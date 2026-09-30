import { FONT_MONO } from '../config';
import { TAU } from '../core/math';
import { makeCanvas } from './canvas';

/** Sprites are pre-rendered at 2x and drawn at half size for crispness on hi-dpi. */
export const SS = 2;

export type BulletColor = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'magenta' | 'white' | 'gold' | 'lime' | 'pink';

export const BCOL: Record<BulletColor, { body: string; core: string; glow: string }> = {
  red: { body: '#ff2a4a', core: '#ffe0e6', glow: '#ff0033' },
  orange: { body: '#ff8a1f', core: '#fff0dc', glow: '#ff6a00' },
  yellow: { body: '#ffe21f', core: '#fffbe0', glow: '#ffd000' },
  green: { body: '#2bff7a', core: '#e6ffef', glow: '#00ff66' },
  lime: { body: '#b6ff2b', core: '#f7ffe6', glow: '#9dff00' },
  cyan: { body: '#1fe8ff', core: '#e6fdff', glow: '#00e5ff' },
  blue: { body: '#3d7bff', core: '#e3ecff', glow: '#1f5fff' },
  purple: { body: '#9b5bff', core: '#f0e6ff', glow: '#8a3dff' },
  magenta: { body: '#ff2bd6', core: '#ffe6f9', glow: '#ff00cc' },
  pink: { body: '#ff7ab8', core: '#fff0f7', glow: '#ff4d9e' },
  white: { body: '#dfe8ff', core: '#ffffff', glow: '#9fb8ff' },
  gold: { body: '#ffc21f', core: '#fff8dc', glow: '#ffae00' },
};

export const BULLET_COLORS = Object.keys(BCOL) as BulletColor[];

export type BType = 'orb' | 'ball' | 'big' | 'rice' | 'kunai' | 'arrow' | 'bit0' | 'bit1' | 'diamond' | 'ring' | 'star' | 'glyph' | 'note';

export interface BTypeSpec {
  /** hitbox radius */
  r: number;
  /** sprite canvas size (logical px) */
  size: number;
  /** rotate to velocity */
  dir: boolean;
  /** constant spin */
  spin?: number;
  /** draw order: bigger first */
  layer: number;
}

export const BTYPES: Record<BType, BTypeSpec> = {
  big: { r: 15, size: 64, dir: false, layer: 0 },
  ball: { r: 7, size: 34, dir: false, layer: 1 },
  ring: { r: 5.5, size: 30, dir: false, layer: 2 },
  glyph: { r: 6, size: 30, dir: false, layer: 2 },
  bit0: { r: 5, size: 26, dir: false, layer: 3 },
  bit1: { r: 5, size: 26, dir: false, layer: 3 },
  note: { r: 5, size: 28, dir: false, layer: 3 },
  star: { r: 4.5, size: 26, dir: false, spin: 0.12, layer: 3 },
  orb: { r: 4, size: 22, dir: false, layer: 4 },
  diamond: { r: 4, size: 26, dir: true, layer: 4 },
  arrow: { r: 4, size: 26, dir: true, layer: 4 },
  rice: { r: 3.5, size: 28, dir: true, layer: 5 },
  kunai: { r: 3.5, size: 30, dir: true, layer: 5 },
};

const cache = new Map<string, HTMLCanvasElement>();

