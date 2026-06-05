<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import AppHeader from './components/AppHeader.vue';
import TodoFrameDays from './components/TodoFrameDays.vue';
import TodoFrameCustom from './components/TodoFrameCustom.vue';
import PreferencesPanel from './components/PreferencesPanel.vue';
import ArchiveView from './components/ArchiveView.vue';
import NotePanel from './components/NotePanel.vue';
import AppBottomBar from './components/AppBottomBar.vue';
import QuickCapture from './components/QuickCapture.vue';
import AuthGate from './components/AuthGate.vue';
import SetPasswordGate from './components/SetPasswordGate.vue';
import { useTagFilter } from './composables/useTagFilter';
import { useQuickCapture } from './composables/useQuickCapture';
import { useAuth } from './composables/useAuth';
import { useSync } from './composables/useSync';
import { tagHue } from './lib/tags';

const { activeTag, clear: clearTag } = useTagFilter();
const { openCapture } = useQuickCapture();
const { user, ready, hasPassword, forceSetPassword } = useAuth();
// Initialize the sync engine (watches auth, owns the per-user cache + cloud).
useSync();
const customOpen = ref(true);
const prefsOpen = ref(false);
const archiveOpen = ref(false);
// Lets a user skip the "set a password" step for this session (code-only login).
const passwordSkipped = ref(false);
// Reset the skip when the account changes, so the next user is prompted.
watch(user, (u) => {
  if (!u) passwordSkipped.value = false;
});

// Global in-app shortcut: Cmd/Ctrl+K opens quick-capture to the Inbox.
function onGlobalKeydown(e: KeyboardEvent): void {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCapture();
  }
}

function toggleCustom(): void {
  customOpen.value = !customOpen.value;
}

onMounted(() => {
  window.addEventListener('keydown', onGlobalKeydown);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onGlobalKeydown);
});
</script>

<template>
  <!-- Waiting for the initial session check. -->
  <div v-if="!ready" class="app-boot" />

  <!-- Auth gate: must be signed in to use the app. -->
  <AuthGate v-else-if="!user" />

  <!-- After signup (or a password reset), set a password before entering. -->
  <SetPasswordGate
    v-else-if="(!hasPassword || forceSetPassword) && !passwordSkipped"
    @skip="passwordSkipped = true"
  />

  <div v-else class="app">
    <div class="app__accent" />

    <AppHeader @preferences="prefsOpen = true" @history="archiveOpen = true" />

    <PreferencesPanel :open="prefsOpen" @close="prefsOpen = false" />

    <ArchiveView :open="archiveOpen" @close="archiveOpen = false" />

    <NotePanel />

    <div v-if="activeTag" class="app__filter">
      <span class="app__filter-text">Focusing</span>
      <span class="tag-chip -on" :style="{ '--tag-h': tagHue(activeTag) }">#{{ activeTag }}</span>
      <button class="app__filter-clear" type="button" @click="clearTag">Clear ✕</button>
    </div>

    <main class="app__main">
      <TodoFrameDays />

      <section class="app__custom">
        <button
          class="app__custom-tab"
          type="button"
          :aria-expanded="customOpen"
          @click="toggleCustom"
        >
          <span class="app__custom-caret" :class="{ '-open': customOpen }">▸</span>
          <span class="app__custom-label">Lists</span>
        </button>
        <div v-show="customOpen" class="app__custom-body">
          <TodoFrameCustom />
        </div>
      </section>
    </main>

    <AppBottomBar />
    <QuickCapture />
  </div>
</template>

<style scoped>
.app-boot {
  min-height: 100vh;
  background: var(--main-bg);
}

.app {
  --bottom-bar-h: 46px;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  /* Reserve room so the fixed bottom bar never covers content. */
  padding-bottom: var(--bottom-bar-h);
  color: var(--main-text);
  background: var(--main-bg);
}

/* Thin warm bar pinned to the very top edge. */
.app__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--accent), var(--amber-strong));
}

.app__main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
}

.app__filter {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 1.25rem;
  border-bottom: 1px solid var(--divider);
  background: var(--accent-soft);
  font-size: 0.82rem;
}

.app__filter-text {
  color: var(--aside-text);
  font-weight: 600;
}

.app__filter-clear {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--aside-text);
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
}

.app__filter-clear:hover {
  color: var(--highlight-text);
}

.app__custom {
  border-top: 1px solid var(--divider);
  background: var(--panel-bg);
}

.app__custom-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding: 0.7rem 1.25rem;
  border: none;
  border-bottom: 2px solid var(--accent);
  background: transparent;
  color: var(--header-text);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  cursor: pointer;
}

.app__custom-caret {
  display: inline-block;
  color: var(--accent);
  transition: transform 0.15s ease;
}

.app__custom-caret.-open {
  transform: rotate(90deg);
}

.app__custom-body {
  width: 100%;
}
</style>
