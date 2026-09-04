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
import { GARDEN_TEXT, QUEST_TEXT, getZone, type ZoneId } from '../data/garden';
import { FRIENDS, LANDMARKS, WORLD_ISLANDS, zoneHint, type LandmarkDef } from './WorldLayout';
import { STATIONS } from './WorldStations';
import { REGIONS, type RegionDef } from './WorldRegions';
import { WorldDaily } from './worldDaily';
import { isWorldOnboarded, markWorldOnboarded } from './worldMode';
import { loadFound, markFound } from './worldFound';
import { loadSparkles, markSparkle } from './worldCollect';
import { loadAcorns, loadWallet, markAcorn, spendAcorns } from './worldAcorns';
import {
  loadWardrobe,
  buyScarf,
  wearScarf,
  scarfById,
  SCARF_ITEMS,
  type WardrobeState,
} from './worldWardrobe';
import { BAND_NAMES, specsForBand, type StationBand } from './WorldStations';
import { zoneCatalog, tierUnlocked, tierMissing, displayNameFor } from '../content/catalog';
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
/* stage 12: the journey of the day — three places, every day anew */
const daily = new WorldDaily();
let foundIds: string[] = loadFound();
/* stage 14: the acorn ledger + the well's wardrobe (local, honest) */
let acornLedger: string[] = loadAcorns();
let acornWallet: number = loadWallet();
let wardrobe: WardrobeState = loadWardrobe();

/* stage 11: the meadow's rare finds whisper one honest line each —
   they are rest stops, never tasks (ETHICS: offered, never forced) */
const DAILY_TEXT = {
  chip: 'הַדֶּרֶךְ שֶׁל הַיּוֹם',
  done: 'הַמַּסַע הַיּוֹמִי הֻשְׁלַם! וָאו!',
};

