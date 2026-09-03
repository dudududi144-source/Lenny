/// <reference types="vitest/config" />
import {defineConfig} from 'vite';
export default defineConfig({
  base:'/Lenny/',
  server:{port:5173},
  build:{
    outDir:'dist',
    target:'es2020',
    /* audit 9-c: pixi.js as its own cacheable chunk next to the lazy
       game impl (the world chunk was already lazy via WorldScreen). */
    rollupOptions:{output:{manualChunks:{pixi:['pixi.js']}}},
  },
  /* vitest unit tests (pure cognitive systems), see src/__tests__/ */
  test:{
    environment:'node',
    setupFiles:['./src/__tests__/setup.ts'],
    include:['src/__tests__/**/*.test.ts'],
  }
});
