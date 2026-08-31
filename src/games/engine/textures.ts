import { Texture } from 'pixi.js';

/* Procedural texture factory — every glow/gradient is baked once into a
   small canvas texture (radial/linear gradients live HERE, so sprites get
   rich depth without per-frame filter cost). White textures are tinted
   at runtime for any color. */

const cache = new Map<string, Texture>();

function canvasTexture(key: string, size: number, draw: (ctx: CanvasRenderingContext2D, size: number) => void): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable for texture baking');
  draw(ctx, size);
  const tex = Texture.from(canvas);
  cache.set(key, tex);
  return tex;
}

/** Soft radial white glow — tint for any color. */
export function softGlowTexture(): Texture {
  return canvasTexture('soft-glow', 128, (ctx, size) => {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Crisp-edged disc with soft rim — for fish bodies, orbs, particles. */
export function discTexture(): Texture {
  return canvasTexture('disc', 128, (ctx, size) => {
    const g = ctx.createRadialGradient(size * 0.5, size * 0.42, size * 0.08, size / 2, size / 2, size * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.72, 'rgba(255,255,255,0.96)');
    g.addColorStop(0.92, 'rgba(255,255,255,0.75)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** 4-point sparkle star (white, tintable). */
export function sparkTexture(): Texture {
  return canvasTexture('spark', 64, (ctx, size) => {
    const c = size / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.4);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.beginPath();
    ctx.moveTo(c, 2);
    ctx.quadraticCurveTo(c + 2.5, c - 2.5, size - 2, c);
    ctx.quadraticCurveTo(c + 2.5, c + 2.5, c, size - 2);
    ctx.quadraticCurveTo(c - 2.5, c + 2.5, 2, c);
    ctx.quadraticCurveTo(c - 2.5, c - 2.5, c, 2);
    ctx.fill();
  });
}

/** Rounded confetti chip (white, tintable). */
export function confettiTexture(): Texture {
  return canvasTexture('confetti', 32, (ctx, size) => {
    ctx.fillStyle = 'rgba(255,255,255,1)';
    const w = size * 0.42;
    const h = size * 0.28;
    const r = 3;
    const x = (size - w) / 2;
    const y = (size - h) / 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
  });
}

/** Thin ring (white, tintable) — ripples and auras. */
export function ringTexture(): Texture {
  return canvasTexture('ring', 128, (ctx, size) => {
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = size * 0.055;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.42, 0, Math.PI * 2);
    ctx.stroke();
  });
}

/** Vertical linear gradient backdrop, cached per key. */
export function verticalGradientTexture(key: string, stops: Array<[number, string]>, width = 16, height = 256): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context unavailable for texture baking');
  const g = ctx.createLinearGradient(0, 0, 0, height);
  for (const [offset, color] of stops) g.addColorStop(offset, color);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
  const tex = Texture.from(canvas);
  cache.set(key, tex);
  return tex;
}
