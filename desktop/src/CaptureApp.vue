<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import type { User } from '@supabase/supabase-js'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { supabase, isConfigured, appendInboxItem } from './supabase'
import { buildLabel, tagHue, priorityLevel } from './tags'

const appWindow = getCurrentWindow()

// The capture bar is a thin strip; the login form needs more vertical room.
// Width stays 640 to respect the window's minWidth.
const CAPTURE_SIZE = new LogicalSize(640, 72)
const LOGIN_SIZE = new LogicalSize(640, 240)

async function applySize(): Promise<void> {
  await appWindow.setSize(user.value ? CAPTURE_SIZE : LOGIN_SIZE)
  await appWindow.center()
}

const ready = ref(false)
const user = ref<User | null>(null)

// Login form
const email = ref('')
const password = ref('')
const loginError = ref<string | null>(null)
const busy = ref(false)

// Capture — same tag/body input model as the web board (TodoItemInput): type '#'
// to enter tag mode, Enter seals a tag into a chip, Enter again saves to Inbox.
const tags = ref<string[]>([])
const text = ref('')
const mode = ref<'body' | 'tag'>('body')
const inputEl = ref<HTMLInputElement | null>(null)
const flash = ref<string | null>(null)
const queuedCount = ref(0)

const placeholder = computed(() =>
  mode.value === 'tag'
    ? '标签…（回车封存）'
    : tags.value.length
      ? '要做什么…'
      : '记点什么… #标签 13:30，回车存入 Inbox',
)

// A leading '#' / fullwidth '＃' (Chinese IME) starts a tag; strip the marker.
watch(text, (val) => {
  if (mode.value === 'body' && (val[0] === '#' || val[0] === '＃')) {
    mode.value = 'tag'
    text.value = val.slice(1)
  }
})

const QUEUE_KEY = 'mytodo-capture-queue'

function readQueue(): string[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}
function writeQueue(q: string[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch {
    // ignore
  }
  queuedCount.value = q.length
}

async function flushQueue(): Promise<void> {
  if (!user.value) return
  let q = readQueue()
  while (q.length) {
    const next = q[0]
    const { error } = await appendInboxItem(next)
    if (error) break // still offline / failing; keep the rest queued
    q = q.slice(1)
    writeQueue(q)
  }
}

function focusInput(): void {
  nextTick(() => inputEl.value?.focus())
}

async function onCapture(): Promise<void> {
  const label = buildLabel(tags.value, text.value)
  if (!label) return
  tags.value = []
  text.value = ''
  mode.value = 'body'
  const { error } = await appendInboxItem(label)
  if (!error) {
    flash.value = '✓ 已加入 Inbox'
    void flushQueue() // drain any backlog now that the server is reachable
  } else if (!navigator.onLine) {
    // Genuinely offline → keep it for later auto-sync.
    writeQueue([...readQueue(), label])
    flash.value = '已离线保存,稍后自动同步'
  } else {
    // Online but the server rejected it (e.g. RPC missing / auth) → surface the
    // real reason. Don't queue: retrying won't help until it's fixed.
    flash.value = `保存失败:${error}`
  }
  focusInput()
  window.setTimeout(() => (flash.value = null), error ? 5000 : 1600)
}

// Tag-mode key handling, ported from the web TodoItemInput. (Esc isn't handled
// here, so it bubbles to the root and hides the panel.)
function onKeydown(e: KeyboardEvent): void {
  if (e.isComposing || e.keyCode === 229) return
  if ((e.key === '#' || e.key === '＃') && mode.value === 'body' && text.value === '') {
    e.preventDefault()
    mode.value = 'tag'
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (mode.value === 'tag') sealTag()
    else void onCapture()
    return
  }
  if (e.key === 'Backspace') {
    if (mode.value === 'tag' && text.value === '') {
      e.preventDefault()
      mode.value = 'body'
      return
    }
    if (mode.value === 'body' && text.value === '' && tags.value.length) {
      e.preventDefault()
      mode.value = 'tag'
      text.value = tags.value.pop() ?? ''
    }
  }
}

function sealTag(): void {
  const name = text.value.trim()
  if (name) tags.value.push(name)
  text.value = ''
  mode.value = 'body'
}

function removeTag(index: number): void {
  tags.value.splice(index, 1)
  focusInput()
}

async function onLogin(): Promise<void> {
  if (!supabase) return
  busy.value = true
  loginError.value = null
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value,
  })
  busy.value = false
  if (error) loginError.value = error.message
}

function hideWindow(): void {
  appWindow.hide()
}

onMounted(async () => {
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    user.value = data.session?.user ?? null
    supabase.auth.onAuthStateChange((_e, session) => {
      const wasLoggedIn = user.value !== null
      user.value = session?.user ?? null
      const isLoggedIn = user.value !== null
      if (isLoggedIn !== wasLoggedIn) applySize()
      if (session) {
        flushQueue()
        focusInput()
      }
    })
  }
  ready.value = true
  queuedCount.value = readQueue().length
  await applySize()
  flushQueue()
  focusInput()

  // The native NSPanel delegate (Rust) hides the panel when it loses key focus,
  // so we only need to re-focus the capture input whenever the panel is shown
  // again. `panel.show()` makes the webview first responder, so the web content
  // receives focus / visibility events.
  window.addEventListener('focus', focusInput)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') focusInput()
  })
})
</script>

