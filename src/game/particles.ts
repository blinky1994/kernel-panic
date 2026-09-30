import { PF_X, PF_Y } from '../config';
import { TAU } from '../core/math';
import { fpick, frand } from '../core/rng';
import { ctx, view } from '../render/canvas';
import { font } from '../render/draw';
import { glowSprite, glyphSprite, SS } from '../render/sprites';

const enum K {
  Spark,
  Glow,
  Ring,
  Glyph,
  Text,
  Shard,
  Line,
}

class P {
  alive = false;
  k: K = K.Spark;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 0;
  max = 1;
  size = 1;
  size1 = 1;
  color = '#fff';
  spr: HTMLCanvasElement | null = null;
  drag = 1;
  rot = 0;
  vr = 0;
  text = '';
  grav = 0;
  x2 = 0;
  y2 = 0;
}

const GLYPHS = ['{', '}', ';', '0', '1', '<', '>', '/', '*', '#', '&', '=', '(', ')', '[', ']', '!', '?', '$', '%'];

export class Particles {
  private pool: P[] = [];
  private list: P[] = [];
  private textList: P[] = [];
  constructor(max = 4096) {
    for (let i = 0; i < max; i++) this.pool.push(new P());
  }

  private get(): P | null {
    const p = this.pool.pop();
    if (!p) return null;
    p.alive = true;
    p.drag = 1;
    p.grav = 0;
    p.rot = 0;
    p.vr = 0;
    p.spr = null;
    p.vx = p.vy = 0;
    return p;
  }

  get count() {
    return this.list.length + this.textList.length;
  }

  spark(x: number, y: number, ang: number, speed: number, color: string, life = 18, len = 1) {
    const p = this.get();
    if (!p) return;
    p.k = K.Spark;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(ang) * speed;
    p.vy = Math.sin(ang) * speed;
    p.life = p.max = life;
    p.color = color;
    p.size = len;
    p.drag = 0.9;
    this.list.push(p);
  }

  glow(x: number, y: number, r: number, color: string, life = 20, vx = 0, vy = 0, r1 = r) {
    const p = this.get();
    if (!p) return;
    p.k = K.Glow;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.size = r;
    p.size1 = r1;
    p.life = p.max = life;
    p.spr = glowSprite(color, 32);
    p.drag = 0.94;
    this.list.push(p);
  }

  ring(x: number, y: number, r0: number, r1: number, color: string, life = 20, width = 2) {
    const p = this.get();
    if (!p) return;
    p.k = K.Ring;
    p.x = x;
    p.y = y;
    p.size = r0;
    p.size1 = r1;
    p.life = p.max = life;
    p.color = color;
    p.rot = width;
    this.list.push(p);
  }

  glyph(x: number, y: number, color: string, speed = 3, ch?: string, life = 40) {
    const p = this.get();
    if (!p) return;
    p.k = K.Glyph;
    p.x = x;
    p.y = y;
    const a = Math.random() * TAU;
    const s = speed * (0.4 + Math.random());
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.life = p.max = life * (0.6 + Math.random() * 0.6);
    p.spr = glyphSprite(ch ?? fpick(GLYPHS), color, 14);
    p.drag = 0.95;
    p.vr = frand(-0.2, 0.2);
    p.grav = 0.03;
    this.list.push(p);
  }

  shard(x: number, y: number, color: string, speed = 4, size = 4) {
    const p = this.get();
    if (!p) return;
    p.k = K.Shard;
    p.x = x;
    p.y = y;
    const a = Math.random() * TAU;
    const s = speed * (0.3 + Math.random());
    p.vx = Math.cos(a) * s;
    p.vy = Math.sin(a) * s;
    p.life = p.max = 25 + Math.random() * 30;
    p.color = color;
    p.size = size * (0.5 + Math.random());
    p.drag = 0.95;
    p.vr = frand(-0.3, 0.3);
    p.grav = 0.05;
    this.list.push(p);
  }

  line(x: number, y: number, x2: number, y2: number, color: string, life = 12, width = 2) {
    const p = this.get();
    if (!p) return;
    p.k = K.Line;
    p.x = x;
    p.y = y;
    p.x2 = x2;
    p.y2 = y2;
    p.life = p.max = life;
    p.color = color;
    p.size = width;
    this.list.push(p);
  }

