import { audio } from '../audio/engine';
import { music } from '../audio/music';
import { H, W } from '../config';
import { input } from '../core/input';
import { formatScore } from '../core/math';
import { addScore, qualifies, save, persist } from '../core/save';
import { DIFFS } from '../game/difficulty';
import type { GameResult } from '../game/game';
import { SHIPS } from '../game/ships';
import { STAGES } from '../content/stages';
import { base, ctx, view } from '../render/canvas';
import { glitchText, panelRect, text } from '../render/draw';
import { post } from '../render/post';
import { GameScene } from './gameScene';
import { attract, PracticeScene, ScoresScene, TitleScene } from './menus';
import { app, Menu, type Scene } from './scene';

const NAME_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-.!?* ';

function backdrop(dim: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  attract.draw(view.k, view.ox, view.oy);
  base();
  ctx.fillStyle = `rgba(2,3,10,${dim})`;
  ctx.fillRect(0, 0, W, H);
}

export class ResultScene implements Scene {
  cursor = true;
  private t = 0;
  private entering: boolean;
  private name: string[];
  private pos = 0;
  private menu: Menu;
  private saved = false;

  constructor(private r: GameResult) {
    this.entering = r.mode === 'arcade' && qualifies(DIFFS[r.diff].id, r.score);
    this.name = save.lastName.padEnd(8, ' ').slice(0, 8).split('');
    this.pos = Math.min(7, save.lastName.trim().length);
    const retry = () => {
      if (r.mode === 'spell') app.set(new GameScene({ diff: r.diff, ship: r.ship, mode: 'spell', spell: r.spell }));
      else app.set(new GameScene({ diff: r.diff, ship: r.ship, mode: r.mode, stage: r.mode === 'stage' ? r.stage : 0 }));
    };
    const items = [
      { label: r.mode === 'spell' ? 'RETRY EXCEPTION' : 'RETRY', select: retry },
      ...(r.mode === 'arcade' ? [{ label: 'HIGH SCORES', select: () => app.set(new ScoresScene()) }] : [{ label: 'PRACTICE MENU', select: () => app.set(new PracticeScene()) }]),
      { label: 'TITLE', select: () => app.set(new TitleScene()) },
    ];
    this.menu = new Menu(items);
    this.menu.onBack = () => app.set(new TitleScene());
  }

  enter() {
    if (this.r.mode === 'spell') return;
    music.play(this.r.cleared ? 'ending' : 'title');
  }

  update() {
    this.t++;
    attract.intensity = 0.3;
    attract.update();
    if (this.entering) {
      this.updateEntry();
      return;
    }
    if (this.t > 30) this.menu.update();
  }

  private updateEntry() {
    for (const ch of input.chars) {
      if (ch === '\b') {
        this.pos = Math.max(0, this.pos - 1);
        this.name[this.pos] = ' ';
      } else if (ch === '\n') {
        this.commit();
        return;
      } else {
        const c = ch.toUpperCase();
        if (NAME_CHARS.includes(c) && this.pos < 8) {
          this.name[this.pos] = c;
          this.pos = Math.min(8, this.pos + 1);
          audio.play('type');
        }
      }
    }
    if (input.lastDevice === 'gamepad') {
      const cur = this.name[Math.min(this.pos, 7)];
      let ci = NAME_CHARS.indexOf(cur);
      if (input.repeat('up')) ci = (ci + 1) % NAME_CHARS.length;
      if (input.repeat('down')) ci = (ci - 1 + NAME_CHARS.length) % NAME_CHARS.length;
      this.name[Math.min(this.pos, 7)] = NAME_CHARS[ci];
      if (input.repeat('right')) this.pos = Math.min(7, this.pos + 1);
      if (input.repeat('left')) this.pos = Math.max(0, this.pos - 1);
      if (input.pressed('pause')) this.commit();
      if (input.pressed('confirm')) {
        if (this.pos >= 7) this.commit();
        else this.pos++;
      }
    }
    for (const tp of input.taps) if (tp.y > 560) this.commit();
  }

