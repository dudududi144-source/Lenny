/* ============================================================
 * DragDropSystem — a reusable drag-and-drop manager.
 *
 * Why this exists: matching/building/sorting games all need to
 * drag items to targets. Instead of re-implementing hit-testing,
 * snap-back, and drop validation in each scene, we build ONE
 * solid system and reuse it.
 *
 * Design notes (the exemplar part):
 *  - Draggables and targets are plain data (positions + ids).
 *  - The system handles pointer logic; the scene draws the visuals.
 *  - Drop validation via a scene-provided callback (isValidDrop).
 *  - Failed drops animate back to origin (snap-back).
 * ============================================================ */

import Phaser from 'phaser';

export interface DragItem {
  id: string;
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  placed: boolean;
}

export interface DropTarget {
  id: string;
  x: number;
  y: number;
  radius: number;
  occupied: boolean;
}

export interface DragCallbacks {
  /* return true if this item may drop on this target */
  isValidDrop: (itemId: string, targetId: string) => boolean;
  /* fired on a successful drop */
  onDrop: (itemId: string, targetId: string) => void;
  /* fired when a drop is rejected (item snaps back) */
  onReject?: (itemId: string) => void;
}

export class DragDropSystem {
  private scene: Phaser.Scene;
  items: DragItem[] = [];
  targets: DropTarget[] = [];
  private cb: DragCallbacks;
  private dragging: string | null = null;
  private grabDX = 0;
  private grabDY = 0;

  constructor(scene: Phaser.Scene, cb: DragCallbacks) {
    this.scene = scene;
    this.cb = cb;
  }

  addItem(id: string, x: number, y: number): void {
    this.items.push({ id, x, y, homeX: x, homeY: y, placed: false });
  }

  addTarget(id: string, x: number, y: number, radius: number): void {
    this.targets.push({ id, x, y, radius, occupied: false });
  }

  /** Call from the scene's pointerdown handler. */
  pointerDown(px: number, py: number): void {
    /* pick the top-most unplaced item under the pointer */
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      if (it.placed) continue;
      if (Math.hypot(px - it.x, py - it.y) < 42) {
        this.dragging = it.id;
        this.grabDX = it.x - px;
        this.grabDY = it.y - py;
        return;
      }
    }
  }

  /** Call from the scene's pointermove handler. */
  pointerMove(px: number, py: number): void {
    if (!this.dragging) return;
    const it = this.getItem(this.dragging);
    if (!it) return;
    it.x = px + this.grabDX;
    it.y = py + this.grabDY;
  }

  /** Call from the scene's pointerup handler. */
  pointerUp(px: number, py: number): void {
    if (!this.dragging) return;
    const it = this.getItem(this.dragging);
    this.dragging = null;
    if (!it) return;

    const target = this.findTarget(px, py);
    if (target && !target.occupied && this.cb.isValidDrop(it.id, target.id)) {
      it.x = target.x;
      it.y = target.y;
      it.placed = true;
      target.occupied = true;
      this.cb.onDrop(it.id, target.id);
    } else {
      /* snap back home with a small tween */
      if (this.cb.onReject) this.cb.onReject(it.id);
      const proxy = { x: it.x, y: it.y };
      this.scene.tweens.add({
        targets: proxy,
        x: it.homeX,
        y: it.homeY,
        duration: 220,
        ease: 'Quad.easeOut',
        onUpdate: () => { it.x = proxy.x; it.y = proxy.y; },
      });
    }
  }

  private getItem(id: string): DragItem | undefined {
    return this.items.find((i) => i.id === id);
  }

  private findTarget(px: number, py: number): DropTarget | undefined {
    for (const t of this.targets) {
      if (Math.hypot(px - t.x, py - t.y) < t.radius) return t;
    }
    return undefined;
  }

  /** Which item is currently being dragged (or null). */
  activeDrag(): string | null {
    return this.dragging;
  }
}
