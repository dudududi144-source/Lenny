/* ============================================================
 * Loader — a tiny reusable loading indicator.
 *
 * Why this exists: every game loads the illustrated background
 * (a large asset) in preload(). Without feedback, children stare
 * at a frozen screen. This shows a calm "loading" bubble that
 * disappears automatically when the assets are ready.
 *
 * Usage in a scene:
 *   preload(): void {
 *     showLoader(this);
 *     this.load.image(...);
 *   }
 * ============================================================ */

import Phaser from 'phaser';

/** Show a gentle loading indicator until the scene's assets finish loading. */
export function showLoader(scene: Phaser.Scene): void {
  const w = scene.scale.width, h = scene.scale.height;
  const bg = scene.add.rectangle(w / 2, h / 2, w, h, 0x0b0726, 0.75).setDepth(998);
  const dot = scene.add.circle(w / 2, h / 2, 10, 0xffd76a, 1).setDepth(999);
  const label = scene.add.text(w / 2, h / 2 + 34, 'טוֹעֵן...', {
    fontFamily: 'Heebo, Arial', fontSize: '18px', color: '#fff6ec',
  }).setOrigin(0.5).setDepth(999);

  /* gentle pulse while waiting */
  const pulse = scene.tweens.add({ targets: dot, scale: 1.4, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

  const cleanup = () => { pulse.stop(); bg.destroy(); dot.destroy(); label.destroy(); };
  scene.load.on('complete', cleanup);
  scene.load.on('loaderror', cleanup);
}
