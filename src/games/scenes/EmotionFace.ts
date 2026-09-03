import { Container, Graphics, Sprite, Text } from 'pixi.js';
import { GameScene, type SceneCtx } from '../engine/GameScene';
import { ease } from '../engine/AnimationSystem';
import { softGlowTexture } from '../engine/textures';
import { COLORS } from '../engine/theme';
import { audio } from '../engine/AudioEngine';

type Emotion = 'happy' | 'sad' | 'angry' | 'surprised' | 'calm';

const ALL: Emotion[] = ['happy', 'sad', 'angry', 'surprised', 'calm'];

/* emotion pairs children most often confuse (verbatim from the old scene) */
const SIMILAR: [Emotion, Emotion][] = [
  ['sad', 'angry'],
  ['happy', 'calm'],
  ['surprised', 'angry'],
];

const LABELS: Record<Emotion, string> = {
  happy: 'שָׂמֵחַ',
  sad: 'עָצוּב',
  angry: 'כּוֹעֵס',
  surprised: 'מוּפְתָּע',
  calm: 'רָגוּעַ',
};

const EMOTION_HEX: Record<Emotion, number> = {
  happy: 0xffd76a,
  sad: 0x4dc9ff,
  angry: 0xf2549a,
  surprised: 0xffa552,
  calm: 0x7dffb8,
};

/* old timing constants */
const CORRECT_LOCK_MS = 700;

/* round C 'situation' variant: short, familiar vignettes — the child
   HEARS (and reads) what happened and infers the feeling. The claimed
   empathy/perspective skill finally has real practice (audit 9-d #10). */
const SITUATIONS: Record<Emotion, string[]> = {
  happy: [
    'דָּנִי קִבֵּל מַתָּנָה שֶׁרָצָה מְאֹד. מָה הוּא מַרְגִּישׁ?',
    'הַחֲבֵרָה שֶׁל נוֹגָה שִׂיחְקָה אִתָּהַיּוֹם בַּחֲצֵר. מָה הִיא מַרְגִּישָׁה?',
  ],
  sad: [
    'הַבָּלוֹן שֶׁל אִיתַי נָפַץ. מָה הוּא מַרְגִּישׁ?',
    'כֶּלֶב קָטָן נִשְׁאַר לְבַד בַּגַּשֶׁם. מָה הוּא מַרְגִּישׁ?',
  ],
  angry: [
    'מִישֶׁהוּ הֶפֵּל אֶת הַמִּגְדָּל שֶׁעֲלִי בָּנָה. מָה הוּא מַרְגִּישׁ?',
    'לָקְחוּ לְתָמָר אֶת הַצַעְצוּעַ בְּלִי לִשְׁאֹל. מָה הוּא מַרְגִּישׁ?',
  ],
  surprised: [
    'מִתּוֹךְ הַקֻּפְסָא קָפַץ צַפְרְדֵּעַ! מָה הוּא מַרְגִּישׁ?',
    'בַּקֹּפְסָה שֶׁל הַמַּתָּנָה הָיָה חָתוּל קָטָן! מָה הוּא מַרְגִּישׁ?',
  ],
  calm: [
    'אַחֲרֵי הַסִּפּוּר נָשַׁם מַיִם לְאַט וְנָחָה. מָה הוּא מַרְגִּישׁ?',
    'שָׁכַב עַל הַדֶּשֶׁא, הִסְתַּכֵּל בֶּעָנָנִים וְנָחָה. מָה הוּא מַרְגִּישׁ?',
  ],
};

/** A tiny vector emotion face for the option tiles — pre-readers pick
    by LOOKING, not by decoding Hebrew labels (audit 9-d #10). */
function miniFace(emo: Emotion): Graphics {
  const g = new Graphics();
  g.circle(0, 0, 13).fill({ color: 0x7dffb8 });
  g.circle(0, 0, 13).stroke({ color: EMOTION_HEX[emo], width: 2.5, alpha: 0.95 });
  g.circle(-4.5, -3, 2).fill({ color: 0x0a0416 });
  g.circle(4.5, -3, 2).fill({ color: 0x0a0416 });
  if (emo === 'happy') {
    g.arc(0, 3, 5, 0.25, Math.PI - 0.25).stroke({ color: 0x0a0416, width: 1.8 });
  } else if (emo === 'sad') {
    g.arc(0, 11, 5, Math.PI + 0.25, Math.PI * 2 - 0.25).stroke({ color: 0x0a0416, width: 1.8 });
  } else if (emo === 'angry') {
    g.moveTo(-7, -7).lineTo(-2.5, -5).stroke({ color: 0x0a0416, width: 1.5 });
    g.moveTo(7, -7).lineTo(2.5, -5).stroke({ color: 0x0a0416, width: 1.5 });
    g.moveTo(-4.5, 6).lineTo(4.5, 5).stroke({ color: 0x0a0416, width: 1.8 });
  } else if (emo === 'surprised') {
    g.circle(0, 5, 2.6).fill({ color: 0x0a0416 });
  } else {
    g.moveTo(-4, 5.5).lineTo(4, 5.5).stroke({ color: 0x0a0416, width: 1.8 });
  }
  return g;
}


