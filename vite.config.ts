import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        // Preserve original host (e.g. localhost vs local2.localhost) so
        // backend tenant resolution by hostname works in local dev.
        changeOrigin: false,
      },
    },
  },
})
