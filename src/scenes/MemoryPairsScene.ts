/* ============================================================
 * MemoryPairsScene — Stage 2b: a LEVEL GENERATOR for working
 * memory. Lives in Memory Hill (zone: memory-hill).
 *
 * What Stage 2b changed (the GlowFish template applied to cards):
 *  - Every card face is a (suit, tone) KIND (8 kinds, CardTypes):
 *    flower / bug / fish / tree, in warm (coral-gold) or cool
 *    (violet-mint) clothing. Vector-drawn, no emoji, no letters
 *    on the faces — the backs carry no hints either.
 *  - The DDA's continuous level picks HOW SIMILAR the pair kinds
 *    in the deck are to each other: wanted = 0.15 + level * 0.55.
 *    Low level -> pairs are strangers; high level -> near-twins
 *    (same family, different tone).
 *  - Exposure is a difficulty axis too: none (static study time)
 *    -> peek (one 1.2s full reveal) -> peek-plus (0.8s reveal and
 *    a dim aid over failed cards after 4 misses).
 *  - Mismatches are classified (near-miss-same-suit-diff-tone /
 *    near-miss-same-suit / near-miss-same-tone / far-pair) and
 *    answered with Lenny's specific Hebrew feedback. The hint
 *    ladder is now VISIBLE: the show-hint paints a pink aura
 *    (0xff8ad9 — a pink used nowhere else in this scene) around
 *    the first pick's twin for 1.2s; the clear hint sparkles there.
 *
 * Gate B contract preserved (unchanged from Stage 0-1):
 *  - outcome() fires ONLY at the win boundary (one win per game):
 *    outcome(true, max(0.3, 1 - mistakes * 0.2)). outcome(false)
 *    is NEVER called; misses feed LearningSignals + hint ladder
 *    (no fail state for age 4-7).
 *  - recordZoneFinish gets real elapsed seconds.
 * ============================================================ */

import Phaser from 'phaser';
import { recordZoneFinish } from '../games/core/ProgressStore';
import { showLoader } from '../games/fx/Loader';
import { AdaptiveDifficulty, HintStrength } from '../games/core/AdaptiveDifficulty';
import { LearningSignals } from '../games/core/LearningSignals';
import { GameSpec } from '../games/builder/GameSpec';
import { CardFlipSystem } from '../games/fx/CardFlipSystem';
import { ProgressRing } from '../games/fx/ProgressRing';
import { DialogueBox } from '../games/fx/DialogueBox';
import { ParticleBurst, bloomBurst, sparkleBurst } from '../games/fx/ParticleBurst';
import {
  CardType,
  Exposure,
  selectPairTypes,
  exposureFor,
  errorKindFor,
  colorFor,
} from '../games/fx/CardTypes';

interface Card {
  pairId: number;
  kind: CardType;
  matched: boolean;
}

/* tuning constants (kept in one place for review) */
const PEEK_SETTLE_MS = 400;  /* let the backs paint before the reveal flips */
const FLIP_MS = 320;         /* CardFlipSystem tween: 160 in + 160 out */
const MATCH_LOCK_MS = 500;
const MISS_LOCK_MS = 800;
const LOCK_PAD_MS = 80;      /* pad over the flip tail before input unlocks */
const AURA_MS = 1200;
const WIN_GAP_MS = 2600;
/* the show-hint aura: a pink used NOWHERE else in this scene, so the
   e2e suite can locate it by pixels alone */
const AURA_HEX = 0xff8ad9;
/* card face + ink */
const FACE_HEX = 0xfff9f0;
const FACE_EDGE_HEX = 0xe8d9c8;

export class MemoryPairsScene extends Phaser.Scene {
  /* cognitive core engines */
  private dda = new AdaptiveDifficulty('memory-hill');
  private signals = new LearningSignals();
  private seenCards = new Set<number>();
  private roundStart = 0;
  private mistakes = 0;
  private consecutiveMiss = 0;
  private spec: GameSpec | null = null;

  /* the level generator's plan for this round */
  private exposure: Exposure = { mode: 'none', peekMs: 0, dimAfterMisses: Infinity };

