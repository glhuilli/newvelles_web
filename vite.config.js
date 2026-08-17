import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/news': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/metadata': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/stories.json': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
      '/momentum.json': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        redesign: 'redesign.html',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
  },
});
