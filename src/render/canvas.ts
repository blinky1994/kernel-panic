import { H, W } from '../config';

export const canvas = document.getElementById('game') as HTMLCanvasElement;
export const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) as CanvasRenderingContext2D;

export const view = { k: 1, ox: 0, oy: 0, dpr: 1, cw: 1, ch: 1 };

export function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  canvas.width = Math.max(1, Math.round(cssW * dpr));
  canvas.height = Math.max(1, Math.round(cssH * dpr));
  view.dpr = dpr;
  view.cw = canvas.width;
  view.ch = canvas.height;
  view.k = Math.min(canvas.width / W, canvas.height / H);
  view.ox = Math.round((canvas.width - W * view.k) / 2);
  view.oy = Math.round((canvas.height - H * view.k) / 2);
  ctx.imageSmoothingEnabled = true;
}

/** Reset to the logical 1280x720 coordinate system. */
export function base() {
  ctx.setTransform(view.k, 0, 0, view.k, view.ox, view.oy);
}

export function toLogical(clientX: number, clientY: number): [number, number] {
  const x = (clientX * view.dpr - view.ox) / view.k;
  const y = (clientY * view.dpr - view.oy) / view.k;
  return [x, y];
}

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  return [c, g];
}
