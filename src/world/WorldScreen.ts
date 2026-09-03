/* ============================================================
 * WorldScreen — the DOM shell around the 3D world canvas.
 *
 * Owns: the canvas host, the floating header (title + light chip
 * + back), the grown-up corner (parents + classic garden), the
 * loading veil, and the window.__lennyWorld debug bridge.
 *
 * The Babylon engine itself is LAZY: this module is cheap DOM, and
 * the world engine chunk loads on the first open only. Classic
 * sessions never download a byte of Babylon.
 *
 * Zones, movement, creatures and Lenny arrive in commits 2-6.
 * ============================================================ */

import { freshGarden, LocalProgressStore, isUnlocked, consumeNewZones, type GardenData } from '../games/core/ProgressStore';
import { GARDEN_TEXT, QUEST_TEXT, type ZoneId } from '../data/garden';
import { LANDMARKS, type LandmarkDef } from './WorldLayout';
import { isWorldOnboarded, markWorldOnboarded } from './worldMode';
import { loadFound, markFound } from './worldFound';
import {
  WorldQuests,
  buildPatternQuest,
  countingCountFor,
  questHash,
  type ActiveQuest,
  type PatternColor,
} from './worldQuests';
import { WorldDiary } from './worldDiary';
import { bubbleLineFor } from './LennyStar';
import { audio } from '../games/engine/AudioEngine';
import { music } from '../audio/MusicEngine';
import { createGameShelf, type GameShelfHandle } from '../ui/components/GameShelf';
import { h } from '../ui/components/common/el';
import { uiButton } from '../ui/components/common/Button';
import { createSoundToggle } from '../ui/components/SoundToggle';
import type { WorldApp } from './WorldApp';

export interface WorldScreenCallbacks {
  loadGarden(): GardenData;
  onBack(): void;
  onParents(): void;
  /** The grown-ups asked for the classic garden — the shell reroutes. */
  onClassic(): void;
  /** Engine missing/failed/perf-distress — the shell falls back silently. */
  onWorldFailed(): void;
  toast(message: string): void;
  /** The child picked a game from the world shelf — the shell opens the arena. */
  onZonePick(zoneId: string, specId: string): void;
}

export type WorldPhase = 'onboarding' | 'exploring' | 'shelf-open' | 'closed';

export interface WorldScreenHandle {
  root: HTMLElement;
  /** Boots the engine on first call; resolves when the world renders. */
  open(): Promise<void>;
  /** Fully disposes the engine (clean handoff, zero leaks). */
  close(): void;
  isOpen(): boolean;
}

const store = new LocalProgressStore();
/* stage 8: the parent's lens sees the world too — local, identifier-free */
const diary = new WorldDiary();
/* critic round B: discovery state + quest progress, local only */
const quests = new WorldQuests();
let foundIds: string[] = loadFound();

function loadGarden(): GardenData {
  try {
    return store.load();
  } catch {
    return freshGarden();
  }
}

declare global {
  interface Window {
    __lennyWorld?: {
      version: string;
      presencePos(): { x: number; z: number } | null;
      nearZone(): string | null;
      zones(): Array<{ id: string; unlocked: boolean; bloom: number }>;
      fps(): number;
      phase(): WorldPhase;
      renderer(): string | null;
      sky(): string | null;
      life(): { butterflies: number; fireflies: number; fish: number } | null;
      /** Lit path lanterns — the journey made visible. */
      lanterns(): number;
      /** The eight places beyond the path (discovery state). */
      landmarks(): Array<{ id: string; found: boolean; x: number; z: number }>;
      foundCount(): number;
      /** The offered discovery quest, if any (e2e + lens tooling). */
      quest(): {
        family: string;
        tier: number;
        seq: number;
        stage: string;
        picked: number;
        count: number;
        target: string | null;
        answer: string | null;
      } | null;
      /** Canvas-fraction spot of a live quest prop. */
      propScreen(id: string): { x: number; y: number; on: boolean } | null;
      /** Project any world point to canvas fractions (read-only). */
      screenOf(x: number, z: number): { x: number; y: number; on: boolean } | null;
    };
  }
}

