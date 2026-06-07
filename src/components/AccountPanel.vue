<script setup lang="ts">
import { ref, watch } from 'vue'
import type { UserIdentity } from '@supabase/supabase-js'
import { useAuth } from '../composables/useAuth'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { user, hasPassword, getIdentities, linkOAuth, unlinkOAuth, updateEmail, setPassword } =
  useAuth()

// The connectable OAuth providers, in display order, with their brand SVGs.
const PROVIDERS = [
  { id: 'github', label: 'GitHub' },
  { id: 'google', label: 'Google' },
  { id: 'apple', label: 'Apple' },
] as const
type Provider = (typeof PROVIDERS)[number]['id']

const identities = ref<UserIdentity[]>([])
const loading = ref(false)

// --- Email editing -------------------------------------------------------
const editingEmail = ref(false)
const newEmail = ref('')
const emailBusy = ref(false)
const emailError = ref<string | null>(null)
const emailHint = ref<string | null>(null)

// --- Password ------------------------------------------------------------
const editingPassword = ref(false)
const newPassword = ref('')
const pwBusy = ref(false)
const pwError = ref<string | null>(null)
const pwSaved = ref(false)

// --- Provider rows -------------------------------------------------------
const busyProvider = ref<Provider | null>(null)
const providerError = ref<string | null>(null)

async function loadIdentities(): Promise<void> {
  loading.value = true
  identities.value = await getIdentities()
  loading.value = false
}

// Reset transient state and (re)load identities whenever the panel opens.
watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    editingEmail.value = false
    emailError.value = null
    emailHint.value = null
    editingPassword.value = false
    newPassword.value = ''
    pwError.value = null
    pwSaved.value = false
    providerError.value = null
    void loadIdentities()
  },
  { immediate: true },
)

function identityFor(provider: Provider): UserIdentity | undefined {
  return identities.value.find((i) => i.provider === provider)
}

function emailFor(identity: UserIdentity): string | undefined {
  const data = identity.identity_data
  return typeof data?.email === 'string' ? data.email : undefined
}

function startEditEmail(): void {
  editingEmail.value = true
  emailError.value = null
  emailHint.value = null
  newEmail.value = user.value?.email ?? ''
}

async function onSaveEmail(): Promise<void> {
  const email = newEmail.value.trim()
  if (!email || email === user.value?.email) {
    editingEmail.value = false
    return
  }
  emailBusy.value = true
  emailError.value = null
  const res = await updateEmail(email)
  emailBusy.value = false
  if (res.error) {
    emailError.value = res.error
    return
  }
  editingEmail.value = false
  emailHint.value = '验证邮件已发送到新邮箱，验证后生效。'
}

function startEditPassword(): void {
  editingPassword.value = true
  newPassword.value = ''
  pwError.value = null
  pwSaved.value = false
}

async function onSavePassword(): Promise<void> {
  if (newPassword.value.length < 6) {
    pwError.value = '密码至少 6 位。'
    return
  }
  pwBusy.value = true
  pwError.value = null
  const res = await setPassword(newPassword.value)
  pwBusy.value = false
  if (res.error) {
    pwError.value = res.error
    return
  }
  editingPassword.value = false
  newPassword.value = ''
  pwSaved.value = true
}

// Connect a provider — this redirects the browser, so on success we never get
// back here; only an error (e.g. Manual linking disabled) returns.
async function onConnect(provider: Provider): Promise<void> {
  busyProvider.value = provider
  providerError.value = null
  const res = await linkOAuth(provider)
  busyProvider.value = null
  if (res.error) providerError.value = res.error
}

async function onDisconnect(identity: UserIdentity): Promise<void> {
  // Guard: never remove the last remaining sign-in method.
  if (identities.value.length <= 1) return
  busyProvider.value = identity.provider as Provider
  providerError.value = null
  const res = await unlinkOAuth(identity)
  busyProvider.value = null
  if (res.error) {
    providerError.value = res.error
    return
  }
  await loadIdentities()
}
</script>

