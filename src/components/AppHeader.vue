<script setup lang="ts">
import AccountControl from './AccountControl.vue'

const emit = defineEmits<{ preferences: []; history: []; account: [] }>()
</script>

<template>
  <header class="app-header">
    <h1 class="app-title">Meloday</h1>

    <nav class="app-header__side app-header__side--right">
      <AccountControl @preferences="emit('preferences')" @history="emit('history')" @account="emit('account')" />
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1.25rem;
  border-bottom: 1px solid var(--divider);
  background: var(--main-bg);
}

.app-title {
  margin: 0;
  grid-column: 2;
  text-align: center;
  font-size: 1.05rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-indent: 0.18em;
  text-transform: uppercase;
  color: var(--accent);
}

.app-header__side {
  display: flex;
  align-items: center;
  gap: 0.15rem;
}

.app-header__side--right {
  grid-column: 3;
  justify-content: flex-end;
}
</style>
