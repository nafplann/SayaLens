import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: 'src-react',
  build: {
    outDir: '../dist-react',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        capture: path.resolve(__dirname, 'src-react/capture.html'),
        result: path.resolve(__dirname, 'src-react/result.html'),
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src-react"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