  private grid!: CardFlipSystem;
  private ring!: ProgressRing;
  private dialogue!: DialogueBox;
  private burst!: ParticleBurst;
  /* layering: grid backs (depth 0) < dim aid (9) < fronts (10) < aura (11) */
  private dimG!: Phaser.GameObjects.Graphics;
  private frontG!: Phaser.GameObjects.Graphics;
  private hintG!: Phaser.GameObjects.Graphics;

  private cards: Card[] = [];
  /* slots whose vector FRONT is currently drawn (flipped up) */
  private showing = new Set<number>();
  /* slots that took part in a failed attempt (peek-plus dim aid) */
  private openedFailed = new Set<number>();
  private firstPick: number | null = null;
  private lock = false;
  private foundPairs = 0;
  private totalPairs = 6;
  private done = false;

  /* show-hint state */
  private showAuraSlot: number | null = null;
  private showAuraUntil = 0;

  constructor() { super('memory-pairs'); }

  init(data: { spec?: GameSpec }): void {
    this.spec = (data && data.spec) ? data.spec : null;
  }

  preload(): void {
    showLoader(this);
    this.load.image('butterfly', 'art/butterfly.png');
    this.load.image('garden-bg', 'art/garden-bg.png');
  }

  create(): void {
    this.foundPairs = 0;
    this.done = false;
    this.mistakes = 0;
    this.consecutiveMiss = 0;
    this.firstPick = null;
    this.lock = false;
    this.seenCards = new Set<number>();
    this.showing = new Set<number>();
    this.openedFailed = new Set<number>();
    this.showAuraSlot = null;
    this.showAuraUntil = 0;
    const w = this.scale.width, h = this.scale.height;

    /* illustrated background */
    const bg = this.add.image(w / 2, h / 2, 'garden-bg');
    bg.setDisplaySize(w, h);
    bg.setAlpha(0.6);

    /* butterfly companion top-right */
    const bf = this.add.image(w * 0.85, h * 0.12, 'butterfly');
    bf.setDisplaySize(70, 70);
    this.tweens.add({ targets: bf, y: bf.y - 6, duration: 1000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    this.add.rectangle(w / 2, h / 2, w, h, 0x1a1040, 0.45);

    /* adaptive difficulty: the DDA tier picks how many pairs to show;
       the CONTINUOUS level picks how similar they look and how much
       the child is shown up front — one number, three knobs */
    const layouts: { pairs: number; rows: number; cols: number }[] = [
      { pairs: 3, rows: 2, cols: 3 },
      { pairs: 4, rows: 2, cols: 4 },
      { pairs: 6, rows: 3, cols: 4 },
      { pairs: 6, rows: 3, cols: 4 },
    ];
    const level = this.dda.level();
    this.exposure = exposureFor(level);
    const specPairs = (this.spec && this.spec.params) ? this.spec.params.itemCount : undefined;
    const bySpec = specPairs ? layouts.find((l) => l.pairs === specPairs) : undefined;
    const layout = bySpec || layouts[Math.min(this.dda.tier(), layouts.length - 1)];
    this.totalPairs = layout.pairs;

    /* card grid sized to the adaptive pair count */
    this.grid = new CardFlipSystem(this, {
      rows: layout.rows,
      cols: layout.cols,
      areaX: w * 0.08,
      areaY: h * 0.22,
      areaW: w * 0.84,
      areaH: h * 0.5,
      gap: 10,
    });

    /* particles above the card backs: constructed AFTER the grid so
       at equal depth the insertion order puts them on top (the
       clear-hint sparkle lands on a face-DOWN twin — it must paint
       over the back, not under it) */
    this.burst = new ParticleBurst(this);

    this.dimG = this.add.graphics().setDepth(9);
    this.frontG = this.add.graphics().setDepth(10);
    this.hintG = this.add.graphics().setDepth(11);

    /* progress ring top-right */
    this.ring = new ProgressRing(this, { x: w - 40, y: 55, radius: 18 });
    this.ring.setCounts(0, this.totalPairs);

    /* Lenny introduces the game */
    this.dialogue = new DialogueBox(this, { x: w / 2, y: h * 0.88, width: w * 0.85 });
    const intro = (this.spec && this.spec.narrative && this.spec.narrative.intro.length > 0)
      ? this.spec.narrative.intro
      : ['הַפַּרְפַּר שָׁכַח אֵיפֹה הַפְּרָחִים שֶׁלּוֹ.', 'בּוֹא נִמְצָא אֶת הַזּוּגוֹת!'];
    this.dialogue.say(intro);

    /* build the deck: totalPairs DISTINCT kinds whose mutual similarity
       follows the level; each kind dealt exactly twice, shuffled */
    const deck = selectPairTypes(this.totalPairs, level);
    const ids: number[] = [];
    for (let i = 0; i < this.totalPairs; i++) ids.push(i, i);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    this.cards = ids.map((pairId) => ({ pairId, kind: deck[pairId], matched: false }));

    this.grid.drawBacks();

    this.roundStart = this.time.now;
    if (this.exposure.mode !== 'none') this.startPeek();
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
  }

  /* ==========================================================
   * Exposure ladder (the reveal protocol)
   * ========================================================== */

  private startPeek(): void {
    this.lock = true;
    this.time.delayedCall(PEEK_SETTLE_MS, () => {
      if (this.done) return;
      /* reveal everything with REAL flip-ups */
      for (let i = 0; i < this.cards.length; i++) {
        this.grid.flipUp(i, () => this.showIcon(i));
      }
      this.time.delayedCall(FLIP_MS + this.exposure.peekMs, () => this.endPeek());
    });
  }

  private endPeek(): void {
    if (this.done) return;
    /* hide everything with REAL flip-downs (no hard cuts) */
    for (let i = 0; i < this.cards.length; i++) {
      this.grid.flipDown(i, () => this.hideIcon(i));
    }
    /* the tweens finish ~FLIP_MS from now; release the input lock
       only after the backs are truly back (a tap eaten by the flip
       tail would poison the first pick) */
    this.time.delayedCall(FLIP_MS + LOCK_PAD_MS, () => { this.lock = false; });
  }

  /* ==========================================================
   * Input
   * ========================================================== */

  private onTap(p: Phaser.Input.Pointer): void {
    if (this.lock || this.done) return;
    this.dialogue.skip();
    const idx = this.grid.hitTest(p.x, p.y);
    if (idx === null) return;
    const card = this.cards[idx];
    if (card.matched) return;
    /* re-tapping the held card must never resolve against itself */
    if (idx === this.firstPick) return;

    this.grid.flipUp(idx, () => this.showIcon(idx));

    if (this.firstPick === null) {
      this.firstPick = idx;
    } else {
      const first = this.firstPick;
      this.firstPick = null;
      if (this.cards[first].pairId === card.pairId) {
        this.onMatch(first, idx);
      } else {
        this.onMiss(first, idx);
      }
    }
  }

  private onMatch(first: number, idx: number): void {
    this.consecutiveMiss = 0;
    this.lock = true;
    this.time.delayedCall(MATCH_LOCK_MS, () => {
      this.cards[first].matched = true;
      this.cards[idx].matched = true;
      this.foundPairs++;
      this.signals.attempt('memory.pairs', true); /* per matched pair */
      this.ring.setCounts(this.foundPairs, this.totalPairs);
      const slot = this.grid.slots[idx];
      this.burst.emit(bloomBurst(slot.x, slot.y));
      if (this.foundPairs >= this.totalPairs) {
        this.win();
      } else {
        this.lock = false;
      }
    });
  }

  private onMiss(first: number, idx: number): void {
    this.mistakes++;
    this.consecutiveMiss++;
    /* error taxonomy on the card KINDS: the feedback names WHAT was
       almost right (family? tone?) instead of a generic "try again" */
    const kind = errorKindFor(this.cards[first].kind, this.cards[idx].kind);
    this.signals.attempt('memory.pairs', false);
    this.signals.errorKind('memory.pairs', kind);
    this.openedFailed.add(first);
    this.openedFailed.add(idx);

    /* visible, escalating help: gentle -> clear -> show */
    const hint = this.dda.suggestHint(this.consecutiveMiss);
    if (hint !== 'none') this.signals.hintUsed('memory.pairs');
    if (hint === 'clear' || hint === 'show') {
      const twin = this.twinOf(first);
      if (twin >= 0) {
        if (hint === 'clear') {
          this.burst.emit(sparkleBurst(this.grid.slots[twin].x, this.grid.slots[twin].y));
        } else {
          this.showAuraSlot = twin;
          this.showAuraUntil = this.time.now + AURA_MS;
        }
      }
    }
    this.dialogue.say([this.lineFor(kind, hint)]);

    this.lock = true;
    this.time.delayedCall(MISS_LOCK_MS, () => {
      this.grid.flipDown(first, () => this.hideIcon(first));
      this.grid.flipDown(idx, () => this.hideIcon(idx));
      /* both tweens finish ~FLIP_MS from now */
      this.time.delayedCall(FLIP_MS + LOCK_PAD_MS, () => { this.lock = false; });
    });
  }

  private twinOf(idx: number): number {
    for (let j = 0; j < this.cards.length; j++) {
      if (j !== idx && this.cards[j].pairId === this.cards[idx].pairId) return j;
    }
    return -1;
  }

  /* Hebrew feedback: taxonomy lines verbatim (spec), same-tone
     completion line, then the escalating hint lines */
  private lineFor(kind: string, hint: HintStrength): string {
    if (hint === 'show') return 'הַזּוּג שֶׁל הַקֶּלֶף הָרִאשׁוֹן מֵהַבֵּב בְּוָרוֹד — הַקִּישׁוּ עָלָיו';
    if (hint === 'clear') return 'הַנְּצִנְצִים מֵהַבְּבִים עַל הַזּוּג — בֹּאוּ נִזְכֹּר';
    if (hint === 'gentle') return 'נַסּוּ לִזְכֹּר אֵיפֹה הָיָה הַקֶּלֶף הָרִאשׁוֹן';
    switch (kind) {
      case 'near-miss-same-suit-diff-tone':
        return 'כַּמְעַט! אוֹתָהּ מִשְׁפָּחָה — שִׂימִי לֵב לַגַּוָּן';
      case 'near-miss-same-suit':
        return 'אוֹתָהּ מִשְׁפָּחָה, גַּם אוֹתוֹ גַּוָּן — אֲבָל לֹא אוֹתוֹ כֶּרְטִיס!';
      case 'near-miss-same-tone':
        return 'כַּמְעַט! אוֹתוֹ גַּוָּן — אֲבָל מִשְׁפָּחָה אַחֶרֶת';
      default:
        return 'אֵלּוּ שְׁנֵי כֶּרְטִיסִים שׁוֹנִים מְאֹד';
    }
  }

  /* ==========================================================
   * Card faces (vector fronts — no emoji, no letters)
   * ========================================================== */

  private showIcon(idx: number): void {
    this.seenCards.add(idx); /* the child has now seen this card */
    this.showing.add(idx);
  }

  private hideIcon(idx: number): void {
    this.showing.delete(idx);
  }

  /* face-up fronts, drawn every frame above the backs */
  private drawFronts(): void {
    const g = this.frontG;
    g.clear();
    for (const idx of this.showing) {
      const s = this.grid.slots[idx];
      g.fillStyle(FACE_HEX, 1);
      g.fillRoundedRect(s.x - s.w / 2 + 2, s.y - s.h / 2 + 2, s.w - 4, s.h - 4, 10);
      g.lineStyle(2, FACE_EDGE_HEX, 1);
      g.strokeRoundedRect(s.x - s.w / 2 + 2, s.y - s.h / 2 + 2, s.w - 4, s.h - 4, 10);
      this.drawKind(g, s.x, s.y, s.w, this.cards[idx].kind);
    }
  }

  /* one shared renderer per suit; signatures are deliberately
     distinct for pixel classification:
       flower  disc + 6 DETACHED petals (empty gap ring between)
       bug     body ellipse + 6 thin detached legs BELOW center
       fish    right-shifted body + tail on the LEFT (asymmetric)
       tree    crown on top + narrow trunk (top-heavy)
     u = card width * 0.44; component gaps ~0.1-0.2u so
     anti-aliasing can never fuse them into one blob */
  private drawKind(
    g: Phaser.GameObjects.Graphics,
    cx: number,
    cy: number,
    cardW: number,
    kind: CardType,
  ): void {
    const hex = colorFor(kind);
    const u = cardW * 0.44;
    g.fillStyle(hex, 1);

    switch (kind.suit) {
      case 'flower': {
        g.fillCircle(cx, cy, u * 0.30);
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 3) * k - Math.PI / 2;
          g.fillCircle(cx + Math.cos(a) * u * 0.64, cy + Math.sin(a) * u * 0.64, u * 0.15);
        }
        break;
      }
      case 'bug': {
        g.fillEllipse(cx, cy - u * 0.06, u * 0.88, u * 0.56);
        for (const off of [-0.33, -0.20, -0.07, 0.07, 0.20, 0.33]) {
          g.fillRect(cx + off * u - u * 0.02, cy + u * 0.32, u * 0.04, u * 0.26);
        }
        break;
      }
      case 'fish': {
        g.fillEllipse(cx + u * 0.18, cy, u * 0.94, u * 0.52);
        g.fillTriangle(
          cx - u * 0.42, cy,
          cx - u * 0.72, cy - u * 0.22,
          cx - u * 0.72, cy + u * 0.22,
        );
        break;
      }
      case 'tree': {
        g.fillCircle(cx, cy - u * 0.20, u * 0.40);
        g.fillRect(cx - u * 0.08, cy + u * 0.26, u * 0.16, u * 0.46);
        break;
      }
    }
  }