<template>
  <div class="cap" @keydown.esc="hideWindow">
    <div v-if="!ready" class="cap__boot" />

    <div v-else-if="!isConfigured" class="cap__notice">
      未配置后端,请在 desktop/.env 设置 Supabase 变量后重启。
    </div>

    <!-- Login (once) -->
    <form v-else-if="!user" class="cap__login" @submit.prevent="onLogin">
      <div class="cap__brand">MyTodo · 登录</div>
      <input v-model="email" class="cap__field" type="email" placeholder="邮箱" autocomplete="email" />
      <input v-model="password" class="cap__field" type="password" placeholder="密码" autocomplete="current-password" />
      <p v-if="loginError" class="cap__error">{{ loginError }}</p>
      <button class="cap__btn" type="submit" :disabled="busy || !email || !password">登录</button>
    </form>

    <!-- Capture -->
    <div v-else class="cap__capture" @click="focusInput">
      <span class="cap__bullet">›</span>

      <span
        v-for="(t, i) in tags"
        :key="i"
        :class="priorityLevel(t) ? ['cap__prio', `-${priorityLevel(t)}`] : 'cap__chip'"
        :style="priorityLevel(t) ? undefined : { '--tag-h': tagHue(t) }"
      >{{ priorityLevel(t) ? priorityLevel(t)?.toUpperCase() : '#' + t }}<button
          class="cap__chip-x"
          type="button"
          aria-label="移除标签"
          @click.stop="removeTag(i)"
        >×</button></span>

      <span v-if="mode === 'tag'" class="cap__hash">#</span>

      <input
        ref="inputEl"
        v-model="text"
        class="cap__input"
        :class="{ '-tag': mode === 'tag' }"
        type="text"
        :placeholder="placeholder"
        autocomplete="off"
        @keydown="onKeydown"
      />
      <span v-if="flash" class="cap__flash">{{ flash }}</span>
      <span v-else-if="queuedCount" class="cap__queued">待同步 {{ queuedCount }}</span>
    </div>
  </div>
</template>

<style scoped>
.cap {
  height: 100vh;
  display: flex;
  align-items: center;
  padding: 0;
}

.cap__boot,
.cap__notice {
  width: 100%;
  text-align: center;
  color: #9a9da6;
  font-size: 0.85rem;
}

.cap__capture {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  padding: 0 1.1rem;
}

.cap__bullet {
  flex: 0 0 auto;
  color: #e8b552;
  font-size: 1.4rem;
  font-weight: 700;
  user-select: none;
}

.cap__chip {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  padding: 0.08rem 0.5rem;
  border-radius: 7px;
  font-size: 1rem;
  font-weight: 600;
  background: hsl(var(--tag-h, 40) 32% 26%);
  color: hsl(var(--tag-h, 40) 80% 82%);
}

.cap__prio {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  padding: 0.08rem 0.5rem;
  border-radius: 6px;
  font-size: 0.95rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #fff;
}

.cap__prio.-p0 {
  background: #e0524e;
}

.cap__prio.-p1 {
  background: #e07b39;
}

.cap__prio.-p2 {
  background: #6b7a90;
}

.cap__chip-x {
  margin-left: 0.25em;
  border: none;
  background: transparent;
  color: inherit;
  opacity: 0.65;
  font-size: 1em;
  line-height: 1;
  padding: 0;
  cursor: pointer;
}

.cap__chip-x:hover {
  opacity: 1;
}

.cap__hash {
  flex: 0 0 auto;
  margin-right: -0.15rem;
  color: #e8b552;
  font-size: 1.05rem;
  opacity: 0.85;
}

.cap__input {
  flex: 1 1 auto;
  border: none;
  background: transparent;
  color: #f3f3f5;
  font-size: 1.2rem;
  outline: none;
}

.cap__input::placeholder {
  color: #6c6f78;
  font-size: 0.95rem;
}

.cap__input.-tag {
  color: #e8b552;
  font-weight: 600;
}

.cap__flash {
  flex: 0 0 auto;
  color: #e8b552;
  font-size: 0.8rem;
  white-space: nowrap;
}

.cap__queued {
  flex: 0 0 auto;
  color: #9a9da6;
  font-size: 0.78rem;
  white-space: nowrap;
}

.cap__login {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 100%;
  padding: 0 1.1rem;
}

.cap__brand {
  color: #e8b552;
  font-weight: 700;
  letter-spacing: 0.1em;
  font-size: 0.8rem;
}

.cap__field {
  padding: 0.5rem 0.6rem;
  border: 1px solid #34343c;
  border-radius: 7px;
  background: #1c1c21;
  color: #f3f3f5;
  font-size: 0.9rem;
  outline: none;
}

.cap__field:focus {
  border-color: #e8b552;
}

.cap__error {
  margin: 0;
  color: #e8835a;
  font-size: 0.78rem;
}

.cap__btn {
  padding: 0.5rem;
  border: none;
  border-radius: 7px;
  background: #e8b552;
  color: #16161a;
  font-weight: 600;
  cursor: pointer;
}

.cap__btn:disabled {
  opacity: 0.5;
}
</style>
