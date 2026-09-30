import { PF_H, PF_W, PF_X, PF_Y } from '../config';
import { lerp } from '../core/math';
import { ctx, view } from '../render/canvas';
import { itemSprite, SS, type ItemKind } from '../render/sprites';
import type { Game } from './game';

export class Item {
  alive = false;
  kind: ItemKind = 'power';
  x = 0;
  y = 0;
  px = 0;
  py = 0;
  vx = 0;
  vy = 0;
  magnet = false;
  magnetDelay = 0;
  age = 0;
  spr: HTMLCanvasElement | null = null;
  rot = 0;
}

export class ItemPool {
  list: Item[] = [];
  private free: Item[] = [];
  constructor(max = 1400) {
    for (let i = 0; i < max; i++) this.free.push(new Item());
  }

  spawn(kind: ItemKind, x: number, y: number, spread = 0): Item | null {
    const it = this.free.pop();
    if (!it) return null;
    it.alive = true;
    it.kind = kind;
    it.x = it.px = Math.max(10, Math.min(PF_W - 10, x + (Math.random() - 0.5) * spread));
    it.y = it.py = y + (Math.random() - 0.5) * spread * 0.6;
    it.vx = (Math.random() - 0.5) * (spread ? 2.4 : 0.4);
    it.vy = -2.6 - Math.random() * 1.2;
    it.magnet = false;
    it.magnetDelay = 0;
    it.age = 0;
    it.rot = 0;
    it.spr = itemSprite(kind);
    this.list.push(it);
    return it;
  }

  /** A bullet-cancel bit: small, homes to the player after a short hover. */
  spawnCancel(x: number, y: number, gold: boolean) {
    const it = this.spawn(gold ? 'gold' : 'cancel', x, y);
    if (!it) return;
    it.vx = (Math.random() - 0.5) * 1.2;
    it.vy = -1.2 - Math.random();
    it.magnet = true;
    it.magnetDelay = 14 + Math.random() * 10;
  }

  magnetAll() {
    for (const it of this.list) {
      it.magnet = true;
      it.magnetDelay = Math.min(it.magnetDelay, 4);
    }
  }

  update(g: Game) {
    const p = g.player;
    const pAlive = p.alive;
    const collectAll = pAlive && p.y < g.pocY;
    const rMag = p.focus ? 70 : 42;
    for (const it of this.list) {
      if (!it.alive) continue;
      it.px = it.x;
      it.py = it.y;
      it.age++;
      if (it.magnetDelay > 0) it.magnetDelay--;
      if (pAlive && !it.magnet) {
        const dx = p.x - it.x;
        const dy = p.y - it.y;
        if (collectAll || dx * dx + dy * dy < rMag * rMag) it.magnet = true;
      }
      if (it.magnet && pAlive && it.magnetDelay <= 0) {
        const dx = p.x - it.x;
        const dy = p.y - it.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = Math.min(16, 6 + it.age * 0.08 + (it.kind === 'cancel' || it.kind === 'gold' ? 4 : 0));
        it.vx = lerp(it.vx, (dx / d) * sp, 0.35);
        it.vy = lerp(it.vy, (dy / d) * sp, 0.35);
        if (d < 18) {
          g.collect(it);
          it.alive = false;
          continue;
        }
      } else {
        it.vx *= 0.94;
        it.vy = Math.min(it.vy + 0.09, it.kind === 'cancel' || it.kind === 'gold' ? 3 : 2.3);
      }
      it.x += it.vx;
      it.y += it.vy;
      if (it.age < 24) it.rot += 0.35;
      else it.rot *= 0.8;
      if (it.y > PF_H + 24) it.alive = false;
    }
    let j = 0;
    for (const it of this.list) {
      if (it.alive) this.list[j++] = it;
      else this.free.push(it);
    }
    this.list.length = j;
  }

  clear() {
    for (const it of this.list) this.free.push(it);
    this.list.length = 0;
  }

  draw(alpha: number) {
    const k = view.k;
    const ox = view.ox + PF_X * k;
    const oy = view.oy + PF_Y * k;
    for (const it of this.list) {
      const x = lerp(it.px, it.x, alpha);
      const y = lerp(it.py, it.y, alpha);
      const spr = it.spr!;
      const w = spr.width / SS;
      if (y < -w / 2) {
        // off-screen marker at the top edge
        ctx.setTransform(k, 0, 0, k, ox + x * k, oy);
        ctx.globalAlpha = 0.6;
        ctx.drawImage(spr, -w / 4, 2, w / 2, w / 2);
        ctx.globalAlpha = 1;
        continue;
      }
      if (it.rot) {
        const c = Math.cos(it.rot) * k;
        const s = Math.sin(it.rot) * k;
        ctx.setTransform(c, s, -s, c, ox + x * k, oy + y * k);
      } else ctx.setTransform(k, 0, 0, k, ox + x * k, oy + y * k);
      ctx.drawImage(spr, -w / 2, -w / 2, w, w);
    }
  }
}
