/* Mirror of ui/styles/tokens.css for the Pixi scenes.
   Keep both in sync — the DOM shell owns the canonical tokens. */

export const COLORS = {
  void: 0x050810,
  night: 0x0a0f1e,
  dawn: 0x1a1f3a,
  glow: 0xffd76a,
  glowSoft: 0xffe9a6,
  ember: 0xff9e5e,
  spark: 0x7c4dff,
  sparkLight: 0x4a9eff,
  mint: 0x7dffb8,
  coral: 0xf2549a,
  cream: 0xfff6ec,
  /** platform-wide "show hint" language (same hex the old scenes used) */
  hint: 0xff8ad9,
  showBadge: 0xfff3dc,
} as const;

export const DESIGN = { w: 420, h: 720 } as const;

export function rgba(hex: number, alpha: number): string {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}
