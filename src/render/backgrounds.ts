import { FONT_MONO, PF_H, PF_W } from '../config';
import { TAU } from '../core/math';
import { fpick, frand } from '../core/rng';
import type { Game } from '../game/game';
import { makeCanvas } from './canvas';
import { glowSprite, glyphSprite, hexA } from './sprites';

export interface Background {
  update(ts: number, g: Game | null): void;
  /** Called with the context already translated to the playfield origin. */
  draw(c: CanvasRenderingContext2D, t: number): void;
}

const CODE = 'const let var if else for while return function => {} () [] ; 0x 1 0 null undefined async await try catch throw new class import export'.split(' ');
const CHARS = '01{}[]();<>=+-*/&|!?#$%@abcdefxyz'.split('');

// ------------------------------------------------------------------ 1: localhost grid

class GridBg implements Background {
  private scroll = 0;
  private cols: { x: number; y: number; speed: number; len: number; chars: string[] }[] = [];
  constructor() {
    for (let i = 0; i < 16; i++) this.cols.push(this.newCol(Math.random() * PF_H));
  }
  private newCol(y = -200) {
    const len = 6 + Math.floor(Math.random() * 14);
    return { x: 20 + Math.floor(Math.random() * 29) * 20, y, speed: 1 + Math.random() * 2.5, len, chars: Array.from({ length: len }, () => fpick(CHARS)) };
  }
  update(ts: number) {
    this.scroll += 1.4 * ts;
    for (let i = 0; i < this.cols.length; i++) {
      const c = this.cols[i];
      c.y += c.speed * ts;
      if (Math.random() < 0.03) c.chars[Math.floor(Math.random() * c.len)] = fpick(CHARS);
      if (c.y - c.len * 18 > PF_H) this.cols[i] = this.newCol();
    }
  }
  draw(c: CanvasRenderingContext2D, t: number) {
    const g = c.createLinearGradient(0, 0, 0, PF_H);
    g.addColorStop(0, '#020611');
    g.addColorStop(0.5, '#040c18');
    g.addColorStop(1, '#071322');
    c.fillStyle = g;
    c.fillRect(0, 0, PF_W, PF_H);
    // perspective floor grid
    const hy = 120;
    const vx = PF_W / 2;
    c.strokeStyle = 'rgba(0,240,255,0.13)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = -12; i <= 12; i++) {
      c.moveTo(vx + i * 8, hy);
      c.lineTo(vx + i * 120, PF_H + 40);
    }
    const sp = this.scroll % 1;
    for (let i = 0; i < 18; i++) {
      const z = i + (this.scroll / 40) % 1;
      const y = hy + Math.pow(z / 18, 2.2) * (PF_H - hy + 60);
      c.moveTo(0, y);
      c.lineTo(PF_W, y);
    }
    c.stroke();
    void sp;
    // horizon glow
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.25;
    c.drawImage(glowSprite('#00a0ff', 32), vx - 380, hy - 90, 760, 180);
    c.globalAlpha = 1;
    // code rain
    for (const col of this.cols) {
      for (let i = 0; i < col.len; i++) {
        const y = col.y - i * 18;
        if (y < -20 || y > PF_H + 20) continue;
        const head = i === 0;
        c.globalAlpha = head ? 0.55 : 0.28 * (1 - i / col.len);
        const s = glyphSprite(col.chars[i], head ? '#b0ffd0' : '#00c060', 14);
        c.drawImage(s, col.x - 14, y - 14, 28, 28);
      }
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------------------------ 2: DOM tree

const TAGS = ['<div>', '<span>', '<a>', '<ul>', '<li>', '<img>', '<form>', '<p>', '<nav>', '<svg>', '<iframe>', '<script>'];
const tagCache = new Map<string, HTMLCanvasElement>();
function tagSprite(tag: string, color: string) {
  const key = tag + color;
  let s = tagCache.get(key);
  if (!s) {
    const w = tag.length * 8 + 14;
    const [cv, g] = makeCanvas(w * 2, 40);
    g.scale(2, 2);
    g.fillStyle = 'rgba(12,4,24,0.9)';
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(0.5, 0.5, w - 1, 19, 4);
    g.fill();
    g.stroke();
    g.font = `600 11px ${FONT_MONO}`;
    g.fillStyle = color;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(tag, w / 2, 10.5);
    s = cv;
    tagCache.set(key, s);
  }
  return s;
}

class DomBg implements Background {
  private scroll = 0;
  private rows: { y: number; nodes: { x: number; tag: string; parent: number }[] }[] = [];
  private rowGap = 96;
  constructor() {
    for (let y = PF_H + 100; y > -200; y -= this.rowGap) this.rows.unshift(this.makeRow(y));
    this.rows.reverse();
  }
  private makeRow(y: number) {
    const n = 2 + Math.floor(Math.random() * 4);
    const nodes = [];
    for (let i = 0; i < n; i++) nodes.push({ x: ((i + 0.5) / n) * PF_W + frand(-30, 30), tag: fpick(TAGS), parent: Math.floor(Math.random() * 5) });
    return { y, nodes };
  }
  update(ts: number) {
    this.scroll += 0.9 * ts;
    for (const r of this.rows) r.y += 0.9 * ts;
    // rows sorted top (smallest y) ... we keep in array order bottom->top
    this.rows = this.rows.filter((r) => r.y < PF_H + 150);
    let top = Math.min(...this.rows.map((r) => r.y));
    while (top > -150) {
      top -= this.rowGap;
      this.rows.push(this.makeRow(top));
    }
  }
  draw(c: CanvasRenderingContext2D, t: number) {
    const g = c.createLinearGradient(0, 0, 0, PF_H);
    g.addColorStop(0, '#07020f');
    g.addColorStop(1, '#10041a');
    c.fillStyle = g;
    c.fillRect(0, 0, PF_W, PF_H);
    // parallax dots
    c.fillStyle = 'rgba(255,43,214,0.12)';
    for (let i = 0; i < 60; i++) {
      const x = (i * 97) % PF_W;
      const y = (i * 53 + this.scroll * 0.4) % (PF_H + 20);
      c.fillRect(x, y, 2, 2);
    }
    const sorted = this.rows.slice().sort((a, b) => a.y - b.y);
    c.strokeStyle = 'rgba(169,112,255,0.18)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 1; i < sorted.length; i++) {
      const up = sorted[i - 1];
      const row = sorted[i];
      for (const n of row.nodes) {
        const p = up.nodes[n.parent % up.nodes.length];
        c.moveTo(n.x, row.y);
        c.bezierCurveTo(n.x, row.y - 40, p.x, up.y + 40, p.x, up.y);
      }
    }
    c.stroke();
    c.globalAlpha = 0.5;
    for (const r of sorted) {
      for (const n of r.nodes) {
        const s = tagSprite(n.tag, (n.x | 0) % 3 === 0 ? '#4d8dff' : '#ff2bd6');
        c.drawImage(s, n.x - s.width / 4, r.y - 10, s.width / 2, 20);
      }
    }
    c.globalAlpha = 1;
  }
}

// ------------------------------------------------------------------ 3: heap

class HeapBg implements Background {
  private scroll = 0;
  private cellW = 40;
  private cellH = 24;
  private cols = Math.ceil(PF_W / 40);
  private state: number[][] = [];
  private baseRow = 0;
  constructor() {
    for (let r = 0; r < 36; r++) this.state.push(this.makeRow());
  }
  private makeRow() {
    const row: number[] = [];
    let run = 0;
    let v = 0;
    for (let i = 0; i < this.cols; i++) {
      if (run <= 0) {
        run = 1 + Math.floor(Math.random() * 5);
        v = Math.random() < 0.45 ? 0 : 0.3 + Math.random() * 0.7;
      }
      row.push(v);
      run--;
    }
    return row;
  }
  update(ts: number) {
    this.scroll += 0.8 * ts;
    while (this.scroll >= this.cellH) {
      this.scroll -= this.cellH;
      this.state.pop();
      this.state.unshift(this.makeRow());
      this.baseRow++;
    }
    if (Math.random() < 0.25 * ts) {
      const r = Math.floor(Math.random() * this.state.length);
      const c = Math.floor(Math.random() * this.cols);
      this.state[r][c] = this.state[r][c] > 0 ? 0 : 0.4 + Math.random() * 0.6;
    }
  }
  draw(c: CanvasRenderingContext2D, t: number) {
    c.fillStyle = '#080502';
    c.fillRect(0, 0, PF_W, PF_H);
    const { cellW, cellH } = this;
    for (let r = 0; r < this.state.length; r++) {
      const y = (r - 2) * cellH + this.scroll;
      if (y > PF_H || y < -cellH) continue;
      const row = this.state[r];
      for (let i = 0; i < row.length; i++) {
        const v = row[i];
        if (v <= 0) continue;
        c.fillStyle = `rgba(150,${90 + Math.floor(v * 40)},40,${0.04 + v * 0.07})`;
        c.fillRect(i * cellW + 2, y + 2, cellW - 4, cellH - 4);
      }
    }
    c.strokeStyle = 'rgba(255,160,40,0.05)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i <= this.cols; i++) {
      c.moveTo(i * cellW, 0);
      c.lineTo(i * cellW, PF_H);
    }
    c.stroke();
    // addresses
    c.font = `500 9px ${FONT_MONO}`;
    c.fillStyle = 'rgba(255,190,90,0.16)';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    for (let r = 0; r < this.state.length; r += 2) {
      const y = (r - 2) * cellH + this.scroll + cellH / 2;
      if (y < 0 || y > PF_H) continue;
      const addr = (0x7ffe0000 - (this.baseRow - r) * 0x40) >>> 0;
      c.fillText('0x' + addr.toString(16).toUpperCase(), 4, y);
    }
  }
}

