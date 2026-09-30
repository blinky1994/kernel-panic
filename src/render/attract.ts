import { H, W } from '../config';
import { TAU } from '../core/math';
import { fpick } from '../core/rng';
import { ctx } from './canvas';
import { bulletSprite, glowSprite, glyphSprite, SS, type BType, type BulletColor } from './sprites';

/** Full-screen animated backdrop used by menus: synthwave floor, code rain and a demo danmaku. */

interface AB {
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: BType;
  color: BulletColor;
  a: number;
  life: number;
}

const CHARS = '01{}[]();<>=+-*/&|!?#$%@'.split('');

export class Attract {
  t = 0;
  private bullets: AB[] = [];
  private cols: { x: number; y: number; speed: number; len: number; chars: string[] }[] = [];
  private angle = 0;
  cx = W / 2;
  cy = 250;
  intensity = 1;

  constructor() {
    for (let i = 0; i < 34; i++) this.cols.push(this.col(Math.random() * H));
  }
  private col(y = -300) {
    const len = 6 + Math.floor(Math.random() * 16);
    return { x: 10 + Math.floor(Math.random() * 64) * 20, y, speed: 1 + Math.random() * 3, len, chars: Array.from({ length: len }, () => fpick(CHARS)) };
  }

  update() {
    this.t++;
    const t = this.t;
    for (let i = 0; i < this.cols.length; i++) {
      const c = this.cols[i];
      c.y += c.speed;
      if (Math.random() < 0.04) c.chars[Math.floor(Math.random() * c.len)] = fpick(CHARS);
      if (c.y - c.len * 18 > H) this.cols[i] = this.col();
    }
    if (this.intensity > 0) {
      // demo pattern cycles every 8 seconds
      const phase = Math.floor(t / 480) % 3;
      if (phase === 0 && t % 4 === 0) {
        for (let k = 0; k < 5; k++) this.shoot(this.angle + (k / 5) * TAU, 2, 'rice', k % 2 ? 'cyan' : 'magenta');
        this.angle += 0.11;
      } else if (phase === 1 && t % 24 === 0) {
        const off = Math.random() * TAU;
        for (let k = 0; k < 24; k++) this.shoot(off + (k / 24) * TAU, 1.8, 'orb', 'yellow');
        for (let k = 0; k < 12; k++) this.shoot(off + (k / 12) * TAU, 1.2, 'ball', 'red');
      } else if (phase === 2 && t % 3 === 0) {
        this.shoot(this.angle, 2.4, 'kunai', 'green');
        this.shoot(-this.angle * 1.3, 2.1, 'diamond', 'purple');
        this.angle += 0.23;
      }
    }
    for (const b of this.bullets) {
      b.x += b.vx;
      b.y += b.vy;
      b.life++;
    }
    this.bullets = this.bullets.filter((b) => b.x > -40 && b.x < W + 40 && b.y > -40 && b.y < H + 40);
  }

  private shoot(a: number, s: number, type: BType, color: BulletColor) {
    if (this.bullets.length > 900) return;
    this.bullets.push({ x: this.cx, y: this.cy, vx: Math.cos(a) * s, vy: Math.sin(a) * s, type, color, a, life: 0 });
  }

  draw(k: number, ox: number, oy: number, bulletAlpha = 0.55) {
    const t = this.t;
    ctx.setTransform(k, 0, 0, k, ox, oy);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#02030a');
    g.addColorStop(0.55, '#060818');
    g.addColorStop(1, '#0c0620');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // sun
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25;
    ctx.drawImage(glowSprite('#ff2bd6', 32), W / 2 - 520, 280, 1040, 380);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // floor grid
    const hy = 470;
    ctx.strokeStyle = 'rgba(255,43,214,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -24; i <= 24; i++) {
      ctx.moveTo(W / 2 + i * 14, hy);
      ctx.lineTo(W / 2 + i * 140, H + 20);
    }
    for (let i = 0; i < 14; i++) {
      const z = i + ((t / 50) % 1);
      const y = hy + Math.pow(z / 14, 2.3) * (H - hy + 40);
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,43,214,0.35)';
    ctx.fillRect(0, hy, W, 1);
    // code rain
    ctx.globalCompositeOperation = 'lighter';
    for (const c of this.cols) {
      for (let i = 0; i < c.len; i++) {
        const y = c.y - i * 18;
        if (y < -20 || y > H + 20) continue;
        ctx.globalAlpha = i === 0 ? 0.5 : 0.22 * (1 - i / c.len);
        ctx.drawImage(glyphSprite(c.chars[i], i === 0 ? '#b0ffd0' : '#00a050', 14), c.x - 14, y - 14, 28, 28);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    // demo bullets
    ctx.globalAlpha = bulletAlpha;
    for (const b of this.bullets) {
      const spr = bulletSprite(b.type, b.color);
      const w = spr.width / SS;
      const c = Math.cos(b.a) * k;
      const s = Math.sin(b.a) * k;
      ctx.setTransform(c, s, -s, c, ox + b.x * k, oy + b.y * k);
      ctx.drawImage(spr, -w / 2, -w / 2, w, w);
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(k, 0, 0, k, ox, oy);
  }
}
