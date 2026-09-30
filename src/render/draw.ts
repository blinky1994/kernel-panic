import { FONT_DISPLAY, FONT_MONO } from '../config';
import { ctx } from './canvas';

export interface TextOpts {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  weight?: number | string;
  display?: boolean;
  glow?: string;
  glowBlur?: number;
  alpha?: number;
  stroke?: string;
  strokeW?: number;
  spacing?: number;
}

export function font(size: number, weight: number | string = 400, display = false) {
  return `${weight} ${size}px ${display ? FONT_DISPLAY : FONT_MONO}`;
}

export function text(str: string, x: number, y: number, o: TextOpts = {}) {
  const size = o.size ?? 14;
  ctx.font = font(size, o.weight ?? 400, o.display);
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  const prevA = ctx.globalAlpha;
  if (o.alpha !== undefined) ctx.globalAlpha = prevA * o.alpha;
  if (o.spacing) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = o.spacing + 'px';
  if (o.glow) {
    ctx.shadowColor = o.glow;
    ctx.shadowBlur = o.glowBlur ?? 10;
  }
  if (o.stroke) {
    ctx.lineWidth = o.strokeW ?? 3;
    ctx.strokeStyle = o.stroke;
    ctx.lineJoin = 'round';
    ctx.strokeText(str, x, y);
  }
  ctx.fillStyle = o.color ?? '#cfe3ff';
  ctx.fillText(str, x, y);
  if (o.glow) {
    ctx.shadowBlur = 0;
    ctx.shadowColor = 'transparent';
  }
  if (o.spacing) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  ctx.globalAlpha = prevA;
}

export function measure(str: string, size: number, weight: number | string = 400, display = false): number {
  ctx.font = font(size, weight, display);
  return ctx.measureText(str).width;
}

/** Chromatic-split headline text. */
export function glitchText(str: string, x: number, y: number, size: number, t: number, intensity = 1, o: TextOpts = {}) {
  const jitter = intensity * (Math.random() < 0.08 * intensity ? 6 : 1.5);
  const dx = Math.sin(t * 0.07) * 2 * intensity + (Math.random() - 0.5) * jitter;
  const base: TextOpts = { size, weight: o.weight ?? 900, display: o.display ?? true, align: o.align ?? 'center', baseline: o.baseline ?? 'middle', spacing: o.spacing };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  text(str, x - dx - 2 * intensity, y, { ...base, color: 'rgba(255,0,90,0.75)' });
  text(str, x + dx + 2 * intensity, y, { ...base, color: 'rgba(0,220,255,0.75)' });
  ctx.restore();
  text(str, x, y, { ...base, color: o.color ?? '#f4fbff', glow: o.glow ?? '#00f0ff', glowBlur: o.glowBlur ?? 18 });
}

export function panelRect(x: number, y: number, w: number, h: number, line = '#1b2540', fill = 'rgba(6,9,18,0.85)') {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = line;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  // corner ticks
  ctx.strokeStyle = '#3a5a9a';
  ctx.lineWidth = 2;
  const c = 8;
  ctx.beginPath();
  ctx.moveTo(x, y + c);
  ctx.lineTo(x, y);
  ctx.lineTo(x + c, y);
  ctx.moveTo(x + w - c, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + c);
  ctx.moveTo(x + w, y + h - c);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - c, y + h);
  ctx.moveTo(x + c, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.stroke();
}

export function bar(x: number, y: number, w: number, h: number, t: number, color: string, back = 'rgba(255,255,255,0.08)') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, t)), h);
}

/** Draw a simple mouse-cursor arrow (the player's avatar & life icon). */
export function cursorPath(g: CanvasRenderingContext2D, s: number) {
  g.beginPath();
  g.moveTo(0, -13 * s);
  g.lineTo(9.5 * s, 7 * s);
  g.lineTo(3 * s, 5 * s);
  g.lineTo(0, 13 * s);
  g.lineTo(-3 * s, 5 * s);
  g.lineTo(-9.5 * s, 7 * s);
  g.closePath();
}
