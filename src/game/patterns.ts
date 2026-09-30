import { TAU } from '../core/math';
import type { BType, BulletColor } from '../render/sprites';
import type { Bullet, BOpts } from './bullets';
import type { Game } from './game';

/** n bullets evenly around a circle. */
export function ring(g: Game, x: number, y: number, n: number, speed: number, a0: number, type: BType, color: BulletColor, o?: BOpts): Bullet[] {
  const out: Bullet[] = [];
  for (let i = 0; i < n; i++) {
    const b = g.shoot(x, y, a0 + (i / n) * TAU, speed, type, color, o);
    if (b) out.push(b);
  }
  return out;
}

/** n bullets spread across `spread` radians centred on `center`. */
export function fan(g: Game, x: number, y: number, n: number, spread: number, center: number, speed: number, type: BType, color: BulletColor, o?: BOpts): Bullet[] {
  const out: Bullet[] = [];
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? center : center - spread / 2 + (spread * i) / (n - 1);
    const b = g.shoot(x, y, a, speed, type, color, o);
    if (b) out.push(b);
  }
  return out;
}

/** A line of bullets along one angle with speeds from s0 to s1. */
export function stack(g: Game, x: number, y: number, count: number, angle: number, s0: number, s1: number, type: BType, color: BulletColor, o?: BOpts): Bullet[] {
  const out: Bullet[] = [];
  for (let i = 0; i < count; i++) {
    const s = count === 1 ? s0 : s0 + ((s1 - s0) * i) / (count - 1);
    const b = g.shoot(x, y, angle, s, type, color, o);
    if (b) out.push(b);
  }
  return out;
}

/** Fan where every lane is a stack. */
export function fanStack(g: Game, x: number, y: number, n: number, spread: number, center: number, count: number, s0: number, s1: number, type: BType, color: BulletColor, o?: BOpts) {
  for (let i = 0; i < n; i++) {
    const a = n === 1 ? center : center - spread / 2 + (spread * i) / (n - 1);
    stack(g, x, y, count, a, s0, s1, type, color, o);
  }
}

/** Ring spawned on a circle of radius r around (x, y), flying outward. */
export function burst(g: Game, x: number, y: number, n: number, r: number, speed: number, a0: number, type: BType, color: BulletColor, o?: BOpts) {
  for (let i = 0; i < n; i++) {
    const a = a0 + (i / n) * TAU;
    g.shoot(x + Math.cos(a) * r, y + Math.sin(a) * r, a, speed, type, color, o);
  }
}

/** A string of text where every character is a bullet. */
export function textLine(g: Game, str: string, x: number, y: number, angle: number, speed: number, color: BulletColor, spacing = 20, o?: BOpts) {
  const perp = angle - Math.PI / 2;
  const w = (str.length - 1) * spacing;
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (ch === ' ') continue;
    const off = -w / 2 + i * spacing;
    g.shoot(x + Math.cos(perp) * off, y + Math.sin(perp) * off, angle, speed, 'glyph', color, { ...o, glyph: ch });
  }
}

// ----- bullet behaviours (reusable `upd` hooks) -----

/** Decelerate to a stop, pause, then relaunch toward the player. */
export function stopAndAim(stopAt: number, pause: number, speed: number, accel = 0) {
  return (b: Bullet, g: Game) => {
    const st = b.data.st ?? 0;
    if (st === 0 && b.age >= stopAt) {
      b.data.st = 1;
      b.data.t0 = b.age;
      b.speed = 0;
      b.accel = 0;
    } else if (st === 1 && b.age >= (b.data.t0 ?? 0) + pause) {
      b.data.st = 2;
      b.setAngle(g.aim(b.x, b.y));
      b.speed = accel ? 0.5 : speed;
      b.accel = accel;
      b.maxSpeed = speed;
    }
  };
}

/** Decelerate, then turn by `turn` radians and fly again. */
export function stopAndTurn(stopAt: number, pause: number, turn: number, speed: number) {
  return (b: Bullet) => {
    const st = b.data.st ?? 0;
    if (st === 0 && b.age >= stopAt) {
      b.data.st = 1;
      b.data.t0 = b.age;
      b.speed = 0;
      b.accel = 0;
    } else if (st === 1 && b.age >= (b.data.t0 ?? 0) + pause) {
      b.data.st = 2;
      b.setAngle(b.angle + turn);
      b.speed = 0.4;
      b.accel = 0.06;
      b.maxSpeed = speed;
    }
  };
}

/** Sine-wave wobble perpendicular to heading. */
export function wave(amp: number, freq: number) {
  return (b: Bullet, g: Game) => {
    const base = b.data.base ?? (b.data.base = b.angle);
    b.setAngle(base + Math.sin(b.age * freq + (b.data.ph ?? 0)) * amp);
  };
}

export const aimed = (g: Game, x: number, y: number) => g.aim(x, y);