/**
 * EmotionFace — "help the turtle name its feeling" (feelings-garden).
 * Ported 1:1 from the Phaser scene: adaptive option count from the DDA
 * (2 + floor(level*3)), confusable-pair error taxonomy and the visible
 * hint ladder (gentle -> clear -> show) as message lines. The turtle
 * face is drawn vectorially per emotion — face disc + eyes + mouth path
 * + eyebrows, same geometry as the original Graphics code.
 */
export class EmotionFaceScene extends GameScene {
  private faceC = new Container();
  private faceG = new Graphics();
  private faceGlow!: Sprite;
  private msgText!: Text;
  private scoreText!: Text;
  private optionLayer = new Container();
  private optionViews: Container[] = [];

  private current: Emotion = 'happy';
  private options: Emotion[] = [];
  private correctIdx = 0;
  private found = 0;
  private TARGET = 5;
  private lock = false;
  private wrongSinceLastCorrect = 0;
  private optionCount = 3;
  private optionSpots: { x: number; y: number }[] = [];
  private lastHint: 'none' | 'gentle' | 'clear' | 'show' = 'none';
  /* round C 'situation' variant: hear a vignette, infer the feeling */
  private situationMode = false;
  private situationText = '';

  constructor(ctx: SceneCtx) {
    super(ctx);
    this.build();
  }

  protected build(): void {
    this.found = 0;
    this.wrongSinceLastCorrect = 0;
    this.lock = false;
    this.lastHint = 'none';
    this.TARGET = this.ctx.spec?.params.rounds ? this.ctx.spec.params.rounds : 5;
    this.situationMode = this.ctx.spec?.params.extra?.variant === 'situation';
    /* DDA adapts the option count: options = 2 + floor(level * 3) (2..5) */
    this.optionCount = Math.min(5, Math.max(2, 2 + Math.floor(this.dda.level() * 3)));

    /* turtle face, drawn vectorially; halo tint follows the emotion */
    this.faceGlow = this.glowSprite(0xffd76a, 230, 0.26);
    this.faceC.addChild(this.faceGlow, this.faceG);
    this.faceC.x = 0;
    this.faceC.y = 0;
    this.anim.loop(() => {
      this.faceGlow.alpha = 0.2 + 0.08 * Math.sin(this.t / 520);
    });

    this.msgText = this.label('הַצָּב מַרְגִּישׁ מַשֶּׁהוּ. מַה הוּא מַרְגִּישׁ?', 16, COLORS.cream);
    this.msgText.x = this.w / 2;
    this.msgText.y = this.h * 0.07;

    this.scoreText = this.label('', 15, COLORS.cream);
    this.scoreText.x = this.w / 2;
    this.scoreText.y = this.h * 0.92;

    /* option buttons at the bottom, evenly spaced for the adaptive count */
    this.optionSpots = [];
    for (let i = 0; i < this.optionCount; i++) {
      this.optionSpots.push({ x: this.w * ((i + 1) / (this.optionCount + 1)), y: this.h * 0.78 });
    }

    this.root.addChild(this.faceC, this.msgText, this.scoreText, this.optionLayer);

    const intro = this.ctx.spec?.narrative.intro ?? ['הַצָּב מַרְגִּישׁ מַשֶּׁהוּ. מַה הוּא מַרְגִּישׁ?'];
    this.say(intro);

    this.newRound();
    this.updateScore();
  }

  /* ---------- rounds (verbatim selection + shuffle) ---------- */

