import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    server: {
      // In dev, /api/* is forwarded to the FastAPI backend, so the browser never makes a cross-origin call.
      proxy: {
        '/api': env.BACKEND_URL || 'http://localhost:8000',
      },
    },
  }
})
