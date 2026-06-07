import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { User, UserIdentity } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

const user: Ref<User | null> = ref(null)
// false until the initial session check resolves (avoids UI flicker on load).
const ready = ref(false)
// True once we've authenticated with a password this session (skips the
// "set a password" gate without waiting for the metadata round-trip).
const passwordVerified = ref(false)
// Set after a "forgot password" code is verified, so we route the user to the
// set-password screen even though their account already has a password.
const forceSetPassword = ref(false)

// Whether this account has a password set (vs. code-only).
const hasPassword: ComputedRef<boolean> = computed(
  () => passwordVerified.value || Boolean(user.value?.user_metadata?.has_password),
)

let initialized = false

function init(): void {
  if (initialized) return
  initialized = true

  if (!supabase) {
    ready.value = true
    return
  }

  supabase.auth.getSession().then(({ data }) => {
    user.value = data.session?.user ?? null
    ready.value = true
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    user.value = session?.user ?? null
    if (!session) {
      passwordVerified.value = false
      forceSetPassword.value = false
    }
  })
}

init()

export interface AuthResult {
  error: string | null
  message?: string
}

function fail(e: unknown): AuthResult {
  return { error: e instanceof Error ? e.message : String(e) }
}

export function useAuth(): {
  user: Ref<User | null>
  ready: Ref<boolean>
  hasPassword: ComputedRef<boolean>
  forceSetPassword: Ref<boolean>
  isConfigured: boolean
  signInWithPassword: (email: string, password: string) => Promise<AuthResult>
  signInWithOAuth: (provider: 'github' | 'apple' | 'google') => Promise<AuthResult>
  sendCode: (email: string, createUser: boolean) => Promise<AuthResult>
  verifyCode: (email: string, token: string) => Promise<AuthResult>
  markPasswordResetPending: () => void
  setPassword: (password: string) => Promise<AuthResult>
  getIdentities: () => Promise<UserIdentity[]>
  linkOAuth: (provider: 'github' | 'apple' | 'google') => Promise<AuthResult>
  unlinkOAuth: (identity: UserIdentity) => Promise<AuthResult>
  updateEmail: (email: string) => Promise<AuthResult>
  signOut: () => Promise<void>
} {
  return {
    user,
    ready,
    hasPassword,
    forceSetPassword,
    isConfigured: isSupabaseConfigured,

    async signInWithPassword(email, password) {
      if (!supabase) return { error: 'Backend not configured' }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return fail(error)
      passwordVerified.value = true
      if (!data.user?.user_metadata?.has_password) {
        supabase.auth.updateUser({ data: { has_password: true } }).catch(() => {})
      }
      return { error: null }
    },

    // Redirect to a third-party provider; Supabase brings the session back to
    // redirectTo, where onAuthStateChange picks it up. (Configure each provider
    // in the Supabase dashboard first.)
    async signInWithOAuth(provider) {
      if (!supabase) return { error: 'Backend not configured' }
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      })
      return error ? fail(error) : { error: null }
    },

    // Send a 6-digit verification code. createUser=true for signup.
    async sendCode(email, createUser) {
      if (!supabase) return { error: 'Backend not configured' }
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: createUser },
      })
      return error ? fail(error) : { error: null, message: '验证码已发送到邮箱。' }
    },

    // Verify the emailed code; on success a session is established.
    async verifyCode(email, token) {
      if (!supabase) return { error: 'Backend not configured' }
      const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' })
      return error ? fail(error) : { error: null }
    },

    markPasswordResetPending() {
      forceSetPassword.value = true
    },

    async setPassword(password) {
      if (!supabase) return { error: 'Backend not configured' }
      const { error } = await supabase.auth.updateUser({
        password,
        data: { has_password: true },
      })
      if (error) return fail(error)
      passwordVerified.value = true
      forceSetPassword.value = false
      return { error: null }
    },

    // The account's linked sign-in identities (email + any OAuth providers).
    async getIdentities() {
      if (!supabase) return []
      const { data } = await supabase.auth.getUserIdentities()
      return data?.identities ?? []
    },

    // Connect an OAuth provider to the current account. This redirects the
    // browser to the provider; the session returns to redirectTo where
    // onAuthStateChange picks it up. Requires "Manual linking" enabled in the
    // Supabase dashboard (Auth settings) — otherwise this returns an error.
    async linkOAuth(provider) {
      if (!supabase) return { error: 'Backend not configured' }
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo: window.location.origin },
      })
      return error ? fail(error) : { error: null }
    },

    // Remove a linked OAuth identity from the account.
    async unlinkOAuth(identity) {
      if (!supabase) return { error: 'Backend not configured' }
      const { error } = await supabase.auth.unlinkIdentity(identity)
      return error ? fail(error) : { error: null }
    },

    // Change the account email. Supabase sends a confirmation to the new address;
    // the change only takes effect once that link is followed.
    async updateEmail(email) {
      if (!supabase) return { error: 'Backend not configured' }
      const { error } = await supabase.auth.updateUser({ email })
      return error ? fail(error) : { error: null }
    },

    async signOut() {
      if (!supabase) return
      await supabase.auth.signOut()
    },
  }
}