<template>
  <div class="acctp" :class="{ '-open': open }">
    <div class="acctp__scrim" @click="emit('close')" />

    <aside class="acctp__panel" role="dialog" aria-label="账号设置">
      <header class="acctp__head">
        <h2 class="acctp__title">账号</h2>
        <button class="acctp__close" type="button" aria-label="关闭" @click="emit('close')">×</button>
      </header>

      <div class="acctp__body">
        <!-- a) Account email — the anchor -->
        <section class="acctp__section">
          <h3 class="acctp__section-title">账号邮箱</h3>
          <p class="acctp__note">邮箱是账号的根，始终可用「邮箱验证码」登录。</p>

          <template v-if="!editingEmail">
            <div class="acctp__field-row">
              <span class="acctp__email">{{ user?.email }}</span>
              <button class="acctp__btn" type="button" @click="startEditEmail">修改邮箱</button>
            </div>
            <p v-if="emailHint" class="acctp__hint">{{ emailHint }}</p>
          </template>

          <template v-else>
            <input
              v-model="newEmail"
              class="acctp__input"
              type="email"
              placeholder="新邮箱"
              autocomplete="email"
              @keydown.enter="onSaveEmail"
            />
            <p v-if="emailError" class="acctp__error">{{ emailError }}</p>
            <div class="acctp__actions">
              <button class="acctp__btn -primary" type="button" :disabled="emailBusy" @click="onSaveEmail">
                保存
              </button>
              <button class="acctp__btn" type="button" :disabled="emailBusy" @click="editingEmail = false">
                取消
              </button>
            </div>
          </template>
        </section>

        <!-- b) Password — an optional shortcut on the email -->
        <section class="acctp__section">
          <h3 class="acctp__section-title">密码</h3>

          <template v-if="!editingPassword">
            <div class="acctp__field-row">
              <span class="acctp__status-text">
                {{ pwSaved || hasPassword ? '已设置密码' : '未设置密码' }}
              </span>
              <button class="acctp__btn" type="button" @click="startEditPassword">
                {{ pwSaved || hasPassword ? '修改密码' : '设置密码' }}
              </button>
            </div>
            <p v-if="pwSaved" class="acctp__hint">已保存。</p>
          </template>

          <template v-else>
            <input
              v-model="newPassword"
              class="acctp__input"
              type="password"
              placeholder="新密码（至少 6 位）"
              autocomplete="new-password"
              @keydown.enter="onSavePassword"
            />
            <p v-if="pwError" class="acctp__error">{{ pwError }}</p>
            <div class="acctp__actions">
              <button class="acctp__btn -primary" type="button" :disabled="pwBusy" @click="onSavePassword">
                保存
              </button>
              <button class="acctp__btn" type="button" :disabled="pwBusy" @click="editingPassword = false">
                取消
              </button>
            </div>
          </template>

          <p class="acctp__note">设置后可用「邮箱+密码」登录；不设也能用验证码。</p>
        </section>

        <!-- c) Sign-in providers — connectable quick sign-in methods -->
        <section class="acctp__section acctp__section--last">
          <h3 class="acctp__section-title">登录方式</h3>

          <p v-if="providerError" class="acctp__error">{{ providerError }}</p>

          <div v-if="loading" class="acctp__note">加载中…</div>

          <div v-else class="acctp__providers">
            <div v-for="p in PROVIDERS" :key="p.id" class="acctp__provider">
              <span class="acctp__provider-ico" aria-hidden="true">
                <svg v-if="p.id === 'github'" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .5C5.73.5.5 5.73.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.23-1.28-5.23-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.69 5.39-5.25 5.68.41.36.78 1.06.78 2.14 0 1.55-.01 2.8-.01 3.18 0 .31.21.68.8.56A11.51 11.51 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z"/></svg>
                <svg v-else-if="p.id === 'google'" viewBox="0 0 24 24" fill="currentColor"><path d="M12 11v3.2h4.5c-.2 1.16-1.4 3.4-4.5 3.4a4.6 4.6 0 0 1 0-9.2c1.43 0 2.4.6 2.95 1.13l2.01-1.94A7.6 7.6 0 0 0 12 4.4a7.6 7.6 0 1 0 0 15.2c4.39 0 7.3-3.08 7.3-7.42 0-.5-.06-.88-.13-1.18H12z"/></svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor"><path d="M16.37 1.43c.06.86-.27 1.7-.83 2.32-.6.66-1.55 1.17-2.46 1.1-.08-.86.32-1.74.85-2.3.6-.64 1.62-1.13 2.44-1.12zM19.7 17.1c-.46 1.07-.68 1.55-1.28 2.49-.83 1.31-2 2.95-3.45 2.96-1.29.01-1.62-.84-3.37-.83-1.75.01-2.12.85-3.41.83-1.45-.02-2.56-1.5-3.4-2.81-2.34-3.67-2.59-7.98-1.14-10.27 1.03-1.63 2.65-2.58 4.17-2.58 1.55 0 2.52.85 3.8.85 1.24 0 2-.85 3.8-.85 1.35 0 2.78.74 3.8 2.01-3.34 1.83-2.8 6.6.88 8.2z"/></svg>
              </span>

              <div class="acctp__provider-text">
                <span class="acctp__provider-name">{{ p.label }}</span>
                <span v-if="identityFor(p.id)" class="acctp__provider-meta">
                  已连接<template v-if="emailFor(identityFor(p.id)!)"> · {{ emailFor(identityFor(p.id)!) }}</template>
                </span>
                <span v-else class="acctp__provider-meta">未连接</span>
              </div>

              <template v-if="identityFor(p.id)">
                <button
                  class="acctp__btn"
                  type="button"
                  :disabled="identities.length <= 1 || busyProvider === p.id"
                  :title="identities.length <= 1 ? '需至少保留一种登录方式' : ''"
                  @click="onDisconnect(identityFor(p.id)!)"
                >
                  断开
                </button>
              </template>
              <button
                v-else
                class="acctp__btn -primary"
                type="button"
                :disabled="busyProvider === p.id"
                @click="onConnect(p.id)"
              >
                连接
              </button>
            </div>
          </div>
        </section>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.acctp {
  position: fixed;
  inset: 0;
  z-index: 50;
  pointer-events: none;
}

