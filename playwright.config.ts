import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'tests/e2e',
 use:{viewport:{width:375,height:667},hasTouch:true,isMobile:true},
 webServer:{command:'npx vite preview --port 4173 --strictPort',port:4173,reuseExistingServer:true},
});
