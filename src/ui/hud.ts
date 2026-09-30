import { BOMB_FRAMES, COLORS, FONT_MONO, H, MAX_POWER, PF_H, PF_W, PF_X, PF_Y, POC_Y, W } from '../config';
import { input } from '../core/input';
import { clamp, ease, formatScore, lerp, TAU } from '../core/math';
import { save } from '../core/save';
import type { Game } from '../game/game';
import { SHIPS } from '../game/ships';
import { DIFFS } from '../game/difficulty';
import { ctx, view } from '../render/canvas';
import { bar, cursorPath, font, glitchText, measure, panelRect, text } from '../render/draw';
import { glowSprite, hexA } from '../render/sprites';

const LOG_COLORS: Record<string, string> = {
  INFO: '#6fb8ff',
  WARN: '#ffb84d',
  ERROR: '#ff5a74',
  FATAL: '#ff2a4a',
  OK: '#39ff88',
  DEBUG: '#8a93b8',
};

function pfBase() {
  ctx.setTransform(view.k, 0, 0, view.k, view.ox + PF_X * view.k, view.oy + PF_Y * view.k);
}
function scrBase() {
  ctx.setTransform(view.k, 0, 0, view.k, view.ox, view.oy);
}

// ------------------------------------------------------------------ side panels

export function drawPanels(g: Game) {
  scrBase();
  const t = g.realFrame;
  // backgrounds
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#060a14');
  grad.addColorStop(1, '#03050b');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, PF_X, H);
  ctx.fillRect(PF_X + PF_W, 0, W - PF_X - PF_W, H);
  // subtle grid
  ctx.strokeStyle = 'rgba(60,90,160,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < W; x += 20) {
    if (x > PF_X && x < PF_X + PF_W) continue;
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
  }
  for (let y = 0; y < H; y += 20) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(PF_X, y + 0.5);
    ctx.moveTo(PF_X + PF_W, y + 0.5);
    ctx.lineTo(W, y + 0.5);
  }
  ctx.stroke();
  // playfield frame
  const stc = g.stage.color;
  ctx.strokeStyle = hexA(stc, 0.5);
  ctx.lineWidth = 2;
  ctx.strokeRect(PF_X - 1, PF_Y - 1, PF_W + 2, PF_H + 2);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.12;
  ctx.drawImage(glowSprite(stc, 32), PF_X - 30, 0, 60, H);
  ctx.drawImage(glowSprite(stc, 32), PF_X + PF_W - 30, 0, 60, H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  drawLeft(g, t);
  drawRight(g, t);
}

