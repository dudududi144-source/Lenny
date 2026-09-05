/// <reference types="vitest/config" />
import {execSync} from 'node:child_process';
import {defineConfig, type Plugin} from 'vite';

/* stage 19 — every build carries an identity stamp. The bundle gets
   it via define (__BUILD_ID__) and the deploy root gets the very
   same stamp as /version.json. The running app compares the two and
   self-reloads when it discovers it is a stale shell (see
   src/versionWatch.ts). The hour is part of the stamp so even a
   manual re-deploy of the same commit counts as "newer". */
const buildId: string = (() => {
  try {
    const sha: string = execSync('git rev-parse --short=10 HEAD').toString().trim();
    return `${sha}-${new Date().toISOString().slice(0, 13)}`;
  } catch {
    return `dev-${Date.now().toString(36)}`;
  }
})();

const buildStamp = (): Plugin => ({
  name: 'lenny-build-stamp',
  config: () => ({define: {__BUILD_ID__: JSON.stringify(buildId)}}),
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'version.json',
      source: `${JSON.stringify({id: buildId})}\n`,
    });
  },
});

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
  plugins:[buildStamp()],
  /* vitest unit tests (pure cognitive systems), see src/__tests__/ */
  test:{
    environment:'node',
    setupFiles:['./src/__tests__/setup.ts'],
    include:['src/__tests__/**/*.test.ts'],
  }
});
