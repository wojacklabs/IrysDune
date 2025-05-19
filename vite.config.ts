import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable polyfills for specific globals and modules
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true, // Polyfill node: protocol imports
    }),
  ],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      stream: 'vite-plugin-node-polyfills/stream',
      crypto: 'vite-plugin-node-polyfills/crypto',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'three': ['three'],
          'vendor': ['react', 'react-dom'],
          'irys': ['@irys/web-upload']
        }
      }
    },
    chunkSizeWarningLimit: 1000, // 1MB로 증가
  }
})
