<script setup lang="ts">
import { computed, ref, onBeforeUnmount } from 'vue'
import { useOccasions } from '../composables/useOccasions'
import { useImeEnter } from '../composables/useImeEnter'

// `reveal` is the parent's "header is hovered" signal: the icon stays hidden
// until the header is hovered, EXCEPT on days that already have an occasion
// (those keep it visible as a marker), or while its popover is open.
const props = defineProps<{ date: Date; reveal?: boolean }>()
const { occasionsOn, addOccasion, removeOccasion } = useOccasions()
const { onCompositionEnd, isImeEnter } = useImeEnter()

// The viewed date's month/day, used to look up and create occasions for it.
const viewedMonth = computed(() => props.date.getMonth() + 1)
const viewedDay = computed(() => props.date.getDate())
const dayOccasions = computed(() => occasionsOn(viewedMonth.value, viewedDay.value))
const hasOccasions = computed(() => dayOccasions.value.length > 0)

const popoverOpen = ref(false)

// Visible when the header is hovered, or the day is special, or we're editing it.
const visible = computed(() => hasOccasions.value || popoverOpen.value || !!props.reveal)
const newName = ref('')
const wrapRef = ref<HTMLElement | null>(null)

// Close on any click outside the popover/icon (added only while open).
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node | null
  if (wrapRef.value && target && !wrapRef.value.contains(target)) {
    closePopover()
  }
}

function openPopover(): void {
  popoverOpen.value = true
  document.addEventListener('mousedown', onDocMousedown)
}

function closePopover(): void {
  popoverOpen.value = false
  document.removeEventListener('mousedown', onDocMousedown)
}

function togglePopover(): void {
  if (popoverOpen.value) closePopover()
  else openPopover()
}

function submitOccasion(e: KeyboardEvent): void {
  // Don't submit on an IME-composition Enter (see useImeEnter).
  if (isImeEnter(e)) return
  const name = newName.value.trim()
  if (!name) return
  addOccasion({ name, month: viewedMonth.value, day: viewedDay.value })
  newName.value = ''
}

onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMousedown)
})
</script>

<template>
  <div ref="wrapRef" class="occ-gift" :class="{ '-hidden': !visible }" @keydown.escape="closePopover">
    <button
      class="occ-gift__btn"
      :class="{ '-active': hasOccasions }"
      type="button"
      aria-label="管理节日/纪念日"
      title="节日 / 纪念日"
      @click="togglePopover"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:1.05em;height:1.05em;display:block"><path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8"/><path d="M2 7h20v5H2z"/><path d="M12 7v14"/><path d="M12 7S10.5 3 8 3a2 2 0 0 0 0 4h4zM12 7s1.5-4 4-4a2 2 0 0 1 0 4h-4z"/></svg>
    </button>

    <div v-if="popoverOpen" class="occ-gift__popover">
      <ul v-if="dayOccasions.length" class="occ-gift__list">
        <li v-for="o in dayOccasions" :key="o.id" class="occ-gift__row">
          <span class="occ-gift__row-name">{{ o.name }}</span>
          <button
            class="occ-gift__remove"
            type="button"
            aria-label="删除"
            title="删除"
            @click="removeOccasion(o.id)"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:0.85em;height:0.85em;display:block"><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </li>
      </ul>
      <input
        v-model="newName"
        class="occ-gift__input"
        type="text"
        placeholder="添加节日…"
        @keydown.enter="submitOccasion"
        @compositionend="onCompositionEnd"
      />
    </div>
  </div>
</template>

<style scoped>
.occ-gift {
  position: relative;
  display: inline-flex;
  transition: opacity 0.15s ease;
}

/* Hidden until the header is hovered (kept in layout so the title doesn't
   shift); days with an occasion / an open popover stay visible. */
.occ-gift.-hidden {
  opacity: 0;
  pointer-events: none;
}

.occ-gift__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.85rem;
  height: 1.85rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--aside-text);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.occ-gift__btn:hover {
  background: var(--button-active-bg);
  color: var(--main-text);
}

/* Muted by default; accent-tinted when the viewed day has occasions. */
.occ-gift__btn.-active,
.occ-gift__btn.-active:hover {
  color: var(--accent, var(--highlight-text));
}

/* Small popover anchored under the gift icon, right-aligned to the button. */
.occ-gift__popover {
  position: absolute;
  top: 2.1rem;
  right: 0;
  z-index: 50;
  width: 12.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem;
  background: var(--main-bg);
  border: 1px solid var(--divider);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
}

.occ-gift__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
}

.occ-gift__row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.18rem 0.1rem 0.18rem 0.25rem;
}

.occ-gift__row-name {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.8rem;
  color: var(--main-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.occ-gift__remove {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.25rem;
  height: 1.25rem;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--aside-text);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.occ-gift__remove:hover {
  background: var(--button-active-bg);
  color: var(--main-text);
}

.occ-gift__input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.3rem 0.45rem;
  font-size: 0.8rem;
  color: var(--main-text);
  background: var(--panel-bg);
  border: 1px solid var(--divider);
  border-radius: 6px;
  outline: none;
}

.occ-gift__input:focus {
  border-color: var(--accent, var(--highlight-text));
}
</style>
