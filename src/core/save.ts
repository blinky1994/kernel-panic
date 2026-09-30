export interface Settings {
  musicVol: number;
  sfxVol: number;
  autofire: boolean;
  shake: boolean;
  crt: boolean;
  alwaysHitbox: boolean;
  lastDiff: number;
  lastShip: number;
}

export interface ScoreEntry {
  name: string;
  score: number;
  stage: string;
  ship: string;
  date: string;
  cleared: boolean;
}

export interface SpellRecord {
  tries: number;
  caught: number;
}

export interface SaveData {
  v: number;
  settings: Settings;
  scores: Record<string, ScoreEntry[]>;
  unlocked: number; // highest stage index reached (0-based)
  spells: Record<string, SpellRecord>;
  seenSpells: string[];
  lastName: string;
  clears: number;
}

const KEY = 'kernel-panic.save.v1';

const defaults = (): SaveData => ({
  v: 1,
  settings: {
    musicVol: 0.7,
    sfxVol: 0.75,
    autofire: false,
    shake: true,
    crt: true,
    alwaysHitbox: false,
    lastDiff: 1,
    lastShip: 0,
  },
  scores: {},
  unlocked: 0,
  spells: {},
  seenSpells: [],
  lastName: 'DBG',
  clears: 0,
});

function load(): SaveData {
  const d = defaults();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<SaveData>;
    return {
      ...d,
      ...p,
      settings: { ...d.settings, ...(p.settings ?? {}) },
      scores: p.scores ?? {},
      spells: p.spells ?? {},
      seenSpells: p.seenSpells ?? [],
    };
  } catch {
    return d;
  }
}

export const save: SaveData = load();

export function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    /* storage unavailable: play on without persistence */
  }
}

export function topScores(diff: string): ScoreEntry[] {
  const list = save.scores[diff] ?? [];
  return list.slice().sort((a, b) => b.score - a.score).slice(0, 10);
}

export function hiScore(diff: string): number {
  const t = topScores(diff);
  return t.length ? t[0].score : 100_000;
}

export function qualifies(diff: string, score: number): boolean {
  const t = topScores(diff);
  return score > 0 && (t.length < 10 || score > t[t.length - 1].score);
}

export function addScore(diff: string, e: ScoreEntry) {
  const list = (save.scores[diff] ??= []);
  list.push(e);
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, 10);
  persist();
}

export function spellRecord(id: string): SpellRecord {
  return (save.spells[id] ??= { tries: 0, caught: 0 });
}
