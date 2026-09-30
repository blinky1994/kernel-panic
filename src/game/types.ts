import type { Task } from '../core/tasks';
import type { Boss } from './boss';
import type { Game } from './game';

export interface DialogueLine {
  who: 'you' | 'boss' | 'sys';
  text: string;
}

export interface PhaseDef {
  /** An exception (spell card) has a name; unnamed phases are regular attacks. */
  name?: string;
  hp: number;
  /** seconds */
  time: number;
  bonus?: number;
  /** boss is invulnerable; outlast the timer */
  survival?: boolean;
  /** full-screen tint drawn over the stage background during this phase */
  bgTint?: string;
  run: (b: Boss, g: Game) => Task;
}

export interface BossDef {
  id: string;
  name: string;
  title: string;
  color: string;
  r: number;
  homeY?: number;
  midboss?: boolean;
  music?: string;
  before?: DialogueLine[];
  after?: DialogueLine[];
  phases: PhaseDef[];
  drops?: { bomb?: number; life?: number; full?: number };
  draw: (b: Boss, g: Game, c: CanvasRenderingContext2D, t: number) => void;
  /** optional one-time setup when spawned */
  setup?: (b: Boss, g: Game) => void;
  /** dmg taken while player bombs (default 0.25) */
  bombResist?: number;
}

export interface StageDef {
  index: number;
  name: string;
  title: string;
  subtitle: string;
  music: string;
  bg: string;
  color: string;
  mid: BossDef;
  boss: BossDef;
  script: (g: Game) => Task;
}
