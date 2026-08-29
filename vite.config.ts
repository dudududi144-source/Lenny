/// <reference types="vitest/config" />
import {defineConfig} from 'vite';
export default defineConfig({
  base:'/Lenny/',
  server:{port:5173},
  build:{outDir:'dist',target:'es2020'},
  /* vitest unit tests (pure cognitive systems), see src/__tests__/ */
  test:{
    environment:'node',
    setupFiles:['./src/__tests__/setup.ts'],
    include:['src/__tests__/**/*.test.ts'],
  }
});
