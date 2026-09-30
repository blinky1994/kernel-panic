import { audio } from '../audio/engine';
import { input } from '../core/input';
import { ctx } from '../render/canvas';
import { text } from '../render/draw';

export interface Scene {
  update(): void;
  draw(alpha: number): void;
  enter?(): void;
  leave?(): void;
  /** true if the scene wants the mouse cursor visible */
  cursor?: boolean;
}

class App {
  scene: Scene | null = null;
  private next: Scene | null = null;
  fade = 0;
  private fadeDir = 0;

  set(s: Scene, instant = false) {
    if (instant || !this.scene) {
      this.scene?.leave?.();
      this.scene = s;
      s.enter?.();
      this.fade = instant ? 0 : 1;
      this.fadeDir = -1;
      return;
    }
    this.next = s;
    this.fadeDir = 1;
  }

  update() {
    if (this.fadeDir > 0) {
      this.fade += 0.12;
      if (this.fade >= 1) {
        this.fade = 1;
        this.scene?.leave?.();
        this.scene = this.next;
        this.next = null;
        this.scene?.enter?.();
        input.resetEdges();
        this.fadeDir = -1;
      }
      return;
    }
    if (this.fadeDir < 0) {
      this.fade -= 0.08;
      if (this.fade <= 0) {
        this.fade = 0;
        this.fadeDir = 0;
      }
    }
    this.scene?.update();
  }

  draw(alpha: number) {
    this.scene?.draw(alpha);
  }
}

export const app = new App();

// ------------------------------------------------------------------ menu widget

export interface MenuItem {
  label: string;
  hint?: string;
  disabled?: boolean;
  value?: () => string;
  left?: () => void;
  right?: () => void;
  select?: () => void;
  color?: string;
}

export class Menu {
  idx = 0;
  rects: { x: number; y: number; w: number; h: number }[] = [];
  t = 0;
  onBack: (() => void) | null = null;
  constructor(public items: MenuItem[]) {
    this.skipDisabled(1);
  }

  private skipDisabled(dir: number) {
    let guard = 0;
    while (this.items[this.idx]?.disabled && guard++ < this.items.length) this.idx = (this.idx + dir + this.items.length) % this.items.length;
  }

  move(dir: number) {
    this.idx = (this.idx + dir + this.items.length) % this.items.length;
    this.skipDisabled(dir);
    audio.play('menuMove');
  }

  update() {
    this.t++;
    if (input.repeat('up')) this.move(-1);
    if (input.repeat('down')) this.move(1);
    if (input.wheel) this.move(input.wheel);
    const it = this.items[this.idx];
    if (it && !it.disabled) {
      if (input.repeat('left') && it.left) {
        it.left();
        audio.play('menuMove');
      }
      if (input.repeat('right') && it.right) {
        it.right();
        audio.play('menuMove');
      }
      if (input.pressed('confirm')) this.activate(this.idx);
    }
    if (input.pressed('back') && this.onBack) {
      audio.play('menuBack');
      this.onBack();
      return;
    }
    // pointer
    if (input.hover && input.hoverMoved) {
      const i = this.hit(input.hover.x, input.hover.y);
      if (i >= 0 && i !== this.idx && !this.items[i].disabled) {
        this.idx = i;
        audio.play('menuMove');
      }
    }
    for (const tp of input.taps) {
      const i = this.hit(tp.x, tp.y);
      if (i >= 0 && !this.items[i].disabled) {
        const r = this.rects[i];
        const item = this.items[i];
        this.idx = i;
        if ((item.left || item.right) && !item.select) {
          if (tp.x < r.x + r.w / 2) item.left?.();
          else item.right?.();
          audio.play('menuMove');
        } else this.activate(i);
      }
    }
  }

  private activate(i: number) {
    const it = this.items[i];
    if (it.select) {
      audio.play('menuOk');
      it.select();
    } else if (it.right) {
      it.right();
      audio.play('menuMove');
    }
  }

  hit(x: number, y: number): number {
    for (let i = 0; i < this.rects.length; i++) {
      const r = this.rects[i];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  draw(x: number, y: number, o: { w?: number; gap?: number; size?: number; align?: 'left' | 'center'; accent?: string; max?: number } = {}) {
    const w = o.w ?? 360;
    const gap = o.gap ?? 40;
    const size = o.size ?? 18;
    const accent = o.accent ?? '#00f0ff';
    const max = o.max ?? 999;
    let start = 0;
    if (this.items.length > max) start = Math.max(0, Math.min(this.idx - Math.floor(max / 2), this.items.length - max));
    this.rects = [];
    this.items.forEach((it, i) => {
      if (i < start || i >= start + max) {
        this.rects.push({ x: -9999, y: -9999, w: 0, h: 0 });
        return;
      }
      const yy = y + (i - start) * gap;
      const sel = i === this.idx;
      const rx = o.align === 'center' ? x - w / 2 : x;
      this.rects.push({ x: rx, y: yy - gap / 2, w, h: gap });
      if (sel) {
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 0.15);
        ctx.fillStyle = `rgba(0,240,255,${0.07 + pulse * 0.05})`;
        ctx.fillRect(rx, yy - gap / 2 + 3, w, gap - 6);
        ctx.fillStyle = it.color ?? accent;
        ctx.fillRect(rx, yy - gap / 2 + 3, 3, gap - 6);
      }
      const col = it.disabled ? '#3a4560' : sel ? '#ffffff' : '#8aa0cc';
      const label = (sel ? '> ' : '  ') + it.label;
      if (o.align === 'center' && !it.value) {
        text(label, x, yy, { size, weight: sel ? 800 : 600, color: col, align: 'center', baseline: 'middle', glow: sel ? it.color ?? accent : undefined, glowBlur: 10 });
      } else {
        text(label, rx + 14, yy, { size, weight: sel ? 800 : 600, color: col, baseline: 'middle', glow: sel ? it.color ?? accent : undefined, glowBlur: 10 });
        if (it.value) {
          const v = it.value();
          text((it.left ? '◀ ' : '') + v + (it.right ? ' ▶' : ''), rx + w - 14, yy, { size: size - 2, weight: 700, color: sel ? it.color ?? accent : '#8aa0cc', align: 'right', baseline: 'middle' });
        }
      }
    });
    if (start > 0) text('▲', x + (o.align === 'center' ? 0 : w / 2), y - gap * 0.7, { size: 10, color: '#556a90', align: 'center' });
    if (start + max < this.items.length) text('▼', x + (o.align === 'center' ? 0 : w / 2), y + max * gap - gap * 0.3, { size: 10, color: '#556a90', align: 'center' });
    const cur = this.items[this.idx];
    return cur?.hint ?? '';
  }
}
