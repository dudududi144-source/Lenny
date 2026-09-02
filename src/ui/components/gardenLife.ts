/* ============================================================
 * gardenLife — the garden that GROWS (Stage 6, commit 6).
 *
 * Pure SVG builders, zero assets. Two consumers:
 *   1. Per-zone growth: every finished game opens one flower in its
 *      zone card (bud → bloom, scale+rotate payoff when returning).
 *   2. The garden life layer: a decorative strip that follows the
 *      global bloom ladder — 0 soil, 1 sprouts, 2 flowers,
 *      3 flowers+butterflies, 4 small trees, 5 full garden+fireflies.
 *
 * All deterministic: same progress in, same garden out.
 * ============================================================ */

const NS = 'http://www.w3.org/2000/svg';

function svgEl(tag: string, attrs: Record<string, string | number>): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/* ---------- flowers (per-zone growth) ---------- */

/** One open flower, tinted by the zone color. */
export function flowerSvg(tint: string, seed = 0): SVGElement {
  const s = svgEl('svg', { viewBox: '0 0 24 24', class: 'flower-svg', 'aria-hidden': 'true' });
  const stem = svgEl('path', {
    d: 'M12 22 C12 17 11.4 14 12 10',
    fill: 'none',
    stroke: '#5fae6e',
    'stroke-width': 1.6,
    'stroke-linecap': 'round',
  });
  const leaf = svgEl('path', {
    d: seed % 2 === 0 ? 'M12 16 C9 15.4 7.6 13.6 7.4 11.6 C10 12 11.6 13.6 12 16' : 'M12 16 C15 15.4 16.4 13.6 16.6 11.6 C14 12 12.4 13.6 12 16',
    fill: '#7dcb8b',
  });
  s.append(stem, leaf);
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 - 90) * (Math.PI / 180);
    const px = 12 + Math.cos(a) * 4.2;
    const py = 8 + Math.sin(a) * 4.2;
    s.append(
      svgEl('ellipse', {
        cx: px.toFixed(2),
        cy: py.toFixed(2),
        rx: 3.1,
        ry: 2.4,
        transform: `rotate(${i * 72} ${px.toFixed(2)} ${py.toFixed(2)})`,
        fill: tint,
        opacity: 0.92,
      }),
    );
  }
  s.append(svgEl('circle', { cx: 12, cy: 8, r: 2.1, fill: '#ffe9a6' }));
  return s;
}

/** A closed bud — waiting for its moment. */
export function budSvg(tint: string): SVGElement {
  const s = svgEl('svg', { viewBox: '0 0 24 24', class: 'bud-svg', 'aria-hidden': 'true' });
  s.append(
    svgEl('path', {
      d: 'M12 22 C12 18 12 15 12 12',
      fill: 'none',
      stroke: '#5fae6e',
      'stroke-width': 1.5,
      'stroke-linecap': 'round',
    }),
    svgEl('path', { d: 'M12 12 C9.4 10.8 9 7.8 12 5.6 C15 7.8 14.6 10.8 12 12', fill: tint, opacity: 0.75 }),
  );
  return s;
}

/* ---------- the garden life layer (bloom ladder 0..5) ---------- */

export const BLOOM_STAGES = ['soil', 'sprouts', 'flowers', 'butterflies', 'trees', 'full'] as const;
export type BloomStage = (typeof BLOOM_STAGES)[number];

/** Global progress → visual stage (the ladder caps at 5). */
export function bloomStageFor(level: number): BloomStage {
  return BLOOM_STAGES[Math.max(0, Math.min(5, Math.floor(level)))];
}

function sproutSvg(seed: number): SVGElement {
  const s = svgEl('svg', { viewBox: '0 0 24 24', class: 'life-sprout', 'aria-hidden': 'true' });
  const bend = seed % 2 === 0 ? 1 : -1;
  s.append(
    svgEl('path', {
      d: `M12 22 C12 17 12 14 12 11`,
      fill: 'none',
      stroke: '#69b97a',
      'stroke-width': 1.8,
      'stroke-linecap': 'round',
    }),
    svgEl('path', {
      d: `M12 13 C${12 + bend * 4} 12 ${12 + bend * 5.4} 9.6 ${12 + bend * 4.6} 7.4 C${12 + bend * 1.6} 9 12 11 12 13`,
      fill: '#8fd69b',
    }),
  );
  return s;
}

function butterflySvg(seed: number): SVGElement {
  const s = svgEl('svg', { viewBox: '0 0 24 24', class: 'life-butterfly', 'aria-hidden': 'true' });
  const tint = ['#ffd76a', '#f2549a', '#7dffb8', '#ffa552'][seed % 4];
  s.append(
    svgEl('ellipse', { cx: 8.6, cy: 10.6, rx: 4.4, ry: 3.1, transform: 'rotate(-24 8.6 10.6)', fill: tint, opacity: 0.9 }),
    svgEl('ellipse', { cx: 15.4, cy: 10.6, rx: 4.4, ry: 3.1, transform: 'rotate(24 15.4 10.6)', fill: tint, opacity: 0.9 }),
    svgEl('ellipse', { cx: 9.4, cy: 14.2, rx: 3, ry: 2.2, fill: tint, opacity: 0.7 }),
    svgEl('ellipse', { cx: 14.6, cy: 14.2, rx: 3, ry: 2.2, fill: tint, opacity: 0.7 }),
    svgEl('rect', { x: 11.3, y: 7.4, width: 1.4, height: 8.4, rx: 0.7, fill: '#4a3560' }),
  );
  return s;
}

