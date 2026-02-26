import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/administracion/',
  plugins: [react()],
  server: {
    // Dev convenience: route API calls to the backend server.
    // UI dev server runs on :3040; backend usually on :3030.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3030',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
