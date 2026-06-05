<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const { isConfigured, signInWithPassword, sendCode, verifyCode, markPasswordResetPending } = useAuth()

// login: email+password · signup/reset: email→code · code: enter the 6 digits
type View = 'login' | 'signup' | 'reset' | 'code'
const view = ref<View>('login')
const flow = ref<'signup' | 'reset'>('signup')

const email = ref('')
const password = ref('')
const code = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

const cooldown = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const codeReady = computed(() => /^\d{6}$/.test(code.value))

function startCooldown(seconds = 60): void {
  cooldown.value = seconds
  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    cooldown.value -= 1
    if (cooldown.value <= 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }, 1000)
}
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

function go(next: View): void {
  view.value = next
  error.value = null
}

async function onLogin(): Promise<void> {
  busy.value = true
  error.value = null
  const res = await signInWithPassword(email.value.trim(), password.value)
  busy.value = false
  if (res.error) error.value = res.error
}

async function startCode(which: 'signup' | 'reset'): Promise<void> {
  busy.value = true
  error.value = null
  const res = await sendCode(email.value.trim(), which === 'signup')
  busy.value = false
  if (res.error) {
    error.value = res.error
    return
  }
  flow.value = which
  code.value = ''
  go('code')
  startCooldown()
}

async function onResend(): Promise<void> {
  if (cooldown.value > 0 || busy.value) return
  busy.value = true
  error.value = null
  const res = await sendCode(email.value.trim(), flow.value === 'signup')
  busy.value = false
  if (res.error) error.value = res.error
  else startCooldown()
}

async function onVerify(): Promise<void> {
  if (!codeReady.value) return
  busy.value = true
  error.value = null
  // For a password reset, route to the set-password screen after verifying.
  if (flow.value === 'reset') markPasswordResetPending()
  const res = await verifyCode(email.value.trim(), code.value.trim())
  busy.value = false
  if (res.error) error.value = res.error
  // On success a session is established and the app takes over.
}
</script>

<template>
  <div class="gate">
    <div class="gate__accent" />
    <div class="gate__card">
      <h1 class="gate__brand">MY&nbsp;TODO</h1>
      <p class="gate__tag">登录后开始,你的数据会自动跨设备同步。</p>

      <p v-if="!isConfigured" class="gate__warn">
        尚未配置后端。请在 <code>.env</code> 设置 <code>VITE_SUPABASE_URL</code> 和
        <code>VITE_SUPABASE_ANON_KEY</code> 后重启。
      </p>

      <!-- Enter the 6-digit code -->
      <template v-else-if="view === 'code'">
        <div class="gate__code">
          <p class="gate__code-title">输入验证码</p>
          <p class="gate__code-text">已发送 6 位验证码至 <b>{{ email.trim() }}</b></p>

          <input
            v-model="code"
            class="gate__input gate__code-input"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            placeholder="6 位数字"
            @keydown.enter="onVerify"
          />

          <p v-if="error" class="gate__error">{{ error }}</p>

          <button class="gate__primary" type="button" :disabled="busy || !codeReady" @click="onVerify">
            {{ flow === 'reset' ? '验证并设置新密码' : '验证并继续' }}
          </button>
          <button class="gate__link" type="button" :disabled="busy || cooldown > 0" @click="onResend">
            {{ cooldown > 0 ? `重新发送 (${cooldown})` : '没收到?重新发送' }}
          </button>
          <button class="gate__link" type="button" @click="go(flow === 'reset' ? 'reset' : 'signup')">
            ← 换个邮箱
          </button>
        </div>
      </template>

      <!-- Forgot password: email → code -->
      <template v-else-if="view === 'reset'">
        <p class="gate__code-title">重置密码</p>
        <input
          v-model="email"
          class="gate__input"
          type="email"
          placeholder="邮箱"
          autocomplete="email"
          @keydown.enter="startCode('reset')"
        />
        <p v-if="error" class="gate__error">{{ error }}</p>
        <p v-else class="gate__hint">我们会发一个验证码,验证后即可设置新密码。</p>
        <button class="gate__primary" type="button" :disabled="busy || !email" @click="startCode('reset')">
          发送验证码
        </button>
        <button class="gate__link" type="button" @click="go('login')">← 返回登录</button>
      </template>

      <!-- Login / signup tabs -->
      <template v-else>
        <div class="gate__tabs">
          <button class="gate__tab" :class="{ '-active': view === 'login' }" type="button" @click="go('login')">
            登录
          </button>
          <button class="gate__tab" :class="{ '-active': view === 'signup' }" type="button" @click="go('signup')">
            注册
          </button>
        </div>

        <!-- Login: email + password -->
        <template v-if="view === 'login'">
          <input
            v-model="email"
            class="gate__input"
            type="email"
            placeholder="邮箱"
            autocomplete="email"
          />
          <input
            v-model="password"
            class="gate__input"
            type="password"
            placeholder="密码"
            autocomplete="current-password"
            @keydown.enter="onLogin"
          />
          <p v-if="error" class="gate__error">{{ error }}</p>
          <button class="gate__primary" type="button" :disabled="busy || !email || !password" @click="onLogin">
            登录
          </button>
          <button class="gate__link" type="button" @click="go('reset')">忘记密码?</button>
        </template>

        <!-- Signup: email → code → set password -->
        <template v-else>
          <input
            v-model="email"
            class="gate__input"
            type="email"
            placeholder="邮箱"
            autocomplete="email"
            @keydown.enter="startCode('signup')"
          />
          <p v-if="error" class="gate__error">{{ error }}</p>
          <p v-else class="gate__hint">我们会发一个验证码,验证后设置密码即完成注册。</p>
          <button class="gate__primary" type="button" :disabled="busy || !email" @click="startCode('signup')">
            发送验证码
          </button>
        </template>
      </template>
    </div>
  </div>
