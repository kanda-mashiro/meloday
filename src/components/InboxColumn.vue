<script setup lang="ts">
import { computed } from 'vue'
import { useTodoStore } from '../composables/useTodoStore'
import { usePreferences } from '../composables/usePreferences'
import { useInbox } from '../composables/useInbox'
import { INBOX_LIST_ID } from '../lib/constants'
import TodoList from './TodoList.vue'

const store = useTodoStore()
const { prefs } = usePreferences()
const { open, toggle } = useInbox()

const count = computed(() => store.inboxItems.value.length)
</script>

<template>
  <!-- Collapsed rail -->
  <button v-if="!open" class="inbox-rail" type="button" title="展开 Inbox" @click="toggle">
    <svg class="inbox-rail__icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22 12h-6l-2 3h-4l-2-3H2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
    <span v-if="count" class="inbox-rail__count">{{ count }}</span>
    <span class="inbox-rail__label">INBOX</span>
    <span class="inbox-rail__chevron">›</span>
  </button>

  <!-- Expanded column -->
  <section v-else class="inbox-col">
    <header class="inbox-col__header">
      <span class="inbox-col__sub">Quick capture · ⌘K</span>
      <span class="inbox-col__title">
        <svg class="inbox-col__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M22 12h-6l-2 3h-4l-2-3H2" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        Inbox
        <span v-if="count" class="inbox-col__count">{{ count }}</span>
        <button class="inbox-col__collapse" type="button" title="收起 Inbox" @click="toggle">‹</button>
      </span>
    </header>
    <div class="inbox-col__body" :class="{ ruled: prefs.showLines }">
      <TodoList :list-id="INBOX_LIST_ID" :items="store.inboxItems.value" />
    </div>
  </section>
</template>

<style scoped>
/* ---- Collapsed rail ---- */
.inbox-rail {
  position: sticky;
  left: 0;
  z-index: 2;
  display: flex;
  flex: 0 0 2.75rem;
  width: 2.75rem;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  padding: calc(var(--line-h) * 0.9) 0 1rem;
  border: none;
  border-right: 2px solid var(--main-border-light);
  background: color-mix(in srgb, var(--main-text) 5%, var(--main-bg));
  color: var(--highlight-text);
  cursor: pointer;
  font: inherit;
}

.inbox-rail:hover {
  background: color-mix(in srgb, var(--main-text) 9%, var(--main-bg));
}

.inbox-rail__icon {
  width: 1.2rem;
  height: 1.2rem;
}

.inbox-rail__count {
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 0.62rem;
  font-weight: 700;
  line-height: 1.5;
}

.inbox-rail__label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  letter-spacing: 0.18em;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--aside-text);
}

.inbox-rail__chevron {
  margin-top: auto;
  color: var(--disabled-text);
  font-size: 1.1rem;
}

/* ---- Expanded column ---- */
.inbox-col {
  position: sticky;
  left: 0;
  z-index: 2;
  display: flex;
  flex-direction: column;
  flex: 0 0 15rem;
  width: 15rem;
  background: var(--panel-bg);
  background: color-mix(in srgb, var(--main-text) 5%, var(--main-bg));
  border-right: 2px solid var(--main-border-light);
}

.inbox-col__header {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.1rem;
  height: calc(var(--line-h) * 1.6);
  padding: 0 0.85rem 0.5rem;
}

.inbox-col__sub {
  font-size: 0.66rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: var(--aside-text);
}

.inbox-col__title {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 1.25rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--highlight-text);
}

.inbox-col__icon {
  width: 1.05rem;
  height: 1.05rem;
}

.inbox-col__count {
  padding: 0.05rem 0.4rem;
  border-radius: 999px;
  background: var(--accent);
  color: #fff;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1.5;
}

.inbox-col__collapse {
  margin-left: auto;
  width: 1.5rem;
  height: 1.5rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--aside-text);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
}

.inbox-col__collapse:hover {
  background: var(--button-active-bg);
  color: var(--main-text);
}

.inbox-col__body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 62vh;
  padding: 0 0.5rem;
}
</style>
