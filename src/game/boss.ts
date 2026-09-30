import { PF_W } from '../config';
import { ease, clamp } from '../core/math';
import type { Task } from '../core/tasks';
import { Enemy, type EnemyKind } from './enemy';
import type { Game } from './game';
import type { BossDef, PhaseDef } from './types';

const bossKind = (def: BossDef): EnemyKind => ({
  id: def.id,
  hp: 1000,
  r: def.r,
  score: 0,
  color: def.color,
  explode: 'L',
  draw: () => {},
});

export class Boss extends Enemy {
  def: BossDef;
  phase: PhaseDef | null = null;
  phaseIdx = 0;
  phasesLeft = 0;
  timer = 0;
  timerMax = 1;
  spellFailed = false;
  inSpell = false;
  dead = false;
  /** visual intensity 0..1 used by boss draw functions */
  charge = 0;
  partners: Enemy[] = [];

  constructor(def: BossDef) {
    super(bossKind(def), PF_W / 2, -80);
    this.def = def;
    this.isBoss = true;
    this.keepAlive = true;
    this.noDrops = true;
    this.dmgMult = 1;
  }

  /** Drift to a random point in the upper field. */
  *wander(g: Game, frames = 60, rx = 120, yMin = 90, yMax = 190): Task {
    const x = clamp(this.x + g.rng.range(-rx, rx), 90, PF_W - 90);
    const y = g.rng.range(yMin, yMax);
    this.moveTo(x, y, frames, ease.inOutSine);
    yield frames;
  }

  *home(frames = 40, y = this.def.homeY ?? 150): Task {
    this.moveTo(PF_W / 2, y, frames, ease.inOutSine);
    yield frames;
  }
}

export interface FightOpts {
  phaseOnly?: number;
  noDialogue?: boolean;
}

export function* fightBoss(g: Game, def: BossDef, opts: FightOpts = {}): Task {
  const b = new Boss(def);
  b.x = b.px = PF_W / 2;
  b.y = b.py = -90;
  b.invuln = 99999;
  def.setup?.(b, g);
  g.addEnemy(b);
  g.boss = b;
  g.banner(def.name, def.title, def.color, def.midboss ? 130 : 190, 'boss');
  b.moveTo(PF_W / 2, def.homeY ?? 150, 80, ease.outCubic);
  if (!def.midboss && def.music && opts.phaseOnly === undefined) {
    // boss theme kicks in as the boss appears
    g.playMusic(def.music);
  }
  yield 80;
  if (def.before && !opts.noDialogue && g.mode !== 'spell') yield* g.dialogue(def.before);
  if (opts.phaseOnly !== undefined && def.music && !def.midboss) g.playMusic(def.music);

  const phases = opts.phaseOnly !== undefined ? [def.phases[opts.phaseOnly]] : def.phases;
  for (let i = 0; i < phases.length; i++) {
    b.phaseIdx = opts.phaseOnly ?? i;
    b.phasesLeft = phases.length - i - 1;
    const res = yield* runPhase(g, b, phases[i], opts.phaseOnly !== undefined ? opts.phaseOnly : i);
    if (g.over) return;
    if (def.midboss && res === 'timeout' && i === phases.length - 1) {
      // midboss gives up and leaves
      b.invuln = 99999;
      g.banner('MIDBOSS ESCAPED', 'process detached', '#5d6f93');
      yield* b.moveWait(b.x, -120, 60, ease.inCubic);
      b.alive = false;
      g.boss = null;
      return;
    }
    if (i < phases.length - 1) {
      b.invuln = 99999;
      yield* b.home(50);
      yield 10;
    }
  }
  yield* defeat(g, b);
  g.boss = null;
  if (def.after && !opts.noDialogue && g.mode !== 'spell') {
    yield 50;
    yield* g.dialogue(def.after);
  }
}

function* runPhase(g: Game, b: Boss, ph: PhaseDef, idx: number): Task<'kill' | 'timeout'> {
  b.hp = b.maxHp = Math.round(ph.hp * g.bossHpMult);
  b.phase = ph;
  b.timer = b.timerMax = ph.time * 60;
  b.spellFailed = false;
  b.inSpell = !!ph.name;
  b.invuln = 45;
  b.charge = 0;
  if (ph.name) g.declareSpell(b, ph, idx);
  b.tasks.clear();
  b.tasks.add(ph.run(b, g));
  let timeout = false;
  let lastSec = -1;
  while (true) {
    if (g.over) return 'timeout';
    if (!ph.survival && b.hp <= 0) break;
    b.timer -= 1;
    const sec = Math.ceil(b.timer / 60);
    if (sec <= 10 && sec !== lastSec && sec > 0) {
      g.sfx('tick');
      lastSec = sec;
    }
    if (b.timer <= 0) {
      timeout = true;
      break;
    }
    yield;
  }
  b.tasks.clear();
  for (const p of b.partners) p.tasks.clear();
  g.phaseBreak(b, ph, timeout, idx);
  b.inSpell = false;
  return timeout ? 'timeout' : 'kill';
}

function* defeat(g: Game, b: Boss): Task {
  b.invuln = 99999;
  b.tasks.clear();
  g.slowmo(110, 0.3);
  g.sfx('bossDie');
  for (let i = 0; i < 10; i++) {
    g.fx.explode(b.x + g.rng.range(-40, 40), b.y + g.rng.range(-40, 40), b.def.color, 18 + i * 2);
    g.shake(6);
    yield 6;
  }
  g.bossExplosion(b);
  b.alive = false;
  for (const p of b.partners) {
    p.alive = false;
    g.fx.explode(p.x, p.y, b.def.color, 50);
  }
  yield 70;
}

export type { Task };