  private commit() {
    const name = this.name.join('').trim() || 'DBG';
    save.lastName = name;
    addScore(DIFFS[this.r.diff].id, {
      name,
      score: this.r.score,
      stage: `STAGE ${this.r.stage + 1}`,
      ship: SHIPS[this.r.ship].file,
      date: new Date().toISOString().slice(0, 10),
      cleared: this.r.cleared,
    });
    persist();
    this.entering = false;
    this.saved = true;
    audio.play('menuOk');
    input.resetEdges();
  }

  draw() {
    backdrop(0.8);
    const r = this.r;
    if (r.mode === 'spell') {
      const ok = r.spellResult === 'caught';
      glitchText(ok ? 'EXCEPTION CAUGHT' : 'UNCAUGHT EXCEPTION', W / 2, 220, 48, this.t, ok ? 0.3 : 1, { glow: ok ? '#ffe14d' : '#ff3b5c' });
      text(ok ? 'try { survive(); } catch (e) { celebrate(e); }' : 'at Cursor.dodge (cursor.ts:1) — Segmentation fault', W / 2, 270, { size: 13, color: ok ? '#39ff88' : '#ff5a74', align: 'center' });
      this.menu.draw(W / 2, 400, { w: 380, align: 'center', gap: 46 });
      post(0, app.fade);
      return;
    }
    const practice = r.mode === 'stage';
    const title = r.cleared ? (practice ? 'STAGE PATCHED' : 'ALL SYSTEMS NOMINAL') : r.quit ? 'PROCESS TERMINATED' : 'GAME OVER';
    glitchText(title, W / 2, 80, 42, this.t, r.cleared ? 0.3 : 0.9, { glow: r.cleared ? '#39ff88' : '#ff3b5c' });
    text(r.cleared ? 'exit code 0' : r.quit ? 'SIGTERM received' : 'kernel: Out of processes. Killing debugger.', W / 2, 118, { size: 13, color: r.cleared ? '#39ff88' : '#ff5a74', align: 'center' });

    panelRect(W / 2 - 420, 150, 840, 330, '#1b2540', 'rgba(3,6,14,0.85)');
    const hash = (r.score * 2654435761 >>> 0).toString(16).padStart(8, '0').slice(0, 7);
    text(`commit ${hash}`, W / 2 - 390, 184, { size: 14, color: '#ffe14d', weight: 700 });
    text(`Author: ${save.lastName} <dbg@ring3>`, W / 2 - 390, 208, { size: 13, color: '#9fb0d0' });
    const msg = r.cleared ? (practice ? `fix: ${STAGES[r.stage].boss.name.toLowerCase()} (practice)` : 'fix: resolve kernel panic (all stages)') : `wip: reached ${STAGES[r.stage].name}`;
    text(`    ${msg}  [${DIFFS[r.diff].name} · ${SHIPS[r.ship].file}]`, W / 2 - 390, 240, { size: 13, color: '#e6f0ff' });
    const secs = Math.floor(r.time / 60);
    const stats: [string, string, string?][] = [
      ['score', formatScore(r.score), '#ffffff'],
      ['graze', String(r.graze)],
      ['max streak', String(r.maxStreak)],
      ['exceptions caught', `${r.caught} / ${r.seen}`],
      ['processes lost', String(r.deaths)],
      ['sudo used', String(r.bombsUsed)],
      ['uptime', `${Math.floor(secs / 60)}m ${String(secs % 60).padStart(2, '0')}s`],
      ['continues', String(r.continues), r.continues ? '#ff5a74' : undefined],
    ];
    stats.forEach(([k, v, c], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = W / 2 - 390 + col * 410;
      const y = 290 + row * 40;
      text(`+ ${k}`, x, y, { size: 14, color: '#39ff88' });
      text(v, x + 370, y, { size: i === 0 ? 20 : 15, weight: 800, color: c ?? '#cfe3ff', align: 'right' });
    });

    if (this.entering) {
      panelRect(W / 2 - 300, 500, 600, 150, '#ffe14d', 'rgba(20,16,0,0.9)');
      text('NEW HIGH SCORE — git config user.name', W / 2, 532, { size: 14, weight: 800, color: '#ffe14d', align: 'center' });
      for (let i = 0; i < 8; i++) {
        const x = W / 2 - 8 * 26 + i * 52 + 26;
        const cur = i === Math.min(this.pos, 7);
        ctx.fillStyle = cur && Math.floor(this.t / 15) % 2 ? '#ffe14d' : '#3a3310';
        ctx.fillRect(x - 18, 598, 36, 3);
        text(this.name[i], x, 590, { size: 30, weight: 800, color: '#ffffff', align: 'center' });
      }
      text(input.lastDevice === 'gamepad' ? '↑↓ letter · ←→ move · START done' : 'type your name · ENTER to save', W / 2, 634, { size: 11, color: '#9fb0d0', align: 'center' });
    } else {
      if (this.saved) text('score committed to history ✓', W / 2, 505, { size: 12, color: '#39ff88', align: 'center' });
      this.menu.draw(W / 2, 560, { w: 380, align: 'center', gap: 42 });
    }
    post(0, app.fade);
  }
}

