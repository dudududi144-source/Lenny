import { Application, WebGPURenderer } from 'pixi.js';
import type { GameScene } from './GameScene';
import { audio } from './AudioEngine';

export type RendererKind = 'webgpu' | 'webgl' | null;

interface SceneInput {
  pointerDown(x: number, y: number): boolean;
  pointerMove(x: number, y: number): void;
  pointerUp(x: number, y: number): void;
}

export interface StageView {
  /** canvas size in CSS pixels (logical renderer units) */
  w: number;
  h: number;
}

/**
 * GameApp v2 — full-bleed responsive PixiJS stage (Arena layer).
 * The canvas always fills its host element; the active scene is
 * notified of every size change and lays out in "world" units via
 * GameScene (unit-scaled so gameplay math stays resolution-agnostic).
 */
export class GameApp {
  private app: Application | null = null;
  private scene: GameScene | null = null;
  private host: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private canvasHandlers: Array<[string, (e: PointerEvent) => void]> = [];
  private lastPixels: StageView = { w: 420, h: 720 };

  rendererKind: RendererKind = null;
  private paused = false;

  get pixiApp(): Application | null {
    return this.app;
  }

  /** Pause gate: the ticker keeps rendering but stops updating the scene. */
  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  get view(): StageView {
    return { ...this.lastPixels };
  }

  async mount(hostElement: HTMLElement): Promise<void> {
    if (this.app) return;
    this.host = hostElement;

    /* The host may be mid screen-transition (transform scale) — wait for
       two consecutive identical frames so the canvas is born at its real
       size and never resizes under a live scene. */
    const stable = await this.stableSize();
    const pxW = Math.max(280, stable.w);
    const pxH = Math.max(480, stable.h);
    this.lastPixels = { w: pxW, h: pxH };

    const app = new Application();
    const preferWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const initOptions = {
      width: pxW,
      height: pxH,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: true,
    };
    try {
      await app.init({ preference: preferWebGPU ? 'webgpu' : 'webgl', ...initOptions });
    } catch {
      /* headless/old devices: fall back to WebGL2 explicitly */
      await app.init({ preference: 'webgl', ...initOptions });
    }

    this.rendererKind = app.renderer instanceof WebGPURenderer ? 'webgpu' : 'webgl';
    this.app = app;

    const canvas = app.canvas;
    canvas.style.display = 'block';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.touchAction = 'none';
    hostElement.appendChild(canvas);

    const toLocal = (e: PointerEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const asScene = (): SceneInput | null => this.scene;
    const onDown = (e: PointerEvent) => {
      audio.unlock();
      const p = toLocal(e);
      asScene()?.pointerDown(p.x, p.y);
    };
    const onMove = (e: PointerEvent) => {
      const p = toLocal(e);
      asScene()?.pointerMove(p.x, p.y);
    };
    const onUp = (e: PointerEvent) => {
      const p = toLocal(e);
      asScene()?.pointerUp(p.x, p.y);
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    this.canvasHandlers = [
      ['pointerdown', onDown],
      ['pointermove', onMove],
      ['pointerup', onUp],
      ['pointercancel', onUp],
    ];

    app.ticker.maxFPS = 60;
    app.ticker.add((ticker) => {
      if (!this.paused) this.scene?.update(ticker.deltaMS);
    });

    this.resizeObserver = new ResizeObserver(() => this.refit());
    this.resizeObserver.observe(hostElement);
  }

  /** Two consecutive identical non-zero frames (transition-safe). */
  private stableSize(): Promise<{ w: number; h: number }> {
    return new Promise((resolve) => {
      let last = { w: -1, h: -1 };
      let frames = 0;
      const started = performance.now();
      const tick = (): void => {
        const r = this.host?.getBoundingClientRect();
        const cur = { w: Math.round(r?.width ?? 0), h: Math.round(r?.height ?? 0) };
        if (cur.w > 0 && cur.h > 0 && cur.w === last.w && cur.h === last.h) {
          resolve(cur);
          return;
        }
        last = cur;
        if (performance.now() - started > 1600) {
          resolve(cur.w > 0 ? cur : { w: 420, h: 720 });
          return;
        }
        frames++;
        void frames;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }

  /** Resize the renderer to the host's current CSS size and notify the scene. */
  private refit(): void {
    if (!this.app || !this.host) return;
    const rect = this.host.getBoundingClientRect();
    const w = Math.max(280, Math.round(rect.width));
    const h = Math.max(480, Math.round(rect.height));
    if (w === this.lastPixels.w && h === this.lastPixels.h) return;
    this.lastPixels = { w, h };
    this.app.renderer.resize(w, h);
    this.scene?.resizeView(w, h);
  }

  /** Swap the active scene (destroys the previous one). */
  setScene(scene: GameScene | null): void {
    const old = this.scene;
    this.scene = scene;
    if (scene && this.app) {
      this.app.stage.addChild(scene.root);
      scene.resizeView(this.lastPixels.w, this.lastPixels.h);
    }
    old?.destroy();
  }

  getScene(): GameScene | null {
    return this.scene;
  }

  canvasElement(): HTMLCanvasElement | null {
    return this.app?.canvas ?? null;
  }

  destroy(): void {
    this.setScene(null);
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    const canvas = this.app?.canvas;
    if (canvas) {
      for (const [name, handler] of this.canvasHandlers) canvas.removeEventListener(name, handler as EventListener);
    }
    this.canvasHandlers = [];
    this.app?.destroy({ removeView: true }, { children: true });
    this.app = null;
    this.host = null;
    this.rendererKind = null;
  }
}
