import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { RhythmEngine } from '../fx/RhythmEngine';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { discTexture, ringTexture, softGlowTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';

/* old timing constants */
const LEAD_IN = 2.0;          /* seconds of count-in before the first beat */
const FALL_TIME = 2.2;        /* seconds a note takes to fall */
const START_DELAY_MS = 1200;  /* 'בּוֹא נַתְחִיל' moment before taps go live */
const FINISH_GAP_MS = 2400;

/* Per-lane note tints — the old scene's violet note plus two harmonics
   (the old scene had a single falling column, so lanes cycle by beat
   index). Near the hit-zone every note turns the old gold. */
const LANE_TINTS = [0x7c4dff, 0x4a9eff, 0x9b5de5];
const NEAR_TINT = 0xffd76a;

interface NoteView {
  beat: number;
  view: Container;
  glow: Sprite;
  disc: Sprite;
}

/**
 * DrumBeat — notes fall toward the big drum (rhythm-square).
 * Ported 1:1 from the Phaser scene on the RhythmEngine: beatCount from
 * the spec (8), tempo from the spec's speed BPM or 70 + floor(level*40),
 * 2.0s lead-in count-in, judge windows perfect/good/miss, tap misses
 * classified too-early / too-late / missed via engine.upcoming, hint
 * ladder in the grade text, omission sweep, and the whole-pattern DDA
 * round (pass = ratio >= 0.5) judged once at pattern end.
 */
export class DrumBeatScene extends GameScene {
  private engine: RhythmEngine;
  private started = false;
  private perfects = 0;
  private goods = 0;
  private beatCount = 8;
  private bpm = 78;
  private consecutiveMiss = 0;
  private judgedBeats: boolean[] = [];
  private missedBeats: boolean[] = [];

  /* layout */
  private hitY = 0;
  private spawnY = 0;
  private drumScale = 1;

  /* views */
  private drum = new Container();
  private hitRing!: Sprite;
  private notesLayer = new Container();
  private noteViews = new Map<number, NoteView>();
  private msgText!: Text;
  private gradeText!: Text;
  private gradeHandle: { kill(): void } | null = null;

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.beatCount = ctx.spec?.params.rounds ? ctx.spec.params.rounds : 8;
    /* tempo: spec-authored speed (BPM) wins; otherwise DDA adapts it:
       bpm = 70 + floor(level * 40) */
    this.bpm = ctx.spec?.params.speed ? ctx.spec.params.speed : 70 + Math.floor(this.dda.level() * 40);
    this.engine = new RhythmEngine({ bpm: this.bpm, beats: this.beatCount, leadIn: LEAD_IN });
    this.engine.start(0);
    this.build();
  }

  protected build(): void {
    this.hitY = this.h * 0.68;
    this.spawnY = this.h * 0.08;
    this.judgedBeats = new Array<boolean>(this.beatCount).fill(false);
    this.missedBeats = new Array<boolean>(this.beatCount).fill(false);

    this.msgText = this.label('', 16, COLORS.cream);
    this.msgText.x = this.w / 2;
    this.msgText.y = this.h * 0.06;

    this.gradeText = this.label('', 22, COLORS.glow, '700');
    this.gradeText.x = this.w / 2;
    this.gradeText.y = this.h * 0.5;
    this.gradeText.alpha = 0;

    this.buildDrum();
    this.root.addChild(this.notesLayer, this.drum, this.hitRing, this.msgText, this.gradeText);

    const intro = this.ctx.spec?.narrative.intro ?? ['הַתֹּף הַגָּדוֹל הִפְסִיק לְתַפְתֵּף.'];
    this.say(intro);
    this.setMsg('בּוֹא נַתְחִיל לְתַפְתֵּף!');

    this.anim.after(START_DELAY_MS, () => {
      this.started = true;
    });
  }

  /* ---------- views ---------- */

  private buildDrum(): void {
    /* gradient glow behind the drum body */
    const glow = this.glowSprite(0xf2549a, 250, 0.26);
    glow.y = -8;
    const g = new Graphics();
    /* drum body (two stacked ellipses, old colors) */
    g.ellipse(0, 0, 55, 23).fill({ color: 0xc2405e });
    g.ellipse(0, -18, 55, 23).fill({ color: 0xf2549a });
    /* drum rim */
    g.ellipse(0, -18, 55, 23).stroke({ color: 0xffd76a, width: 3, alpha: 0.8 });
    /* laces */
    for (let i = -2; i <= 2; i++) {
      g.moveTo(i * 22, -30).lineTo(i * 22, 10).stroke({ color: 0xffd76a, width: 2, alpha: 0.5 });
    }
    this.drum.addChild(glow, g);
    this.drum.x = this.w / 2;
    this.drum.y = this.hitY + 55;

    /* pulsing hit-zone ring */
    this.hitRing = new Sprite(ringTexture());
    this.hitRing.anchor.set(0.5);
    this.hitRing.tint = COLORS.glow;
    this.hitRing.blendMode = 'add';
    this.hitRing.width = 52;
    this.hitRing.height = 52;
    this.hitRing.x = this.w / 2;
    this.hitRing.y = this.hitY;
  }

  private buildNote(beat: number): NoteView {
    const view = new Container();
    const glow = new Sprite(softGlowTexture());
    glow.anchor.set(0.5);
    glow.blendMode = 'add';
    glow.alpha = 0.5;
    glow.width = 46;
    glow.height = 46;
    const disc = new Sprite(discTexture());
    disc.anchor.set(0.5);
    disc.width = 26;
    disc.height = 26;
    const rim = new Sprite(ringTexture());
    rim.anchor.set(0.5);
    rim.tint = 0xfff6ec;
    rim.alpha = 0.5;
    rim.width = 32;
    rim.height = 32;
    view.addChild(glow, disc, rim);
    return { beat, view, glow, disc };
  }

  private setMsg(text: string): void {
    this.msgText.text = text;
  }

  /* ---------- gameplay ---------- */

  private clockSec(): number {
    return this.t / 1000;
  }

  /** Relative time (ms) of the next un-judged beat; null when none remain. */
  private nextBeatInMs(): number | null {
    const t = this.engine.elapsed(this.clockSec());
    const interval = 60 / this.engine.bpm;
    const leadIn = this.engine.leadIn;
    for (let i = 0; i < this.beatCount; i++) {
      if (this.judgedBeats[i] || this.missedBeats[i]) continue;
      return (leadIn + i * interval - t) * 1000;
    }
    return null;
  }

  onTap(_x: number, _y: number): boolean {
    if (!this.started || this.isFinished()) return false;
    const nowSec = this.clockSec();
    const j = this.engine.judge(nowSec);

    if (j.grade === 'perfect') {
      this.perfects++;
      this.consecutiveMiss = 0;
      if (j.beatIndex >= 0) this.judgedBeats[j.beatIndex] = true;
      this.showGrade('מֻשְׁלָם!', 0xffd76a);
      this.score.hit(15, { x: this.w / 2, y: this.hitY });
      this.sparkle(this.w / 2, this.hitY);
      this.fx.shake(this.root, 0, 0, 2, 120);
    } else if (j.grade === 'good') {
      this.goods++;
      this.consecutiveMiss = 0;
      if (j.beatIndex >= 0) this.judgedBeats[j.beatIndex] = true;
      this.showGrade('יוֹפִי!', 0x7dffb8);
      this.score.hit(8, { x: this.w / 2, y: this.hitY });
    } else {
      this.consecutiveMiss++;
      this.signals.attempt('rhythm.timing', false);
      /* error taxonomy: classify the miss by where it landed relative
         to the beat map (early vs late vs nowhere near) */
      const up = this.engine.upcoming(nowSec, 30);
      let kind = 'missed';
      if (up.length > 0 && up[0] <= 0.28) kind = 'too-early';
      else if (up.length === 0) kind = 'too-late';
      this.signals.errorKind('rhythm.timing', kind);
      this.ripple(this.w / 2, this.hitY, 0xff3b3b);
      /* wrong taps feed the signals stream and the hint ladder, NOT
         the DDA: a tap-level failure is not a round-level loss. The
         round is the whole pattern, judged once in finishFlow(). */
      const hint = this.suggestHint(this.consecutiveMiss);
      this.showGrade(
        hint === 'show'
          ? 'הַקֵּשׁ רַק כְּשֶׁהַצִּיּוּץ בְּתוֹךְ הָעִגּוּל הַזָּהוֹב'
          : hint === 'clear'
            ? 'הַקֵּשׁ כְּשֶׁהַצִּיּוּץ מַגִּיעַ לָּעִגּוּל הַזָּהוֹב'
            : 'נַסֶּה לְהַקְשִׁיב לַקֶּצֶב',
        0xfff6ec,
      );
    }

    /* drum pulse feedback */
    this.drumScale = 1.12;

    if (this.engine.isDone(nowSec)) {
      this.finishFlow();
    }
    return true;
  }

  private showGrade(text: string, color: number): void {
    this.gradeHandle?.kill();
    this.gradeText.text = text;
    this.gradeText.style.fill = color;
    this.gradeText.alpha = 1;
    this.gradeHandle = this.anim.to(this.gradeText, { alpha: 0 }, { durationMs: 600, delayMs: 400 });
  }

  private finishFlow(): void {
    /* account for beats the child never tapped (omissions, not just
       judged taps) before scoring the pattern */
    for (const _beat of this.engine.sweep(this.clockSec())) {
      this.signals.errorKind('rhythm.timing', 'missed-beat');
    }

    const total = this.engine.total();
    const hits = this.engine.hits();
    const ratio = hits / Math.max(1, total);
    /* the WHOLE pattern is the DDA round: pass needs half the beats.
       Off-beat taps never touched the DDA — only this decision does. */
    const passed = ratio >= 0.5;
    if (passed) {
      this.dda.outcome(true, ratio);
    } else {
      this.dda.outcome(false);
    }
    this.signals.attempt('rhythm.timing', passed);

    this.setMsg('וָאו, כָּל הַכָּבוֹד! הַתֹּף חָזַר לְתַפְתֵּף!');
    this.ctx.hud.ringCounts(hits, total);
    this.score.hit(25, { x: this.w / 2, y: this.h * 0.4 }, `דיוק ${Math.round(ratio * 100)}%`);
    audio.play('fanfare');
    this.finishWithCeremony({ title: passed ? 'הַקֶצֶב שֶׁלְּךָ!' : 'כַּמְעַט — נִנְסֶה שׁוּב?' });
  }

  update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
    const dt = dtMs / 1000;
    const nowSec = this.clockSec();

    /* relax drum pulse */
    this.drumScale += (1 - this.drumScale) * Math.min(1, dt * 8);
    this.drum.scale.set(this.drumScale);

    /* pulsing hit-zone ring (old glow formula) */
    const pulse = 0.5 + 0.5 * Math.sin(nowSec * 3);
    this.hitRing.alpha = 0.3 + pulse * 0.3;

    /* mark beats that fully passed without a hit as missed (omissions) */
    for (const beat of this.engine.sweep(nowSec)) {
      this.missedBeats[beat] = true;
      this.signals.errorKind('rhythm.timing', 'missed');
    }

    /* auto-finish when the pattern completes, even if the child stops tapping */
    if (this.started && !this.isFinished() && this.engine.isDone(nowSec)) {
      this.finishFlow();
      return;
    }

    this.syncNotes(nowSec);
  }

  /** Falling notes synced to the engine's tempo (old drawing math). */
  private syncNotes(nowSec: number): void {
    const t = this.engine.elapsed(nowSec);
    const beatInterval = 60 / this.engine.bpm;
    const leadIn = this.engine.leadIn;
    for (let i = 0; i < this.beatCount; i++) {
      const beatT = leadIn + i * beatInterval;
      /* progress 0..1 of the fall */
      const p = 1 - (beatT - t) / FALL_TIME;
      let note = this.noteViews.get(i);
      if (p < 0 || p > 1.15) {
        if (note) {
          note.view.destroy({ children: true });
          this.noteViews.delete(i);
        }
        continue;
      }
      if (!note) {
        note = this.buildNote(i);
        this.noteViews.set(i, note);
        this.notesLayer.addChild(note.view);
      }
      const near = Math.abs(p - 1) < 0.08;
      const tint = near ? NEAR_TINT : LANE_TINTS[i % LANE_TINTS.length];
      note.view.x = this.w / 2;
      note.view.y = this.spawnY + (this.hitY - this.spawnY) * p;
      note.view.scale.set(near ? 16 / 13 : 1);
      note.glow.tint = tint;
      note.disc.tint = tint;
    }
  }

  debugState(): Record<string, unknown> {
    const hits = this.engine.hits();
    const total = this.engine.total();
    return {
      kind: 'drum-beat',
      bpm: this.bpm,
      beats: this.beatCount,
      hits,
      misses: this.engine.misses(),
      total,
      ratio: hits / Math.max(1, total),
      done: this.isFinished(),
      nextBeatInMs: this.nextBeatInMs(),
    };
  }
}