</template>

<style scoped>
.gate {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--main-bg);
  color: var(--main-text);
}

.gate__accent {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent), var(--amber-strong));
}

.gate__card {
  width: min(380px, 92vw);
  padding: 2rem;
  border: 1px solid var(--main-border-light);
  border-radius: 14px;
  background: var(--panel-bg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
}

.gate__brand {
  margin: 0;
  text-align: center;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-indent: 0.28em;
  text-transform: uppercase;
  color: var(--accent);
}

.gate__tag {
  margin: 0.5rem 0 1.3rem;
  text-align: center;
  font-size: 0.82rem;
  color: var(--aside-text);
}

.gate__warn {
  margin: 0;
  font-size: 0.84rem;
  line-height: 1.6;
  color: var(--aside-text);
}

.gate__warn code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  color: var(--highlight-text);
}

.gate__tabs {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 1.2rem;
  padding: 0.25rem;
  border-radius: 9px;
  background: var(--main-bg);
}

.gate__tab {
  flex: 1 1 0;
  padding: 0.45rem;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
}

.gate__tab.-active {
  background: var(--panel-bg);
  color: var(--main-text);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.gate__input {
  width: 100%;
  margin-bottom: 0.6rem;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--main-border-light);
  border-radius: 8px;
  background: var(--main-bg);
  color: var(--main-text);
  font: inherit;
  outline: none;
}

.gate__input:focus {
  border-color: var(--accent);
}

.gate__code-input {
  text-align: center;
  font-size: 1.5rem;
  letter-spacing: 0.6em;
  text-indent: 0.6em;
  font-variant-numeric: tabular-nums;
}

.gate__error {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  color: var(--highlight-text);
}

.gate__hint {
  margin: 0 0 0.6rem;
  font-size: 0.78rem;
  color: var(--aside-text);
}

.gate__primary {
  width: 100%;
  padding: 0.65rem;
  border: none;
  border-radius: 8px;
  background: var(--accent);
  color: #fff;
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}

.gate__primary:disabled {
  opacity: 0.5;
  cursor: default;
}

.gate__link {
  display: block;
  width: 100%;
  margin-top: 0.7rem;
  border: none;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
}

.gate__link:disabled {
  opacity: 0.5;
  cursor: default;
}

.gate__link:not(:disabled):hover {
  color: var(--highlight-text);
}

.gate__code {
  text-align: center;
}

.gate__code-title {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--main-text);
}

.gate__code-text {
  margin: 0 0 1rem;
  font-size: 0.84rem;
  color: var(--aside-text);
}

.gate__code-text b {
  color: var(--main-text);
}
</style>
