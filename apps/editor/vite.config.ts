import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@studio/core': path.resolve(__dirname, '../../packages/core/src/index.ts') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8787', changeOrigin: false },
      '/preview': 'http://localhost:8787',
      '/sites': 'http://localhost:8787',
    },
  },
  build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
});
