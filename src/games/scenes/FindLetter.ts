import { Container, Graphics, Sprite } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { softGlowTexture, sparkTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';
import { SkillBridge } from '../core/SkillBridge';

const TARGET_HIT = 40;
const TILE_W = 62;
const TILE_H = 50;

interface LetterSpot {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  glyph: string;
  tile: Container;
  phase: number;
}

/**
 * FindLetter — letter recognition (words-valley).
 * Ported 1:1 from the Phaser scene: 6 distinct letters, confusable
 * partners planted at level>=0.5, per-letter skill wiring through
 * SkillBridge (shared signals), verbatim hint ladder.
 */
export class FindLetterScene extends GameScene {
  private totalRounds = 5;
  private found = 0;
  private lock = false;
  private targetLetter = '';
  private spots: LetterSpot[] = [];
  private board = new Container();
  private wrongSinceLastFind = 0;
  private lastHint: 'none' | 'gentle' | 'clear' | 'show' = 'none';
  private skillBridge: SkillBridge;
  private bunny!: Container;

  private readonly GLYPH_SKILL: Record<string, string> = {
    'א': 'letter.alef',
    'ב': 'letter.bet',
  };

  private readonly CONFUSABLES: Record<string, string> = {
    'ב': 'כ', 'כ': 'ב',
    'מ': 'ס', 'ס': 'מ',
    'ד': 'ר', 'ר': 'ד',
  };

  private readonly LETTERS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת'];

  constructor(ctx: SceneCtx) {
    super(ctx);
    /* shares the scene's signals: acquisition fires only when a skill
       crosses the mastery threshold (3 corrects), never on 1 success */
    this.skillBridge = new SkillBridge(this.signals);
    this.root.addChild(this.board);
    this.build();
  }

  protected build(): void {
    this.totalRounds = this.ctx.spec?.params.rounds ?? 5;

    /* vector bunny companion (no bitmap art) */
    this.bunny = new Container();
    const body = new Graphics();
    body.circle(0, 6, 13).fill({ color: 0xe8d9c8 });
    body.circle(0, -12, 10).fill({ color: 0xe8d9c8 });
    body.ellipse(-5, -26, 4, 11).fill({ color: 0xe8d9c8 });
    body.ellipse(5, -26, 4, 11).fill({ color: 0xe8d9c8 });
    body.circle(-3.5, -13, 1.8).fill({ color: 0x1c1430 });
    body.circle(3.5, -13, 1.8).fill({ color: 0x1c1430 });
    this.bunny.addChild(body);
    const bunnyHalo = this.glowSprite(COLORS.glowSoft, 70, 0.35);
    this.bunny.addChildAt(bunnyHalo, 0);
    this.bunny.x = this.w * 0.85;
    this.bunny.y = this.h * 0.1;
    this.board.addChild(this.bunny);
    this.anim.loop(() => {
      this.bunny.y = this.h * 0.1 + Math.sin(this.t / 500) * 6;
    });

    this.say(this.ctx.spec?.narrative.intro ?? ['הָאַרְנֶבֶת אִבְּדָה אֶת הָאוֹתִיּוֹת']);
    this.ctx.hud.ringCounts(0, this.totalRounds);
    this.newRound();
  }

  private newRound(): void {
    for (const spot of this.spots) if (!spot.tile.destroyed) spot.tile.destroy({ children: true });
    this.spots = [];

    const pool = [...this.LETTERS];
    const chosen: string[] = [];
    const level = this.dda.level();
    for (let i = 0; i < 6; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      chosen.push(pool[idx]);
      pool.splice(idx, 1);
    }
    const targetIdx = Math.floor(Math.random() * 6);
    const target = chosen[targetIdx];
    this.targetLetter = target;
    /* audit 9-d #5: the letter is SPOKEN (audit mandate: language is the
       weakest category) — pre-readers hear the target, not just see it.
       Guarded: no WebSpeech / muted choice / missing voice = silent. */
    this.speakLetter(target);
    const partner = this.CONFUSABLES[target];
    if (level >= 0.5 && partner && !chosen.includes(partner)) {
      const slot = chosen.findIndex((c, i) => i !== targetIdx);
      chosen[slot] = partner;
    }

    this.say([`אֵיפֹה הָאוֹת ${target}?`]);
    this.ctx.hud.mission?.(`מְבֻקֶּשֶׁת הָאוֹת ${target}`);

    for (let i = 0; i < 6; i++) {
      const x = this.w * (0.25 + (i % 3) * 0.25);
      const y = this.h * (0.42 + Math.floor(i / 3) * 0.22);
      const tile = new Container();
      tile.x = x;
      tile.y = y;

      /* firefly-lantern: warm glass tile with a glowing letter */
      const shape = new Graphics();
      shape.roundRect(-TILE_W / 2, -TILE_H / 2, TILE_W, TILE_H, 14).fill({ color: 0x7c4dff, alpha: 0.92 });
      shape.roundRect(-TILE_W / 2 + 2, -TILE_H / 2 + 2, TILE_W - 4, TILE_H - 4, 12).stroke({ color: 0x9b74ff, width: 2, alpha: 0.9 });
      tile.addChild(shape);

      const halo = new Sprite(softGlowTexture());
      halo.anchor.set(0.5);
      halo.tint = 0xffffff;
      halo.alpha = 0.16;
      halo.blendMode = 'add';
      halo.width = TILE_W;
      halo.height = TILE_H * 0.7;
      halo.y = -TILE_H * 0.2;
      tile.addChild(halo);

      const glyph = this.label(chosen[i], 38, COLORS.cream, '700');
      tile.addChild(glyph);
      tile.scale.set(0);
      this.board.addChild(tile);
      this.anim.to(tile, { scale: 1 }, { durationMs: 420, delayMs: i * 60, ease: ease.outBack });
      this.spots.push({ x, y, baseX: x, baseY: y, glyph: chosen[i], tile, phase: Math.random() * Math.PI * 2 });
    }
  }

  onTap(x: number, y: number): boolean {
    if (this.isFinished() || this.lock) return false;
    const spot = this.spots.find((s) => Math.abs(x - s.x) < TARGET_HIT && Math.abs(y - s.y) < TARGET_HIT);
    if (!spot) return false;

    if (spot.glyph === this.targetLetter) {
      this.found++;
      this.ctx.hud.ringCounts(this.found, this.totalRounds);
      this.dda.outcome(true, Math.max(0.3, 1 - this.wrongSinceLastFind * 0.2));
      this.signals.attempt(this.skillIdFor(this.targetLetter), true);
      this.wrongSinceLastFind = 0;
      this.lastHint = 'none';
      this.score.hit(20, { x: spot.x, y: spot.y }, this.targetLetter);
      audio.play('chime', this.found % 4);
      this.sparkle(spot.x, spot.y);
      /* the letter FLIES to the bunny — the collection moment */
      const star = new Sprite(sparkTexture());
      star.anchor.set(0.5);
      star.tint = COLORS.glow;
      star.blendMode = 'add';
      star.width = 34;
      star.height = 34;
      star.x = spot.x;
      star.y = spot.y;
      this.board.addChild(star);
      this.anim.to(star, { x: this.bunny.x, y: this.bunny.y - 12, scale: 0.5 }, { durationMs: 620, ease: ease.inOutCubic, onDone: () => {
        this.sparkle(this.bunny.x, this.bunny.y - 12, [COLORS.glow, 0xffffff]);
        star.destroy();
      } });

      if (this.found >= this.totalRounds) {
        this.win();
      } else {
        this.lock = true;
        this.say(['וָאו! מָצָאתָ אוֹתָהּ!']);
        this.anim.after(500, () => {
          this.lock = false;
          this.newRound();
        });
      }
    } else {
      this.wrongSinceLastFind++;
      this.score.miss({ x: spot.x, y: spot.y });
      this.signals.attempt(this.skillIdFor(this.targetLetter), false);
      this.signals.errorKind('language.letter-recognition', this.getLetterErrorKind(spot.glyph));
      const hint = this.suggestHint(this.wrongSinceLastFind);
      this.lastHint = hint;
      if (hint !== 'none') this.signals.hintUsed('language.letter-recognition');
      this.say([
        hint === 'show'
          ? 'הַשְׁוֵה כָּל אוֹת לְמַטָּה עִם הָאוֹת שֶׁלְּמַעְלָה'
          : hint === 'clear'
            ? 'הִסְתַּכֵּל לְאָט עַל כָּל הָאוֹתִיּוֹת'
            : 'כִּמְעַט! נַסֶּה שׁוּב',
      ]);
    }
    return true;
  }

  private getLetterErrorKind(tapped: string): string {
    const confusables: Record<string, string> = {
      'ב': 'confused-bet-kaf', 'כ': 'confused-bet-kaf',
      'מ': 'confused-mem-samech', 'ס': 'confused-mem-samech',
      'ד': 'confused-dalet-resh', 'ר': 'confused-dalet-resh',
    };
    return confusables[tapped] ?? 'wrong-letter';
  }

  /** Speak the target letter in Hebrew — best effort, ETHICS §9 safe
      (silent when the sound choice is off) and a no-op without TTS. */
  private speakLetter(letter: string): void {
    try {
      if (audio.isMuted()) return;
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(letter);
      u.lang = 'he-IL';
      u.rate = 0.85;
      synth.speak(u);
    } catch {
      /* no TTS in this environment — the visual hint stands alone */
    }
  }

  private skillIdFor(letter: string): string {
    return this.GLYPH_SKILL[letter] ?? 'language.letter-recognition';
  }

  private win(): void {
    this.say(['וָאו, כָּל הַכָּבוֹד! הָאַרְנֶבֶת מָצְאָה אֶת הָאוֹתִיּוֹת!']);
    audio.play('fanfare');
    this.fx.sparkleRain(this.particles, this.w);
    this.finishWithCeremony({ title: 'כָּל הָאוֹתִיּוֹת נִמְצְאוּ!' });
  }

  update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    /* firefly drift: the lanterns wander gently and the bridge
       positions stay live (hit tests + e2e use the same coords) */
    for (const spot of this.spots) {
      if (spot.tile.destroyed) continue;
      spot.x = spot.baseX + Math.sin(this.t / 900 + spot.phase) * 9;
      spot.y = spot.baseY + Math.sin(this.t / 700 + spot.phase * 1.7) * 6;
      spot.tile.x = spot.x;
      spot.tile.y = spot.y;
    }
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'find-letter',
      round: this.found,
      totalRounds: this.totalRounds,
      targetLetter: this.targetLetter,
      letters: this.spots.map((s) => ({ x: Math.round(s.x), y: Math.round(s.y), glyph: s.glyph })),
      wrongSinceLastFind: this.wrongSinceLastFind,
      hint: this.lastHint,
      done: this.isFinished(),
    };
  }
}
