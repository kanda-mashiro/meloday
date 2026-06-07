<script setup lang="ts">
import { ref, watch } from 'vue';
import type { ResolvedCustomList } from '../types/todo';
import { useTodoStore } from '../composables/useTodoStore';
import { usePreferences } from '../composables/usePreferences';
import { useImeEnter } from '../composables/useImeEnter';
import TodoList from './TodoList.vue';

const props = defineProps<{ list: ResolvedCustomList }>();

const store = useTodoStore();
const { prefs } = usePreferences();
const { onCompositionEnd, isImeEnter } = useImeEnter();

const title = ref(props.list.title);

watch(
  () => props.list.title,
  (value) => {
    title.value = value;
  },
);

function commitTitle(): void {
  store.editCustomList({ id: props.list.id, title: title.value.trim() });
}

// Don't let the IME-confirming Enter (Safari) commit the rename prematurely.
function onTitleEnter(e: KeyboardEvent): void {
  if (isImeEnter(e)) return;
  commitTitle();
}

function onDelete(): void {
  store.deleteCustomList({ id: props.list.id });
}
</script>

<template>
  <div class="todo-custom-list">
    <header class="todo-custom-list__header">
      <slot name="handle" />
      <input
        v-model="title"
        class="todo-custom-list__title"
        type="text"
        placeholder="Untitled"
        @blur="commitTitle"
        @keydown.enter.prevent="onTitleEnter"
        @compositionend="onCompositionEnd"
      />
      <button
        class="todo-custom-list__delete"
        type="button"
        title="Delete list"
        aria-label="Delete list"
        @click="onDelete"
      >
        &times;
      </button>
    </header>
    <div class="todo-custom-list__body" :class="{ ruled: prefs.showLines }">
      <TodoList :list-id="list.id" :items="list.items" />
    </div>
  </div>
</template>

<style scoped>
.todo-custom-list {
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
}

.todo-custom-list__header {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  height: calc(var(--line-h) * 1.6);
  padding: 0 0.5rem 0.5rem 0.85rem;
}

.todo-custom-list:hover .todo-custom-list__delete {
  visibility: visible;
}

.todo-custom-list__title {
  flex: 1 1 auto;
  min-width: 0;
  align-self: flex-end;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--main-text);
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-family: inherit;
}

.todo-custom-list__title::placeholder {
  color: var(--disabled-text);
}

.todo-custom-list__title:focus {
  outline: none;
}

.todo-custom-list__delete {
  flex: 0 0 auto;
  visibility: hidden;
  align-self: flex-end;
  width: 1.3rem;
  height: 1.3rem;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--disabled-text);
  font-size: 1.15rem;
  line-height: 1;
  cursor: pointer;
}

.todo-custom-list__delete:hover {
  color: var(--highlight-text);
  background: var(--button-active-bg);
}

.todo-custom-list__body {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 34vh;
  padding: 0 0.5rem;
}
</style>
