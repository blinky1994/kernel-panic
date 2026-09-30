import { PF_W } from '../config';
import { ease } from '../core/math';
import type { Task } from '../core/tasks';
import type { Enemy } from '../game/enemy';
import type { Game } from '../game/game';

export type Script = (e: Enemy, g: Game) => Task;
export type Pt = readonly [number, number];

export const CX = PF_W / 2;
/** Toaplan-style lanes (no lanes at the very edges). */
export const LANES = [90, 170, 250, 350, 430, 510];

export const mirror = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [PF_W - x, y] as const);

/** Follow a spline; optionally run a firing routine alongside. */
export const along =
  (pts: Pt[], frames: number, fire?: Script): Script =>
  function* (e, g) {
    e.followPath(pts, frames);
    if (fire) e.run(fire(e, g));
    yield frames + 400;
  };

/** Fly in, hold position while firing, then leave. */
export const visit =
  (tx: number, ty: number, enter: number, stay: number, fire: Script, exitAngle = Math.PI / 2, exitSpeed = 1.6): Script =>
  function* (e, g) {
    yield* e.moveWait(tx, ty, enter, ease.outCubic);
    const f = fire(e, g);
    e.run(f);
    yield stay;
    e.tasks.kill(f);
    e.setVel(0.2, exitAngle);
    e.ax = Math.cos(exitAngle) * 0.06;
    e.ay = Math.sin(exitAngle) * 0.06;
    yield 400;
  };

/** Straight flight with constant velocity + optional fire routine. */
export const fly =
  (speed: number, angle: number, fire?: Script): Script =>
  function* (e, g) {
    e.setVel(speed, angle);
    if (fire) e.run(fire(e, g));
    yield 1200;
  };

/** Repeat `fn` every `interval` frames after `delay`, `count` times. */
export const every =
  (interval: number, fn: (e: Enemy, g: Game, i: number) => void, delay = 0, count = Infinity): Script =>
  function* (e, g) {
    if (delay > 0) yield delay;
    for (let i = 0; i < count; i++) {
      if (e.onScreen) fn(e, g, i);
      yield interval;
    }
  };

/** Run several scripts in parallel on one enemy. */
export const all =
  (...scripts: Script[]): Script =>
  function* (e, g) {
    for (const s of scripts) e.run(s(e, g));
    yield 1;
  };
