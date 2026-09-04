/* ============================================================
 * WorldSky — the painted day (Stage 7, commit 4; stage 15-D polish).
 *
 * The garden breathes with the real day (visual only — the hour
 * may change the LIGHT, never the challenge, per ETHICS):
 *
 *   morning  soft gold + butterflies + a breath of mist
 *   midday   bright blue + butterflies (the clearest air)
 *   evening  golden hour, pink clouds + the first stars
 *   night    deep blue, moon, stars + fireflies
 *
 * Stage 15-D professional pass (all still ZERO assets):
 *   - a multi-stop gradient (zenith → mid → low → horizon haze)
 *     instead of three flat bands — the sky reads as AIR now
 *   - the sun got a soft halo, the moon a glow (painted radials)
 *   - stars are varied and deterministic (seeded, never flicker)
 *   - lerpPalette() blends two palettes so the day TURNS instead
 *     of jumping — a child never sees the world snap dark
 *   - fogDensity + cloudTint ride the palette (WorldApp consumes)
 *
 * The phase comes from the existing content/dayCycle.ts (with its
 * lenny-hour-override for deterministic e2e). Pure mapping here —
 * WorldApp applies the palettes.
 * ============================================================ */

import type { DayPhase } from '../content/dayCycle';

/* ---------- the palette shape (lives here; WorldApp consumes it) ---------- */

export interface WorldPalette {
  skyTop: string;
  skyMid: string;
  /** the low-sky band between mid and horizon haze (stage 15-D) */
  skyLow: string;
  skyHorizon: string;
  /** sun disc position on the painted dome (0..1 of texture space) or null */
  sun: { x: number; y: number; r: number; color: string } | null;
  /** the sun halo's warm wash (stage 15-D) */
  sunHalo: string;
  moon: boolean;
  stars: number;
  sunDir: [number, number, number];
  sunIntensity: number;
  hemiIntensity: number;
  hemiSky: string;
  hemiGround: string;
  grassBase: string;
  grassDark: string;
  grassLight: string;
  fogColor: string;
  /** the hour's air thickness (EXP2 density; WorldApp eases it in on standard+) */
  fogDensity: number;
  /** the cloud billboards' hour tint (stage 15-D; weak keeps white) */
  cloudTint: string;
  /** 1 = the disc is painted, 0 = gone; lerped so day turns into night gently */
  sunAlpha: number;
  moonAlpha: number;
}

export const MORNING_PALETTE: WorldPalette = {
  skyTop: '#5db3e3',
  skyMid: '#a8d8f0',
  skyLow: '#d8ecf7',
  skyHorizon: '#fdf3d8',
  sun: { x: 0.3, y: 0.3, r: 30, color: '#ffe9a6' },
  sunHalo: '#fff6cf',
  moon: false,
  stars: 6,
  sunDir: [-0.55, -0.6, 0.35],
  sunIntensity: 0.95,
  hemiIntensity: 0.68,
  hemiSky: '#fff6e0',
  hemiGround: '#4a7a3a',
  grassBase: '#83c95c',
  grassDark: '#66a94a',
  grassLight: '#abdf83',
  fogColor: '#fdf3d8',
  fogDensity: 0.004,
  cloudTint: '#fff9ec',
  sunAlpha: 1,
  moonAlpha: 0,
};

export const MIDDAY_PALETTE: WorldPalette = {
  skyTop: '#3fa7e0',
  skyMid: '#8fd0ef',
  skyLow: '#c8e9f6',
  skyHorizon: '#eaf7dc',
  sun: { x: 0.22, y: 0.14, r: 34, color: '#fff3b0' },
  sunHalo: '#fffbe0',
  moon: false,
  stars: 0,
  sunDir: [-0.4, -0.85, 0.3],
  sunIntensity: 1,
  hemiIntensity: 0.65,
  hemiSky: '#ffffff',
  hemiGround: '#4a7a3a',
  grassBase: '#79c356',
  grassDark: '#5ea344',
  grassLight: '#a4d97b',
  fogColor: '#eaf7dc',
  fogDensity: 0.003,
  cloudTint: '#ffffff',
  sunAlpha: 1,
  moonAlpha: 0,
};