.acctp__scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.28);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.acctp__panel {
  position: absolute;
  top: 0;
  left: 0;
  width: min(380px, 90vw);
  height: 100%;
  background: var(--panel-bg);
  border-right: 1px solid var(--divider);
  box-shadow: 0 0 40px rgba(0, 0, 0, 0.12);
  transform: translateX(-100%);
  transition: transform 0.22s ease;
  display: flex;
  flex-direction: column;
}

.acctp.-open {
  pointer-events: auto;
}

.acctp.-open .acctp__scrim {
  opacity: 1;
}

.acctp.-open .acctp__panel {
  transform: translateX(0);
}

.acctp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.25rem 0.75rem;
}

.acctp__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--main-text);
}

.acctp__close {
  border: none;
  background: transparent;
  color: var(--aside-text);
  font-size: 1.5rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.25rem;
}

.acctp__close:hover {
  color: var(--main-text);
}

.acctp__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0.5rem 1.25rem 2rem;
}

.acctp__section {
  padding: 1rem 0;
  border-bottom: 1px solid var(--divider);
}

.acctp__section--last {
  border-bottom: none;
}

.acctp__section-title {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--main-text);
}

.acctp__note {
  margin: 0.5rem 0 0;
  font-size: 0.75rem;
  line-height: 1.5;
  color: var(--aside-text);
}

.acctp__hint {
  margin: 0.45rem 0 0;
  font-size: 0.76rem;
  color: var(--accent);
}

.acctp__error {
  margin: 0.45rem 0 0;
  font-size: 0.76rem;
  color: var(--highlight-text);
}

.acctp__field-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.acctp__email,
.acctp__status-text {
  font-size: 0.84rem;
  color: var(--main-text);
  word-break: break-all;
  min-width: 0;
}

.acctp__input {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.55rem 0.7rem;
  border: 1px solid var(--main-border-light);
  border-radius: 8px;
  background: var(--main-bg);
  color: var(--main-text);
  font: inherit;
  font-size: 0.84rem;
  outline: none;
}

.acctp__input:focus {
  border-color: var(--accent);
}

.acctp__actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.6rem;
}

.acctp__btn {
  flex: none;
  padding: 0.4rem 0.7rem;
  border: 1px solid var(--main-border-light);
  border-radius: 7px;
  background: transparent;
  color: var(--aside-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.12s ease, color 0.12s ease, background-color 0.12s ease;
}

.acctp__btn:hover:not(:disabled) {
  color: var(--highlight-text);
  border-color: var(--highlight-text);
}

.acctp__btn.-primary {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.acctp__btn.-primary:hover:not(:disabled) {
  color: #fff;
}

.acctp__btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.acctp__providers {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.6rem;
}

.acctp__provider {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.55rem 0.4rem;
  border-radius: 8px;
}

.acctp__provider-ico {
  display: inline-flex;
  flex: none;
  color: var(--main-text);
}

.acctp__provider-ico svg {
  width: 1.2rem;
  height: 1.2rem;
  display: block;
}

.acctp__provider-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1 1 auto;
}

.acctp__provider-name {
  font-size: 0.84rem;
  font-weight: 600;
  color: var(--main-text);
}

.acctp__provider-meta {
  font-size: 0.72rem;
  color: var(--aside-text);
  word-break: break-all;
}
</style>