  /* peek-plus memory aid: after enough misses, the backs of cards
     that took part in failed attempts dim slightly (the child has
     already excluded them — trimming the working-memory load is
     what keeps the hardest similarity band playable).
     A dark rounded rect over the slot — no CardFlipSystem change. */
  private drawDimAid(): void {
    const g = this.dimG;
    g.clear();
    if (this.exposure.mode !== 'peek-plus') return;
    if (this.mistakes < this.exposure.dimAfterMisses) return;
    g.fillStyle(0x0b0726, 0.35);
    for (const idx of this.openedFailed) {
      if (this.cards[idx].matched) continue;
      const s = this.grid.slots[idx];
      g.fillRoundedRect(s.x - s.w / 2, s.y - s.h / 2, s.w, s.h, 12);
    }
  }

  /* the show-hint: a pink aura around the first pick's twin */
  private drawAura(): void {
    const g = this.hintG;
    g.clear();
    const now = this.time.now;
    if (this.showAuraSlot === null || now >= this.showAuraUntil) return;
    const s = this.grid.slots[this.showAuraSlot];
    g.lineStyle(8, AURA_HEX, 0.95);
    g.strokeRoundedRect(s.x - s.w / 2 - 7, s.y - s.h / 2 - 7, s.w + 14, s.h + 14, 14);
  }

  /* ==========================================================
   * Round boundary (the ONLY place outcome() fires — Gate B)
   * ========================================================== */

  private win(): void {
    this.done = true;
    const secs = (this.time.now - this.roundStart) / 1000;
    this.dda.outcome(true, Math.max(0.3, 1 - this.mistakes * 0.2));
    this.dialogue.say(['וָאו, כָּל הַכָּבוֹד!', 'הַפַּרְפַּר נִזְכַּר בַּכֹּל!']);

    /* real elapsed seconds feed the PlayerModel tempo signal */
    recordZoneFinish('memory-hill', secs);

    this.time.delayedCall(WIN_GAP_MS, () => this.scene.start('portal'));
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000;
    this.burst.update(dt);
    this.ring.update(dt);
    this.dialogue.update(dt);
    this.grid.drawBacks();
    this.drawDimAid();
    this.drawFronts();
    this.drawAura();
  }
}
