<script setup lang="ts">
import { useToast } from '../composables/useToast'

const { message } = useToast()
</script>

<template>
  <Transition name="toast">
    <div v-if="message" class="toast" role="status">{{ message }}</div>
  </Transition>
</template>

<style scoped>
.toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--bottom-bar-h, 46px) + 1.3rem);
  transform: translateX(-50%);
  z-index: 60;
  padding: 0.55rem 1.1rem;
  border-radius: 999px;
  background: var(--main-text);
  color: var(--main-bg);
  font-size: 0.85rem;
  font-weight: 600;
  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.24);
  pointer-events: none;
  white-space: nowrap;
}

.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(6px);
}
</style>