function drawLeft(g: Game, t: number) {
  const x0 = 24;
  glitchText('KERNEL//PANIC', PF_X / 2, 46, 26, t, 0.35, { spacing: 1 });
  text('a debug-hell shoot ’em up', PF_X / 2, 72, { size: 10, color: COLORS.dim, align: 'center' });

  // stage
  panelRect(x0, 92, PF_X - 48, 58);
  text(g.mode === 'spell' ? 'EXCEPTION PRACTICE' : g.stage.title, x0 + 12, 114, { size: 11, color: COLORS.dim, weight: 700, spacing: 2 });
  text(g.stage.name, x0 + 12, 138, { size: 16, color: g.stage.color, weight: 700 });

  // console
  const cy = 164;
  const ch = 372;
  panelRect(x0, cy, PF_X - 48, ch, '#1b2540', 'rgba(3,6,12,0.92)');
  ctx.fillStyle = 'rgba(40,60,110,0.35)';
  ctx.fillRect(x0 + 1, cy + 1, PF_X - 50, 20);
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = ['#ff5f57', '#febc2e', '#28c840'][i];
    ctx.beginPath();
    ctx.arc(x0 + 12 + i * 12, cy + 11, 3.5, 0, TAU);
    ctx.fill();
  }
  text('dbg@ring3: ~/journal', x0 + 50, cy + 15, { size: 10, color: '#8aa0cc' });
  const lines = g.logs.slice(-18);
  let y = cy + 40;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + 2, cy + 22, PF_X - 52, ch - 24);
  ctx.clip();
  for (const l of lines) {
    const age = g.realFrame - l.t;
    const a = age < 10 ? 0.4 + age / 16 : 1;
    text(l.time, x0 + 8, y, { size: 9, color: '#445577', alpha: a });
    text(l.level.padEnd(5), x0 + 44, y, { size: 9, color: LOG_COLORS[l.level], weight: 700, alpha: a });
    let msg = l.msg;
    if (msg.length > 31) msg = msg.slice(0, 30) + '…';
    text(msg, x0 + 86, y, { size: 9, color: age < 30 ? '#e6f0ff' : '#9fb0d0', alpha: a });
    y += 19;
  }
  // blinking prompt
  text('$ ' + (Math.floor(t / 30) % 2 ? '█' : ''), x0 + 8, y, { size: 10, color: '#39ff88' });
  ctx.restore();

  // bottom: controls or touch pad
  if (g.touchMode) drawPad(g, 'bomb', `SUDO ×${g.bombs}`, SHIPS[g.shipIndex].bombColor, g.bombs > 0);
  else {
    const hy = 556;
    panelRect(x0, hy, PF_X - 48, 142);
    const rows: [string, string][] = [
      ['MOVE', '←↑↓→ / WASD'],
      ['SHOOT', 'Z  (hold)'],
      ['FOCUS', 'SHIFT'],
      ['BOMB', 'X'],
      ['OVERCLOCK', 'C'],
      ['PAUSE', 'ESC'],
    ];
    if (input.lastDevice === 'gamepad') {
      rows.splice(0, rows.length, ['MOVE', 'D-PAD / L-STICK'], ['SHOOT', 'A'], ['FOCUS', 'LB / RB'], ['BOMB', 'B'], ['OVERCLOCK', 'X / Y'], ['PAUSE', 'START']);
    }
    rows.forEach(([k, v], i) => {
      text(k, x0 + 14, hy + 24 + i * 20, { size: 10, color: COLORS.dim, weight: 700 });
      text(v, PF_X - 38, hy + 24 + i * 20, { size: 10, color: '#cfe3ff', align: 'right' });
    });
  }
}

function drawPad(g: Game, which: 'bomb' | 'oc', label: string, color: string, ready: boolean) {
  const r = g.touchPad(which);
  ctx.fillStyle = ready ? hexA(color, 0.12) : 'rgba(40,40,60,0.2)';
  ctx.strokeStyle = ready ? color : '#334';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(r.x, r.y, r.w, r.h, 16);
  ctx.fill();
  ctx.stroke();
  text(which === 'bomb' ? 'BOMB' : 'OVERCLOCK', r.x + r.w / 2, r.y + r.h / 2 - 6, { size: 20, weight: 800, display: true, color: ready ? color : '#556', align: 'center', baseline: 'middle' });
  text(label, r.x + r.w / 2, r.y + r.h / 2 + 22, { size: 11, color: '#9fb0d0', align: 'center', baseline: 'middle' });
}

