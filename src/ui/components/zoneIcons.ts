/* Zone icons — hand-written SVG art, inlined at build time (?raw).
   Keys match ZoneId from src/data/garden.ts. */
import attentionStream from '../assets/zones/attention-stream.svg?raw';
import breathPool from '../assets/zones/breath-pool.svg?raw';
import creativityMeadow from '../assets/zones/creativity-meadow.svg?raw';
import feelingsGarden from '../assets/zones/feelings-garden.svg?raw';
import lightPath from '../assets/zones/light-path.svg?raw';
import memoryHill from '../assets/zones/memory-hill.svg?raw';
import rhythmSquare from '../assets/zones/rhythm-square.svg?raw';
import spaceSky from '../assets/zones/space-sky.svg?raw';
import thinkingForest from '../assets/zones/thinking-forest.svg?raw';
import wordsValley from '../assets/zones/words-valley.svg?raw';

export const ZONE_ICONS: Record<string, string> = {
  'attention-stream': attentionStream,
  'breath-pool': breathPool,
  'creativity-meadow': creativityMeadow,
  'feelings-garden': feelingsGarden,
  'light-path': lightPath,
  'memory-hill': memoryHill,
  'rhythm-square': rhythmSquare,
  'space-sky': spaceSky,
  'thinking-forest': thinkingForest,
  'words-valley': wordsValley,
};