export const EVENING_PALETTE: WorldPalette = {
  skyTop: '#4a6fa5',
  skyMid: '#e78a5e',
  skyLow: '#f7c98e',
  skyHorizon: '#ffd9a0',
  sun: { x: 0.62, y: 0.55, r: 40, color: '#ffb066' },
  sunHalo: '#ffcf94',
  moon: false,
  stars: 14,
  sunDir: [0.6, -0.45, -0.3],
  sunIntensity: 0.85,
  hemiIntensity: 0.55,
  hemiSky: '#ffd9a0',
  hemiGround: '#3d5a34',
  grassBase: '#6ba850',
  grassDark: '#528a3e',
  grassLight: '#93c76e',
  fogColor: '#ffd9a0',
  fogDensity: 0.0036,
  cloudTint: '#ffdcc0',
  sunAlpha: 1,
  moonAlpha: 0,
};

export const NIGHT_PALETTE: WorldPalette = {
  skyTop: '#0b1a3a',
  skyMid: '#1d3a5f',
  skyLow: '#23405f',
  skyHorizon: '#31527a',
  sun: null,
  sunHalo: '#0b1a3a',
  moon: true,
  stars: 60,
  sunDir: [0.3, -0.7, 0.5],
  sunIntensity: 0.32,
  hemiIntensity: 0.34,
  hemiSky: '#8fa8d0',
  hemiGround: '#1c2f24',
  grassBase: '#3f6b3c',
  grassDark: '#2f5530',
  grassLight: '#568750',
  fogColor: '#17263c',
  fogDensity: 0.0038,
  cloudTint: '#b6c3dd',
  sunAlpha: 0,
  moonAlpha: 1,
};

export const PHASE_PALETTES: Record<DayPhase, WorldPalette> = {
  morning: MORNING_PALETTE,
  midday: MIDDAY_PALETTE,
  evening: EVENING_PALETTE,
  night: NIGHT_PALETTE,
};

/** The palette for a day phase (pure, total). */
export function paletteForPhase(phase: DayPhase): WorldPalette {
  return PHASE_PALETTES[phase] ?? MIDDAY_PALETTE;
}

/** Do two palettes differ enough to justify a repaint? (pure) */
export function paletteChanged(a: WorldPalette, b: WorldPalette): boolean {
  return (
    a.skyTop !== b.skyTop ||
    a.skyHorizon !== b.skyHorizon ||
    a.moon !== b.moon ||
    a.stars !== b.stars ||
    a.sunIntensity !== b.sunIntensity ||
    a.hemiIntensity !== b.hemiIntensity
  );
}

/* ---------- stage 15-D: gentle day-night blending (pure) ---------- */

const hexCache = new Map<string, [number, number, number]>();