function drawRight(g: Game, t: number) {
  const x0 = PF_X + PF_W + 24;
  const w = W - x0 - 24;
  const xr = x0 + w - 12;
  let y = 30;
  panelRect(x0, y - 10, w, 104);
  text('HI-SCORE', x0 + 12, y + 10, { size: 10, color: COLORS.dim, weight: 700, spacing: 2 });
  text(formatScore(g.mode === 'arcade' ? Math.max(g.hiScore, g.displayScore) : g.hiScore), xr, y + 10, { size: 14, color: '#8aa0cc', align: 'right', weight: 700 });
  text('SCORE', x0 + 12, y + 40, { size: 10, color: COLORS.dim, weight: 700, spacing: 2 });
  text(formatScore(g.displayScore), xr, y + 72, { size: 28, color: '#ffffff', align: 'right', weight: 800, glow: '#00f0ff', glowBlur: 8 });

  y = 140;
  panelRect(x0, y, w, 92);
  text('PROCESSES', x0 + 12, y + 22, { size: 10, color: COLORS.dim, weight: 700, spacing: 1 });
  const lives = Math.max(0, g.lives);
  for (let i = 0; i < Math.min(lives, 8); i++) {
    ctx.save();
    ctx.translate(x0 + 124 + i * 20, y + 18);
    cursorPath(ctx, 0.62);
    ctx.fillStyle = '#ff2bd6';
    ctx.fill();
    ctx.restore();
  }
  if (lives > 8) text(`+${lives - 8}`, xr, y + 22, { size: 10, color: '#ff2bd6', align: 'right' });
  text('SUDO', x0 + 12, y + 58, { size: 10, color: COLORS.dim, weight: 700, spacing: 1 });
  for (let i = 0; i < Math.min(g.bombs, 8); i++) {
    const bx = x0 + 124 + i * 20;
    ctx.fillStyle = '#062a14';
    ctx.strokeStyle = '#39ff88';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(bx - 8, y + 46, 16, 16, 3);
    ctx.fill();
    ctx.stroke();
    text('#', bx, y + 58, { size: 11, weight: 800, color: '#39ff88', align: 'center' });
  }
  const bn = SHIPS[g.shipIndex].bombName;
  text(g.bombT > 0 ? `running: ${bn}` : '', x0 + 12, y + 82, { size: 9, color: '#39ff88' });

  y = 244;
  panelRect(x0, y, w, 128);
  const maxed = g.power >= MAX_POWER;
  text('BUILD', x0 + 12, y + 22, { size: 10, color: COLORS.dim, weight: 700, spacing: 2 });
  text(`v${(1 + g.power / 100).toFixed(2)}${maxed ? ' MAX' : ''}`, xr, y + 22, { size: 14, weight: 800, align: 'right', color: maxed ? '#ffe14d' : '#ff7ab8' });
  bar(x0 + 12, y + 32, w - 24, 5, g.power / MAX_POWER, maxed ? '#ffe14d' : '#ff4d9e');
  for (let i = 1; i < 4; i++) {
    ctx.fillStyle = '#05060b';
    ctx.fillRect(x0 + 12 + ((w - 24) * i) / 4 - 1, y + 32, 2, 5);
  }
  text('GRAZE', x0 + 12, y + 62, { size: 10, color: COLORS.dim, weight: 700, spacing: 2 });
  text(String(g.graze), xr, y + 62, { size: 13, weight: 700, align: 'right', color: '#e6f0ff' });
  text('BIT VALUE', x0 + 12, y + 86, { size: 10, color: COLORS.dim, weight: 700, spacing: 1 });
  text(formatScore(g.bitValue), xr, y + 86, { size: 13, weight: 700, align: 'right', color: '#6fb8ff' });
  const mult = g.streakMult;
  text('STREAK', x0 + 12, y + 110, { size: 10, color: COLORS.dim, weight: 700, spacing: 2 });
  text(`${g.streak}  ×${mult.toFixed(2)}`, xr, y + 110, { size: 13, weight: 800, align: 'right', color: g.streak >= 100 ? '#ffe14d' : g.streak > 0 ? '#ffb84d' : '#556' });
  bar(x0 + 12, y + 116, w - 24, 3, g.streakT / 120, '#ffb84d', 'rgba(255,255,255,0.05)');

  // cache / overclock
  y = 384;
  panelRect(x0, y, w, 94, g.overclock ? '#9b5bff' : '#1b2540');
  const ready = g.cache >= 35 && !g.overclock;
  text('CACHE', x0 + 12, y + 22, { size: 10, color: COLORS.dim, weight: 700, spacing: 2 });
  text(g.overclock ? 'OVERCLOCKED' : ready ? (g.cache >= 100 ? 'FULL — PRESS C' : 'READY [C]') : 'graze to fill', xr, y + 22, {
    size: 10,
    weight: 700,
    align: 'right',
    color: g.overclock ? '#c9a8ff' : ready ? (Math.floor(t / 15) % 2 ? '#c9a8ff' : '#ffffff') : '#556',
  });
  const cw = w - 24;
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.fillRect(x0 + 12, y + 32, cw, 16);
  const cg = ctx.createLinearGradient(x0 + 12, 0, x0 + 12 + cw, 0);
  cg.addColorStop(0, '#4d8dff');
  cg.addColorStop(1, '#c95bff');
  ctx.fillStyle = cg;
  ctx.fillRect(x0 + 12, y + 32, (cw * g.cache) / 100, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(x0 + 12 + cw * 0.35 - 1, y + 30, 2, 20);
  text(`${Math.floor(g.cache)}%`, x0 + 12 + cw / 2, y + 44, { size: 10, weight: 800, align: 'center', color: '#fff' });
  text(g.overclock ? `world clock ×0.42   gold ×${Math.min(10, 1 + g.ocCancels / 40).toFixed(1)}` : 'slows time · kills turn bullets to gold', x0 + 12, y + 70, { size: 9, color: '#8a93b8' });

  // run info
  y = 490;
  const d = DIFFS[g.diffIndex];
  const s = SHIPS[g.shipIndex];
  panelRect(x0, y, w, 56);
  text(`${d.name}`, x0 + 12, y + 22, { size: 11, weight: 800, color: d.color, spacing: 1 });
  text(d.flag, xr, y + 22, { size: 10, color: '#556a90', align: 'right' });
  text(s.file, x0 + 12, y + 44, { size: 11, weight: 700, color: s.color });
  text(s.lang, xr, y + 44, { size: 10, color: '#556a90', align: 'right' });

  if (g.touchMode) drawPad(g, 'oc', `${Math.floor(g.cache)}%`, '#c95bff', g.cache >= 35 || g.overclock);
  else {
    text('♪ ' + (g.nowPlaying || '—'), x0 + 12, 580, { size: 10, color: '#556a90' });
    text(`bullets ${g.bullets.count}`, x0 + 12, 604, { size: 9, color: '#34405c' });
    if (g.continues > 0) text(`continues used: ${g.continues}`, x0 + 12, 624, { size: 9, color: '#ff5a74' });
  }
}

// ------------------------------------------------------------------ playfield overlays

export function drawPlayfieldOverlays(g: Game, alpha: number) {
  pfBase();
  const t = g.realFrame;

  // point-of-collection hint
  const p = g.player;
  const pocA = Math.max(g.pocHintT > 0 ? Math.min(1, g.pocHintT / 60) * 0.7 : 0, p.alive && p.y < POC_Y + 40 ? 0.35 : 0);
  if (pocA > 0) {
    ctx.globalAlpha = pocA;
    ctx.strokeStyle = '#6fb8ff';
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = -t * 0.5;
    ctx.beginPath();
    ctx.moveTo(0, POC_Y);
    ctx.lineTo(PF_W, POC_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    text('— AUTO-COLLECT LINE —', PF_W / 2, POC_Y - 6, { size: 9, color: '#9fd0ff', align: 'center' });
    ctx.globalAlpha = 1;
  }

  // overclock tint
  if (g.overclock || g.ocFlash > 0.02) {
    const a = g.overclock ? 0.12 + 0.04 * Math.sin(t * 0.1) : 0;
    ctx.fillStyle = `rgba(110,60,255,${a + g.ocFlash * 0.25})`;
    ctx.fillRect(0, 0, PF_W, PF_H);
    if (g.overclock) {
      ctx.strokeStyle = 'rgba(180,120,255,0.55)';
      ctx.lineWidth = 6;
      ctx.strokeRect(3, 3, PF_W - 6, PF_H - 6);
      text('OVERCLOCK', PF_W - 12, PF_H - 14, { size: 12, weight: 900, display: true, color: '#c9a8ff', align: 'right', spacing: 3 });
    }
  }

  // bomb visuals
  if (g.bombT > 0) drawBomb(g, t);

  if (g.boss && g.boss.alive) drawBossHud(g, t);
  if (g.spellCut) drawSpellCut(g);
  for (const b of g.banners) drawBanner(b, t);
  if (g.stageTitleT > 0) drawStageTitle(g);
  if (g.dlg) drawDialogue(g, t);
  if (g.clearTally) drawTally(g);
  if (g.state === 'continue') drawContinue(g, t);

  // deathbomb warning
  if (p.hitT > 0) {
    ctx.fillStyle = `rgba(255,30,60,${0.18 + 0.1 * Math.sin(t)})`;
    ctx.fillRect(0, 0, PF_W, PF_H);
    text('!! BOMB NOW !!', p.x, p.y - 30, { size: 12, weight: 900, color: '#ff2a4a', align: 'center', stroke: '#000' });
  }

  // flash
  if (g.flashAmt > 0.01) {
    ctx.globalAlpha = g.flashAmt * 0.6;
    ctx.fillStyle = g.flashColor;
    ctx.fillRect(0, 0, PF_W, PF_H);
    ctx.globalAlpha = 1;
  }
}

function drawBomb(g: Game, t: number) {
  const age = BOMB_FRAMES - g.bombT;
  const ship = SHIPS[g.shipIndex];
  const col = ship.bombColor;
  const fade = Math.min(1, g.bombT / 30);
  ctx.globalCompositeOperation = 'lighter';
  const r = age * 20;
  if (ship.id === 'js') {
    for (let i = 0; i < 3; i++) {
      const rr = r - i * 60;
      if (rr <= 0) continue;
      ctx.globalAlpha = fade * (0.5 - i * 0.12);
      ctx.strokeStyle = col;
      ctx.lineWidth = 14 - i * 4;
      ctx.beginPath();
      ctx.arc(g.bombX, g.bombY, rr, 0, TAU);
      ctx.stroke();
    }
  } else if (ship.id === 'rs') {
    const w = 120 + Math.sin(age * 0.3) * 20;
    const grad = ctx.createLinearGradient(g.bombX - w, 0, g.bombX + w, 0);
    grad.addColorStop(0, 'rgba(255,90,40,0)');
    grad.addColorStop(0.5, `rgba(255,200,150,${0.6 * fade})`);
    grad.addColorStop(1, 'rgba(255,90,40,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(g.bombX - w, 0, w * 2, PF_H);
    ctx.globalAlpha = fade * 0.4;
    ctx.strokeStyle = col;
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(g.bombX, g.bombY, r, 0, TAU);
    ctx.stroke();
  } else {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + age * 0.05;
      ctx.globalAlpha = fade * 0.6;
      ctx.strokeStyle = col;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let s = 0; s < 20; s++) {
        const rr = (r * s) / 20;
        const aa = a + Math.sin(s * 0.6 + age * 0.3) * 0.25;
        const x = g.bombX + Math.cos(aa) * rr;
        const y = g.bombY + Math.sin(aa) * rr;
        if (s === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = fade * 0.15;
  ctx.fillStyle = col;
  ctx.fillRect(0, 0, PF_W, PF_H);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (age < 70) {
    ctx.globalAlpha = fade;
    text(`$ sudo ${ship.bombName}`, g.bombX, g.bombY - 40 - age * 0.5, { size: 12, weight: 700, color: '#fff', align: 'center', stroke: 'rgba(0,0,0,0.7)' });
    ctx.globalAlpha = 1;
  }
}

function drawBossHud(g: Game, t: number) {
  const b = g.boss!;
  const def = b.def;
  // name & phases
  text(def.name, 10, 20, { size: 12, weight: 800, color: def.color, stroke: 'rgba(0,0,0,0.7)', spacing: 1 });
  for (let i = 0; i < b.phasesLeft; i++) {
    ctx.fillStyle = def.color;
    ctx.save();
    ctx.translate(12 + i * 13, 32);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-3.5, -3.5, 7, 7);
    ctx.restore();
  }
  if (!b.phase) return; // still entering / talking
  // HP bar
  const bx = 10;
  const bw = PF_W - 80;
  const hp = clamp(b.hp / b.maxHp, 0, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(bx, 42, bw, 6);
  const hg = ctx.createLinearGradient(bx, 0, bx + bw, 0);
  hg.addColorStop(0, '#ffffff');
  hg.addColorStop(1, def.color);
  ctx.fillStyle = b.phase?.survival ? '#556' : hg;
  ctx.fillRect(bx, 42, bw * (b.phase?.survival ? b.timer / b.timerMax : hp), 6);
  if (b.invuln > 0 && b.invuln < 99999) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(bx, 42, bw * hp, 6);
  }
  // timer
  const sec = Math.max(0, b.timer / 60);
  const low = sec < 10;
  text(sec.toFixed(sec < 10 ? 2 : 0).padStart(2, '0'), PF_W - 12, 52, {
    size: low ? 20 : 18,
    weight: 800,
    display: true,
    color: low ? (Math.floor(t / 8) % 2 ? '#ff3b5c' : '#ffffff') : '#ffffff',
    align: 'right',
    stroke: 'rgba(0,0,0,0.7)',
  });
  // spell name strip
  if (b.inSpell && b.phase?.name) {
    const cutT = g.spellCut ? g.spellCut.t : 999;
    const slide = cutT < 50 ? 0 : Math.min(1, (cutT - 50) / 30);
    const yTarget = 70;
    const y = lerp(PF_H * 0.62, yTarget, ease.inOutCubic(slide));
    const name = b.phase.name;
    ctx.font = font(12, 700);
    const tw = Math.min(PF_W - 20, ctx.measureText(name).width + 24);
    const gx = PF_W - tw - 6;
    const sg = ctx.createLinearGradient(gx, 0, PF_W, 0);
    sg.addColorStop(0, 'rgba(0,0,0,0)');
    sg.addColorStop(0.15, 'rgba(0,0,0,0.75)');
    sg.addColorStop(1, 'rgba(0,0,0,0.75)');
    ctx.fillStyle = sg;
    ctx.fillRect(gx, y - 14, tw + 6, 22);
    ctx.fillStyle = def.color;
    ctx.fillRect(gx + 10, y + 7, tw - 4, 1);
    text(name, PF_W - 10, y + 2, { size: 12, weight: 700, color: '#ffffff', align: 'right', glow: def.color, glowBlur: 6 });
    if (slide >= 1) {
      const bonus = b.spellFailed ? 'FAILED' : b.phase.survival ? 'SURVIVE' : formatScore(Math.round((((g.stageIndex + 1) * 1_000_000 + 500_000) * (0.5 + 0.5 * clamp(b.timer / b.timerMax, 0, 1)) * (1 + g.lv * 0.25)) / 10) * 10);
      const rec = save.spells[`${def.id}:${b.phaseIdx}`];
      text(`BONUS ${bonus}   HISTORY ${rec ? rec.caught : 0}/${rec ? rec.tries : 0}`, PF_W - 10, y + 20, { size: 9, color: b.spellFailed ? '#ff5a74' : '#9fb0d0', align: 'right', stroke: 'rgba(0,0,0,0.7)' });
    }
  }
  // enemy marker at the bottom edge
  ctx.fillStyle = def.color;
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.moveTo(b.x, PF_H - 10);
  ctx.lineTo(b.x - 7, PF_H);
  ctx.lineTo(b.x + 7, PF_H);
  ctx.closePath();
  ctx.fill();
  text('BOSS', b.x, PF_H - 13, { size: 8, weight: 800, color: def.color, align: 'center' });
  ctx.globalAlpha = 1;
}

function drawSpellCut(g: Game) {
  const c = g.spellCut!;
  const t = c.t;
  if (t > 110) return;
  const a = t < 15 ? t / 15 : t > 80 ? Math.max(0, 1 - (t - 80) / 30) : 1;
  ctx.save();
  ctx.globalAlpha = a * 0.9;
  // diagonal band
  ctx.translate(PF_W / 2, PF_H * 0.55);
  ctx.rotate(-0.18);
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.fillRect(-PF_W, -46, PF_W * 2, 92);
  ctx.fillStyle = c.color;
  ctx.fillRect(-PF_W, -46, PF_W * 2, 2);
  ctx.fillRect(-PF_W, 44, PF_W * 2, 2);
  const slide = (t - 55) * 3;
  ctx.globalAlpha = a * 0.18;
  text(c.boss, -slide - 100, 0, { size: 70, weight: 900, display: true, color: c.color, baseline: 'middle' });
  ctx.globalAlpha = a;
  text('throw', -PF_W / 2 + 30, -18, { size: 12, weight: 700, color: '#ff5a74' });
  const shortName = c.name.length > 44 ? c.name.slice(0, 43) + '…' : c.name;
  text(shortName, 0, 8, { size: 16, weight: 800, color: '#ffffff', align: 'center', baseline: 'middle', glow: c.color, glowBlur: 14 });
  text('EXCEPTION DECLARED', PF_W / 2 - 30, 32, { size: 9, weight: 700, color: c.color, align: 'right', spacing: 3 });
  ctx.restore();
}

function drawBanner(b: Game['banners'][number], t: number) {
  const p = b.t / b.dur;
  const a = p < 0.12 ? p / 0.12 : p > 0.8 ? (1 - p) / 0.2 : 1;
  ctx.globalAlpha = a;
  if (b.kind === 'center') {
    const y = PF_H * 0.4;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, y - 44, PF_W, 88);
    // hazard stripes
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y - 44, PF_W, 10);
    ctx.rect(0, y + 34, PF_W, 10);
    ctx.clip();
    ctx.fillStyle = b.color;
    for (let x = -40 + ((b.t * 2) % 40); x < PF_W + 40; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, y - 44);
      ctx.lineTo(x + 20, y - 44);
      ctx.lineTo(x + 10, y + 44);
      ctx.lineTo(x - 10, y + 44);
      ctx.fill();
    }
    ctx.restore();
    const blink = Math.floor(b.t / 10) % 2 === 0 ? 1 : 0.55;
    ctx.globalAlpha = a * blink;
    glitchText(b.text, PF_W / 2, y - 4, 40, t, 0.8, { color: '#ffffff', glow: b.color });
    ctx.globalAlpha = a;
    text(b.sub, PF_W / 2, y + 24, { size: 11, weight: 700, color: b.color, align: 'center', spacing: 3 });
  } else if (b.kind === 'boss') {
    const slide = ease.outCubic(Math.min(1, b.t / 30));
    const out = p > 0.8 ? (p - 0.8) / 0.2 : 0;
    const x = lerp(-PF_W, 24, slide) + out * 60;
    const y = PF_H * 0.22;
    ctx.globalAlpha = a;
    const g2 = ctx.createLinearGradient(0, 0, PF_W, 0);
    g2.addColorStop(0, hexA(b.color, 0.35));
    g2.addColorStop(1, hexA(b.color, 0));
    ctx.fillStyle = g2;
    ctx.fillRect(0, y - 34, PF_W, 60);
    ctx.fillStyle = b.color;
    ctx.fillRect(0, y + 26, PF_W * slide, 2);
    text('PID ' + (1000 + ((b.text.length * 7919) % 9000)), x, y - 16, { size: 10, color: b.color, weight: 700, spacing: 3 });
    text(b.text, x, y + 12, { size: 30, weight: 900, display: true, color: '#ffffff', glow: b.color, glowBlur: 16, spacing: 2 });
    text(b.sub, x + 4, y + 44, { size: 12, color: '#cfe3ff', stroke: 'rgba(0,0,0,0.7)' });
  } else if (b.kind === 'result') {
    const y = PF_H * 0.3 + (1 - Math.min(1, b.t / 12)) * 20;
    text(b.text, PF_W / 2, y, { size: 24, weight: 900, display: true, color: b.color, align: 'center', stroke: 'rgba(0,0,0,0.8)', strokeW: 5, spacing: 2 });
    text(b.sub, PF_W / 2, y + 26, { size: 14, weight: 700, color: '#ffffff', align: 'center', stroke: 'rgba(0,0,0,0.8)' });
  } else {
    const y = PF_H * 0.52 - b.t * 0.3;
    text(b.text, PF_W / 2, y, { size: 18, weight: 800, color: b.color, align: 'center', stroke: 'rgba(0,0,0,0.8)', strokeW: 4 });
    if (b.sub) text(b.sub, PF_W / 2, y + 20, { size: 10, color: '#cfe3ff', align: 'center', stroke: 'rgba(0,0,0,0.8)' });
  }
  ctx.globalAlpha = 1;
}

function drawStageTitle(g: Game) {
  const t = g.stageTitleT;
  const a = t < 40 ? t / 40 : t > 280 ? Math.max(0, (330 - t) / 50) : 1;
  const st = g.stage;
  ctx.globalAlpha = a;
  const y = PF_H * 0.36;
  const reveal = Math.min(1, t / 50);
  text(g.mode === 'spell' ? 'PRACTICE' : st.title, PF_W / 2, y - 40, { size: 14, weight: 700, color: st.color, align: 'center', spacing: 8 });
  const name = st.name.slice(0, Math.ceil(st.name.length * reveal));
  glitchText(name + (reveal < 1 ? '_' : ''), PF_W / 2, y, 34, t, t < 60 ? 1 : 0.25, { glow: st.color });
  text(st.subtitle, PF_W / 2, y + 36, { size: 13, color: '#9fb0d0', align: 'center' });
  if (g.nowPlaying) text('♪ ' + g.nowPlaying, PF_W - 14, PF_H - 20, { size: 11, color: '#cfe3ff', align: 'right', stroke: 'rgba(0,0,0,0.6)' });
  ctx.globalAlpha = 1;
}

function wrap(str: string, maxW: number, size: number): string[] {
  ctx.font = font(size, 500);
  const words = str.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function drawDialogue(g: Game, t: number) {
  const d = g.dlg!;
  const line = d.lines[d.idx];
  if (!line) return;
  const x = 20;
  const w = PF_W - 40;
  const h = 110;
  const y = PF_H - h - 30;
  ctx.fillStyle = 'rgba(2,4,10,0.9)';
  ctx.strokeStyle = line.who === 'you' ? SHIPS[g.shipIndex].color : line.who === 'boss' ? g.boss?.def.color ?? '#ff3b5c' : '#ff3b5c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.stroke();
  const who = line.who === 'you' ? 'dbg@ring3' : line.who === 'boss' ? (d.bossName || 'unknown').toLowerCase().replace(/ /g, '_') + '@pid' : 'SYSTEM';
  const col = ctx.strokeStyle as string;
  text(`${who}:~$`, x + 14, y + 22, { size: 11, weight: 800, color: col });
  const shown = line.text.slice(0, Math.floor(d.chars));
  const lines = wrap(shown, w - 28, 14);
  lines.forEach((l, i) => text(l, x + 14, y + 48 + i * 20, { size: 14, color: '#e6f0ff' }));
  if (d.chars >= line.text.length && Math.floor(t / 20) % 2) text('▼ Z', x + w - 14, y + h - 12, { size: 10, color: '#8aa0cc', align: 'right' });
  text('hold X+SHIFT to skip', x + 14, y + h - 12, { size: 9, color: '#445577' });
}

function drawTally(g: Game) {
  const tl = g.clearTally!;
  const t = tl.t;
  const a = Math.min(1, t / 20) * (t > 240 ? Math.max(0, (260 - t) / 20) : 1);
  ctx.globalAlpha = a;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(40, PF_H * 0.26, PF_W - 80, 250);
  ctx.strokeStyle = g.stage.color;
  ctx.strokeRect(40.5, PF_H * 0.26 + 0.5, PF_W - 81, 249);
  glitchText('STAGE CLEAR', PF_W / 2, PF_H * 0.26 + 44, 32, g.realFrame, 0.3, { glow: g.stage.color });
  text(`$ git commit -m "fix: ${g.stage.boss.name.toLowerCase()}"`, PF_W / 2, PF_H * 0.26 + 76, { size: 11, color: '#39ff88', align: 'center' });
  tl.lines.forEach(([k, v], i) => {
    if (t < 40 + i * 20) return;
    text(k, 80, PF_H * 0.26 + 120 + i * 26, { size: 13, color: '#9fb0d0', weight: 700 });
    text(v, PF_W - 80, PF_H * 0.26 + 120 + i * 26, { size: 13, color: '#ffffff', weight: 700, align: 'right' });
  });
  if (t > 120) {
    text('TOTAL', 80, PF_H * 0.26 + 214, { size: 15, color: '#ffe14d', weight: 800 });
    text(formatScore(tl.total), PF_W - 80, PF_H * 0.26 + 214, { size: 18, color: '#ffe14d', weight: 900, align: 'right' });
  }
  ctx.globalAlpha = 1;
}

function drawContinue(g: Game, t: number) {
  ctx.fillStyle = 'rgba(0,0,10,0.78)';
  ctx.fillRect(0, 0, PF_W, PF_H);
  glitchText('SEGMENTATION FAULT', PF_W / 2, PF_H * 0.3, 32, t, 1, { glow: '#ff3b5c' });
  text('(core dumped)', PF_W / 2, PF_H * 0.3 + 34, { size: 13, color: '#ff5a74', align: 'center' });
  const sec = Math.ceil(g.continueT / 60);
  text('REBOOT AND CONTINUE?', PF_W / 2, PF_H * 0.5, { size: 18, weight: 800, color: '#ffffff', align: 'center' });
  text(String(sec), PF_W / 2, PF_H * 0.5 + 70, { size: 60, weight: 900, display: true, color: '#00f0ff', align: 'center', glow: '#00f0ff' });
  text('[Z] yes — score resets      [X] no — save & exit', PF_W / 2, PF_H * 0.5 + 120, { size: 12, color: '#9fb0d0', align: 'center' });
  if (g.touchMode) text('tap upper half: yes  ·  lower half: no', PF_W / 2, PF_H * 0.5 + 146, { size: 11, color: '#556a90', align: 'center' });
}

export function measureText(s: string, size: number) {
  return measure(s, size);
}
export { FONT_MONO };
