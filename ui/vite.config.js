import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devApiTarget = env.VITE_DEV_API_TARGET || 'http://127.0.0.1:3030'

  return {
    base: '/administracion/',
    plugins: [react()],
    // Only used by `vite dev` (local UI + backend split).
    server: command === 'serve'
      ? {
          proxy: {
            '/api': {
              target: devApiTarget,
              changeOrigin: true,
              secure: false,
            },
          },
        }
      : undefined,
  }
})