function hexToRgb(hex: string): [number, number, number] {
  const hit = hexCache.get(hex);
  if (hit) return hit;
  const h = hex.replace('#', '');
  const v: [number, number, number] = [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
  hexCache.set(hex, v);
  return v;
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function lerpHex(a: string, b: string, k: number): string {
  if (a === b) return a;
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return `#${clamp255(ca[0] + (cb[0] - ca[0]) * k).toString(16).padStart(2, '0')}${clamp255(
    ca[1] + (cb[1] - ca[1]) * k,
  )
    .toString(16)
    .padStart(2, '0')}${clamp255(ca[2] + (cb[2] - ca[2]) * k).toString(16).padStart(2, '0')}`;
}

/**
 * A palette between two hours (pure): every color and number eases
 * from `a` toward `b` by k. The sun/moon discs cross-fade via
 * sunAlpha/moonAlpha instead of popping — the day TURNS, it never
 * snaps dark (a 4-year-old is watching).
 */
export function lerpPalette(a: WorldPalette, b: WorldPalette, k: number): WorldPalette {
  const t = Math.max(0, Math.min(1, k));
  if (t <= 0) return a;
  if (t >= 1) return b;
  const sun =
    a.sun && b.sun
      ? {
          x: a.sun.x + (b.sun.x - a.sun.x) * t,
          y: a.sun.y + (b.sun.y - a.sun.y) * t,
          r: a.sun.r + (b.sun.r - a.sun.r) * t,
          color: lerpHex(a.sun.color, b.sun.color, t),
        }
      : t < 0.5
        ? a.sun
        : b.sun;
  return {
    skyTop: lerpHex(a.skyTop, b.skyTop, t),
    skyMid: lerpHex(a.skyMid, b.skyMid, t),
    skyLow: lerpHex(a.skyLow, b.skyLow, t),
    skyHorizon: lerpHex(a.skyHorizon, b.skyHorizon, t),
    sun,
    sunHalo: lerpHex(a.sunHalo, b.sunHalo, t),
    moon: t < 0.5 ? a.moon : b.moon,
    stars: Math.round(a.stars + (b.stars - a.stars) * t),
    sunDir: [
      a.sunDir[0] + (b.sunDir[0] - a.sunDir[0]) * t,
      a.sunDir[1] + (b.sunDir[1] - a.sunDir[1]) * t,
      a.sunDir[2] + (b.sunDir[2] - a.sunDir[2]) * t,
    ],
    sunIntensity: a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t,
    hemiIntensity: a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t,
    hemiSky: lerpHex(a.hemiSky, b.hemiSky, t),
    hemiGround: lerpHex(a.hemiGround, b.hemiGround, t),
    grassBase: lerpHex(a.grassBase, b.grassBase, t),
    grassDark: lerpHex(a.grassDark, b.grassDark, t),
    grassLight: lerpHex(a.grassLight, b.grassLight, t),
    fogColor: lerpHex(a.fogColor, b.fogColor, t),
    fogDensity: a.fogDensity + (b.fogDensity - a.fogDensity) * t,
    cloudTint: lerpHex(a.cloudTint, b.cloudTint, t),
    sunAlpha: a.sunAlpha + (b.sunAlpha - a.sunAlpha) * t,
    moonAlpha: a.moonAlpha + (b.moonAlpha - a.moonAlpha) * t,
  };
}

/* ---------- the painted dome (zero assets, deterministic) ---------- */

/** Paint quality: 'weak' is the historical sky, byte for byte; the
 *  standard+ night earns a denser field, a milky band and a prouder
 *  moon (stage 16-c). The rng is reseeded per paint, so every
 *  quality stays deterministic — the night sky is a PLACE. */
export type SkyQuality = 'weak' | 'standard' | 'rich';

/**
 * Paint one sky texture (the same seeded stars every time — the
 * night sky is a PLACE, not noise). `blend` (0..1) fades the discs:
 * the WorldApp day-turn drives it through lerpPalette's sun/moon
 * alphas so dusk takes ~9 gentle seconds.
 */
export function paintSkyCanvas(
  ctx: CanvasRenderingContext2D,
  size: number,
  p: WorldPalette,
  rng: () => number,
  quality: SkyQuality = 'weak',
): void {
  /* the air: zenith → mid → low → horizon haze (multi-stop) */
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(0.38, p.skyMid);
  g.addColorStop(0.62, p.skyLow);
  g.addColorStop(0.74, p.skyHorizon);
  g.addColorStop(1, p.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  /* the stars — BEFORE the discs so the moon overlaps them. Fixed
     rng() calls per star: the field stays put while counts blend.
     standard+ (16-c): the field DENSIFIES and a faint milky band
     crosses the high sky — still seeded, never flickering. */
  if (p.stars > 0) {
    const rich = quality === 'rich';
    const boosted = quality !== 'weak';
    const count = boosted ? Math.round(p.stars * (rich ? 3 : 2.2)) + (rich ? 34 : 18) : p.stars;
    /* the milky band: one soft diagonal wash behind everything */
    if (boosted) {
      const bx = size * (0.2 + rng() * 0.1);
      const by = size * 0.1;
      const band = ctx.createLinearGradient(bx, by, bx + size * 0.7, size * 0.62);
      band.addColorStop(0, 'rgba(214,228,255,0)');
      band.addColorStop(0.5, `rgba(214,228,255,${rich ? 0.1 : 0.07})`);
      band.addColorStop(1, 'rgba(214,228,255,0)');
      ctx.fillStyle = band;
      ctx.fillRect(0, 0, size, size);
    }
    ctx.fillStyle = '#fff7d6';
    for (let i = 0; i < count; i++) {
      const x = rng() * size;
      const y = rng() * size * 0.55;
      const r = 0.6 + rng() * 1.3;
      ctx.globalAlpha = 0.35 + rng() * 0.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    /* a handful of brighter friends — the sky has hierarchy now */
    for (let i = 0; i < 5 && p.stars >= 14; i++) {
      const x = rng() * size;
      const y = rng() * size * 0.4;
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.arc(x, y, 1.4 + rng() * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.3;
      ctx.fillRect(x - 4, y - 0.4, 8, 0.8);
      ctx.fillRect(x - 0.4, y - 4, 0.8, 8);
    }
    /* standard+ night: four-point glints on the brightest few */
    if (boosted) {
      const glints = rich ? 7 : 5;
      ctx.globalAlpha = 0.5;
      for (let i = 0; i < glints; i++) {
        const x = rng() * size;
        const y = rng() * size * 0.45;
        const s = 3 + rng() * 4;
        ctx.fillRect(x - s, y - 0.35, s * 2, 0.7);
        ctx.fillRect(x - 0.35, y - s, 0.7, s * 2);
      }
    }
    ctx.globalAlpha = 1;
  }

  /* the sun: a warm halo wash + a hot core (fades via sunAlpha) */
  if (p.sun && p.sunAlpha > 0.01) {
    const sx = p.sun.x * size;
    const sy = p.sun.y * size;
    const halo = ctx.createRadialGradient(sx, sy, p.sun.r * 0.6, sx, sy, p.sun.r * 3.4);
    halo.addColorStop(0, p.sunHalo);
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.55 * p.sunAlpha;
    ctx.fillStyle = halo;
    ctx.fillRect(sx - p.sun.r * 3.4, sy - p.sun.r * 3.4, p.sun.r * 6.8, p.sun.r * 6.8);
    ctx.globalAlpha = p.sunAlpha;
    ctx.fillStyle = p.sun.color;
    ctx.beginPath();
    ctx.arc(sx, sy, p.sun.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.85 * p.sunAlpha;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, p.sun.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /* the moon: a soft glow + the crescent (fades via moonAlpha).
     standard+ (16-c): a second, wider halo wash plus a thin ring —
     the moon reads as a LAMP in the sky, not a sticker. */
  if (p.moon && p.moonAlpha > 0.01) {
    const mx = 0.78 * size;
    const my = 0.14 * size;
    const halo = ctx.createRadialGradient(mx, my, 6, mx, my, 90);
    halo.addColorStop(0, 'rgba(243,236,208,0.75)');
    halo.addColorStop(1, 'rgba(243,236,208,0)');
    ctx.globalAlpha = p.moonAlpha;
    ctx.fillStyle = halo;
    ctx.fillRect(mx - 90, my - 90, 180, 180);
    if (quality !== 'weak') {
      const wide = ctx.createRadialGradient(mx, my, 40, mx, my, 150);
      wide.addColorStop(0, 'rgba(214,224,248,0.16)');
      wide.addColorStop(1, 'rgba(214,224,248,0)');
      ctx.fillStyle = wide;
      ctx.fillRect(mx - 150, my - 150, 300, 300);
      ctx.globalAlpha = 0.28 * p.moonAlpha;
      ctx.strokeStyle = 'rgba(243,236,208,0.55)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(mx, my, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = p.moonAlpha;
    }
    ctx.fillStyle = '#f3ecd0';
    ctx.beginPath();
    ctx.arc(mx, my, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.skyTop;
    ctx.beginPath();
    ctx.arc(0.755 * size, 0.125 * size, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/** A seeded star field — the same sky on every device, every reload. */
export function skyStarRng(seed: number): () => number {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(s, 0x6d2b79f5) + 0x2545f491) >>> 0;
    s ^= s >>> 13;
    s = (Math.imul(s, 0x6d2b79f5) + 0x2545f491) >>> 0;
    return ((s >>> 8) % 100000) / 100000;
  };
}
