<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const { isConfigured, signInWithPassword, signInWithOAuth, sendCode, verifyCode, markPasswordResetPending } =
  useAuth()

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

async function onOAuth(provider: 'github' | 'apple' | 'google'): Promise<void> {
  busy.value = true
  error.value = null
  const res = await signInWithOAuth(provider)
  // On success the browser redirects to the provider; only errors return here.
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

        <div class="gate__or"><span>或</span></div>
        <button class="gate__oauth" type="button" :disabled="busy" @click="onOAuth('github')">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"/></svg>
          使用 GitHub 继续
        </button>
        <button class="gate__oauth" type="button" :disabled="busy" @click="onOAuth('apple')">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.37 1.43c.06.86-.27 1.7-.83 2.32-.6.66-1.55 1.17-2.46 1.1-.08-.86.32-1.74.85-2.3.6-.64 1.62-1.13 2.44-1.12zM19.7 17.1c-.46 1.07-.68 1.55-1.28 2.49-.83 1.31-2 2.95-3.45 2.96-1.29.01-1.62-.84-3.37-.83-1.75.01-2.12.85-3.41.83-1.45-.02-2.56-1.5-3.4-2.81-2.34-3.67-2.59-7.98-1.14-10.27 1.03-1.63 2.65-2.58 4.17-2.58 1.55 0 2.52.85 3.8.85 1.24 0 2-.85 3.8-.85 1.35 0 2.78.74 3.8 2.01-3.34 1.83-2.8 6.6.88 8.2z"/></svg>
          使用 Apple 继续
        </button>
        <button class="gate__oauth" type="button" :disabled="busy" @click="onOAuth('google')">
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 11v3.2h4.5c-.2 1.16-1.4 3.4-4.5 3.4a4.6 4.6 0 0 1 0-9.2c1.43 0 2.4.6 2.95 1.13l2.01-1.94A7.6 7.6 0 0 0 12 4.4a7.6 7.6 0 1 0 0 15.2c4.39 0 7.3-3.08 7.3-7.42 0-.5-.06-.88-.13-1.18H12z"/></svg>
          使用 Google 继续
        </button>
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

.gate__or {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin: 1.1rem 0 0.8rem;
  color: var(--aside-text);
  font-size: 0.74rem;
}

.gate__or::before,
.gate__or::after {
  content: '';
  flex: 1 1 auto;
  height: 1px;
  background: var(--divider);
}

.gate__oauth {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.55rem;
  width: 100%;
  margin-bottom: 0.5rem;
  padding: 0.6rem;
  border: 1px solid var(--main-border-light);
  border-radius: 8px;
  background: var(--main-bg);
  color: var(--main-text);
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.12s ease, background-color 0.12s ease;
}

.gate__oauth:hover:not(:disabled) {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.gate__oauth:disabled {
  opacity: 0.5;
  cursor: default;
}

.gate__oauth svg {
  width: 1.05rem;
  height: 1.05rem;
  display: block;
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
