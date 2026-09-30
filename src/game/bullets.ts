import { PF_H, PF_W, PF_X, PF_Y } from '../config';
import { lerp } from '../core/math';
import { ctx, view } from '../render/canvas';
import { BTYPES, SS, bulletSprite, glowSprite, hexA, type BType, type BulletColor, BCOL } from '../render/sprites';
import { makeCanvas } from '../render/canvas';
import type { Game } from './game';

export type BulletFn = (b: Bullet, g: Game) => void;

export interface BOpts {
  accel?: number;
  angVel?: number;
  minSpeed?: number;
  maxSpeed?: number;
  delay?: number;
  upd?: BulletFn;
  glyph?: string;
  maxAge?: number;
  bounce?: number;
  wrap?: number;
  cullGrace?: number;
  ay?: number;
  scale?: number;
  data?: Record<string, number>;
  noCancel?: boolean;
  sfx?: boolean;
}

export class Bullet {
  alive = false;
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  speed = 0;
  angle = 0;
  cos = 1;
  sin = 0;
  accel = 0;
  angVel = 0;
  minSpeed = -99;
  maxSpeed = 99;
  ay = 0;
  type: BType = 'orb';
  color: BulletColor = 'red';
  r = 4;
  sprite: HTMLCanvasElement | null = null;
  half = 8;
  dir = false;
  spin = 0;
  rot = 0;
  layer = 0;
  delay = 0;
  delayMax = 1;
  age = 0;
  grazed = false;
  owner: object | null = null;
  upd: BulletFn | null = null;
  data: Record<string, number> = {};
  maxAge = 0;
  bounce = 0;
  wrap = 0;
  cullGrace = 0;
  scale = 1;
  alpha = 1;
  noCancel = false;
  glyph = '';
  /** flagged while slowed by overclock (tints purple) */

  setSpeedAngle(speed: number, angle: number) {
    this.speed = speed;
    this.angle = angle;
    this.cos = Math.cos(angle);
    this.sin = Math.sin(angle);
  }

  setAngle(a: number) {
    this.angle = a;
    this.cos = Math.cos(a);
    this.sin = Math.sin(a);
  }

  setType(type: BType, color: BulletColor, glyph = '') {
    this.type = type;
    this.color = color;
    this.glyph = glyph;
    const spec = BTYPES[type];
    this.r = spec.r * this.scale;
    this.dir = spec.dir;
    this.spin = spec.spin ?? 0;
    this.layer = spec.layer;
    this.sprite = bulletSprite(type, color, glyph);
    this.half = (spec.size / 2) * this.scale;
  }
}

export const MAX_BULLETS = 4096;

export class BulletPool {
  list: Bullet[] = [];
  private free: Bullet[] = [];

  constructor() {
    for (let i = 0; i < MAX_BULLETS; i++) this.free.push(new Bullet());
  }

  get count() {
    return this.list.length;
  }

  spawn(x: number, y: number, angle: number, speed: number, type: BType, color: BulletColor, o?: BOpts): Bullet | null {
    const b = this.free.pop();
    if (!b) return null;
    b.alive = true;
    b.x = b.px = x;
    b.y = b.py = y;
    b.setSpeedAngle(speed, angle);
    b.accel = o?.accel ?? 0;
    b.angVel = o?.angVel ?? 0;
    b.minSpeed = o?.minSpeed ?? -99;
    b.maxSpeed = o?.maxSpeed ?? 99;
    b.ay = o?.ay ?? 0;
    b.scale = o?.scale ?? 1;
    b.setType(type, color, o?.glyph ?? '');
    b.delay = b.delayMax = o?.delay ?? 10;
    b.age = 0;
    b.grazed = false;
    b.owner = null;
    b.upd = o?.upd ?? null;
    b.data = o?.data ? { ...o.data } : {};
    b.maxAge = o?.maxAge ?? 0;
    b.bounce = o?.bounce ?? 0;
    b.wrap = o?.wrap ?? 0;
    b.cullGrace = o?.cullGrace ?? 0;
    b.rot = angle;
    b.alpha = 1;
    b.noCancel = o?.noCancel ?? false;
    this.list.push(b);
    return b;
  }

