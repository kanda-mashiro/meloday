<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import draggable from 'vuedraggable'
import type { TodoItem as TodoItemType } from '../types/todo'
import { useTodoStore } from '../composables/useTodoStore'
import { usePreferences } from '../composables/usePreferences'
import { getTime } from '../lib/time'
import TodoItem from './TodoItem.vue'
import TodoItemInput from './TodoItemInput.vue'

const props = defineProps<{ listId: string; items: TodoItemType[] }>()

const store = useTodoStore()
const { prefs } = usePreferences()

// The add-input is hidden until the empty column area is clicked.
const adding = ref(false)
const adder = ref<InstanceType<typeof TodoItemInput> | null>(null)

async function startAdding(): Promise<void> {
  adding.value = true
  await nextTick()
  adder.value?.focus()
}

// Start adding only when the click lands on empty space (not an item/input).
function onEmptyClick(e: MouseEvent): void {
  const target = e.target as HTMLElement
  if (target.closest('.todo-item') || target.closest('.todo-item-input')) return
  startAdding()
}

// Items to render: completed sink to the bottom, timed items rise to the top
// (by start time); the rest keep their manual (drag) order. Completed can also
// be hidden entirely via Preferences.
const source = computed<TodoItemType[]>(() => {
  const items = prefs.showCompleted ? props.items : props.items.filter((i) => !i.done)
  return [...items].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    const ta = getTime(a.label)
    const tb = getTime(b.label)
    if (!!ta !== !!tb) return ta ? -1 : 1
    if (ta && tb && ta.start !== tb.start) return ta.start - tb.start
    return a.index - b.index
  })
})

// Local writable copy bound to <draggable>, kept in sync with incoming items.
const localItems = ref<TodoItemType[]>([...source.value])

watch(
  source,
  (next) => {
    localItems.value = [...next]
  },
  { deep: true },
)

interface DragChangeEvent {
  added?: { element: TodoItemType; newIndex: number }
  moved?: { element: TodoItemType; newIndex: number }
}

function onChange(event: DragChangeEvent) {
  const change = event.added ?? event.moved
  if (!change) return
  store.moveItem({
    id: change.element.id,
    listId: props.listId,
    index: change.newIndex,
  })
}
</script>

<template>
  <!-- The whole column is the click-to-add zone and the drag drop zone. -->
  <div class="todo-list" @click="onEmptyClick">
    <draggable
      v-model="localItems"
      class="todo-list__items"
      group="todo-items"
      item-key="id"
      handle=".todo-item__handle"
      :animation="150"
      ghost-class="todo-list__ghost"
      drag-class="todo-list__drag"
      @change="onChange"
    >
      <template #item="{ element }">
        <TodoItem :item="element" />
      </template>
      <template #footer>
        <TodoItemInput
          v-show="adding"
          ref="adder"
          :list-id="listId"
          @blur-empty="adding = false"
        />
      </template>
    </draggable>
  </div>
</template>

<style scoped>
.todo-list {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  cursor: text;
}

/* Fills the column so empty space below items stays a drop + add target. */
.todo-list__items {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: var(--line-h);
}

.todo-list__ghost {
  opacity: 0.35;
}

.todo-list__drag {
  background: var(--main-bg);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
}
</style>