// ------------------------------------------------------------------ ending

const ENDING_LINES: [string, string][] = [
  ['$ sudo systemctl restart kernel', '#cfe3ff'],
  ['', ''],
  ['[  OK  ] Terminated INFINITE LOOP (pid 1)', '#39ff88'],
  ['[  OK  ] Refactored SPAGHETTI CODE into 212 small functions', '#39ff88'],
  ['[  OK  ] Reclaimed 64.0 GiB from MEMORY LEAK', '#39ff88'],
  ['[  OK  ] Synchronized RACE CONDITION with a mutex', '#39ff88'],
  ['[  OK  ] Handled KERNEL PANIC', '#39ff88'],
  ['[  OK  ] Proved nothing about the Halting Problem, but it halted anyway', '#39ff88'],
  ['', ''],
  ['● kernel.service - KERNEL//PANIC', '#ffffff'],
  ['   Active: active (running) since just now', '#39ff88'],
  ['   Tests:  1337 passed, 0 failed', '#39ff88'],
  ['', ''],
  ['Somewhere, a production server stops beeping.', '#9fb0d0'],
  ['An on-call engineer goes back to sleep.', '#9fb0d0'],
  ['', ''],
  ['Thank you for debugging.', '#ffe14d'],
];

const CREDITS: [string, string][] = [
  ['GAME DESIGN & ENGINEERING', 'Claude Code'],
  ['SOUNDTRACK', 'synthesised live by the Web Audio API'],
  ['ART', 'every pixel drawn in code'],
  ['INSPIRED BY', 'Touhou Project · DoDonPachi · Espgaluda · Ikaruga'],
  ['DIRECTED BY', 'you'],
];

export class EndingScene implements Scene {
  cursor = true;
  private t = 0;
  constructor(private r: GameResult) {}
  enter() {
    music.play('ending');
  }
  update() {
    this.t++;
    attract.intensity = 0;
    attract.update();
    if (this.t > 120 && (input.pressed('confirm') || input.pressed('back') || input.taps.length)) {
      if (this.t < 900) this.t = 900;
      else app.set(new ResultScene(this.r));
    }
  }
  draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    base();
    ctx.fillStyle = '#010205';
    ctx.fillRect(0, 0, W, H);
    const shown = Math.min(ENDING_LINES.length, Math.floor(this.t / 22));
    for (let i = 0; i < shown; i++) {
      const [l, c] = ENDING_LINES[i];
      text(l, 80, 60 + i * 26, { size: 15, color: c, weight: l.startsWith('Thank') ? 800 : 400 });
    }
    if (this.t > 520) {
      const a = Math.min(1, (this.t - 520) / 60);
      ctx.globalAlpha = a;
      glitchText('exit(0)', W - 260, 180, 60, this.t, 0.3, { glow: '#39ff88' });
      CREDITS.forEach(([k, v], i) => {
        text(k, W - 260, 300 + i * 56, { size: 11, color: '#6a7ca8', align: 'center', spacing: 2, weight: 700 });
        text(v, W - 260, 322 + i * 56, { size: 14, color: '#e6f0ff', align: 'center' });
      });
      ctx.globalAlpha = 1;
    }
    if (this.t > 900 && Math.floor(this.t / 30) % 2) text('PRESS Z', W / 2, H - 30, { size: 14, weight: 800, color: '#00f0ff', align: 'center', spacing: 4 });
    post(0, app.fade);
  }
}
