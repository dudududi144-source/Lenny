import { Application, WebGPURenderer } from 'pixi.js';
import type { GameScene } from './GameScene';
import { DESIGN } from './theme';

export type RendererKind = 'webgpu' | 'webgl' | null;

interface SceneInput {
  onTap(x: number, y: number): boolean;
  onDragStart(x: number, y: number): void;
  onDragMove(x: number, y: number): void;
  onDragEnd(x: number, y: number): void;
}

/**
 * PixiJS v8 Application wrapper.
 * - WebGPU renderer preferred, automatic WebGL2 fallback (headless/CI safe)
 * - fixed 420x720 design space, CSS-contain fitted + centered
 * - pointer events remapped from page space into design space
 * - single scene mounted at a time
 */
export class GameApp {
  private app: Application | null = null;
  private scene: GameScene | null = null;
  private host: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private canvasHandlers: Array<[string, (e: PointerEvent) => void]> = [];

  rendererKind: RendererKind = null;

  get pixiApp(): Application | null {
    return this.app;
  }

  async mount(hostElement: HTMLElement): Promise<void> {
    if (this.app) return;

    const app = new Application();
    const preferWebGPU = typeof navigator !== 'undefined' && 'gpu' in navigator;
    const initOptions = {
      width: DESIGN.w,
      height: DESIGN.h,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(2, window.devicePixelRatio || 1),
      autoDensity: false,
    };
    try {
      await app.init({ preference: preferWebGPU ? 'webgpu' : 'webgl', ...initOptions });
    } catch {
      /* headless/old devices: fall back to WebGL2 explicitly */
      await app.init({ preference: 'webgl', ...initOptions });
    }

    this.rendererKind = app.renderer instanceof WebGPURenderer ? 'webgpu' : 'webgl';
    this.app = app;
    this.host = hostElement;

    const canvas = app.canvas;
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    canvas.style.touchAction = 'none';
    hostElement.appendChild(canvas);

    /* pointer remapping: page space → 420x720 design space */
    const toDesign = (e: PointerEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * DESIGN.w,
        y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * DESIGN.h,
      };
    };
    const asScene = (): SceneInput | null => this.scene;
    const onDown = (e: PointerEvent) => {
      const p = toDesign(e);
      asScene()?.onDragStart(p.x, p.y);
      asScene()?.onTap(p.x, p.y);
    };
    const onMove = (e: PointerEvent) => {
      const p = toDesign(e);
      asScene()?.onDragMove(p.x, p.y);
    };
    const onUp = (e: PointerEvent) => {
      const p = toDesign(e);
      asScene()?.onDragEnd(p.x, p.y);
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
    app.ticker.add((ticker) => this.scene?.update(ticker.deltaMS));

    this.fit();
    this.resizeObserver = new ResizeObserver(() => this.fit());
    this.resizeObserver.observe(hostElement);
  }

  /** Contain-fit the fixed design space into the host element. */
  private fit(): void {
    if (!this.app || !this.host) return;
    const rect = this.host.getBoundingClientRect();
    const scale = Math.min(rect.width / DESIGN.w, rect.height / DESIGN.h);
    const canvas = this.app.canvas;
    canvas.style.width = `${Math.floor(DESIGN.w * scale)}px`;
    canvas.style.height = `${Math.floor(DESIGN.h * scale)}px`;
  }

  /** Swap the active scene (destroys the previous one). */
  setScene(scene: GameScene | null): void {
    const old = this.scene;
    this.scene = scene;
    if (scene && this.app) this.app.stage.addChild(scene.root);
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
