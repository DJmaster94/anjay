import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import preview from './config/preview.json'

export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? process.env.PAGES_BASE_PATH || '/anjay/' : '/',
  define: { 'import.meta.env.VITE_DEPLOY_TARGET': JSON.stringify(mode === 'pages' ? 'github-pages' : 'server') },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    headers: { 'Content-Security-Policy': `frame-ancestors 'self' ${preview.frameAncestors.join(' ')}` },
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
  build: { outDir: mode === 'pages' ? 'dist-pages' : 'dist', rollupOptions: { output: { manualChunks: { charts: ['recharts'] } } } },
}))