  kill(b: Bullet) {
    b.alive = false;
  }

  update(g: Game) {
    const ts = g.ts;
    const list = this.list;
    const M = 40;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (!b.alive) continue;
      b.px = b.x;
      b.py = b.y;
      if (b.delay > 0) b.delay -= ts;
      if (b.upd) {
        b.upd(b, g);
        if (!b.alive) continue;
      }
      if (b.accel !== 0) {
        b.speed += b.accel * ts;
        if (b.speed > b.maxSpeed) b.speed = b.maxSpeed;
        if (b.speed < b.minSpeed) b.speed = b.minSpeed;
      }
      if (b.angVel !== 0) {
        b.angle += b.angVel * ts;
        b.cos = Math.cos(b.angle);
        b.sin = Math.sin(b.angle);
      }
      if (b.ay !== 0) {
        const vx = b.cos * b.speed;
        const vy = b.sin * b.speed + b.ay * ts;
        b.speed = Math.hypot(vx, vy);
        b.angle = Math.atan2(vy, vx);
        b.cos = Math.cos(b.angle);
        b.sin = Math.sin(b.angle);
        if (b.speed > b.maxSpeed) b.speed = b.maxSpeed;
      }
      b.x += b.cos * b.speed * ts;
      b.y += b.sin * b.speed * ts;
      b.age += ts;
      if (b.spin) b.rot += b.spin * ts;
      if (b.bounce > 0) {
        if ((b.x < 0 && b.cos < 0) || (b.x > PF_W && b.cos > 0)) {
          b.setAngle(Math.PI - b.angle);
          b.bounce--;
        } else if (b.y < 0 && b.sin < 0) {
          b.setAngle(-b.angle);
          b.bounce--;
        }
      }
      if (b.wrap > 0) {
        if (b.x < -4) {
          b.x += PF_W + 8;
          b.px = b.x;
          b.wrap--;
          g.fx.ring(PF_W, b.y, 4, 20, BCOL[b.color].glow, 14);
        } else if (b.x > PF_W + 4) {
          b.x -= PF_W + 8;
          b.px = b.x;
          b.wrap--;
          g.fx.ring(0, b.y, 4, 20, BCOL[b.color].glow, 14);
        }
      }
      if (b.maxAge > 0 && b.age >= b.maxAge) {
        g.fx.pop(b.x, b.y, BCOL[b.color].glow);
        b.alive = false;
        continue;
      }
      if (b.age > b.cullGrace) {
        const h = b.half;
        if (b.x < -M - h || b.x > PF_W + M + h || b.y < -M - h || b.y > PF_H + M + h) b.alive = false;
      }
    }
    this.compact();
  }

  compact() {
    const list = this.list;
    let j = 0;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.alive) list[j++] = b;
      else {
        b.upd = null;
        b.owner = null;
        this.free.push(b);
      }
    }
    list.length = j;
  }

  clear() {
    for (const b of this.list) b.alive = false;
    this.compact();
  }

  draw(alpha: number, overclock: boolean) {
    const k = view.k;
    const ox = view.ox + PF_X * k;
    const oy = view.oy + PF_Y * k;
    const list = this.list;
    for (let layer = 0; layer <= 5; layer++) {
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        if (b.layer !== layer || !b.alive) continue;
        const x = lerp(b.px, b.x, alpha);
        const y = lerp(b.py, b.y, alpha);
        const spr = b.sprite!;
        let s = b.scale;
        let a = b.alpha;
        if (b.delay > 0) {
          const t = b.delay / b.delayMax;
          s *= 1 + t * 1.6;
          a *= 1 - t * 0.85;
        }
        const w = (spr.width / SS) * s;
        const h = (spr.height / SS) * s;
        if (a !== 1) ctx.globalAlpha = a;
        if (b.dir || b.spin) {
          const r = b.dir ? b.angle : b.rot;
          const c = Math.cos(r) * k;
          const sn = Math.sin(r) * k;
          ctx.setTransform(c, sn, -sn, c, ox + x * k, oy + y * k);
          ctx.drawImage(spr, -w / 2, -h / 2, w, h);
        } else {
          ctx.setTransform(k, 0, 0, k, ox + x * k, oy + y * k);
          ctx.drawImage(spr, -w / 2, -h / 2, w, h);
        }
        if (a !== 1) ctx.globalAlpha = 1;
      }
    }
    if (overclock && list.length) {
      // time-dilation tint: a faint violet halo on every slowed bullet
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      const gs = glowSprite('#9b5bff', 16);
      for (let i = 0; i < list.length; i++) {
        const b = list[i];
        const x = lerp(b.px, b.x, alpha);
        const y = lerp(b.py, b.y, alpha);
        ctx.setTransform(k, 0, 0, k, ox + x * k, oy + y * k);
        ctx.drawImage(gs, -16, -16, 32, 32);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

// ---------------------------------------------------------------- lasers

export class Laser {
  alive = true;
  x = 0;
  y = 0;
  angle = 0;
  len = 900;
  width = 24;
  warn = 50;
  active = 90;
  fade = 14;
  grow = 8;
  age = 0;
  color: BulletColor = 'magenta';
  angVel = 0;
  owner: object | null = null;
  follow: { x: number; y: number } | null = null;
  grazeT = 0;
  fired = false;
  noCancel = false;

  get hot(): boolean {
    return this.age >= this.warn && this.age < this.warn + this.grow + this.active;
  }
  get widthNow(): number {
    const a = this.age - this.warn;
    if (a < 0) return 2;
    if (a < this.grow) return this.width * (a / this.grow);
    if (a < this.grow + this.active) return this.width;
    const f = (a - this.grow - this.active) / this.fade;
    return this.width * Math.max(0, 1 - f);
  }
  get endX() {
    return this.x + Math.cos(this.angle) * this.len;
  }
  get endY() {
    return this.y + Math.sin(this.angle) * this.len;
  }
}

const laserTex = new Map<string, HTMLCanvasElement>();
function laserTexture(color: BulletColor): HTMLCanvasElement {
  let c = laserTex.get(color);
  if (!c) {
    const [cv, g] = makeCanvas(4, 64);
    const grad = g.createLinearGradient(0, 0, 0, 64);
    const col = BCOL[color];
    grad.addColorStop(0, hexA(col.glow, 0));
    grad.addColorStop(0.18, hexA(col.glow, 0.35));
    grad.addColorStop(0.36, hexA(col.body, 0.95));
    grad.addColorStop(0.46, '#ffffff');
    grad.addColorStop(0.54, '#ffffff');
    grad.addColorStop(0.64, hexA(col.body, 0.95));
    grad.addColorStop(0.82, hexA(col.glow, 0.35));
    grad.addColorStop(1, hexA(col.glow, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 64);
    c = cv;
    laserTex.set(color, c);
  }
  return c;
}

export function drawLasers(lasers: Laser[], t: number) {
  const k = view.k;
  const ox = view.ox + PF_X * k;
  const oy = view.oy + PF_Y * k;
  for (const l of lasers) {
    const c = Math.cos(l.angle) * k;
    const s = Math.sin(l.angle) * k;
    ctx.setTransform(c, s, -s, c, ox + l.x * k, oy + l.y * k);
    if (l.age < l.warn) {
      // telegraph: thin flickering line + dashed guide
      const p = l.age / l.warn;
      ctx.globalAlpha = 0.35 + 0.35 * Math.abs(Math.sin(t * 0.4));
      ctx.fillStyle = BCOL[l.color].body;
      ctx.fillRect(0, -0.75 - p * 1.2, l.len, 1.5 + p * 2.4);
      ctx.globalAlpha = 1;
    } else {
      const w = l.widthNow;
      if (w <= 0.2) continue;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(laserTexture(l.color), 0, -w * 1.1, l.len, w * 2.2);
      ctx.globalCompositeOperation = 'source-over';
      // source flare
      const gs = glowSprite(BCOL[l.color].glow, 32);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(gs, -w * 1.5, -w * 1.5, w * 3, w * 3);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.globalAlpha = 1;
}