  text(x: number, y: number, str: string, color = '#ffffff', life = 40, size = 11) {
    const p = this.get();
    if (!p) return;
    p.k = K.Text;
    p.x = x;
    p.y = y;
    p.vy = -0.7;
    p.text = str;
    p.color = color;
    p.life = p.max = life;
    p.size = size;
    p.drag = 0.97;
    this.textList.push(p);
  }

  /** Small cosmetic pop (bullet expiring / cancelled). */
  pop(x: number, y: number, color: string) {
    this.glow(x, y, 10, color, 12, 0, 0, 2);
  }

  explode(x: number, y: number, color: string, size: number) {
    const n = Math.min(40, Math.floor(6 + size * 0.9));
    this.glow(x, y, size * 2.2, color, 18, 0, 0, size * 3.5);
    this.glow(x, y, size * 1.3, '#ffffff', 10, 0, 0, size * 0.5);
    this.ring(x, y, size * 0.4, size * 2.6, color, 20, 3);
    for (let i = 0; i < n; i++) this.spark(x, y, Math.random() * TAU, 2 + Math.random() * (3 + size * 0.15), color, 14 + Math.random() * 16, 1.5);
    for (let i = 0; i < Math.min(14, 3 + size / 4); i++) this.glyph(x, y, color, 2 + size * 0.06);
    for (let i = 0; i < Math.min(10, size / 4); i++) this.shard(x, y, color, 3 + size * 0.05, 3 + size * 0.05);
  }

  update(ts: number) {
    const upd = (arr: P[]) => {
      let j = 0;
      for (let i = 0; i < arr.length; i++) {
        const p = arr[i];
        p.life -= ts;
        if (p.life <= 0) {
          p.alive = false;
          this.pool.push(p);
          continue;
        }
        const d = Math.pow(p.drag, ts);
        p.vx *= d;
        p.vy *= d;
        p.vy += p.grav * ts;
        p.x += p.vx * ts;
        p.y += p.vy * ts;
        p.rot += p.vr * ts;
        arr[j++] = p;
      }
      arr.length = j;
    };
    upd(this.list);
    upd(this.textList);
  }

  clear() {
    for (const p of this.list) this.pool.push(p);
    for (const p of this.textList) this.pool.push(p);
    this.list.length = 0;
    this.textList.length = 0;
  }

  draw() {
    const k = view.k;
    const ox = view.ox + PF_X * k;
    const oy = view.oy + PF_Y * k;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.list) {
      const t = p.life / p.max; // 1 -> 0
      switch (p.k) {
        case K.Spark: {
          ctx.setTransform(k, 0, 0, k, ox, oy);
          ctx.globalAlpha = t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * (0.5 + t);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.vx * 2.2, p.y - p.vy * 2.2);
          ctx.stroke();
          break;
        }
        case K.Glow: {
          const r = p.size1 + (p.size - p.size1) * t;
          ctx.setTransform(k, 0, 0, k, ox + p.x * k, oy + p.y * k);
          ctx.globalAlpha = t;
          ctx.drawImage(p.spr!, -r, -r, r * 2, r * 2);
          break;
        }
        case K.Ring: {
          const r = p.size1 + (p.size - p.size1) * t;
          ctx.setTransform(k, 0, 0, k, ox, oy);
          ctx.globalAlpha = t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.rot * t + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, Math.max(0.1, r), 0, TAU);
          ctx.stroke();
          break;
        }
        case K.Glyph: {
          const c = Math.cos(p.rot) * k;
          const s = Math.sin(p.rot) * k;
          ctx.setTransform(c, s, -s, c, ox + p.x * k, oy + p.y * k);
          ctx.globalAlpha = Math.min(1, t * 1.5);
          const w = p.spr!.width / SS;
          ctx.drawImage(p.spr!, -w / 2, -w / 2, w, w);
          break;
        }
        case K.Shard: {
          const c = Math.cos(p.rot) * k;
          const s = Math.sin(p.rot) * k;
          ctx.setTransform(c, s, -s, c, ox + p.x * k, oy + p.y * k);
          ctx.globalAlpha = t;
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          break;
        }
        case K.Line: {
          ctx.setTransform(k, 0, 0, k, ox, oy);
          ctx.globalAlpha = t;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * t;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x2, p.y2);
          ctx.stroke();
          break;
        }
        default:
          break;
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(k, 0, 0, k, ox, oy);
    for (const p of this.textList) {
      const t = p.life / p.max;
      ctx.globalAlpha = Math.min(1, t * 2);
      ctx.font = font(p.size, 700);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}