// ------------------------------------------------------------------ 4: thread pool

class ThreadBg implements Background {
  private lanes = 9;
  private packets: { lane: number; y: number; speed: number; len: number; color: string }[] = [];
  private barrier = -100;
  private tt = 0;
  constructor() {
    for (let i = 0; i < 40; i++) this.packets.push(this.newPacket(Math.random() * PF_H));
  }
  private newPacket(y = -30) {
    return { lane: Math.floor(Math.random() * this.lanes), y, speed: 2 + Math.random() * 6, len: 10 + Math.random() * 40, color: Math.random() < 0.5 ? '#4d8dff' : '#a970ff' };
  }
  update(ts: number) {
    this.tt += ts;
    for (let i = 0; i < this.packets.length; i++) {
      const p = this.packets[i];
      p.y += p.speed * ts;
      if (p.y - p.len > PF_H) this.packets[i] = this.newPacket();
    }
    this.barrier += 3 * ts;
    if (this.barrier > PF_H + 200) this.barrier = -300 - Math.random() * 400;
  }
  draw(c: CanvasRenderingContext2D, t: number) {
    const g = c.createLinearGradient(0, 0, 0, PF_H);
    g.addColorStop(0, '#03041a');
    g.addColorStop(1, '#070420');
    c.fillStyle = g;
    c.fillRect(0, 0, PF_W, PF_H);
    const lw = PF_W / this.lanes;
    c.strokeStyle = 'rgba(77,141,255,0.12)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i <= this.lanes; i++) {
      c.moveTo(i * lw, 0);
      c.lineTo(i * lw, PF_H);
    }
    c.stroke();
    c.globalCompositeOperation = 'lighter';
    for (const p of this.packets) {
      const x = p.lane * lw + lw / 2;
      const gr = c.createLinearGradient(0, p.y - p.len, 0, p.y);
      gr.addColorStop(0, hexA(p.color, 0));
      gr.addColorStop(1, hexA(p.color, 0.35));
      c.fillStyle = gr;
      c.fillRect(x - 2, p.y - p.len, 4, p.len);
    }
    // sync barrier
    if (this.barrier > -20 && this.barrier < PF_H + 20) {
      c.fillStyle = 'rgba(169,112,255,0.25)';
      c.fillRect(0, this.barrier - 1, PF_W, 2);
      c.globalAlpha = 0.25;
      c.drawImage(glowSprite('#a970ff', 32), -100, this.barrier - 30, PF_W + 200, 60);
      c.globalAlpha = 1;
    }
    c.globalCompositeOperation = 'source-over';
    c.font = `600 9px ${FONT_MONO}`;
    c.fillStyle = 'rgba(160,180,255,0.18)';
    c.textAlign = 'center';
    for (let i = 0; i < this.lanes; i++) c.fillText(`T${i}`, i * lw + lw / 2, 12);
  }
}

