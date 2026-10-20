import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700,
    assetsInlineLimit: 0,
  },
});