  private newRound(): void {
    /* pick the current emotion + (optionCount - 1) distractors */
    this.current = ALL[Math.floor(Math.random() * ALL.length)];
    const others = ALL.filter((e) => e !== this.current);
    const picked: Emotion[] = [this.current];
    while (picked.length < this.optionCount) {
      const idx = Math.floor(Math.random() * others.length);
      picked.push(others[idx]);
      others.splice(idx, 1);
    }
    /* shuffle */
    for (let i = picked.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [picked[i], picked[j]] = [picked[j], picked[i]];
    }
    this.options = picked;
    this.correctIdx = picked.indexOf(this.current);
    this.lastHint = 'none';

    /* situation mode: the vignette IS the question — the turtle's
       face stays a neutral wondering one until the reveal */
    if (this.situationMode) {
      const list = SITUATIONS[this.current];
      this.situationText = list[this.found % list.length];
      this.drawWonderingFace();
      this.rebuildOptions();
      this.setMsg(this.situationText);
      this.speakText(this.situationText);
      this.faceC.scale.set(0.8);
      this.anim.to(this.faceC, { scale: 1 }, { durationMs: 380, ease: ease.outBack });
      return;
    }

    this.drawTurtleFace();
    this.rebuildOptions();
    /* the face ARRIVES: a springy pop + glow pulse keeps every round alive */
    this.faceC.scale.set(0.8);
    this.anim.to(this.faceC, { scale: 1 }, { durationMs: 380, ease: ease.outBack });
  }

  private updateScore(): void {
    this.scoreText.text = 'הִכַּרְתָּ: ' + this.found + ' / ' + this.TARGET;
    this.ctx.hud.ringCounts(this.found, this.TARGET);
    this.ctx.hud.mission?.(this.situationMode ? 'הַאֲזִינוּ — מָה הַרְגָּשׁ?' : 'מַה הַצָּב מַרְגִּישׁ?');
  }

  /* ---------- turtle face (same geometry as the Phaser Graphics) ---------- */

  /** Situation-mode neutral face: the turtle wonders — the answer must
      come from the vignette, not from reading a face. A '?' hovers. */
  private drawWonderingFace(): void {
    const x = this.w / 2;
    const y = this.h * 0.4;
    const r = 60;
    const g = this.faceG;
    g.clear();
    g.circle(x, y, r + 12).fill({ color: 0x4caf6e, alpha: 0.9 });
    g.circle(x, y, r).fill({ color: 0x7dffb8 });
    g.circle(x - 22, y - 15, 12).fill({ color: 0xffffff });
    g.circle(x + 22, y - 15, 12).fill({ color: 0xffffff });
    g.circle(x - 22, y - 15, 4).fill({ color: 0x0a0416 });
    g.circle(x + 22, y - 15, 4).fill({ color: 0x0a0416 });
    /* a small wondering mouth: slightly open, perfectly neutral */
    g.circle(x, y + 20, 5).stroke({ color: 0x0a0416, width: 2.5, alpha: 0.9 });
    /* the hovering question mark */
    const q = this.label('?', 44, 0xffd76a, '800');
    q.anchor.set(0.5);
    q.x = x + r * 0.78;
    const baseY = y - r * 0.82;
    q.y = baseY;
    q.name = 'wonder-mark';
    this.faceC.addChild(q);
    this.anim.to(q, { y: baseY - 7, alpha: 0.55 }, { durationMs: 900, ease: ease.inOutSine, onDone: () => {
      this.anim.to(q, { y: baseY, alpha: 1 }, { durationMs: 900, ease: ease.inOutSine });
    } });
    this.faceGlow.tint = 0xffd76a;
  }

  /** Clear the wondering '?' (before the reveal / new round). */
  private clearWonderMark(): void {
    for (const child of [...this.faceC.children]) {
      if (child.name === 'wonder-mark') child.destroy({ children: true });
    }
  }

  private drawTurtleFace(): void {
    const x = this.w / 2;
    const y = this.h * 0.4;
    const r = 60;
    const g = this.faceG;
    g.clear();

    /* shell ring */
    g.circle(x, y, r + 12).fill({ color: 0x4caf6e, alpha: 0.9 });
    /* face */
    g.circle(x, y, r).fill({ color: 0x7dffb8 });

    /* eyes */
    g.circle(x - 22, y - 15, 12).fill({ color: 0xffffff });
    g.circle(x + 22, y - 15, 12).fill({ color: 0xffffff });
    const pupil = this.current === 'surprised' ? 6 : 4;
    g.circle(x - 22, y - 15, pupil).fill({ color: 0x0a0416 });
    g.circle(x + 22, y - 15, pupil).fill({ color: 0x0a0416 });

    /* eyebrows for angry/sad */
    if (this.current === 'angry') {
      g.moveTo(x - 32, y - 30).lineTo(x - 12, y - 24).stroke({ color: 0x0a0416, width: 3 });
      g.moveTo(x + 32, y - 30).lineTo(x + 12, y - 24).stroke({ color: 0x0a0416, width: 3 });
    } else if (this.current === 'sad') {
      g.moveTo(x - 32, y - 24).lineTo(x - 12, y - 30).stroke({ color: 0x0a0416, width: 3 });
      g.moveTo(x + 32, y - 24).lineTo(x + 12, y - 30).stroke({ color: 0x0a0416, width: 3 });
    }

    /* mouth by emotion */
    if (this.current === 'happy') {
      g.arc(x, y + 15, 22, 0.2, Math.PI - 0.2).stroke({ color: 0x0a0416, width: 3 });
    } else if (this.current === 'sad') {
      /* upper half of a circle centered below the face = the frown */
      g.arc(x, y + 42, 22, Math.PI + 0.3, Math.PI * 2 - 0.3).stroke({ color: 0x0a0416, width: 3 });
    } else if (this.current === 'angry') {
      g.moveTo(x - 18, y + 25).lineTo(x + 18, y + 20).stroke({ color: 0x0a0416, width: 3 });
    } else if (this.current === 'surprised') {
      g.circle(x, y + 22, 10).fill({ color: 0x0a0416 });
    } else {
      g.moveTo(x - 15, y + 22).lineTo(x + 15, y + 22).stroke({ color: 0x0a0416, width: 3 });
    }

    /* rendering only: emotion-tinted halo + a soft pop */
    this.faceGlow.tint = EMOTION_HEX[this.current];
    this.faceC.scale.set(0.92);
    this.anim.to(this.faceC.scale, { x: 1, y: 1 }, { durationMs: 420, ease: ease.outBack });
  }

