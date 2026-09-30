import { PF_H, PF_W, PF_X, PF_Y, PLAYER_GRAZE_R } from '../config';
import { DEG, TAU, lerp, turnTowards } from '../core/math';
import { ctx, makeCanvas, view } from '../render/canvas';
import { cursorPath } from '../render/draw';
import { glowSprite, hexA, SS } from '../render/sprites';
import type { Enemy } from './enemy';
import type { Game } from './game';
import type { ShipDef } from './ships';

// ------------------------------------------------------------------ shots

export class Shot {
  alive = false;
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  dmg = 1;
  homing = false;
  target: Enemy | null = null;
  turn = 0;
  speed = 0;
  angle = 0;
  life = 0;
  spr: HTMLCanvasElement | null = null;
  trail: number[] = [];
  r = 10;
}

const shotSprites = new Map<string, HTMLCanvasElement>();
function boltSprite(color: string, w: number, len: number): HTMLCanvasElement {
  const key = color + w + ':' + len;
  let c = shotSprites.get(key);
  if (!c) {
    const [cv, g] = makeCanvas((w + 8) * SS, (len + 8) * SS);
    g.scale(SS, SS);
    const cx = (w + 8) / 2;
    const grad = g.createLinearGradient(0, 4, 0, len + 4);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.35, color);
    grad.addColorStop(1, hexA(color, 0));
    g.fillStyle = grad;
    g.beginPath();
    g.roundRect(cx - w / 2, 4, w, len, w / 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.9)';
    g.beginPath();
    g.roundRect(cx - w / 6, 5, w / 3, len * 0.55, w / 6);
    g.fill();
    c = cv;
    shotSprites.set(key, c);
  }
  return c;
}

export class ShotPool {
  list: Shot[] = [];
  private free: Shot[] = [];
  constructor(max = 600) {
    for (let i = 0; i < max; i++) this.free.push(new Shot());
  }

  bolt(x: number, y: number, angle: number, speed: number, dmg: number, color: string, w = 6, len = 26): Shot | null {
    const s = this.free.pop();
    if (!s) return null;
    s.alive = true;
    s.x = s.px = x;
    s.y = s.py = y;
    s.angle = angle;
    s.speed = speed;
    s.vx = Math.cos(angle) * speed;
    s.vy = Math.sin(angle) * speed;
    s.dmg = dmg;
    s.homing = false;
    s.target = null;
    s.life = 60;
    s.r = 11;
    s.spr = boltSprite(color, w, len);
    this.list.push(s);
    return s;
  }

  seeker(x: number, y: number, angle: number, speed: number, dmg: number, turn: number): Shot | null {
    const s = this.free.pop();
    if (!s) return null;
    s.alive = true;
    s.x = s.px = x;
    s.y = s.py = y;
    s.angle = angle;
    s.speed = speed;
    s.vx = Math.cos(angle) * speed;
    s.vy = Math.sin(angle) * speed;
    s.dmg = dmg;
    s.homing = true;
    s.turn = turn;
    s.target = null;
    s.life = 90;
    s.r = 12;
    s.trail.length = 0;
    this.list.push(s);
    return s;
  }

  update(g: Game) {
    for (const s of this.list) {
      if (!s.alive) continue;
      s.px = s.x;
      s.py = s.y;
      if (s.homing) {
        if (!s.target || !s.target.alive || !s.target.onScreen) s.target = g.nearestEnemy(s.x, s.y);
        if (s.target) {
          const a = Math.atan2(s.target.y - s.y, s.target.x - s.x);
          s.angle = turnTowards(s.angle, a, s.turn);
        } else s.angle = turnTowards(s.angle, -Math.PI / 2, s.turn * 0.5);
        s.speed = Math.min(s.speed + 0.4, 15);
        s.vx = Math.cos(s.angle) * s.speed;
        s.vy = Math.sin(s.angle) * s.speed;
        s.trail.push(s.x, s.y);
        if (s.trail.length > 12) s.trail.splice(0, 2);
      }
      s.x += s.vx;
      s.y += s.vy;
      s.life--;
      if (s.life <= 0 || s.y < -40 || s.y > PF_H + 40 || s.x < -40 || s.x > PF_W + 40) s.alive = false;
    }
  }

