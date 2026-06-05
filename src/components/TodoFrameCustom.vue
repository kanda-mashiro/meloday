<script setup lang="ts">
import { computed } from 'vue'
import draggable from 'vuedraggable'
import type { ResolvedCustomList } from '../types/todo'
import { useTodoStore } from '../composables/useTodoStore'
import TodoCustomList from './TodoCustomList.vue'

const store = useTodoStore()

const lists = computed<ResolvedCustomList[]>({
  get: () => store.customLists.value,
  set: () => {
    /* reordering is committed via the change handler below */
  },
})

interface MoveChange {
  moved: { element: ResolvedCustomList; newIndex: number }
}

function onChange(event: MoveChange): void {
  if (event.moved) {
    store.moveCustomList({
      id: event.moved.element.id,
      index: event.moved.newIndex,
    })
  }
}

function add(): void {
  store.addCustomList()
}
</script>

<template>
  <section class="frame-custom">
    <div class="frame-custom__viewport">
      <draggable
        v-model="lists"
        class="frame-custom__row"
        group="custom-lists"
        item-key="id"
        handle=".frame-custom__handle"
        :animation="150"
        ghost-class="frame-custom__ghost"
        @change="onChange"
      >
        <template #item="{ element }">
          <div class="frame-custom__col">
            <TodoCustomList :list="element">
              <template #handle>
                <span class="frame-custom__handle" title="Drag to reorder">⠿</span>
              </template>
            </TodoCustomList>
          </div>
        </template>
      </draggable>

      <button class="frame-custom__add" type="button" title="Add a list" @click="add">
        <span class="frame-custom__add-plus">+</span>
        <span class="frame-custom__add-label">New&nbsp;list</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.frame-custom {
  width: 100%;
}

.frame-custom__viewport {
  display: flex;
  align-items: stretch;
  overflow-x: auto;
}

.frame-custom__row {
  display: flex;
  align-items: stretch;
}

.frame-custom__col {
  display: flex;
  flex: 0 0 19rem;
  width: 19rem;
  border-right: 1px solid var(--divider);
}

.frame-custom__handle {
  cursor: grab;
  color: var(--disabled-text);
  font-size: 0.95rem;
  line-height: 1;
  user-select: none;
}

.frame-custom__handle:active {
  cursor: grabbing;
}

.frame-custom__ghost {
  opacity: 0.4;
}

.frame-custom__add {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  width: 9rem;
  min-height: 7rem;
  border: none;
  background: transparent;
  color: var(--disabled-text);
  cursor: pointer;
  transition: color 0.12s ease;
}

.frame-custom__add:hover {
  color: var(--accent);
}

.frame-custom__add-plus {
  font-size: 1.5rem;
  line-height: 1;
}

.frame-custom__add-label {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
</style>