  /* ---------- option tiles (Pixi Text on glass tiles) ---------- */

  private rebuildOptions(): void {
    for (const tile of this.optionViews) tile.destroy({ children: true });
    this.optionViews = [];
    for (let i = 0; i < this.optionCount; i++) {
      const spot = this.optionSpots[i];
      const emo = this.options[i];
      const tile = new Container();
      tile.x = spot.x;
      tile.y = spot.y;

      const glass = new Graphics();
      glass.roundRect(-52, -22, 104, 44, 14).fill({ color: 0x7c4dff, alpha: 0.55 });
      glass.roundRect(-52, -22, 104, 44, 14).stroke({ color: 0x9b74ff, width: 2, alpha: 0.9 });
      const sheen = new Sprite(softGlowTexture());
      sheen.anchor.set(0.5);
      sheen.tint = 0xffffff;
      sheen.blendMode = 'add';
      sheen.alpha = 0.18;
      sheen.width = 88;
      sheen.height = 20;
      sheen.y = -9;
      const txt = this.label(LABELS[emo], 16, COLORS.cream, '600');
      txt.x = 16;
      /* the mini face sits on the leading side, the label on the other —
         sharing the center made the Hebrew text collide with it
         (critic round C #4) */
      const face = miniFace(emo);
      face.x = -26;

      tile.addChild(glass, sheen, face, txt);
      tile.alpha = 0;
      this.optionLayer.addChild(tile);
      this.optionViews.push(tile);
      this.anim.to(tile, { alpha: 1 }, { durationMs: 240, ease: ease.outQuad });
    }
  }

  /* ---------- gameplay ---------- */

  /** Speak Hebrew text — best effort, ETHICS §9 safe (silent when the
      sound choice is off) and a no-op without TTS. */
  private speakText(text: string): void {
    try {
      if (audio.isMuted()) return;
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'he-IL';
      u.rate = 0.9;
      synth.speak(u);
    } catch {
      /* no TTS in this environment — the vignette text stands alone */
    }
  }

  private setMsg(text: string): void {
    this.msgText.text = text;
  }

  private hitTest(px: number, py: number): number | null {
    for (let i = 0; i < this.optionSpots.length; i++) {
      const spot = this.optionSpots[i];
      if (Math.abs(px - spot.x) < 55 && Math.abs(py - spot.y) < 30) return i;
    }
    return null;
  }