export function createWorldScreen(callbacks: WorldScreenCallbacks): WorldScreenHandle {

  /* ---------- the world's game shelf (the existing DOM shelf) ---------- */

  const shelf: GameShelfHandle = createGameShelf({
    onPick: (spec) => {
      const zone = shelfZone;
      shelfZone = null;
      phase = 'exploring';
      root.dataset.worldPhase = phase;
      if (zone && spec) {
        diary.notePick();
        /* arena time is game time, not garden time — the diary's
           heartbeat rests until the world opens again */
        stopHeartbeat();
        callbacks.onZonePick(zone, spec.id);
      }
    },
    onClose: () => {
      if (phase === 'shelf-open') {
        phase = 'exploring';
        root.dataset.worldPhase = phase;
      }
    },
  }, { id: 'world-shelf' });

  const stage = h('div', { class: 'world-stage', id: 'world-stage' });
  const loading = h(
    'div',
    { class: 'world-loading', id: 'world-loading', 'aria-hidden': 'true' },
    h('span', { class: 'world-loading-star', 'aria-hidden': 'true' }, '✦'),
    h('span', { class: 'world-loading-text' }, 'הַגַּן מִתְעוֹרֵר...'),
  );

  const lightCount = h('span', { class: 'light-count' }, '0');
  const lightChip = h(
    'span',
    { class: 'light-chip', 'aria-label': 'אורות שנאספו' },
    h('span', { class: 'light-star', 'aria-hidden': 'true' }, '✦'),
    lightCount,
  );

  /* the discovered-places chip — environment knowledge, honest count */
  const foundCount = h('span', { class: 'found-count' }, String(foundIds.length));
  const foundChip = h(
    'span',
    { class: 'light-chip found-chip', id: 'world-found-chip', 'aria-label': 'מקומות שהתגלו בגן' },
    h('span', { class: 'light-star', 'aria-hidden': 'true' }, '✪'),
    foundCount,
  );

  /* Lenny's arrival bubble — she speaks the zone's own mission line,
     never new content (data/garden.ts is the only voice). */
  const bubble = h(
    'div',
    { class: 'lenny-bubble hidden', id: 'lenny-bubble', role: 'status', 'aria-live': 'polite' },
    h('span', { class: 'lenny-bubble-text' }),
  );
  let bubbleTimer: number | null = null;
  let bubblePinner: number | null = null;

  function showBubble(line: string): void {
    if (!line) return;
    bubble.querySelector('.lenny-bubble-text')!.textContent = line;
    bubble.classList.remove('hidden');
    if (bubbleTimer !== null) window.clearTimeout(bubbleTimer);
    bubbleTimer = window.setTimeout(() => bubble.classList.add('hidden'), 3600);
    if (bubblePinner === null) {
      bubblePinner = window.setInterval(() => {
        if (!app || bubble.classList.contains('hidden')) return;
        const p = app.lennyScreen();
        bubble.style.left = `${Math.round(p.x * 100)}%`;
        bubble.style.top = `${Math.round(Math.max(0.04, p.y - 0.075) * 100)}%`;
      }, 120);
    }
  }

  const back = uiButton({
    label: '→ חזרה',
    variant: 'ghost',
    id: 'world-back',
    ariaLabel: 'חזרה למסך הפתיחה',
    onPress: callbacks.onBack,
  });

  /* ---------- discovery quests: the roaming becomes learning ----------
     DOM overlay (critic W7): one line + big chips, niqqud, no timers,
     no "wrong" — a miss re-asks softly. Ignorable for free. */
  const questLine = h('p', { class: 'world-quest-line' });
  const questCounter = h('span', { class: 'world-quest-count hidden' });
  const questChips = h('div', { class: 'world-quest-chips', role: 'group', 'aria-label': 'תשובות' });
  const questLater = uiButton({
    label: 'אַחֲרֵי כָּךְ',
    variant: 'ghost',
    id: 'world-quest-later',
    ariaLabel: 'אולי אחרי כך',
    onPress: () => deferQuest(),
  });
  const questPanel = h(
    'section',
    { class: 'world-quest hidden', id: 'world-quest', 'aria-label': QUEST_TEXT.questChip },
    questLine,
    h('div', { class: 'world-quest-row' }, questCounter, questChips, questLater),
  );

  /* found-landmark name plates — environmental print, appears on discovery */
  const plates: Array<HTMLElement> = [];
  const plateById = new Map<string, HTMLElement>();
  for (const l of LANDMARKS) {
    const plate = h(
      'span',
      { class: 'landmark-plate hidden', id: `landmark-plate-${l.id}`, 'aria-hidden': 'true' },
      l.name,
    );
    plates.push(plate);
    plateById.set(l.id, plate);
  }

  const root = h(
    'section',
    { class: 'screen screen--world hidden', id: 'world-screen', 'aria-label': 'הגן התלת-ממדי' },
    stage,
    bubble,
    ...plates,
    shelf.root,
    questPanel,
    loading,
    h(
      'header',
      { class: 'world-head' },
      h(
        'div',
        {},
        h('h2', { class: 'world-title' }, 'הַגַּן שֶׁל לֶנִי'),
        h('p', { class: 'world-sub' }, 'בּוֹא נְהַלֵּךְ בַּגַּן'),
      ),
      h('div', { class: 'world-head-side' }, lightChip, foundChip, createSoundToggle('world-sound-toggle'), back),
    ),
    h(
      'footer',
      { class: 'world-foot' },
      h(
        'button',
        {
          class: 'world-parents-link',
          id: 'world-parent-link',
          type: 'button',
          'aria-label': 'פינת ההורים',
          onClick: () => callbacks.onParents(),
        },
        'לְהוֹרִים',
      ),
      h(
        'button',
        {
          class: 'world-classic-link',
          id: 'world-classic-link',
          type: 'button',
          'aria-label': 'מעבר לגן הקלאסי',
          onClick: () => callbacks.onClassic(),
        },
        'גַּן קְלָאסִי',
      ),
    ),
  );

  let app: WorldApp | null = null;
  let opening: Promise<void> | null = null;
  let phase: WorldPhase = 'closed';
  let shelfZone: string | null = null;
  /* the growth diary: which zones grew since the world was last seen?
     Their new flowers open with the bloom-in payoff on return. */
  let prevCounts: Record<string, number> | null = null;

  /* ---------- visit freshness (critic round B, W4): one bubble + one
     diary row per zone per window — re-tapping the feet or passing
     through mid-walk never spams the parent's lens. The shelf stays
     honest: a final arrival ALWAYS offers what the zone has. */
  let lastVisitZone: string | null = null;
  let lastVisitAt = 0;
  const VISIT_DEBOUNCE_MS = 4000;

  function visitFresh(zone: string): boolean {
    const now = performance.now();
    if (zone === lastVisitZone && now - lastVisitAt < VISIT_DEBOUNCE_MS) return false;
    lastVisitZone = zone;
    lastVisitAt = now;
    return true;
  }

  /* ---------- discovery quests: the state machine (critic W2) ----------
     Three families, one at a time, offered — never forced:
       wayfinding: walk to the named place (spatial / landmark knowledge)
       counting:   tap every bloomed flower, then say HOW MANY (cardinality)
       pattern:    which color continues the stone sequence (seriation)
     A miss re-asks softly (a correction) — nothing is ever "wrong". */

  let currentQuest: ActiveQuest | null = null;
  let questStage: 'idle' | 'counting' | 'answering' | 'pattern' = 'idle';
  let questCount = 0;
  let questPicked = 0;
  let questTrials = 0;
  let questCorrections = 0;
  const pickedFlowers = new Set<number>();
  let patternAnswer: PatternColor | null = null;
  let wayfindingTargetId: string | null = null;
  let questTimer: number | null = null;

  /** Hebrew speech, best effort — silent when the sound choice is off. */
  function speak(line: string): void {
    try {
      if (audio.isMuted()) return;
      const synth = window.speechSynthesis;
      if (!synth) return;
      synth.cancel();
      /* niqqud is for the eyes; the voice reads the letters alone */
      const u = new SpeechSynthesisUtterance(line.replace(/[\u0591-\u05C7]/g, ''));
      u.lang = 'he-IL';
      u.rate = 0.85;
      synth.speak(u);
    } catch {
      /* no TTS in this environment — the visual hint stands alone */
    }
  }

  function setQuestPanel(line: string, counter: string | null, chips: Array<{ label: string; color?: PatternColor; value: number }>): void {
    questLine.textContent = line;
    if (counter === null) {
      questCounter.classList.add('hidden');
    } else {
      questCounter.textContent = counter;
      questCounter.classList.remove('hidden');
    }
    questChips.replaceChildren(
      ...chips.map((c) =>
        h(
          'button',
          {
            class: c.color ? `quest-chip quest-chip-${c.color}` : 'quest-chip quest-chip-num',
            type: 'button',
            'data-count': c.value !== undefined && c.color === undefined ? String(c.value) : undefined,
            'data-color': c.color,
            'aria-label': c.color === undefined ? String(c.value) : c.label,
            onClick: () => {
              if (c.color === undefined) onCountChip(c.value);
              else if (c.color) onColorChip(c.color);
            },
          },
          c.color ? '' : String(c.value),
        ),
      ),
    );
  }

  function hideQuestPanel(): void {
    questPanel.classList.add('hidden');
  }

  function scheduleQuestOffer(ms: number): void {
    if (questTimer !== null) window.clearTimeout(questTimer);
    questTimer = window.setTimeout(() => {
      questTimer = null;
      offerQuest();
    }, ms);
  }

  function offerQuest(): void {
    if (!app || phase !== 'exploring' || shelf.isOpen()) {
      scheduleQuestOffer(5000);
      return;
    }
    startQuest(quests.offerNext());
  }

  /** Begin (or resume) a quest — content is deterministic in (tier, seq). */
  function startQuest(q: ActiveQuest): void {
    if (!app) return;
    currentQuest = q;
    questTrials = 0;
    questCorrections = 0;
    questPicked = 0;
    pickedFlowers.clear();
    questPanel.classList.remove('hidden');

    if (q.family === 'wayfinding') {
      /* a target away from where the child stands — a real little journey */
      const pos = app.presencePos() ?? { x: 0, z: 0 };
      let idx = questHash(q.seq, 3) % LANDMARKS.length;
      for (let tries = 0; tries < LANDMARKS.length; tries++) {
        const cand = LANDMARKS[idx];
        if (Math.hypot(cand.x - pos.x, cand.z - pos.z) > 4) break;
        idx = (idx + 1) % LANDMARKS.length;
      }
      const target = LANDMARKS[idx];
      wayfindingTargetId = target.id;
      app.setQuestTarget(target.id);
      app.setQuestProps(null);
      const line = QUEST_TEXT.wayfinding(target.name);
      setQuestPanel(line, null, []);
      showBubble(line);
      speak(line);
      questStage = 'idle'; /* completion is driven by arrival, not chips */
      return;
    }

    if (q.family === 'counting') {
      questCount = countingCountFor(q.tier, q.seq);
      questStage = 'counting';
      app.setQuestTarget(null);
      app.setQuestProps({ kind: 'counting', anchor: app.presencePos() ?? { x: 0, z: 0 }, count: questCount });
      setQuestPanel(QUEST_TEXT.countingOffer, `0/${questCount}`, []);
      speak(QUEST_TEXT.countingOffer);
      return;
    }

    /* patterns */
    const pq = buildPatternQuest(q.tier, q.seq);
    patternAnswer = pq.answer;
    questStage = 'pattern';
    app.setQuestTarget(null);
    app.setQuestProps({ kind: 'pattern', anchor: app.presencePos() ?? { x: 0, z: 0 }, stones: pq.stones });
    setQuestPanel(
      QUEST_TEXT.patternOffer,
      null,
      pq.options.map((c) => ({
        label: c === 'gold' ? 'צהוב' : c === 'rose' ? 'ורוד' : 'טורקיז',
        color: c as PatternColor,
        value: 0,
      })),
    );
    speak(QUEST_TEXT.patternOffer);
  }

  function completeQuest(): void {
    if (!currentQuest) return;
    quests.complete(currentQuest.family, questTrials, questCorrections);
    showBubble(QUEST_TEXT.done);
    speak(QUEST_TEXT.done);
    sparkleBurst();
    app?.setQuestProps(null);
    app?.setQuestTarget(null);
    wayfindingTargetId = null;
    currentQuest = null;
    questStage = 'idle';
    hideQuestPanel();
    scheduleQuestOffer(16_000);
  }

  /** "Maybe later" — ignoring a quest is free, forever (ETHICS). */
  function deferQuest(): void {
    if (questTimer !== null) {
      window.clearTimeout(questTimer);
      questTimer = null;
    }
    app?.setQuestProps(null);
    app?.setQuestTarget(null);
    wayfindingTargetId = null;
    currentQuest = null;
    questStage = 'idle';
    hideQuestPanel();
    showBubble(QUEST_TEXT.later);
    scheduleQuestOffer(75_000);
  }

  function onCountChip(n: number): void {
    if (questStage !== 'answering' || !currentQuest) return;
    if (n === questCount) {
      completeQuest();
      return;
    }
    /* not "wrong" — the flowers rebloom and the child counts again */
    questCorrections += 1;
    quests.noteCorrection(currentQuest.family);
    showBubble(QUEST_TEXT.countingAgain);
    speak(QUEST_TEXT.countingAgain);
    pickedFlowers.clear();
    questPicked = 0;
    questStage = 'counting';
    app?.setQuestProps({ kind: 'counting', anchor: app.presencePos() ?? { x: 0, z: 0 }, count: questCount });
    setQuestPanel(QUEST_TEXT.countingOffer, `0/${questCount}`, []);
  }

  function onColorChip(c: PatternColor): void {
    if (questStage !== 'pattern' || !currentQuest) return;
    if (c === patternAnswer) {
      questStage = 'answering'; /* guard double taps while the stone springs in */
      app?.fillQuestGap(c);
      completeQuest();
      return;
    }
    questCorrections += 1;
    quests.noteCorrection(currentQuest.family);
    showBubble(QUEST_TEXT.patternAgain);
    speak(QUEST_TEXT.patternAgain);
  }

  /** A landmark came close: discover it, or finish a wayfinding quest. */
  function handleLandmarkNear(landmark: LandmarkDef): void {
    if (!foundIds.includes(landmark.id)) {
      foundIds = markFound(landmark.id);
      foundCount.textContent = String(foundIds.length);
      app?.setFoundLandmarks(foundIds);
      showBubble(landmark.line);
      speak(landmark.line);
      if (foundIds.length === LANDMARKS.length) {
        window.setTimeout(() => {
          showBubble(QUEST_TEXT.foundAll);
          speak(QUEST_TEXT.foundAll);
        }, 2800);
      }
    }
    if (currentQuest && currentQuest.family === 'wayfinding' && wayfindingTargetId) {
      if (landmark.id === wayfindingTargetId) {
        completeQuest();
      } else if (questTrials < 5) {
        questTrials += 1;
        quests.noteTrial(currentQuest.family);
        showBubble(QUEST_TEXT.notYet);
        speak(QUEST_TEXT.notYet);
      }
    }
  }

  function handlePropTap(propName: string): void {
    if (!currentQuest || !app) return;
    if (currentQuest.family === 'counting' && questStage === 'counting') {
      const m = /^quest-flower-(\d+)/.exec(propName);
      if (!m) return;
      const idx = Number(m[1]);
      if (pickedFlowers.has(idx)) return;
      pickedFlowers.add(idx);
      questPicked = pickedFlowers.size;
      app.pickQuestFlower(idx);
      if (questPicked < questCount) {
        setQuestPanel(QUEST_TEXT.countingOffer, `${questPicked}/${questCount}`, []);
      } else {
        questStage = 'answering';
        setQuestPanel(
          QUEST_TEXT.countingAsk,
          `${questPicked}/${questCount}`,
          [questCount - 1, questCount, questCount + 1].map((n) => ({ label: String(n), value: n })),
        );
        speak(QUEST_TEXT.countingAsk);
      }
      return;
    }
    if (currentQuest.family === 'patterns' && propName === 'quest-gap') {
      /* tapping the gap itself — a gentle re-ask of the question */
      speak(QUEST_TEXT.patternOffer);
    }
  }

  /** A tiny celebration burst — CSS sparkles, removed when done. */
  function sparkleBurst(): void {
    for (let i = 0; i < 10; i++) {
      const s = h('span', { class: 'quest-sparkle', 'aria-hidden': 'true' }, '✦');
      s.style.insetInlineStart = `${34 + Math.random() * 32}%`;
      s.style.top = `${52 + Math.random() * 16}%`;
      s.style.animationDelay = `${i * 60}ms`;
      root.appendChild(s);
      window.setTimeout(() => s.remove(), 1500);
    }
  }

  /** Found-landmark name plates follow their places (150ms cadence).
      A garden with nothing found yet costs nothing at all. */
  function updatePlates(): void {
    if (!app || foundIds.length === 0) return;
    const spots = app.landmarkScreens();
    for (const s of spots) {
      const plate = plateById.get(s.id);
      if (!plate) continue;
      if (!foundIds.includes(s.id) || !s.on) {
        plate.classList.add('hidden');
        continue;
      }
      plate.style.left = `${Math.round(s.x * 100)}%`;
      plate.style.top = `${Math.round(s.y * 100)}%`;
      plate.classList.remove('hidden');
    }
  }
  let platesTimer: number | null = null;
  function startPlates(): void {
    if (platesTimer === null) {
      platesTimer = window.setInterval(() => {
        if (!app) return;
        updatePlates();
      }, 150);
    }
  }

  /* ---------- the world diary: honest minutes, local only ---------- */

  let sessionMark = 0;
  let heartbeat: number | null = null;
  const HEARTBEAT_MS = 30_000;

  function flushHeartbeat(): void {
    if (sessionMark > 0) {
      diary.noteHeartbeat(Date.now() - sessionMark);
      sessionMark = 0;
    }
  }

  function startHeartbeat(): void {
    sessionMark = Date.now();
    if (heartbeat === null) {
      heartbeat = window.setInterval(() => {
        if (document.hidden) {
          /* a hidden tab is not garden time — re-mark, add nothing */
          sessionMark = Date.now();
          return;
        }
        flushHeartbeat();
        sessionMark = Date.now();
      }, HEARTBEAT_MS);
    }
  }

  function stopHeartbeat(): void {
    flushHeartbeat();
    if (heartbeat !== null) {
      window.clearInterval(heartbeat);
      heartbeat = null;
    }
  }



  /* ---------- the read-only world bridge (e2e + parent tooling) ---------- */

  window.__lennyWorld = {
    version: 'stage-9',
    presencePos: () => app?.presencePos() ?? null,
    nearZone: () => app?.nearZone() ?? null,
    zones: () => app?.zones() ?? [],
    fps: () => app?.fps() ?? 0,
    phase: () => phase,
    renderer: () => app?.rendererKind() ?? null,
    sky: () => app?.skyPhase() ?? null,
    life: () => app?.life() ?? null,
    lanterns: () => app?.lanterns() ?? 0,
    landmarks: () =>
      LANDMARKS.map((l) => ({ id: l.id, found: foundIds.includes(l.id), x: l.x, z: l.z })),
    foundCount: () => foundIds.length,
    quest: () =>
      currentQuest
        ? {
            family: currentQuest.family,
            tier: currentQuest.tier,
            seq: currentQuest.seq,
            stage: questStage,
            picked: questPicked,
            count: questCount,
            target: wayfindingTargetId,
            answer: currentQuest.family === 'patterns' ? patternAnswer : null,
          }
        : null,
    propScreen: (id) => app?.propScreens().find((p) => p.id === id) ?? null,
    screenOf: (x, z) => app?.screenOf(x, z) ?? null,
  };

  async function boot(): Promise<void> {
    /* lazy chunk — classic sessions never load Babylon */
    const { createWorldApp } = await import('./WorldApp');
    const canvas = document.createElement('canvas');
    canvas.className = 'world-canvas';
    canvas.setAttribute('aria-label', 'הגן התלת-ממדי של לני');
    stage.replaceChildren(canvas);
    const firstVisit = !isWorldOnboarded();
    app = await createWorldApp(
      canvas,
      {
        onDistress: () => {
          callbacks.onWorldFailed();
        },
        onLockedTap: () => {
          callbacks.toast(GARDEN_TEXT.lockedSoon);
        },
        onZonePass: (zone) => {
          /* entered a zone's radius mid-walk — a visit, not an arrival:
             greet + count it, but never slide the shelf mid-stride */
          if (!visitFresh(zone)) return;
          const line = bubbleLineFor(zone);
          if (line) showBubble(line);
          diary.noteArrival(zone);
        },
        onLandmarkNear: (landmark) => {
          try {
            handleLandmarkNear(landmark);
          } catch {
            /* discovery never crashes the garden */
          }
        },
        onPropTap: (propName) => {
          try {
            handlePropTap(propName);
          } catch {
            /* a quest tap never crashes the garden */
          }
        },
        onArrive: (zone) => {
          if (!zone) return;
          const fresh = visitFresh(zone);
          if (fresh) {
            const line = bubbleLineFor(zone);
            if (line) showBubble(line);
            diary.noteArrival(zone);
          }
          /* arriving at an OPEN zone slides in the game shelf — a final
             arrival is always an offer; the shelf never re-spams while
             it is already open */
          const unlocked = isUnlocked(loadGarden(), zone);
          if (unlocked && !shelf.isOpen()) {
            shelfZone = zone;
            shelf.open(zone, null);
            diary.noteShelfOpen();
            phase = 'shelf-open';
            root.dataset.worldPhase = 'shelf-open';
          }
        },
        onPhase: (p) => {
          phase = p;
          root.dataset.worldPhase = p;
          if (p === 'exploring' && firstVisit) markWorldOnboarded();
          /* V3: the flyover just ended on a FIRST visit — boot's own
             scheduling ran before exploring existed. Offer the first
             quest like every other session gets one. */
          if (p === 'exploring' && !currentQuest && questTimer === null && quests.current() === null) {
            scheduleQuestOffer(8000);
          }
        },
      },
      loadGarden(),
      { onboard: firstVisit, found: foundIds },
    );
    phase = firstVisit ? 'onboarding' : 'exploring';
    startPlates();
    /* the quest offer waits until the child is exploring (or resumes) */
    if (phase === 'exploring') {
      const active = quests.current();
      if (active) startQuest(active);
      else scheduleQuestOffer(8000);
    }
  }

  /** Zones that grew since the last time the world was seen. */
  function growthDiff(data: GardenData): Set<string> | undefined {
    if (!prevCounts) {
      prevCounts = {};
      for (const [zone, prog] of Object.entries(data.zones)) prevCounts[zone] = prog.finished;
      for (const [zone, n] of Object.entries(data.finished ?? {})) {
        prevCounts[zone] = Math.max(prevCounts[zone] ?? 0, n);
      }
      return undefined; /* first sight — no payoff yet */
    }
    const grew = new Set<string>();
    for (const [zone, prog] of Object.entries(data.zones)) {
      if (prog.finished > (prevCounts[zone] ?? 0)) grew.add(zone);
    }
    for (const [zone, n] of Object.entries(data.finished ?? {})) {
      if (n > (prevCounts[zone] ?? 0)) grew.add(zone);
    }
    prevCounts = {};
    for (const [zone, prog] of Object.entries(data.zones)) prevCounts[zone] = prog.finished;
    for (const [zone, n] of Object.entries(data.finished ?? {})) {
      prevCounts[zone] = Math.max(prevCounts[zone] ?? 0, n);
    }
    return grew;
  }

  async function open(): Promise<void> {
    if (app) {
      app.setPaused(false);
      const data = loadGarden();
      app.refresh(data, growthDiff(data));
      app.setFoundLandmarks(foundIds);
      foundCount.textContent = String(foundIds.length);
      /* V7: celebrate REAL gate openings — the unlock queue is drained
         by whichever garden the child is actually in (world or classic),
         so the wording is always true */
      const freshGates = consumeNewZones();
      if (freshGates.length > 0) {
        showBubble(GARDEN_TEXT.newZone);
        sparkleBurst();
      }
      /* the soundtrack walks back into the garden */
      music.setMood('garden-exploring');
      music.resume();
      diary.noteOpen();
      startHeartbeat();
      startPlates();
      if (!currentQuest && questTimer === null && quests.current() === null) {
        scheduleQuestOffer(6000);
      } else if (quests.current() && !currentQuest) {
        startQuest(quests.current()!);
      }
      return;
    }
    if (opening) return opening;
    loading.classList.remove('hidden');
    root.dataset.worldPhase = 'loading';
    opening = boot()
      .then(() => {
        loading.classList.add('hidden');
        root.dataset.worldPhase = phase;
        refresh();
        music.setMood('garden-exploring');
        music.resume();
        diary.noteOpen();
        startHeartbeat();
        /* Lenny greets the child at the journey's first island —
           computed lazily: the first rendered frame lights nearZone */
        window.setTimeout(() => {
          const line = bubbleLineFor((app?.nearZone() ?? null) as ZoneId | null);
          if (line) showBubble(line);
        }, 900);
      })
      .catch(() => {
        /* engine refused — the shell shows the classic garden instead */
        app = null;
        phase = 'closed';
        callbacks.onWorldFailed();
      })
      .finally(() => {
        opening = null;
      });
    return opening;
  }

  function close(): void {
    stopHeartbeat();
    if (shelf.isOpen()) shelf.close();
    shelfZone = null;
    /* quests pause with the world — an active offer resumes on return */
    if (questTimer !== null) {
      window.clearTimeout(questTimer);
      questTimer = null;
    }
    currentQuest = null;
    questStage = 'idle';
    hideQuestPanel();
    /* V6: the world owns its timers — closing leaves none behind */
    if (platesTimer !== null) {
      window.clearInterval(platesTimer);
      platesTimer = null;
    }
    if (bubbleTimer !== null) {
      window.clearTimeout(bubbleTimer);
      bubbleTimer = null;
    }
    if (bubblePinner !== null) {
      window.clearInterval(bubblePinner);
      bubblePinner = null;
    }
    if (app) {
      app.dispose();
      app = null;
    }
    phase = 'closed';
    stage.replaceChildren();
    bubble.classList.add('hidden');
    root.dataset.worldPhase = 'closed';
  }

  function refresh(): void {
    const data = loadGarden();
    lightCount.textContent = String(data.lights || 0);
    /* the world re-reads progress too: unlock fog + bloom + lanterns */
    const litBefore = app?.lanterns() ?? 0;
    app?.refresh(data, growthDiff(data));
    const litAfter = app?.lanterns() ?? 0;
    if (litAfter > litBefore) showBubble(GARDEN_TEXT.lanternLit);
  }

  /* ---------- distress → one gentle grown-up note, ever ---------- */

  return {
    root,
    open,
    close,
    isOpen: () => app !== null,
  };
}
