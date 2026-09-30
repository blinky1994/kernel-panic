import { H, W } from '../config';
import { save } from '../core/save';
import { canvas, ctx, view } from './canvas';
import { scanlineSprite, vignetteSprite } from './sprites';

/** Screen-space post effects: glitch slices, scanlines, vignette, fade. */
export function post(glitch: number, fade: number) {
  const cw = view.cw;
  const ch = view.ch;
  if (glitch > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const n = Math.min(10, 2 + Math.floor(glitch / 3));
    for (let i = 0; i < n; i++) {
      if (Math.random() > 0.6) continue;
      const sy = Math.floor(Math.random() * ch);
      const sh = Math.floor(4 + Math.random() * ch * 0.05);
      const dx = Math.floor((Math.random() - 0.5) * glitch * 2.5 * view.k);
      ctx.drawImage(canvas, 0, sy, cw, sh, dx, sy, cw, sh);
      if (Math.random() < 0.3) {
        ctx.fillStyle = Math.random() < 0.5 ? 'rgba(255,0,90,0.12)' : 'rgba(0,220,255,0.12)';
        ctx.fillRect(0, sy, cw, sh);
      }
    }
  }
  ctx.setTransform(view.k, 0, 0, view.k, view.ox, view.oy);
  if (save.settings.crt) {
    ctx.drawImage(vignetteSprite(W, H), 0, 0, W, H);
    ctx.globalAlpha = 0.6;
    ctx.drawImage(scanlineSprite(W, H), 0, 0, W, H);
    ctx.globalAlpha = 1;
  }
  if (fade > 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = `rgba(2,3,8,${fade})`;
    ctx.fillRect(0, 0, cw, ch);
  }
  // letterbox bars
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  if (view.ox > 0) {
    ctx.fillRect(0, 0, view.ox, ch);
    ctx.fillRect(cw - view.ox, 0, view.ox, ch);
  }
  if (view.oy > 0) {
    ctx.fillRect(0, 0, cw, view.oy);
    ctx.fillRect(0, ch - view.oy, cw, view.oy);
  }
}
