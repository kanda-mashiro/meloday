import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// Tauri expects a fixed dev port and quiet output.
export default defineConfig({
  plugins: [vue()],
  clearScreen: false,
  server: {
    port: 5182,
    strictPort: true,
  },
})
