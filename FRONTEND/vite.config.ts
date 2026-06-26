import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/tasks': {
        target: 'http://127.0.0.1:3333',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:3333',
        changeOrigin: true,
      },
    },
  },
})