function glowDisc(g: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, alpha: number) {
  const grad = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  grad.addColorStop(0, hexA(color, alpha));
  grad.addColorStop(0.45, hexA(color, alpha * 0.45));
  grad.addColorStop(1, hexA(color, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(cx, cy, r, 0, TAU);
  g.fill();
}

export function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function renderBullet(type: BType, color: BulletColor, glyph = ''): HTMLCanvasElement {
  const spec = BTYPES[type];
  const S = spec.size * SS;
  const [c, g] = makeCanvas(S, S);
  const col = BCOL[color];
  g.scale(SS, SS);
  const m = spec.size / 2;
  g.translate(m, m);
  const rim = 'rgba(0,0,0,0.75)';
  switch (type) {
    case 'orb':
    case 'ball':
    case 'big': {
      const r = type === 'orb' ? 6.5 : type === 'ball' ? 11 : 22;
      glowDisc(g, 0, 0, r * 1.45, col.glow, 0.55);
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fillStyle = rim;
      g.fill();
      g.beginPath();
      g.arc(0, 0, r - 1.2, 0, TAU);
      g.fillStyle = col.body;
      g.fill();
      const cg = g.createRadialGradient(-r * 0.15, -r * 0.15, 0, 0, 0, r * 0.72);
      cg.addColorStop(0, '#ffffff');
      cg.addColorStop(0.6, col.core);
      cg.addColorStop(1, hexA(col.core, 0));
      g.fillStyle = cg;
      g.beginPath();
      g.arc(0, 0, r * 0.72, 0, TAU);
      g.fill();
      break;
    }
    case 'ring': {
      glowDisc(g, 0, 0, 13, col.glow, 0.5);
      g.lineWidth = 5;
      g.strokeStyle = rim;
      g.beginPath();
      g.arc(0, 0, 8.5, 0, TAU);
      g.stroke();
      g.lineWidth = 3;
      g.strokeStyle = col.body;
      g.stroke();
      g.lineWidth = 1.2;
      g.strokeStyle = col.core;
      g.stroke();
      g.fillStyle = hexA(col.core, 0.8);
      g.beginPath();
      g.arc(0, 0, 3, 0, TAU);
      g.fill();
      break;
    }
    case 'rice': {
      glowDisc(g, 0, 0, 13, col.glow, 0.5);
      g.beginPath();
      g.ellipse(0, 0, 11, 5.5, 0, 0, TAU);
      g.fillStyle = rim;
      g.fill();
      g.beginPath();
      g.ellipse(0, 0, 9.8, 4.4, 0, 0, TAU);
      g.fillStyle = col.body;
      g.fill();
      g.beginPath();
      g.ellipse(1, 0, 6.5, 2.2, 0, 0, TAU);
      g.fillStyle = col.core;
      g.fill();
      break;
    }
    case 'kunai': {
      glowDisc(g, 0, 0, 14, col.glow, 0.45);
      const path = () => {
        g.beginPath();
        g.moveTo(13, 0);
        g.lineTo(2, -5);
        g.lineTo(-4, -2.5);
        g.lineTo(-12, -3.5);
        g.lineTo(-10, 0);
        g.lineTo(-12, 3.5);
        g.lineTo(-4, 2.5);
        g.lineTo(2, 5);
        g.closePath();
      };
      path();
      g.lineWidth = 3;
      g.strokeStyle = rim;
      g.stroke();
      g.fillStyle = col.body;
      g.fill();
      g.beginPath();
      g.moveTo(10, 0);
      g.lineTo(2, -2.2);
      g.lineTo(-6, 0);
      g.lineTo(2, 2.2);
      g.closePath();
      g.fillStyle = col.core;
      g.fill();
      break;
    }
    case 'arrow': {
      // a chevron ">" - the prompt caret
      glowDisc(g, 0, 0, 12, col.glow, 0.5);
      const path = () => {
        g.beginPath();
        g.moveTo(9, 0);
        g.lineTo(-5, -8);
        g.lineTo(-7, -5);
        g.lineTo(2, 0);
        g.lineTo(-7, 5);
        g.lineTo(-5, 8);
        g.closePath();
      };
      path();
      g.lineWidth = 3;
      g.lineJoin = 'round';
      g.strokeStyle = rim;
      g.stroke();
      g.fillStyle = col.body;
      g.fill();
      g.beginPath();
      g.moveTo(6.5, 0);
      g.lineTo(-4.5, -5.8);
      g.lineTo(0.5, 0);
      g.lineTo(-4.5, 5.8);
      g.closePath();
      g.fillStyle = col.core;
      g.fill();
      break;
    }
    case 'diamond': {
      glowDisc(g, 0, 0, 12, col.glow, 0.5);
      const path = (a: number, b: number) => {
        g.beginPath();
        g.moveTo(a, 0);
        g.lineTo(0, -b);
        g.lineTo(-a, 0);
        g.lineTo(0, b);
        g.closePath();
      };
      path(11, 6.5);
      g.fillStyle = rim;
      g.fill();
      path(9.5, 5);
      g.fillStyle = col.body;
      g.fill();
      path(5, 2.2);
      g.fillStyle = col.core;
      g.fill();
      break;
    }
    case 'star': {
      // a pointer asterisk
      glowDisc(g, 0, 0, 12, col.glow, 0.5);
      for (const [w, s] of [
        [5, rim],
        [3, col.body],
        [1.2, col.core],
      ] as const) {
        g.lineWidth = w;
        g.lineCap = 'round';
        g.strokeStyle = s;
        g.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI;
          g.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
          g.lineTo(-Math.cos(a) * 8, -Math.sin(a) * 8);
        }
        g.stroke();
      }
      break;
    }
    case 'bit0':
    case 'bit1':
    case 'glyph':
    case 'note': {
      const ch = type === 'bit0' ? '0' : type === 'bit1' ? '1' : type === 'note' ? '♪' : glyph;
      const r = type === 'glyph' ? 11 : 9.5;
      glowDisc(g, 0, 0, r * 1.4, col.glow, 0.45);
      g.beginPath();
      g.arc(0, 0, r, 0, TAU);
      g.fillStyle = 'rgba(0,0,0,0.78)';
      g.fill();
      g.lineWidth = 1.6;
      g.strokeStyle = col.body;
      g.stroke();
      g.font = `800 ${type === 'glyph' ? 15 : 13}px ${FONT_MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 3;
      g.strokeStyle = col.body;
      g.strokeText(ch, 0, 1);
      g.fillStyle = '#ffffff';
      g.fillText(ch, 0, 1);
      break;
    }
  }
  return c;
}

export function bulletSprite(type: BType, color: BulletColor, glyph = ''): HTMLCanvasElement {
  const key = type + ':' + color + ':' + glyph;
  let c = cache.get(key);
  if (!c) {
    c = renderBullet(type, color, glyph);
    cache.set(key, c);
  }
  return c;
}

export function prewarmBullets() {
  for (const t of Object.keys(BTYPES) as BType[]) {
    if (t === 'glyph') continue;
    for (const c of BULLET_COLORS) bulletSprite(t, c);
  }
}

/** Soft additive glow blob. */
export function glowSprite(color: string, r = 32): HTMLCanvasElement {
  const key = 'glow:' + color + ':' + r;
  let c = cache.get(key);
  if (!c) {
    const S = r * 2;
    const [cv, g] = makeCanvas(S, S);
    const grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0, hexA(color, 1));
    grad.addColorStop(0.2, hexA(color, 0.55));
    grad.addColorStop(0.5, hexA(color, 0.16));
    grad.addColorStop(1, hexA(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    c = cv;
    cache.set(key, c);
  }
  return c;
}

/** A glyph pre-rendered for particle debris. */
export function glyphSprite(ch: string, color: string, size = 16): HTMLCanvasElement {
  const key = 'gl:' + ch + ':' + color + ':' + size;
  let c = cache.get(key);
  if (!c) {
    const S = size * 2 * SS;
    const [cv, g] = makeCanvas(S, S);
    g.scale(SS, SS);
    g.font = `700 ${size}px ${FONT_MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = color;
    g.shadowBlur = 6;
    g.fillStyle = color;
    g.fillText(ch, size, size);
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillText(ch, size, size);
    c = cv;
    cache.set(key, c);
  }
  return c;
}

export type ItemKind = 'power' | 'bigpower' | 'bit' | 'gold' | 'cancel' | 'bomb' | 'life' | 'full';

function renderItem(kind: ItemKind): HTMLCanvasElement {
  const size = kind === 'cancel' ? 14 : kind === 'bit' || kind === 'gold' ? 22 : kind === 'power' ? 22 : 34;
  const [c, g] = makeCanvas(size * SS, size * SS);
  g.scale(SS, SS);
  const m = size / 2;
  g.translate(m, m);
  const box = (w: number, fill: string, stroke: string, label: string, font: number, txt = '#fff') => {
    g.beginPath();
    g.roundRect(-w / 2, -w / 2, w, w, 3);
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fill();
    g.beginPath();
    g.roundRect(-w / 2 + 1.5, -w / 2 + 1.5, w - 3, w - 3, 2.5);
    g.fillStyle = fill;
    g.fill();
    g.lineWidth = 1.2;
    g.strokeStyle = stroke;
    g.stroke();
    g.font = `800 ${font}px ${FONT_MONO}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = txt;
    g.fillText(label, 0, 1);
  };
  switch (kind) {
    case 'power':
      box(14, '#d8203f', '#ff9aad', 'P', 10);
      break;
    case 'bigpower':
      box(24, '#d8203f', '#ffb3c1', 'v+', 12);
      break;
    case 'bit': {
      g.rotate(Math.PI / 4);
      box(12, '#1f63ff', '#9fd0ff', '', 8);
      g.rotate(-Math.PI / 4);
      g.font = `800 9px ${FONT_MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#fff';
      g.fillText('1', 0, 1);
      break;
    }
    case 'gold': {
      g.rotate(Math.PI / 4);
      box(12, '#e0a000', '#fff2b0', '', 8);
      g.rotate(-Math.PI / 4);
      g.font = `800 9px ${FONT_MONO}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = '#fff';
      g.fillText('$', 0, 1);
      break;
    }
    case 'cancel': {
      g.fillStyle = 'rgba(160,220,255,0.35)';
      g.beginPath();
      g.arc(0, 0, 6, 0, TAU);
      g.fill();
      g.fillStyle = '#e8f6ff';
      g.fillRect(-2, -2, 4, 4);
      break;
    }
    case 'bomb':
      box(26, '#11a84e', '#9dffc6', '$#', 11);
      break;
    case 'life':
      box(26, '#d61f9a', '#ffb0e8', '1UP', 9);
      break;
    case 'full':
      box(26, '#e0a000', '#fff2b0', 'MAX', 9, '#221400');
      break;
  }
  return c;
}

export function itemSprite(kind: ItemKind): HTMLCanvasElement {
  const key = 'item:' + kind;
  let c = cache.get(key);
  if (!c) {
    c = renderItem(kind);
    cache.set(key, c);
  }
  return c;
}

/** Scanline overlay pattern. */
export function scanlineSprite(w: number, h: number): HTMLCanvasElement {
  const key = 'scan:' + w + 'x' + h;
  let c = cache.get(key);
  if (!c) {
    const [cv, g] = makeCanvas(w, h);
    g.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    c = cv;
    cache.set(key, c);
  }
  return c;
}

export function vignetteSprite(w: number, h: number): HTMLCanvasElement {
  const key = 'vig:' + w + 'x' + h;
  let c = cache.get(key);
  if (!c) {
    const [cv, g] = makeCanvas(w, h);
    const grad = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.6)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    c = cv;
    cache.set(key, c);
  }
  return c;
}
