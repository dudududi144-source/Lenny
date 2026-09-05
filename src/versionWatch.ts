/* ============================================================
 * stage 19 — the site updates ITSELF; the owner never has to ask
 * "why is nothing changing" again.
 *
 * The wound this closes: the owner's device kept showing a build
 * that the server no longer serves (an old suspended PWA session /
 * a cached shell). Every fix we shipped looked invisible to them.
 *
 * How it works:
 *   1. Every build stamps itself twice — the running bundle carries
 *      __BUILD_ID__ (injected by vite define) and the deploy emits
 *      /version.json with the very same stamp.
 *   2. On load, on focus, on return-from-background the running app
 *      quietly fetches version.json (no-store) and compares.
 *   3. A different stamp = the device runs a stale shell → evict
 *      every service worker and cache entry, then reload once.
 *   4. A sessionStorage guard stops a reload ping-pong if some
 *      middlebox ever serves two different stamps in a row.
 * Failures (offline, 404, private mode) are silent — the app never
 * punishes a bad network with a reload.
 * ============================================================ */

/** pure: should the running session reload? (unit-tested contract)
 *  — only a non-empty string stamp that DIFFERS from the running
 *    one counts; anything else (null, undefined, number, garbage,
 *    empty) keeps the session alive. */
export function versionReloadDecision(runningId: string, servedId: unknown): boolean {
  if (typeof servedId !== 'string') return false;
  if (servedId.length === 0) return false;
  return servedId !== runningId;
}

declare const __BUILD_ID__: string;

const CHECK_MIN_INTERVAL = 30_000; /* at most one probe per 30s */
const LOOP_GUARD_KEY = 'lenny-reload-for';

export function startVersionWatch(): void {
  /* dev server: no stamp emitted, nothing to watch */
  if (import.meta.env.DEV) return;
  const running: string = typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : '';
  if (!running) return;

  const url: string = (import.meta.env.BASE_URL || '/') + 'version.json';
  let lastCheck = 0;
  let inFlight = false;

  const evictAndReload = async (targetStamp: string): Promise<void> => {
    /* the guard is written BEFORE the eviction — if the reload is
       somehow interrupted, the next probe refuses to loop */
    try {
      if (sessionStorage.getItem(LOOP_GUARD_KEY) === targetStamp) return;
      sessionStorage.setItem(LOOP_GUARD_KEY, targetStamp);
    } catch {
      /* private mode / storage ban — proceed without the guard */
    }
    try {
      if (navigator.serviceWorker?.getRegistrations) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if (window.caches?.keys) {
        const keys = await window.caches.keys();
        await Promise.all(keys.map((k) => window.caches.delete(k)));
      }
    } catch {
      /* eviction is best-effort; the reload alone usually suffices */
    }
    window.location.reload();
  };

  const check = async (): Promise<void> => {
    const now = Date.now();
    if (inFlight || now - lastCheck < CHECK_MIN_INTERVAL) return;
    lastCheck = now;
    inFlight = true;
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const data: unknown = await res.json();
      const stamp = (data as { id?: unknown } | null)?.id;
      if (!versionReloadDecision(running, stamp)) return;
      await evictAndReload(stamp as string);
    } catch {
      /* offline or a middlebox hiccup — stay put, try again later */
    } finally {
      inFlight = false;
    }
  };

  window.addEventListener('pageshow', () => {
    void check();
  });
  window.addEventListener('focus', () => {
    void check();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) void check();
  });
  void check();
}