  compact() {
    let j = 0;
    for (const s of this.list) {
      if (s.alive) this.list[j++] = s;
      else {
        s.target = null;
        this.free.push(s);
      }
    }
    this.list.length = j;
  }

  clear() {
    for (const s of this.list) s.alive = false;
    this.compact();
  }

  draw(alpha: number, pyColor: string) {
    const k = view.k;
    const ox = view.ox + PF_X * k;
    const oy = view.oy + PF_Y * k;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.6;
    for (const s of this.list) {
      const x = lerp(s.px, s.x, alpha);
      const y = lerp(s.py, s.y, alpha);
      if (s.homing) {
        ctx.setTransform(k, 0, 0, k, ox, oy);
        ctx.strokeStyle = pyColor;
        ctx.lineCap = 'round';
        const tr = s.trail;
        for (let i = 2; i < tr.length; i += 2) {
          ctx.lineWidth = 1 + (i / tr.length) * 4;
          ctx.beginPath();
          ctx.moveTo(tr[i - 2], tr[i - 1]);
          ctx.lineTo(tr[i], tr[i + 1]);
          ctx.stroke();
        }
        ctx.lineWidth = 5;
        ctx.beginPath();
        if (tr.length >= 2) ctx.moveTo(tr[tr.length - 2], tr[tr.length - 1]);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = '#eaffef';
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, TAU);
        ctx.fill();
      } else {
        const spr = s.spr!;
        const w = spr.width / SS;
        const h = spr.height / SS;
        const r = s.angle + Math.PI / 2;
        const c = Math.cos(r) * k;
        const sn = Math.sin(r) * k;
        ctx.setTransform(c, sn, -sn, c, ox + x * k, oy + y * k);
        ctx.drawImage(spr, -w / 2, -6, w, h);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------------------------ player

const OPT_UNF: Record<number, [number, number][]> = {
  0: [],
  1: [[0, 26]],
  2: [
    [-26, 6],
    [26, 6],
  ],
  3: [
    [-28, 8],
    [0, 28],
    [28, 8],
  ],
  4: [
    [-38, 12],
    [-19, -8],
    [19, -8],
    [38, 12],
  ],
};
const OPT_FOC: Record<number, [number, number][]> = {
  0: [],
  1: [[0, -28]],
  2: [
    [-12, -20],
    [12, -20],
  ],
  3: [
    [-15, -16],
    [0, -30],
    [15, -16],
  ],
  4: [
    [-22, -10],
    [-8, -26],
    [8, -26],
    [22, -10],
  ],
};

export class Player {
  x = PF_W / 2;
  y = PF_H - 90;
  px = this.x;
  py = this.y;
  alive = true;
  focus = false;
  focusT = 0;
  invuln = 0;
  hitT = 0;
  deadT = 0;
  enterT = 0;
  shotCD = 0;
  seekCD = 0;
  bank = 0;
  t = 0;
  opts: { x: number; y: number; px: number; py: number }[] = [];
  beamOn = false;
  beamX = 0;
  beamEnd = 0;
  beamPrevEnd = 0;
  beamHit: Enemy | null = null;
  touchBacklogX = 0;
  touchBacklogY = 0;

  constructor(public ship: ShipDef) {
    for (let i = 0; i < 4; i++) this.opts.push({ x: this.x, y: this.y, px: this.x, py: this.y });
  }

  get level(): number {
    return 0;
  }

  reset() {
    this.x = this.px = PF_W / 2;
    this.y = this.py = PF_H + 40;
    this.enterT = 36;
    for (const o of this.opts) {
      o.x = o.px = this.x;
      o.y = o.py = this.y;
    }
  }

  updateOptions(level: number) {
    const unf = OPT_UNF[level];
    const foc = OPT_FOC[level];
    const ft = this.focusT;
    for (let i = 0; i < 4; i++) {
      const o = this.opts[i];
      o.px = o.x;
      o.py = o.y;
      if (i >= level) {
        o.x = this.x;
        o.y = this.y;
        continue;
      }
      const tx = this.x + lerp(unf[i][0], foc[i][0], ft);
      const ty = this.y + lerp(unf[i][1], foc[i][1], ft);
      o.x = lerp(o.x, tx, 0.45);
      o.y = lerp(o.y, ty, 0.45);
    }
  }

  fire(g: Game, level: number) {
    const ship = this.ship;
    const f = this.focus;
    const up = -Math.PI / 2;
    const dm = g.overclock ? 1.35 : 1;
    const S = g.shots;
    this.beamOn = false;
    if (ship.id === 'rs' && f) {
      this.beamOn = true;
      this.fireBeam(g, level, dm);
    }
    if (this.shotCD > 0) return;
    this.shotCD = 4;
    const col = ship.color;
    switch (ship.id) {
      case 'js': {
        S.bolt(this.x - 6, this.y - 10, up, 22, 2.0 * dm, '#fff3a0', 5, 24);
        S.bolt(this.x + 6, this.y - 10, up, 22, 2.0 * dm, '#fff3a0', 5, 24);
        for (let i = 1; i <= level; i++) {
          const a = (f ? 2.2 : 7) * i * DEG;
          S.bolt(this.x - 4, this.y - 6, up - a, 20, 1.45 * dm, col, 5, 20);
          S.bolt(this.x + 4, this.y - 6, up + a, 20, 1.45 * dm, col, 5, 20);
        }
        for (let i = 0; i < level; i++) {
          const o = this.opts[i];
          const out = f ? 0 : (o.x - this.x) * 0.006;
          S.bolt(o.x, o.y - 6, up + out, 20, 1.2 * dm, '#ffb84d', 4, 18);
        }
        break;
      }
      case 'rs': {
        if (!f) {
          S.bolt(this.x - 5, this.y - 10, up, 26, 2.4 * dm, '#ffd0b0', 7, 32);
          S.bolt(this.x + 5, this.y - 10, up, 26, 2.4 * dm, '#ffd0b0', 7, 32);
          if (level >= 2) {
            S.bolt(this.x - 13, this.y - 4, up, 26, 1.6 * dm, col, 6, 28);
            S.bolt(this.x + 13, this.y - 4, up, 26, 1.6 * dm, col, 6, 28);
          }
        }
        for (let i = 0; i < level; i++) {
          const o = this.opts[i];
          S.bolt(o.x, o.y - 6, up, 26, (f ? 1.0 : 1.7) * dm, col, 6, 28);
        }
        break;
      }
      case 'py': {
        S.bolt(this.x - 5, this.y - 10, up, 22, (f ? 2.3 : 1.8) * dm, '#c8ffd9', 5, 22);
        S.bolt(this.x + 5, this.y - 10, up, 22, (f ? 2.3 : 1.8) * dm, '#c8ffd9', 5, 22);
        if (this.seekCD <= 0) {
          this.seekCD = 8;
          const turn = f ? 0.2 : 0.12;
          if (level === 0) {
            S.seeker(this.x - 10, this.y, up - 0.6, 8, 2.6 * dm, turn);
          } else {
            for (let i = 0; i < level; i++) {
              const o = this.opts[i];
              const a = up + (o.x < this.x ? -0.7 : o.x > this.x ? 0.7 : 0);
              S.seeker(o.x, o.y, a, 8, 2.6 * dm, turn);
            }
          }
        }
        break;
      }
    }
  }

  private fireBeam(g: Game, level: number, dm: number) {
    const w = 14 + level * 3;
    this.beamX = this.x;
    let best: Enemy | null = null;
    let bestY = -1e9;
    for (const e of g.enemies) {
      if (!e.alive || e.y > this.y || !e.onScreen) continue;
      if (Math.abs(e.x - this.x) < e.r + w / 2 && e.y > bestY) {
        best = e;
        bestY = e.y;
      }
    }
    this.beamHit = best;
    const target = best ? Math.max(best.y + best.r * 0.4, -20) : -30;
    this.beamPrevEnd = this.beamEnd;
    this.beamEnd = target;
    if (best) {
      g.damageEnemy(best, (1.9 + level * 0.45) * dm, false, this.x, best.y + best.r * 0.5);
      if (g.frame % 3 === 0) g.fx.spark(this.x + (Math.random() - 0.5) * w, best.y + best.r * 0.4, -Math.PI / 2 + (Math.random() - 0.5) * 2, 3 + Math.random() * 4, this.ship.color, 12);
    }
  }

  draw(g: Game, alpha: number) {
    const k = view.k;
    const ox = view.ox + PF_X * k;
    const oy = view.oy + PF_Y * k;
    const x = lerp(this.px, this.x, alpha);
    const y = lerp(this.py, this.y, alpha);
    const ship = this.ship;
    const level = g.powerLevel;

    // beam
    if (this.beamOn && this.alive) {
      const w = 14 + level * 3;
      const end = this.beamEnd;
      ctx.setTransform(k, 0, 0, k, ox, oy);
      ctx.globalCompositeOperation = 'lighter';
      const flick = 0.85 + Math.random() * 0.15;
      const grad = ctx.createLinearGradient(x - w, 0, x + w, 0);
      grad.addColorStop(0, 'rgba(255,90,40,0)');
      grad.addColorStop(0.3, `rgba(255,110,50,${0.35 * flick})`);
      grad.addColorStop(0.45, `rgba(255,220,180,${0.9 * flick})`);
      grad.addColorStop(0.5, `rgba(255,255,255,${flick})`);
      grad.addColorStop(0.55, `rgba(255,220,180,${0.9 * flick})`);
      grad.addColorStop(0.7, `rgba(255,110,50,${0.35 * flick})`);
      grad.addColorStop(1, 'rgba(255,90,40,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(x - w, end, w * 2, y - 14 - end);
      const gs = glowSprite('#ff7a3c', 32);
      ctx.drawImage(gs, x - w * 1.6, end - w * 1.6, w * 3.2, w * 3.2);
      ctx.drawImage(gs, x - w, y - 14 - w, w * 2, w * 2);
      ctx.globalCompositeOperation = 'source-over';
    }

    // options (threads)
    for (let i = 0; i < level; i++) {
      const o = this.opts[i];
      const ox2 = lerp(o.px, o.x, alpha);
      const oy2 = lerp(o.py, o.y, alpha);
      ctx.setTransform(k, 0, 0, k, ox + ox2 * k, oy + oy2 * k);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(glowSprite(ship.color, 32), -14, -14, 28, 28);
      ctx.globalCompositeOperation = 'source-over';
      ctx.rotate(this.t * 0.08 * (i % 2 ? 1 : -1));
      ctx.strokeStyle = ship.color;
      ctx.lineWidth = 1.6;
      ctx.fillStyle = '#05060b';
      ctx.beginPath();
      ctx.rect(-5, -5, 10, 10);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-1.5, -1.5, 3, 3);
    }

    if (!this.alive) return;
    const blink = this.invuln > 0 && Math.floor(this.t / 3) % 2 === 0;
    ctx.setTransform(k, 0, 0, k, ox + x * k, oy + y * k);
    // thruster
    ctx.globalCompositeOperation = 'lighter';
    const fl = 0.7 + Math.random() * 0.5;
    ctx.drawImage(glowSprite(ship.accent, 32), -10, 6, 20, 22 * fl);
    ctx.drawImage(glowSprite(ship.color, 32), -22, -22, 44, 44);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = blink ? 0.35 : 1;
    const sx = 1 - Math.abs(this.bank) * 0.28;
    ctx.scale(sx, 1);
    cursorPath(ctx, 1.25);
    ctx.fillStyle = '#060912';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = this.hitT > 0 ? '#ff2a4a' : ship.color;
    ctx.stroke();
    // inner detail: a caret
    ctx.strokeStyle = ship.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.lineTo(0, -4);
    ctx.lineTo(4, 4);
    ctx.stroke();
    ctx.scale(1 / sx, 1);
    ctx.globalAlpha = 1;
  }

  /** Hitbox and graze ring, drawn above enemy bullets so it is always visible. */
  drawHitbox(g: Game, alpha: number, always: boolean) {
    if (!this.alive) return;
    const show = this.focusT > 0.01 || always || g.touchMode;
    if (!show) return;
    const k = view.k;
    const x = lerp(this.px, this.x, alpha);
    const y = lerp(this.py, this.y, alpha);
    const a = always || g.touchMode ? Math.max(0.6, this.focusT) : this.focusT;
    ctx.setTransform(k, 0, 0, k, view.ox + (PF_X + x) * k, view.oy + (PF_Y + y) * k);
    ctx.globalAlpha = a;
    ctx.rotate(this.t * 0.03);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.arc(0, 0, PLAYER_GRAZE_R, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.rotate(-this.t * 0.03);
    ctx.fillStyle = '#ff2a4a';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 3.6, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
