import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'tests/e2e',
 /* pixel-scanning suites are frame-timing sensitive: 2-CPU boxes
    + parallel workers made even untouched specs flake. One worker
    keeps every run deterministic (verified 24/24 at repeat-each=2
    during Stage 2b development). */
 workers:1,
 use:{viewport:{width:375,height:667},hasTouch:true,isMobile:true},
 webServer:{command:'npx vite preview --port 4173 --strictPort',port:4173,reuseExistingServer:true},
});
