import {defineConfig} from 'vite';
export default defineConfig({
  base:'/Lenny/',
  server:{port:5173},
  build:{outDir:'dist',target:'es2020'}
});