  onTap(x: number, y: number): boolean {
    if (this.isFinished() || this.lock) return false;
    const idx = this.hitTest(x, y);
    if (idx === null) return false;

    if (idx === this.correctIdx) {
      this.found++;
      this.updateScore();
      /* one named emotion = one DDA round; score reflects its cleanliness */
      this.dda.outcome(true, Math.max(0.3, 1 - this.wrongSinceLastCorrect * 0.2));
      this.signals.attempt('emotion.recognition', true);
      this.score.hit(20, { x, y }, LABELS[this.current]);
      audio.play('chime', this.found % 4);
      this.wrongSinceLastCorrect = 0;
      this.lastHint = 'none';
      if (this.situationMode) {
        /* the reveal: the true face arrives — inference becomes a face
           the child can check themselves */
        this.clearWonderMark();
        this.drawTurtleFace();
      }
      if (this.found >= this.TARGET) {
        this.win();
      } else {
        this.lock = true;
        this.setMsg('כֵּן! הַצָּב מַרְגִּישׁ ' + LABELS[this.current]);
        this.sparkle(x, y, [EMOTION_HEX[this.current], COLORS.glowSoft, 0xffffff]);
        this.anim.after(CORRECT_LOCK_MS, () => {
          if (this.isFinished()) return;
          this.lock = false;
          this.setMsg(this.situationMode ? 'מָה הוּא מַרְגִּישׁ עַכְשָׁו? הַאֲזִינוּ' : 'מַה הַצָּב מַרְגִּישׁ עַכְשָׁו?');
          this.newRound();
        });
      }
    } else {
      this.wrongSinceLastCorrect++;
      this.score.miss({ x, y });
      audio.play('softError');
      /* situation mode: a wrong pick never flashes the ANSWER's color —
         each option's mini face is stroked in its own emotion hex, so
         the flash would name the correct tile (critic round C #3) */
      this.fx.flash(this.situationMode ? COLORS.coral : EMOTION_HEX[this.current], 140, 0.1);
      /* a wrong pick is NOT a round loss (the round is one named
         emotion, judged in the correct branch above). It feeds
         LearningSignals and the visible hint ladder instead. */
      this.signals.attempt('emotion.recognition', false);
      /* error taxonomy: was the wrong pick a commonly-confused pair? */
      const picked = this.options[idx];
      const similar = SIMILAR.some(
        ([a, b]) =>
          (a === picked && b === this.current) || (b === picked && a === this.current),
      );
      this.signals.errorKind('emotion.recognition', similar ? 'confused-similar-emotions' : 'wrong-emotion');
      this.ripple(x, y, EMOTION_HEX[picked]);
      /* visible, escalating help (gentle -> clear -> show) instead of
         a silent difficulty drop -- same pattern as MemoryPairs */
      const hint = this.suggestHint(this.wrongSinceLastCorrect);
      this.lastHint = hint;
      if (this.situationMode) {
        /* inference mode: the face gives nothing away — the vignette
           is the helper, and 'show' points at the right feeling */
        this.setMsg(
          hint === 'show'
            ? 'כָּךַזֶה — חַפְּשׂוּ אֶת הַפָּנִים הַמַּתְאִימִים'
            : hint === 'clear'
              ? 'הַאֲזִינוּ לַמִּשְׁפָּט שׁוּב'
              : 'נַסּוּ שׁוּב — מָה הַרְגָּשׁ?',
        );
        if (hint === 'clear') this.speakText(this.situationText);
        if (hint === 'show') {
          const spot = this.optionSpots[this.correctIdx];
          this.ripple(spot.x, spot.y, COLORS.hint);
        }
      } else {
        this.setMsg(
          hint === 'show'
            ? 'עֵינַיִם, אַחַר כָּךְ גְּבוֹת, אַחַר כָּךְ פֶּה — מָה הַצָּב מַרְגִּישׁ?'
            : hint === 'clear'
              ? 'הִסְתַּכֵּל עַל הַפֶּה שֶׁל הַצָּב'
              : 'נַסֶּה לְהַבִּיט בַּפָּנִים שׁוּב',
        );
        if (hint === 'clear' || hint === 'show') {
          /* point at the mouth — the clearest single feature (rendering only) */
          this.ripple(this.w / 2, this.h * 0.4 + 22, COLORS.hint);
        }
      }
    }
    return true;
  }

  private win(): void {
    this.setMsg('וָאו, כָּל הַכָּבוֹד! הַצָּב מַרְגִּישׁ הַרְבֵּה יוֹתֵר טוֹב!');
    this.sparkle(this.w / 2, this.h * 0.4, [COLORS.glow, COLORS.mint, 0xffffff]);
    audio.play('fanfare');
    this.finishWithCeremony({ title: 'הַלֵּב הֻבְנָה!' });
  }

  update(dtMs: number): void {
    super.update(dtMs);
    if (this.tornDown) return;
  }

  debugState(): Record<string, unknown> {
    return {
      kind: 'emotion-face',
      variant: this.situationMode ? 'situation' : 'classic',
      situation: this.situationMode ? this.situationText : null,
      round: this.found,
      totalRounds: this.TARGET,
      emotion: this.current,
      options: this.optionSpots.map((spot, i) => ({
        x: Math.round(spot.x),
        y: Math.round(spot.y),
        label: LABELS[this.options[i]],
        emotion: this.options[i],
      })),
      wrongSinceLastCorrect: this.wrongSinceLastCorrect,
      hint: this.lastHint,
      done: this.isFinished(),
    };
  }
}
