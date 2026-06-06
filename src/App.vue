<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch, computed } from 'vue';
import AppHeader from './components/AppHeader.vue';
import TodoFrameDays from './components/TodoFrameDays.vue';
import TodoFrameCustom from './components/TodoFrameCustom.vue';
import PreferencesPanel from './components/PreferencesPanel.vue';
import ArchiveView from './components/ArchiveView.vue';
import NotePanel from './components/NotePanel.vue';
import FocusSession from './components/FocusSession.vue';
import Toast from './components/Toast.vue';
import ShortcutsHelp from './components/ShortcutsHelp.vue';
import AppBottomBar from './components/AppBottomBar.vue';
import QuickCapture from './components/QuickCapture.vue';
import AuthGate from './components/AuthGate.vue';
import SetPasswordGate from './components/SetPasswordGate.vue';
import { useTagFilter } from './composables/useTagFilter';
import { useQuickCapture } from './composables/useQuickCapture';
import { useAuth } from './composables/useAuth';
import { useSync } from './composables/useSync';
import { usePreferences } from './composables/usePreferences';
import { useTodoStore } from './composables/useTodoStore';
import { useSelection } from './composables/useSelection';
import { useHelp } from './composables/useHelp';
import { tagHue } from './lib/tags';

const { activeTag, clear: clearTag } = useTagFilter();
const { openCapture } = useQuickCapture();
const { user, ready, hasPassword, forceSetPassword } = useAuth();
// Initialize the sync engine (watches auth, owns the per-user cache + cloud).
useSync();
const { prefs } = usePreferences();
const store = useTodoStore();
const selection = useSelection();
const { toggleHelp } = useHelp();
// The single-day view is a distraction-free focus mode: hide the global header
// and the Lists section so only the day's card shows. The bottom bar stays
// (its column switcher is how you leave focus mode).
const focusMode = computed(() => prefs.columns === 1);
const customOpen = ref(true);
const prefsOpen = ref(false);
const archiveOpen = ref(false);
// Lets a user skip the "set a password" step for this session (code-only login).
const passwordSkipped = ref(false);
// Reset the skip when the account changes, so the next user is prompted.
watch(user, (u) => {
  if (!u) passwordSkipped.value = false;
});

// Arrow keys and vim hjkl both map to a direction: h/← left, l/→ right, j/↓ down,
// k/↑ up.
const DIR_KEYS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  arrowup: 'up',
  k: 'up',
  arrowdown: 'down',
  j: 'down',
  arrowleft: 'left',
  h: 'left',
  arrowright: 'right',
  l: 'right',
};

// Move the selected board item one step in a direction. Returns false if there is
// no selection or it isn't a day item (so the caller falls back to date nav).
function moveSelectedItem(dir: 'up' | 'down' | 'left' | 'right'): boolean {
  const id = selection.selectedId.value;
  if (!id) return false;
  const days = store.days.value;
  let di = -1;
  let ii = -1;
  for (let d = 0; d < days.length; d++) {
    const idx = days[d].items.findIndex((it) => it.id === id);
    if (idx !== -1) {
      di = d;
      ii = idx;
      break;
    }
  }
  if (di === -1) return false;
  const day = days[di];
  if (dir === 'up') {
    if (ii > 0) store.moveItem({ id, listId: day.id, index: ii - 1 });
    return true;
  }
  if (dir === 'down') {
    if (ii < day.items.length - 1) store.moveItem({ id, listId: day.id, index: ii + 1 });
    return true;
  }
  const dd = dir === 'left' ? di - 1 : di + 1;
  if (dd < 0 || dd >= days.length) return true;
  const dest = days[dd];
  store.moveItem({ id, listId: dest.id, index: dest.items.length });
  // Follow the item if its new day fell outside the visible window.
  const at = days.findIndex((d) => d.id === store.state.at);
  const lead = prefs.startOn === 'yesterday' ? 1 : 0;
  const from = Math.max(0, (at < 0 ? 0 : at) - lead);
  if (dd < from || dd >= from + prefs.columns) {
    store.seekDays(dir === 'left' ? -1 : 1);
  }
  return true;
}

// Global in-app shortcut: Cmd/Ctrl+K opens quick-capture to the Inbox.
function onGlobalKeydown(e: KeyboardEvent): void {
  // Esc stays available for in-app use (closing menus, leaving a focus session),
  // but kill its browser default — in Safari a stray Esc exits fullscreen, which
  // is jarring mid-session. Skip form fields, where Esc legitimately cancels.
  if (e.key === 'Escape') {
    const el = e.target as HTMLElement;
    if (el.tagName !== 'INPUT' && el.tagName !== 'TEXTAREA' && !el.isContentEditable) {
      e.preventDefault();
    }
    return;
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    openCapture();
    return;
  }
  // ? opens or closes the shortcuts help (Shift+/ on most layouts).
  if (e.key === '?') {
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
    e.preventDefault();
    toggleHelp();
    return;
  }
  // Directional keys — arrows or vim hjkl. With a board item selected they move
  // it: up/down reorder within the day, left/right shift it to the prev/next day
  // (the board follows if it scrolls off). With nothing selected, left/right
  // navigate the date (Shift = a week), like ‹ › « ». Skipped while typing.
  const dir = DIR_KEYS[e.key.toLowerCase()];
  if (dir) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
    if (selection.selectedId.value && moveSelectedItem(dir)) {
      e.preventDefault();
      return;
    }
    if (dir === 'left' || dir === 'right') {
      e.preventDefault();
      store.seekDays((dir === 'left' ? -1 : 1) * (e.shiftKey ? 7 : 1));
    }
    return;
  }
  // 1 / 3 / 5 / 7 switch the day-column count — but not while typing in a field
  // and not when a modifier is held (so ⌘1 etc. stay with the browser).
  if (!e.metaKey && !e.ctrlKey && !e.altKey && ['1', '3', '5', '7'].includes(e.key)) {
    const el = e.target as HTMLElement;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return;
    prefs.columns = Number(e.key);
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

    <AppHeader v-if="!focusMode" @preferences="prefsOpen = true" @history="archiveOpen = true" />

    <PreferencesPanel :open="prefsOpen" @close="prefsOpen = false" />

    <ArchiveView :open="archiveOpen" @close="archiveOpen = false" />

    <NotePanel />

    <FocusSession />

    <Toast />

    <ShortcutsHelp />

    <div v-if="activeTag" class="app__filter">
      <span class="app__filter-text">Focusing</span>
      <span class="tag-chip -on" :style="{ '--tag-h': tagHue(activeTag) }">#{{ activeTag }}</span>
      <button class="app__filter-clear" type="button" @click="clearTag">Clear ✕</button>
    </div>

    <main class="app__main">
      <TodoFrameDays />

      <section v-if="!focusMode" class="app__custom">
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