function treeSvg(seed: number): SVGElement {
  const s = svgEl('svg', { viewBox: '0 0 24 24', class: 'life-tree', 'aria-hidden': 'true' });
  s.append(
    svgEl('rect', { x: 10.8, y: 13, width: 2.4, height: 8, rx: 1.1, fill: '#8a5a3b' }),
    svgEl('circle', { cx: 12, cy: 9.4, r: 5.4, fill: '#69b97a', opacity: 0.95 }),
    svgEl('circle', { cx: 8.4, cy: 11.4, r: 3.4, fill: '#7dcb8b', opacity: 0.9 }),
    svgEl('circle', { cx: 15.6, cy: 11.2, r: 3.6, fill: '#5fae6e', opacity: 0.9 }),
    svgEl('circle', { cx: 12 + (seed % 3) - 1, cy: 7.4, r: 1, fill: '#ffe9a6', opacity: 0.9 }),
  );
  return s;
}

function fireflySvg(seed: number): SVGElement {
  const s = svgEl('svg', { viewBox: '0 0 24 24', class: 'life-firefly', 'aria-hidden': 'true' });
  s.append(
    svgEl('circle', { cx: 12, cy: 12, r: 5.4, fill: '#ffe9a6', opacity: 0.22 }),
    svgEl('circle', { cx: 12, cy: 12, r: 1.7, fill: '#fff7d6', opacity: 0.95 + (seed % 2) * 0.05 }),
  );
  return s;
}

function starSvg(seed: number): SVGElement {
  const s = svgEl('svg', { viewBox: '0 0 24 24', class: 'life-star', 'aria-hidden': 'true' });
  const r1 = seed % 2 === 0 ? 3.4 : 2.6;
  s.append(
    svgEl('path', {
      d: `M12 9 L12.9 11.1 L15 12 L12.9 12.9 L12 15 L11.1 12.9 L9 12 L11.1 11.1 Z`,
      fill: '#fff7d6',
      opacity: 0.9,
    }),
    svgEl('circle', { cx: 12, cy: 12, r: r1 * 0.28, fill: '#fff7d6', opacity: 0.4 }),
  );
  return s;
}

/**
 * Build the decorative life layer for a bloom stage. Elements stack:
 * every stage keeps the previous ones (flowers stay when butterflies
 * arrive). `w`/`h` are the layer's box in arbitrary units — placement
 * uses percentages so CSS scales it.
 */
export function buildLifeLayer(stage: BloomStage): HTMLElement {
  const layer = document.createElement('div');
  layer.className = `garden-life stage-${stage}`;
  layer.setAttribute('aria-hidden', 'true');
  layer.dataset.stage = stage;

  /* soil baseline (always there — the garden's ground) */
  const soil = document.createElement('div');
  soil.className = 'life-soil';
  layer.append(soil);

  let seed = 0;
  const sprinkle = (cls: string, maker: (seed: number) => SVGElement, count: number, yMin: number, yMax: number): void => {
    for (let i = 0; i < count; i++) {
      const holder = document.createElement('span');
      holder.className = cls;
      holder.style.left = `${(6 + ((seed * 37) % 88))}%`;
      holder.style.top = `${yMin + ((seed * 53) % Math.max(1, yMax - yMin))}%`;
      holder.style.setProperty('--d', `${(2 + (seed % 5) * 0.7).toFixed(1)}s`);
      holder.style.setProperty('--delay', `${(seed % 9) * 0.45}s`);
      holder.append(maker(seed));
      layer.append(holder);
      seed = (seed * 7 + 3) % 97;
    }
  };

  if (stage === 'soil') return layer;

  /* level 1+: sprouts */
  sprinkle('life-item sprouts', sproutSvg, 7, 58, 78);
  if (stage === 'sprouts') return layer;

  /* level 2+: flowers */
  sprinkle('life-item flowers', (sd) => flowerSvg(['#ffd76a', '#f2549a', '#7dffb8', '#ff8bd4'][sd % 4], sd), 8, 46, 74);
  if (stage === 'flowers') return layer;

  /* level 3+: butterflies */
  sprinkle('life-item butterflies', butterflySvg, 3, 12, 44);
  if (stage === 'butterflies') return layer;

  /* level 4+: small trees */
  sprinkle('life-item trees', treeSvg, 3, 40, 62);
  if (stage === 'trees') return layer;

  /* level 5: full garden + fireflies + a few early stars */
  sprinkle('life-item fireflies', fireflySvg, 7, 14, 70);
  sprinkle('life-item stars', starSvg, 5, 6, 26);
  return layer;
}

/**
 * The per-zone growth row: `done` open flowers, remaining slots as
 * buds (up to `slots`). When `animate` is true the LAST flower gets
 * the bloom-in payoff (only on a refresh where the count grew).
 */
export function buildZoneGrowth(tint: string, done: number, slots = 6, animate = false): HTMLElement {
  const row = document.createElement('span');
  row.className = 'zone-growth';
  row.setAttribute('aria-hidden', 'true');
  const open = Math.min(done, slots);
  for (let i = 0; i < slots; i++) {
    const holder = document.createElement('span');
    holder.className = `growth-flower${i < open ? ' is-open' : ''}${animate && i === open - 1 && open > 0 ? ' bloom-in' : ''}`;
    holder.style.setProperty('--i', String(i));
    holder.append(i < open ? flowerSvg(tint, i) : budSvg(tint));
    row.append(holder);
  }
  if (done > slots) {
    const more = document.createElement('span');
    more.className = 'growth-more';
    more.textContent = `+${done - slots}`;
    row.append(more);
  }
  return row;
}
