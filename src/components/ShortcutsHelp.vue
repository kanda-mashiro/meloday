<script setup lang="ts">
import { onMounted, onBeforeUnmount } from 'vue'
import { useHelp } from '../composables/useHelp'

const { open, closeHelp } = useHelp()

interface Row {
  keys: string[]
  desc: string
}
interface Group {
  title: string
  rows: Row[]
}

const GROUPS: Group[] = [
  {
    title: '导航',
    rows: [
      { keys: ['←', 'h'], desc: '前一天（⇧ = 一周）' },
      { keys: ['→', 'l'], desc: '后一天（⇧ = 一周）' },
      { keys: ['t'], desc: '回到今天' },
      { keys: ['[', ']'], desc: '切换天数视图（窄 / 宽）' },
      { keys: ['⌘', 'K'], desc: '快速捕获到 Inbox' },
    ],
  },
  {
    title: '选中条目后（单击任务选中）',
    rows: [
      { keys: ['↑↓←→', 'hjkl'], desc: '在任务 / 天之间移动选中' },
      { keys: ['⌥ + 方向'], desc: '移动卡片：当天重排 / 跨天' },
      { keys: ['Esc'], desc: '取消选中' },
    ],
  },
  {
    title: '通用',
    rows: [
      { keys: ['?'], desc: '打开 / 关闭本帮助' },
      { keys: ['Esc'], desc: '关闭弹层 / 退出专注' },
    ],
  },
]

const TIPS = [
  '单击任务 = 选中，再次单击 = 编辑',
  '右键任务 = 移到日期 / 笔记 / 专注',
  '拖动任务 = 重新排序或跨天移动',
]

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) {
    e.preventDefault()
    e.stopImmediatePropagation()
    closeHelp()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="open" class="help" role="dialog" aria-modal="true" aria-label="快捷键">
    <div class="help__scrim" @click="closeHelp" />
    <div class="help__card">
      <button class="help__close" type="button" aria-label="关闭" @click="closeHelp">
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true" style="width:0.9rem;height:0.9rem;display:block"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7" /></svg>
      </button>

      <h2 class="help__title">快捷键</h2>

      <section v-for="g in GROUPS" :key="g.title" class="help__group">
        <h3 class="help__group-title">{{ g.title }}</h3>
        <div v-for="(row, i) in g.rows" :key="i" class="help__row">
          <span class="help__keys">
            <kbd v-for="(k, j) in row.keys" :key="j" class="help__kbd">{{ k }}</kbd>
          </span>
          <span class="help__desc">{{ row.desc }}</span>
        </div>
      </section>

      <section class="help__group">
        <h3 class="help__group-title">鼠标</h3>
        <p v-for="(t, i) in TIPS" :key="i" class="help__tip">{{ t }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.help {
  position: fixed;
  inset: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.help__scrim {
  position: absolute;
  inset: 0;
  background: color-mix(in srgb, var(--main-bg) 70%, transparent);
  backdrop-filter: blur(3px);
}

.help__card {
  position: relative;
  width: min(440px, 100%);
  max-height: 86vh;
  overflow-y: auto;
  padding: 1.5rem 1.6rem;
  background: var(--main-bg);
  border: 1px solid var(--divider);
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  color: var(--main-text);
}

.help__close {
  position: absolute;
  top: 0.9rem;
  right: 0.9rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.6rem;
  height: 1.6rem;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--aside-text);
  cursor: pointer;
}

.help__close:hover {
  background: var(--button-active-bg);
  color: var(--main-text);
}

.help__title {
  margin: 0 0 1rem;
  font-size: 1.1rem;
  font-weight: 700;
}

.help__group {
  margin-top: 1.1rem;
}

.help__group:first-of-type {
  margin-top: 0;
}

.help__group-title {
  margin: 0 0 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--aside-text);
}

.help__row {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 0.25rem 0;
}

.help__keys {
  flex: 0 0 6.5rem;
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.25rem;
}

.help__kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4rem;
  padding: 0.05rem 0.4rem;
  border: 1px solid var(--main-border-light);
  border-radius: 5px;
  font-size: 0.74rem;
  font-weight: 600;
  line-height: 1.5;
  color: var(--main-text);
  background: color-mix(in srgb, var(--main-text) 4%, transparent);
}

.help__desc {
  font-size: 0.85rem;
  color: var(--main-text);
}

.help__tip {
  margin: 0.3rem 0;
  font-size: 0.82rem;
  color: var(--aside-text);
}
</style>
