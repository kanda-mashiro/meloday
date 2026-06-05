<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuth } from '../composables/useAuth'

const emit = defineEmits<{ skip: [] }>()

const { user, setPassword } = useAuth()

const password = ref('')
const confirm = ref('')
const busy = ref(false)
const error = ref<string | null>(null)

const tooShort = computed(() => password.value.length > 0 && password.value.length < 6)
const mismatch = computed(() => confirm.value.length > 0 && confirm.value !== password.value)
const canSubmit = computed(
  () => password.value.length >= 6 && confirm.value === password.value && !busy.value,
)

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  busy.value = true
  error.value = null
  const res = await setPassword(password.value)
  busy.value = false
  if (res.error) error.value = res.error
  // On success, hasPassword flips true and this gate unmounts.
}
</script>

<template>
  <div class="setpw">
    <div class="setpw__accent" />
    <div class="setpw__card">
      <h1 class="setpw__brand">MY&nbsp;TODO</h1>
      <p class="setpw__tag">最后一步:给账号设置一个密码,以后可直接用密码登录。</p>
      <p class="setpw__email">{{ user?.email }}</p>

      <input
        v-model="password"
        class="setpw__input"
        type="password"
        placeholder="设置密码(至少 6 位)"
        autocomplete="new-password"
      />
      <input
        v-model="confirm"
        class="setpw__input"
        type="password"
        placeholder="再次输入密码"
        autocomplete="new-password"
        @keydown.enter="submit"
      />

      <p v-if="tooShort" class="setpw__error">密码至少 6 位。</p>
      <p v-else-if="mismatch" class="setpw__error">两次输入不一致。</p>
      <p v-else-if="error" class="setpw__error">{{ error }}</p>

      <button class="setpw__primary" type="button" :disabled="!canSubmit" @click="submit">
        设置密码并进入
      </button>
      <button class="setpw__link" type="button" :disabled="busy" @click="emit('skip')">
        以后再说(仅用邮箱链接登录)
      </button>
    </div>
  </div>
</template>

<style scoped>
.setpw {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--main-bg);
  color: var(--main-text);
}

.setpw__accent {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent), var(--amber-strong));
}

.setpw__card {
  width: min(380px, 92vw);
  padding: 2rem;
  border: 1px solid var(--main-border-light);
  border-radius: 14px;
  background: var(--panel-bg);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.25);
}

.setpw__brand {
  margin: 0;
  text-align: center;
  font-size: 1.4rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-indent: 0.28em;
  text-transform: uppercase;
  color: var(--accent);
}

.setpw__tag {
  margin: 0.5rem 0 0.4rem;
  text-align: center;
  font-size: 0.82rem;
  color: var(--aside-text);
}

.setpw__email {
  margin: 0 0 1.2rem;
  text-align: center;
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--main-text);
}

.setpw__input {
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

.setpw__input:focus {
  border-color: var(--accent);
}

.setpw__error {
  margin: 0 0 0.6rem;
  font-size: 0.8rem;
  color: var(--highlight-text);
}

.setpw__primary {
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

.setpw__primary:disabled {
  opacity: 0.5;
  cursor: default;
}

.setpw__link {
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

.setpw__link:disabled {
  opacity: 0.5;
  cursor: default;
}

.setpw__link:not(:disabled):hover {
  color: var(--highlight-text);
}
</style>