const MEADOW_FIND_LINES: Record<string, string> = {
  bench: 'סַפְסָל בַּמַּרְחָב! אֶפְשָׁר לָנוּחַ כָּאן וְלִרְאּוֹת אֶת הַגַּן מִלְמַעְלָה.',
  pondlet: 'בְּרֵכָה קְטַנָּה נֶחְבְּאָה כָּאן! רְגַע, מִי זָז בַּמַּיִם?',
  'standing-stone': 'אֶבֶן עוֹמֶדֶת! מִי הִצִּיב אוֹתָהּ כָּאן כָּל כָּךְ רָחוֹק?',
};

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
      /** the live walk errand (null = none) — e2e/diagnostics. */
      errand(): { x: number; z: number } | null;
      /** true while the balloon vista ride is airborne. */
      riding(): boolean;
      nearZone(): string | null;
      zones(): Array<{ id: string; unlocked: boolean; bloom: number }>;
      fps(): number;
      phase(): WorldPhase;
      renderer(): string | null;
      sky(): string | null;
      life(): { butterflies: number; fireflies: number; fish: number } | null;
      /** Lit path lanterns — the journey made visible. */
      lanterns(): number;
      /** The places beyond the path (discovery state). */
      landmarks(): Array<{ id: string; found: boolean; x: number; z: number }>;
      /** The six regions of the continent (stage 12). */
      regions(): Array<{ id: string; name: string; x: number; z: number; found: boolean }>;
      /** The journey of the day (stage 12). */
      daily(): { targets: string[]; done: string[] };
      foundCount(): number;
      /** Sparkles gathered from the endless meadow (ledger length). */
      sparkles(): number;
      /** Acorns gathered from the roads (ledger length, stage 14). */
      acorns(): number;
      /** The game clearings (stage 14) — id, spot, zone lock state. */
      stations(): Array<{ id: string; zone: string; band: number; x: number; z: number; open: boolean }>;
      /** The named friends beside the road. */
      friends(): Array<{ id: string; x: number; z: number }>;
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
      app?.setKeyboardEnabled(true);
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
      app?.setKeyboardEnabled(true);
    },
  }, { id: 'world-shelf', grouped: true });

  const stage = h('div', { class: 'world-stage', id: 'world-stage' });
  const loading = h(
    'div',
    { class: 'world-loading', id: 'world-loading', 'aria-hidden': 'true' },
    h('span', { class: 'world-loading-star', 'aria-hidden': 'true' }, '✦'),
    h('span', { class: 'world-loading-text' }, 'הַגַּן מִתְעוֹרֵר...'),
  );

  /* stage 14-B HUD: ONE top-bar system. Two instrument chips only —
     the acorns (the road's wallet, the shop's currency) and the
     journey of the day. Everything else lives where it belongs:
     discovery speaks through bubbles + plates, ledgers live in the
     parent's lens. Fewer, bigger, clearer. */

  /* stage 11: the meadow's golden sparkles — the walker's honest ledger
     (kept for the engine + bridge; the chip left the HUD in 14-B) */
  let sparkleLedger: string[] = loadSparkles();

  /* stage 14: the acorn chip — the road pays the walker */
  const acornCount = h('span', { class: 'acorn-count' }, String(acornWallet));
  const acornChip = h(
    'span',
    { class: 'light-chip acorn-chip', id: 'world-acorn-chip', 'aria-label': 'בלוטים שנאספו בדרך' },
    h('span', { class: 'light-star acorn-star', 'aria-hidden': 'true' }, '▲'),
    acornCount,
  );

  /* stage 12: the daily journey chip — three places, every day anew */
  let dailyTargetsNow: string[] = [];
  let dailyDoneNow: string[] = [];
  const dailyCount = h('span', { class: 'daily-count' }, '0/3');
  const dailyChip = h(
    'span',
    { class: 'light-chip daily-chip', id: 'world-daily-chip', 'aria-label': DAILY_TEXT.chip },
    h('span', { class: 'light-star', 'aria-hidden': 'true' }, '☀'),
    dailyCount,
  );

  /* stage 11: the wayfinding compass — an arrow on the HUD that
     points at the next open zone the child is NOT standing in */
  const compassText = h('span', { class: 'zone-compass-text' }, '');
  const compassArrow = h('span', { class: 'zone-compass-arrow', 'aria-hidden': 'true' }, '➤');
  const compass = h('div', { class: 'zone-compass hidden', id: 'zone-compass' }, compassArrow, compassText);

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

  /* stage 14-B: the clearing's entry card — the store front of the
     thirty clearings. The band's games offer THEMSELVES here (a
     2-column grid of big buttons, locked states honest, the zone's
     own color on the accent), one obvious close affordance, and one
     primary action that opens the band's full shelf. On a phone it
     slides up as a bottom sheet; on a desk it is a centered card. */
  const entryTitle = h('strong', { class: 'entry-title' }, '');
  const entrySub = h('span', { class: 'entry-sub' }, '');
  const entryGrid = h('div', { class: 'entry-grid', role: 'group', 'aria-label': 'משחקי התחנה' });
  const entryCard = h(
    'section',
    { class: 'world-entry hidden', id: 'world-entry', role: 'region', 'aria-label': 'כניסה למשחקי התחנה' },
    h('span', { class: 'entry-grip', 'aria-hidden': 'true' }),
    h(
      'header',
      { class: 'entry-head' },
      h('div', { class: 'entry-id' }, entryTitle, entrySub),
      h(
        'button',
        {
          class: 'entry-close',
          id: 'world-entry-close',
          type: 'button',
          'aria-label': 'סגירת כרטיס התחנה',
          onClick: () => hideStationCard(),
        },
        '✕',
      ),
    ),
    entryGrid,
    h(
      'div',
      { class: 'entry-actions' },
      uiButton({
        label: 'לְשַׂחֵק!',
        variant: 'primary',
        id: 'world-entry-play',
        ariaLabel: 'לשחק את משחקי התחנה',
        onPress: () => {
          if (nearStation) openStationShelf(nearStation.zone, nearStation.band);
        },
      }),
    ),
  );

  /* stage 14: the well's shop — acorns become scarves, scarves become
     the fox's look. Local, honest, no timers, no scarcity pressure. */
  const wellRows = h('div', { class: 'well-rows', role: 'group', 'aria-label': 'הצעיפים של הבאר' });
  const wellBalance = h('span', { class: 'well-balance' }, '');
  const wellPanel = h(
    'section',
    { class: 'world-well hidden', id: 'world-well', 'aria-label': 'באר הגן' },
    h(
      'header',
      { class: 'well-head' },
      h('div', { class: 'well-title-wrap' }, h('strong', { class: 'well-title' }, 'בְּאֵר הַגַּן'), h('span', { class: 'well-sub' }, 'אֶפְשָׁר לְקַנּוֹת צָעִיף לְשׁוּעָלָה')), 
      wellBalance,
      h('button', { class: 'well-close', id: 'well-close', type: 'button', 'aria-label': 'סגירת הבאר', onClick: () => closeWell() }, '✕'),
    ),
    wellRows,
  );

  function rebuildWell(): void {
    wellBalance.textContent = `${acornWallet} בָּלוּטִים`;
    wellRows.replaceChildren();
    for (const item of SCARF_ITEMS) {
      const owned = wardrobe.owned.includes(item.id);
      const wearing = wardrobe.wearing === item.id;
      const affordable = acornWallet >= item.cost;
      const action = uiButton({
        label: wearing ? 'הוֹרָדָה' : owned ? 'הַלְבָּשָׁה' : affordable ? `קְנִיָּה · ${item.cost}` : `עוֹד ${item.cost - acornWallet} בָּלוּטִים`,
        variant: wearing ? 'ghost' : owned ? 'secondary' : affordable ? 'primary' : 'ghost',
        id: `well-${item.id}`,
        ariaLabel: `${item.name} — ${wearing ? 'על השועלה' : owned ? 'הלבשה' : affordable ? 'קניה' : 'עוד בלוטים'}`,
        onPress: () => {
          if (wearing) {
            wardrobe = wearScarf(wardrobe, null);
            app?.setScarf(null);
            rebuildWell();
            return;
          }
          if (owned) {
            wardrobe = wearScarf(wardrobe, item.id);
            app?.setScarf(item.color);
            audio.play('pop');
            rebuildWell();
            return;
          }
          const res = buyScarf(wardrobe, item.id, acornWallet);
          if (res.ok) {
            wardrobe = res.state;
            acornWallet = spendAcorns(res.spent);
            acornCount.textContent = String(acornWallet);
            app?.setScarf(item.color);
            audio.play('chime');
            sparkleBurst();
            showBubble(`וָאו! ${item.name}! רֵיחַ שֶׁל הַבְּאֵר.`);
            speak(`וואו! ${item.name.replace(/[\u0591-\u05C7]/g, '')}!`);
          } else {
            audio.play('pop');
          }
          rebuildWell();
        },
      });
      if (!wearing && !owned && !affordable) (action as HTMLButtonElement).disabled = true;
      wellRows.append(
        h(
          'div',
          { class: `well-row${wearing ? ' wearing' : ''}` },
          h('span', { class: 'well-swatch', style: `background: ${item.color}`, 'aria-hidden': 'true' }),
          h('span', { class: 'well-name' }, item.name),
          action,
        ),
      );
    }
  }

  function openWell(): void {
    rebuildWell();
    wellPanel.classList.remove('hidden');
    root.classList.add('well-open');
    /* one primary surface at a time — the shop outranks the clearing */
    hideStationCard();
  }

  function closeWell(): void {
    wellPanel.classList.add('hidden');
    root.classList.remove('well-open');
  }

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
  /* stage 12: the regions' own name plates — a whole continent of
     environmental print, each region greets the reader by name */
  const regionPlates = new Map<string, HTMLElement>();
  for (const r of REGIONS) {
    const plate = h(
      'span',
      { class: 'landmark-plate region-plate hidden', id: `region-plate-${r.id}`, 'aria-hidden': 'true' },
      r.name,
    );
    plates.push(plate);
    regionPlates.set(r.id, plate);
  }

  /* the Lenny signature's star (a quiet inline SVG — no assets) */
  const starIcon = (): HTMLElement => {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', 'brand-star');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute(
      'd',
      'M12 2.6l2.5 6.1 6.6.5-5 4.3 1.5 6.4L12 16.4l-5.6 3.5 1.5-6.4-5-4.3 6.6-.5z',
    );
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    const wrap = h('span', { 'aria-hidden': 'true' });
    wrap.style.display = 'contents';
    wrap.appendChild(svg);
    return wrap;
  };

  const root = h(
    'section',
    { class: 'screen screen--world hidden', id: 'world-screen', 'aria-label': 'הגן התלת-ממדי' },
    stage,
    bubble,
    ...plates,
    shelf.root,
    questPanel,
    entryCard,
    wellPanel,
    compass,
    loading,
    buildTouchControls(),
    /* stage 14-B top bar, stage 15-A layout: ONE flex row — instruments
       on the journey's side, the Lenny signature centered in the row
       (a flex child, never absolutely stacked over the chips), actions
       on the other edge. Nothing can overlap at any width. */
    h(
      'header',
      { class: 'world-head' },
      h('div', { class: 'world-status' }, acornChip, dailyChip),
      h(
        'div',
        { class: 'world-brand', 'aria-hidden': 'true' },
        starIcon(),
        h('span', { class: 'brand-name' }, 'לני'),
      ),
      h(
        'div',
        { class: 'world-menu' },
        uiButton({
          label: 'הַצָּעִיף',
          variant: 'ghost',
          id: 'world-wardrobe-btn',
          ariaLabel: 'ארון הצעיפים של השועלה',
          onPress: () => openWell(),
        }),
        createSoundToggle('world-sound-toggle'),
        back,
      ),
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

  /* stage 14: the clearing the child stands on (the entry card lives here) */
  let nearStation: { zone: string; band: StationBand } | null = null;
  let entryShownFor: string | null = null;

  /** The station card leaves — the child walked off, closed it, or a
      bigger surface (shelf / well) took over. State stays honest. */
  function hideStationCard(): void {
    nearStation = null;
    entryShownFor = null;
    entryCard.classList.add('hidden');
    root.classList.remove('entry-open');
  }

  /** The clearing's door opens: the shelf slides in with ONLY that
      band's games. The island's own shelf keeps every game (the
      journey order stays the spine of the garden). */
  function openStationShelf(zone: string, band: StationBand): void {
    if (shelf.isOpen()) return;
    const unlocked = isUnlocked(loadGarden(), zone as ZoneId);
    if (!unlocked) return;
    shelfZone = zone;
    shelf.open(zone, null, band);
    diary.noteShelfOpen();
    phase = 'shelf-open';
    root.dataset.worldPhase = 'shelf-open';
    app?.setKeyboardEnabled(false);
    hideStationCard();
    closeWell();
  }

  /** The child stepped onto (or off) a clearing pad — the card leans in
      with THAT band's games. One primary surface at a time: the card
      outranks the quest guidance and rests while the shelf is open. */
  function handleStationNear(station: { zone: string; band: StationBand } | null): void {
    nearStation = station;
    if (!station || phase !== 'exploring' || shelf.isOpen()) {
      entryCard.classList.add('hidden');
      root.classList.remove('entry-open');
      return;
    }
    const key = `${station.zone}:${station.band}`;
    if (entryShownFor !== key) {
      entryShownFor = key;
      const zone = getZone(station.zone as ZoneId);
      entryTitle.textContent = BAND_NAMES[station.band];
      entrySub.textContent = zone ? zone.name : '';
      rebuildEntryGrid(station.zone, station.band);
    }
    entryCard.classList.remove('hidden');
    root.classList.add('entry-open');
    /* the clearing outranks the well — one offer, never a pile-up */
    closeWell();
  }

  /** The band's games, dressed in the zone's own color: unlocked ones
      launch straight away, locked ones say honestly what is missing. */
  function rebuildEntryGrid(zone: string, band: StationBand): void {
    entryGrid.replaceChildren();
    const accent = getZone(zone as ZoneId)?.uiColor ?? '#ffd76a';
    entryCard.style.setProperty('--sc', accent);
    const zoneOpen = isUnlocked(loadGarden(), zone as ZoneId);
    for (const spec of specsForBand(zoneCatalog(zone), band)) {
      const unlocked = zoneOpen && tierUnlocked(spec.category, spec.baseTier);
      const missing = unlocked ? 0 : tierMissing(spec.category, spec.baseTier);
      entryGrid.append(
        h(
          'button',
          {
            class: `entry-game${unlocked ? '' : ' locked'}`,
            type: 'button',
            'data-spec': spec.id,
            'aria-label': unlocked
              ? `${displayNameFor(spec)} — שִׂחֲקוּ עַכְשָׁו`
              : `${displayNameFor(spec)} — נָעוּל, עוֹד ${missing} הַשְׁלָמוֹת`,
            style: `--sc: ${accent}`,
            disabled: !unlocked,
            onClick: () => {
              if (!unlocked) return;
              hideStationCard();
              diary.notePick();
              stopHeartbeat();
              callbacks.onZonePick(zone, spec.id);
            },
          },
          h('span', { class: 'entry-game-name' }, displayNameFor(spec)),
          unlocked
            ? h('span', { class: 'entry-game-go', 'aria-hidden': 'true' }, '▶')
            : h('span', { class: 'entry-game-lock', 'aria-hidden': 'true' }, `🔒 עוֹד ${missing}`),
        ),
      );
    }
  }

  /* ---------- stage 11: touch controls + desktop hint ----------
     The touch child walks like a platformer hero: a thumb-stick
     bottom-left, a jump button bottom-right (both ≥64px — small
     fingers, big targets). The desktop child gets a one-line hint
     (keys + space); the classic garden never changes. */

  function buildTouchControls(): HTMLElement {
    const touch =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    const joyBase = h('div', { class: 'world-joy', id: 'world-joy', 'aria-hidden': 'true' }, h('div', { class: 'world-joy-knob', id: 'world-joy-knob' }));
    const jumpBtn = h(
      'button',
      { class: 'world-jump-btn', id: 'world-jump-btn', type: 'button', 'aria-label': 'קפיצה' },
      '⬆',
    );
    const hint = h(
      'div',
      { class: 'world-controls-hint', 'aria-hidden': 'true' },
      touch ? 'הָעִגּוּל לְהִלָּחֵךְ · הַכְּפָתוֹר לִקְפֹּץ' : 'WASD / חִצִּים לְהִלָּחֵךְ · רֶוַח לִקְפֹּץ',
    );

    /* the joystick: pointer events, vector from the base center */
    let joyPointer: number | null = null;
    const R = 46;
    const joyEl = joyBase as HTMLElement;
    const knob = joyEl.querySelector('.world-joy-knob') as HTMLElement;
    const setVec = (dx: number, dy: number): void => {
      const len = Math.hypot(dx, dy);
      const k = len > R ? R / len : 1;
      const x = dx * k;
      const y = dy * k;
      knob.style.transform = `translate(${x}px, ${y}px)`;
      app?.setJoystickVector(x / R, -y / R); /* screen down = backward */
    };
    joyEl.addEventListener('pointerdown', (ev) => {
      joyPointer = ev.pointerId;
      joyEl.setPointerCapture(ev.pointerId);
      const r = joyEl.getBoundingClientRect();
      setVec(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2));
    });
    joyEl.addEventListener('pointermove', (ev) => {
      if (joyPointer !== ev.pointerId) return;
      const r = joyEl.getBoundingClientRect();
      setVec(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2));
    });
    const joyEnd = (ev: PointerEvent): void => {
      if (joyPointer !== ev.pointerId) return;
      joyPointer = null;
      knob.style.transform = 'translate(0px, 0px)';
      app?.setJoystickVector(0, 0);
    };
    joyEl.addEventListener('pointerup', joyEnd);
    joyEl.addEventListener('pointercancel', joyEnd);

    jumpBtn.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      app?.requestJump();
    });

    const wrap = h('div', { class: 'world-controls' }, joyBase, jumpBtn, hint);
    if (touch) wrap.classList.add('world-touch');
    return wrap;
  }

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
    root.classList.remove('quest-open');
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
    /* stage 15-A: the quest owns the bottom-center — the compass
       rests while an offer is live (one surface at a time) */
    root.classList.add('quest-open');

    if (q.family === 'wayfinding') {
      /* a target away from where the child stands — a real LITTLE
         journey: stage-11's garden is big, so the errand pool keeps to
         a child-sized walk (4–26 units, ≈10–30s at a cub's pace); the
         seeded pick rotates inside that honest band */
      const pos = app.presencePos() ?? { x: 0, z: 0 };
      const inBand: number[] = [];
      for (let i = 0; i < LANDMARKS.length; i++) {
        const d = Math.hypot(LANDMARKS[i].x - pos.x, LANDMARKS[i].z - pos.z);
        if (d > 4 && d <= 26) inBand.push(i);
      }
      const pool =
        inBand.length > 0
          ? inBand
          : LANDMARKS.map((_, i) => i).filter(
              (i) => Math.hypot(LANDMARKS[i].x - pos.x, LANDMARKS[i].z - pos.z) > 4,
            );
      const target = LANDMARKS[pool.length > 0 ? pool[questHash(q.seq, 3) % pool.length] : 0];
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

  /* stage 12: the daily journey — targets refresh on open/boot */
  function refreshDaily(): void {
    const t = daily.today();
    dailyTargetsNow = t.targets;
    dailyDoneNow = t.done;
    dailyCount.textContent = `${dailyDoneNow.length}/${t.targets.length}`;
    app?.setDailyTargets(t.targets.filter((id) => !dailyDoneNow.includes(id)));
  }

  /** A landmark came close: discover it, or finish a wayfinding quest. */
  function handleLandmarkNear(landmark: LandmarkDef): void {
    if (!foundIds.includes(landmark.id)) {
      foundIds = markFound(landmark.id);
      app?.setFoundLandmarks(foundIds);
      showBubble(landmark.line);
      speak(landmark.line);
      if (foundIds.filter((id) => !id.startsWith('region:')).length === LANDMARKS.length) {
        window.setTimeout(() => {
          showBubble(QUEST_TEXT.foundAll);
          speak(QUEST_TEXT.foundAll);
        }, 2800);
      }
    }
    /* stage 14: the well is a SHOP — acorns become scarves here */
    if (landmark.id === 'well' && phase === 'exploring' && !shelf.isOpen()) {
      openWell();
    }
    /* the journey of the day: a daily place visited is a daily step done */
    if (dailyTargetsNow.includes(landmark.id) && !dailyDoneNow.includes(landmark.id)) {
      dailyDoneNow = daily.markDone(landmark.id);
      dailyCount.textContent = `${dailyDoneNow.length}/${dailyTargetsNow.length}`;
      audio.play('chime');
      if (dailyTargetsNow.length > 0 && dailyDoneNow.length === dailyTargetsNow.length) {
        showBubble(DAILY_TEXT.done);
        speak(DAILY_TEXT.done);
        sparkleBurst();
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
    if (!app) return;
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
    /* the region plates teach their names from the moment they are on
       screen and near — geography is literacy too */
    const pos = app.presencePos();
    if (!pos) return;
    for (const r of REGIONS) {
      const plate = regionPlates.get(r.id);
      if (!plate) continue;
      const dist = Math.hypot(r.x - pos.x, r.z - pos.z);
      const p = dist < 110 ? app.screenOf(r.x, r.z) : { x: 0, y: 0, on: false };
      if (!p.on) {
        plate.classList.add('hidden');
        continue;
      }
      plate.style.left = `${Math.round(p.x * 100)}%`;
      plate.style.top = `${Math.round(p.y * 100)}%`;
      plate.classList.remove('hidden');
    }
  }

  /** The wayfinding compass: an arrow that points at the next open
      zone on SCREEN (from the fox's screen spot toward the island's
      screen spot) — it stays honest whichever way the camera turns. */
  function updateCompass(): void {
    if (!app || phase === 'closed' || phase === 'shelf-open') return;
    const data = loadGarden();
    const pos = app.presencePos();
    if (!pos) return;
    const hint = zoneHint(pos.x, pos.z, (zone) => isUnlocked(data, zone));
    if (!hint) {
      compass.classList.add('hidden');
      return;
    }
    const island = WORLD_ISLANDS.find((i) => i.zone === hint.zone);
    const from = app.lennyScreen();
    let to = island ? app.screenOf(island.x, island.z) : null;
    /* stage 12: the journey can be LONGER than the screen — when the
       island is beyond the frustum, the arrow points along the hint's
       bearing (a screen-space probe 25 units ahead) */
    if (to && !to.on) {
      const ahead = app.screenOf(
        pos.x + Math.sin(hint.bearing) * 25,
        pos.z + Math.cos(hint.bearing) * 25,
      );
      if (ahead.on) to = ahead;
    }
    if (!to || !to.on || !from.on) {
      compass.classList.add('hidden');
      return;
    }
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    if (Math.hypot(dx, dy) < 0.09) {
      compass.classList.add('hidden');
      return;
    }
    const deg = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
    compassArrow.style.transform = `rotate(${deg}deg)`;
    compassText.textContent = `${getZone(hint.zone)?.name ?? ''} · עוֹד ~${hint.steps} צְעָדִים`;
    compass.classList.remove('hidden');
  }
  let platesTimer: number | null = null;
  function startPlates(): void {
    if (platesTimer === null) {
      platesTimer = window.setInterval(() => {
        if (!app) return;
        updatePlates();
        updateCompass();
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
    version: 'stage-14',
    presencePos: () => app?.presencePos() ?? null,
    errand: () => app?.errand() ?? null,
    riding: () => app?.riding() ?? false,
    nearZone: () => app?.nearZone() ?? null,
    zones: () => app?.zones() ?? [],
    fps: () => app?.fps() ?? 0,
    phase: () => phase,
    renderer: () => app?.rendererKind() ?? null,
    sky: () => app?.skyPhase() ?? null,
    life: () => app?.life() ?? null,
    lanterns: () => app?.lanterns() ?? 0,
    landmarks: () =>
      LANDMARKS.map((l) => ({ id: l.id, found: foundIds.includes(l.id), x: l.x, z: l.z, keep: l.keep })),
    regions: () =>
      REGIONS.map((r) => ({ id: r.id, name: r.name, x: r.x, z: r.z, found: foundIds.includes(`region:${r.id}`) })),
    daily: () => ({ targets: dailyTargetsNow, done: dailyDoneNow }),
    foundCount: () => foundIds.length,
    sparkles: () => loadSparkles().length,
    acorns: () => acornWallet,
    stations: () => {
      const data = loadGarden();
      return STATIONS.map((s) => ({
        id: `${s.zone}:${s.band}`,
        zone: s.zone,
        band: s.band,
        x: s.x,
        z: s.z,
        open: isUnlocked(data, s.zone),
      }));
    },
    friends: () => FRIENDS.map((f) => ({ id: f.id, x: f.x, z: f.z })),
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
    /* round C a11y: a reduced-motion preference skips the flyover —
       the camera eases straight to the play pose and the garden starts */
    const reducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const sawOnboarding = isWorldOnboarded();
    const firstVisit = !sawOnboarding && !reducedMotion;
    if (!sawOnboarding && reducedMotion) markWorldOnboarded();
    app = await createWorldApp(
      canvas,
      {
        onDistress: () => {
          /* stage 14: an explicit, documented QA hold. The distress
             fallback is the child's safety net and stays exactly as
             it is — but the software-GL e2e walkers (CI renders on
             SwiftShader, the fallback's own intended target) walk for
             MINUTES inside the world, long enough for a loaded CI
             runner's fps dips to trip the very safety net that exists
             for real children. `lenny-world-hold=1` (never set by a
             child; e2e boot scripts only) holds the world open and
             lets the walk finish. The event still fired; the design
             is untouched everywhere a child actually plays. */
          let hold = false;
          try {
            hold = localStorage.getItem('lenny-world-hold') === '1';
          } catch {
            hold = false;
          }
          if (hold) {
            console.warn('[lenny] perf distress HELD OPEN by lenny-world-hold (e2e)');
            return;
          }
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
        onSparkle: (id, total) => {
          try {
            sparkleLedger = markSparkle(id);
            audio.play('star');
            void total;
          } catch {
            /* a sparkle never crashes the garden */
          }
        },
        onAcorn: (id, total) => {
          try {
            acornLedger = markAcorn(id).ids;
            acornWallet = loadWallet();
            acornCount.textContent = String(acornWallet);
            audio.play('star');
            void total;
          } catch {
            /* an acorn never crashes the garden */
          }
        },
        onStationNear: (station) => {
          try {
            handleStationNear(station);
          } catch {
            /* a clearing hello never crashes the garden */
          }
        },
        onStationTap: (station) => {
          try {
            openStationShelf(station.zone, station.band);
          } catch {
            /* a clearing door never crashes the garden */
          }
        },
        onFriendNear: (friend) => {
          try {
            showBubble(friend.line);
            audio.play('pop');
          } catch {
            /* a hello never crashes the garden */
          }
        },
        onRegionNear: (region: RegionDef) => {
          try {
            const rid = `region:${region.id}`;
            const isNew = !foundIds.includes(rid);
            if (isNew) {
              foundIds = markFound(rid);
              showBubble(region.line);
              speak(region.line);
            } else {
              showBubble(region.line);
            }
            audio.play('pop');
          } catch {
            /* a region hello never crashes the garden */
          }
        },
        onMeadowFind: (kind) => {
          try {
            const line = MEADOW_FIND_LINES[kind];
            if (line) showBubble(line);
            audio.play('chime');
          } catch {
            /* a whisper never crashes the garden */
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
            hideStationCard();
            /* the shelf owns the keys now — walking away mid-shelf
               would be a confusing ghost (round C a11y) */
            app?.setKeyboardEnabled(false);
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
      {
        onboard: firstVisit,
        found: foundIds,
        sparkles: sparkleLedger,
        acorns: acornLedger,
        scarf: wardrobe.wearing ? scarfById(wardrobe.wearing)?.color ?? null : null,
      },
    );
    phase = firstVisit ? 'onboarding' : 'exploring';
    startPlates();
    refreshDaily();
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
      app.setScarf(wardrobe.wearing ? scarfById(wardrobe.wearing)?.color ?? null : null);
      refreshDaily();
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
    hideStationCard();
    closeWell();
    root.dataset.worldPhase = 'closed';
  }

  function refresh(): void {
    const data = loadGarden();
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
