import { PF_H, PF_W } from '../config';
import { catmull, lerp, type EaseFn, ease } from '../core/math';
import { TaskRunner, type Task } from '../core/tasks';
import type { Game } from './game';

export interface EnemyKind {
  id: string;
  hp: number;
  r: number;
  score: number;
  color: string;
  /** item drops on death */
  drops?: { power?: number; bigpower?: number; bits?: number; bomb?: number; life?: number; full?: number };
  explode?: 'S' | 'M' | 'L';
  draw: (e: Enemy, g: Game, c: CanvasRenderingContext2D, t: number) => void;
}

interface Tween {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  t: number;
  dur: number;
  ease: EaseFn;
}

let nextId = 1;

export class Enemy {
  id = nextId++;
  kind: EnemyKind;
  x: number;
  y: number;
  px: number;
  py: number;
  vx = 0;
  vy = 0;
  ax = 0;
  ay = 0;
  hp: number;
  maxHp: number;
  r: number;
  alive = true;
  age = 0;
  flash = 0;
  tasks = new TaskRunner();
  tween: Tween | null = null;
  path: { pts: ReadonlyArray<readonly [number, number]>; t: number; dur: number } | null = null;
  invuln = 0;
  angle = 0;
  scale = 1;
  dmgMult = 1;
  /** bosses & midbosses */
  isBoss = false;
  noDrops = false;
  /** allow flying out of the playfield without being culled */
  keepAlive = false;
  /** body contact kills the player */
  contact = true;
  onDeath: ((e: Enemy, g: Game) => void) | null = null;
  /** redirect damage to another enemy (shared HP) */
  hpLink: Enemy | null = null;
  data: Record<string, number> = {};
  label = '';
  gen = 0;

  constructor(kind: EnemyKind, x: number, y: number, hpMult = 1) {
    this.kind = kind;
    this.x = this.px = x;
    this.y = this.py = y;
    this.hp = this.maxHp = Math.max(1, Math.round(kind.hp * hpMult));
    this.r = kind.r;
  }

  run(task: Task) {
    this.tasks.add(task);
  }

  moveTo(x: number, y: number, frames: number, e: EaseFn = ease.outCubic) {
    this.tween = { x0: this.x, y0: this.y, x1: x, y1: y, t: 0, dur: Math.max(1, frames), ease: e };
    this.path = null;
    this.vx = this.vy = 0;
    this.ax = this.ay = 0;
  }

  /** Coroutine helper: move and wait until done. */
  *moveWait(x: number, y: number, frames: number, e: EaseFn = ease.outCubic): Task {
    this.moveTo(x, y, frames, e);
    yield frames;
  }

  setVel(speed: number, angle: number) {
    this.tween = null;
    this.path = null;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
  }

  followPath(pts: ReadonlyArray<readonly [number, number]>, frames: number) {
    this.path = { pts, t: 0, dur: Math.max(1, frames) };
    this.tween = null;
  }

  update(g: Game) {
    const ts = g.ts;
    this.px = this.x;
    this.py = this.y;
    if (this.path) {
      const p = this.path;
      p.t = Math.min(1, p.t + ts / p.dur);
      const [x, y] = catmull(p.pts, p.t);
      if (ts > 0.001) {
        this.vx = (x - this.x) / ts;
        this.vy = (y - this.y) / ts;
      }
      this.x = x;
      this.y = y;
      if (p.t >= 1) {
        // keep flying along the path's final tangent so the enemy exits cleanly
        const [bx, by] = catmull(p.pts, 1 - 1 / p.dur);
        this.vx = x - bx;
        this.vy = y - by;
        const sp = Math.hypot(this.vx, this.vy);
        if (sp < 1.5) {
          if (sp < 0.01) this.vy = 1.5;
          else {
            this.vx *= 1.5 / sp;
            this.vy *= 1.5 / sp;
          }
        }
        this.path = null;
      }
    } else if (this.tween) {
      const tw = this.tween;
      tw.t = Math.min(1, tw.t + ts / tw.dur);
      const e = tw.ease(tw.t);
      this.x = lerp(tw.x0, tw.x1, e);
      this.y = lerp(tw.y0, tw.y1, e);
      if (tw.t >= 1) this.tween = null;
    } else {
      this.vx += this.ax * ts;
      this.vy += this.ay * ts;
      this.x += this.vx * ts;
      this.y += this.vy * ts;
    }
    g.currentOwner = this;
    this.tasks.update(ts);
    g.currentOwner = null;
    this.age += ts;
    if (this.flash > 0) this.flash -= 1;
    if (this.invuln > 0) this.invuln -= ts;
    if (!this.keepAlive && this.age > 90) {
      const m = 60 + this.r;
      if (this.x < -m || this.x > PF_W + m || this.y < -m - 60 || this.y > PF_H + m) {
        this.alive = false;
        this.tasks.clear();
      }
      // safety net: popcorn loitering off-screen for ages is stuck, not scripted
      if (!this.isBoss && this.age > 1800 && !this.onScreen) {
        this.alive = false;
        this.tasks.clear();
      }
    }
  }

  get onScreen(): boolean {
    return this.y > -this.r * 0.3 && this.y < PF_H + this.r && this.x > -this.r && this.x < PF_W + this.r;
  }
}