// ------------------------------------------------------------------ 5: kernel

class KernelBg implements Background {
  private scroll = 0;
  private tile: HTMLCanvasElement;
  private pulses: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private glitchT = 0;
  constructor() {
    const [cv, g] = makeCanvas(PF_W, PF_H);
    g.strokeStyle = 'rgba(255,50,80,0.09)';
    g.lineWidth = 2;
    const grid = 40;
    for (let i = 0; i < 70; i++) {
      let x = Math.floor(Math.random() * (PF_W / grid)) * grid;
      let y = Math.floor(Math.random() * (PF_H / grid)) * grid;
      g.beginPath();
      g.moveTo(x, y);
      for (let s = 0; s < 6; s++) {
        if (Math.random() < 0.5) x += (Math.random() < 0.5 ? -1 : 1) * grid * (1 + Math.floor(Math.random() * 3));
        else y += grid * (1 + Math.floor(Math.random() * 3));
        g.lineTo(x, y);
      }
      g.stroke();
      g.fillStyle = 'rgba(255,80,110,0.18)';
      g.fillRect(x - 3, y - 3, 6, 6);
    }
    g.font = `600 10px ${FONT_MONO}`;
    g.fillStyle = 'rgba(255,90,120,0.1)';
    for (let i = 0; i < 20; i++) g.fillText(fpick(['IRQ', 'NMI', 'SYSCALL', 'ring0', 'cr3', 'idt', 'gdt', 'tss', 'MSR', 'APIC']), Math.random() * (PF_W - 40), Math.random() * PF_H);
    this.tile = cv;
  }
  update(ts: number) {
    this.scroll = (this.scroll + 1.1 * ts) % PF_H;
    if (Math.random() < 0.08 * ts) {
      const grid = 40;
      const h = Math.random() < 0.5;
      this.pulses.push({ x: Math.floor(Math.random() * 15) * grid, y: Math.floor(Math.random() * 18) * grid, vx: h ? (Math.random() < 0.5 ? -4 : 4) : 0, vy: h ? 0 : 4, life: 60 });
    }
    for (const p of this.pulses) {
      p.x += p.vx * ts;
      p.y += (p.vy + 1.1) * ts;
      p.life -= ts;
    }
    this.pulses = this.pulses.filter((p) => p.life > 0);
    if (this.glitchT > 0) this.glitchT -= ts;
    else if (Math.random() < 0.005) this.glitchT = 8;
  }
  draw(c: CanvasRenderingContext2D, t: number) {
    c.fillStyle = '#0a0105';
    c.fillRect(0, 0, PF_W, PF_H);
    const pulse = 0.5 + 0.5 * Math.sin(t * 0.03);
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.1 + pulse * 0.06;
    c.drawImage(glowSprite('#ff0033', 32), PF_W / 2 - 350, -250, 700, 500);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.drawImage(this.tile, 0, this.scroll - PF_H);
    c.drawImage(this.tile, 0, this.scroll);
    c.globalCompositeOperation = 'lighter';
    for (const p of this.pulses) {
      c.globalAlpha = Math.min(1, p.life / 20) * 0.6;
      c.drawImage(glowSprite('#ff3b5c', 32), p.x - 8, p.y - 8, 16, 16);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    if (this.glitchT > 0) {
      c.fillStyle = 'rgba(255,40,80,0.1)';
      for (let i = 0; i < 5; i++) c.fillRect(0, Math.random() * PF_H, PF_W, 2 + Math.random() * 14);
    }
  }
}

export function createBackground(kind: string): Background {
  switch (kind) {
    case 'dom':
      return new DomBg();
    case 'heap':
      return new HeapBg();
    case 'threads':
      return new ThreadBg();
    case 'kernel':
      return new KernelBg();
    default:
      return new GridBg();
  }
}

// ------------------------------------------------------------------ spell backdrop

const ringCache = new Map<string, HTMLCanvasElement>();
function textRing(textStr: string, color: string): HTMLCanvasElement {
  const key = textStr + color;
  let cv = ringCache.get(key);
  if (!cv) {
    const S = 900;
    const [c, g] = makeCanvas(S, S);
    g.translate(S / 2, S / 2);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const rings = [
      [420, 18],
      [330, 15],
      [250, 13],
      [180, 11],
    ] as const;
    rings.forEach(([r, size], ri) => {
      g.font = `700 ${size}px ${FONT_MONO}`;
      const unit = textStr + '  //  ';
      const circ = TAU * r;
      const cw = size * 0.62;
      const count = Math.floor(circ / cw);
      g.fillStyle = hexA(color, ri % 2 ? 0.4 : 0.6);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU;
        g.save();
        g.rotate(a);
        g.translate(0, -r);
        g.fillText(unit[i % unit.length], 0, 0);
        g.restore();
      }
      g.strokeStyle = hexA(color, 0.25);
      g.lineWidth = 1;
      g.beginPath();
      g.arc(0, 0, r - size, 0, TAU);
      g.stroke();
    });
    cv = c;
    ringCache.set(key, cv);
  }
  return cv;
}

export function drawSpellBackdrop(c: CanvasRenderingContext2D, alpha: number, t: number, name: string, color: string, cx: number, cy: number) {
  if (alpha <= 0) return;
  c.globalAlpha = alpha * 0.7;
  c.fillStyle = '#000';
  c.fillRect(0, 0, PF_W, PF_H);
  c.globalAlpha = alpha * 0.22;
  const ring = textRing(name, color);
  c.save();
  c.translate(cx, cy);
  c.rotate(t * 0.002);
  c.drawImage(ring, -450, -450);
  c.rotate(-t * 0.005);
  c.scale(1.6, 1.6);
  c.globalAlpha = alpha * 0.1;
  c.drawImage(ring, -450, -450);
  c.restore();
  // radial spokes
  c.globalAlpha = alpha * 0.08;
  c.strokeStyle = color;
  c.lineWidth = 1;
  c.beginPath();
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * TAU + t * 0.001;
    c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * 1200, cy + Math.sin(a) * 1200);
  }
  c.stroke();
  c.globalAlpha = 1;
}
