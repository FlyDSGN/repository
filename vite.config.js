import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // three.js — отдельный ленивый чанк ~150 КБ gzip, грузится после страницы
    chunkSizeWarningLimit: 700,
    // без data:-URI: строгий CSP (font-src 'self') их блокирует
    assetsInlineLimit: 0,
  },
});
