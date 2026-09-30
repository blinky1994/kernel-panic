import { audio } from '../audio/engine';
import { music } from '../audio/music';
import { COLORS, H, W } from '../config';
import { input } from '../core/input';
import { formatScore, TAU } from '../core/math';
import { hiScore, persist, save, topScores } from '../core/save';
import { DIFFS } from '../game/difficulty';
import { SHIPS } from '../game/ships';
import { STAGES } from '../content/stages';
import { Attract } from '../render/attract';
import { base, ctx, view } from '../render/canvas';
import { bar, cursorPath, glitchText, panelRect, text } from '../render/draw';
import { post } from '../render/post';
import { bulletSprite, glowSprite, itemSprite, SS } from '../render/sprites';
import { GameScene } from './gameScene';
import { app, Menu, type Scene } from './scene';

export const attract = new Attract();

function backdrop(dim = 0.55) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, view.cw, view.ch);
  attract.draw(view.k, view.ox, view.oy);
  base();
  ctx.fillStyle = `rgba(2,3,10,${dim})`;
  ctx.fillRect(0, 0, W, H);
}

function footer(hint: string) {
  text(hint, W / 2, H - 22, { size: 11, color: '#6a7ca8', align: 'center' });
}

function header(title: string, sub: string) {
  glitchText(title, W / 2, 70, 36, attract.t, 0.3);
  text(sub, W / 2, 104, { size: 12, color: COLORS.dim, align: 'center', spacing: 2 });
}

function confirmHint() {
  return input.lastDevice === 'gamepad' ? '[A] select   [B] back' : '[Z/ENTER] select   [X/ESC] back   ←→ adjust';
}

// ------------------------------------------------------------------ title

export class TitleScene implements Scene {
  cursor = true;
  private menu: Menu;
  private t = 0;
  constructor() {
    this.menu = new Menu([
      { label: 'START', hint: 'Boot a full run through all 5 layers of the stack.', select: () => app.set(new SelectScene('arcade')) },
      { label: 'PRACTICE', hint: 'Replay stages you have reached, or drill single exceptions.', select: () => app.set(new PracticeScene()) },
      { label: 'HIGH SCORES', hint: 'Top 10 per difficulty.', select: () => app.set(new ScoresScene()) },
      { label: 'HOW TO PLAY', hint: 'Controls, systems and scoring.', select: () => app.set(new ManualScene()) },
      { label: 'OPTIONS', hint: 'Audio, auto-fire, effects, fullscreen.', select: () => app.set(new OptionsScene()) },
    ]);
  }
  enter() {
    music.play('title');
    attract.intensity = 1;
  }
  update() {
    this.t++;
    attract.cx = W / 2;
    attract.cy = 200;
    attract.update();
    this.menu.update();
  }
  draw() {
    backdrop(0.35);
    const t = this.t;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.35;
    ctx.drawImage(glowSprite('#00a0ff', 32), W / 2 - 500, 110, 1000, 180);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    glitchText('KERNEL//PANIC', W / 2, 190, 86, t, 0.9, { spacing: 4 });
    text("A  DEBUG-HELL  SHOOT  'EM  UP", W / 2, 258, { size: 14, weight: 700, color: '#ff7ae6', align: 'center', spacing: 6, glow: '#ff2bd6', glowBlur: 10 });
    panelRect(W / 2 - 220, 318, 440, 244, '#1b2540', 'rgba(3,6,14,0.72)');
    const hint = this.menu.draw(W / 2, 360, { w: 400, align: 'center', gap: 42, size: 20 });
    text(hint, W / 2, 598, { size: 12, color: '#9fb0d0', align: 'center' });
    const d = DIFFS[save.settings.lastDiff];
    text(`HI-SCORE ${formatScore(hiScore(d.id))}  (${d.name})`, 30, H - 22, { size: 11, color: '#6a7ca8' });
    text('v1.0.0 · build 2026.09.30', W - 30, H - 22, { size: 11, color: '#3d4a6a', align: 'right' });
    footer(confirmHint());
    post(0, app.fade);
  }
}

// ------------------------------------------------------------------ difficulty + build select

export class SelectScene implements Scene {
  cursor = true;
  private step = 0;
  private diff = save.settings.lastDiff;
  private ship = save.settings.lastShip;
  private t = 0;
  private cardRects: { x: number; y: number; w: number; h: number }[] = [];
  constructor(
    private mode: 'arcade' | 'stage',
    private stage = 0,
  ) {}
  update() {
    this.t++;
    attract.update();
    const n = this.step === 0 ? DIFFS.length : SHIPS.length;
    let cur = this.step === 0 ? this.diff : this.ship;
    if (input.repeat('left') || input.repeat('up')) {
      cur = (cur + n - 1) % n;
      audio.play('menuMove');
    }
    if (input.repeat('right') || input.repeat('down')) {
      cur = (cur + 1) % n;
      audio.play('menuMove');
    }
    if (input.hover && input.hoverMoved) {
      const i = this.cardRects.findIndex((r) => input.hover!.x >= r.x && input.hover!.x <= r.x + r.w && input.hover!.y >= r.y && input.hover!.y <= r.y + r.h);
      if (i >= 0 && i !== cur) {
        cur = i;
        audio.play('menuMove');
      }
    }
    let go = input.pressed('confirm');
    for (const tp of input.taps) {
      const i = this.cardRects.findIndex((r) => tp.x >= r.x && tp.x <= r.x + r.w && tp.y >= r.y && tp.y <= r.y + r.h);
      if (i >= 0) {
        cur = i;
        go = true;
      }
    }
    if (this.step === 0) this.diff = cur;
    else this.ship = cur;
    if (go) {
      audio.play('menuOk');
      if (this.step === 0) this.step = 1;
      else {
        save.settings.lastDiff = this.diff;
        save.settings.lastShip = this.ship;
        persist();
        app.set(new GameScene({ diff: this.diff, ship: this.ship, mode: this.mode, stage: this.stage }));
      }
    }
    if (input.pressed('back')) {
      audio.play('menuBack');
      if (this.step === 1) this.step = 0;
      else app.set(this.mode === 'arcade' ? new TitleScene() : new PracticeScene());
    }
  }
  draw() {
    backdrop(0.72);
    this.cardRects = [];
    if (this.step === 0) {
      header('SELECT ENVIRONMENT', '$ ./kernel-panic --env=?');
      const cw = 270;
      const gap = 20;
      const x0 = W / 2 - (cw * 4 + gap * 3) / 2;
      DIFFS.forEach((d, i) => {
        const x = x0 + i * (cw + gap);
        const y = 160;
        const h = 360;
        const sel = i === this.diff;
        this.cardRects.push({ x, y, w: cw, h });
        panelRect(x, y + (sel ? -8 : 0), cw, h, sel ? d.color : '#1b2540', sel ? 'rgba(8,14,28,0.95)' : 'rgba(5,8,16,0.85)');
        const yy = y + (sel ? -8 : 0);
        text(d.flag, x + cw / 2, yy + 40, { size: 13, color: '#6a7ca8', align: 'center' });
        text(d.name, x + cw / 2, yy + 84, { size: d.name.length > 10 ? 22 : 28, weight: 900, display: true, color: d.color, align: 'center', glow: sel ? d.color : undefined, glowBlur: 16 });
        // density dots
        const dots = [3, 6, 10, 15][i];
        for (let k = 0; k < dots; k++) {
          const a = (k / dots) * TAU + this.t * 0.02 * (sel ? 1 : 0.2);
          const r = 34 + (k % 3) * 10;
          const spr = bulletSprite('orb', (['green', 'cyan', 'orange', 'red'] as const)[i]);
          ctx.drawImage(spr, x + cw / 2 + Math.cos(a) * r - 7, yy + 170 + Math.sin(a) * r - 7, 14, 14);
        }
        const words = d.desc.split(' ');
        let line = '';
        let ly = yy + 262;
        for (const w of words) {
          if ((line + ' ' + w).length > 26) {
            text(line.trim(), x + cw / 2, ly, { size: 12, color: '#cfe3ff', align: 'center' });
            ly += 18;
            line = w;
          } else line += ' ' + w;
        }
        text(line.trim(), x + cw / 2, ly, { size: 12, color: '#cfe3ff', align: 'center' });
        text(`${d.lives + 1} processes`, x + cw / 2, yy + h - 24, { size: 11, color: '#6a7ca8', align: 'center' });
      });
    } else {
      header('SELECT BUILD', `env: ${DIFFS[this.diff].name}  ·  $ ./kernel-panic --build=?`);
      const cw = 360;
      const gap = 26;
      const x0 = W / 2 - (cw * 3 + gap * 2) / 2;
      SHIPS.forEach((s, i) => {
        const x = x0 + i * (cw + gap);
        const y = 150;
        const h = 470;
        const sel = i === this.ship;
        this.cardRects.push({ x, y, w: cw, h });
        const yy = y + (sel ? -8 : 0);
        panelRect(x, yy, cw, h, sel ? s.color : '#1b2540', sel ? 'rgba(8,14,28,0.95)' : 'rgba(5,8,16,0.85)');
        text(s.file, x + cw / 2, yy + 44, { size: 26, weight: 800, color: s.color, align: 'center', glow: sel ? s.color : undefined, glowBlur: 14 });
        text(s.lang, x + cw / 2, yy + 68, { size: 12, color: '#6a7ca8', align: 'center' });
        // ship + animated shots
        const sx = x + cw / 2;
        const sy = yy + 190;
        this.drawShotPreview(s.id, sx, sy, sel);
        ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(glowSprite(s.color, 32), sx - 30, sy - 30, 60, 60);
        ctx.globalCompositeOperation = 'source-over';
        ctx.save();
        ctx.translate(sx, sy);
        cursorPath(ctx, 1.7);
        ctx.fillStyle = '#060912';
        ctx.fill();
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.restore();
        text(`"${s.tagline}"`, x + cw / 2, yy + 250, { size: 12, color: '#ffb0f0', align: 'center' });
        s.desc.forEach((l, k) => text(l, x + cw / 2, yy + 280 + k * 18, { size: 12, color: '#cfe3ff', align: 'center' }));
        const stats: [string, number][] = [
          ['POWER', s.stats.power],
          ['COVERAGE', s.stats.spread],
          ['SPEED', s.stats.speed],
        ];
        stats.forEach(([k, v], j) => {
          text(k, x + 30, yy + 356 + j * 22, { size: 10, color: '#6a7ca8', weight: 700 });
          bar(x + 130, yy + 348 + j * 22, cw - 160, 6, v / 5, s.color);
        });
        text(`bomb: sudo ${s.bombName}`, x + cw / 2, yy + h - 26, { size: 11, color: s.bombColor, align: 'center' });
      });
    }
    footer(confirmHint());
    post(0, app.fade);
  }
  private drawShotPreview(id: string, sx: number, sy: number, sel: boolean) {
    const t = this.t;
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = sel ? 0.8 : 0.3;
    for (let i = 0; i < 6; i++) {
      const p = ((t * 4 + i * 20) % 120) / 120;
      const y = sy - 20 - p * 110;
      if (id === 'js') {
        for (let k = -2; k <= 2; k++) {
          ctx.fillStyle = '#ffe14d';
          ctx.fillRect(sx + k * p * 36 - 1.5, y, 3, 12);
        }
      } else if (id === 'rs') {
        ctx.fillStyle = '#ff7a3c';
        ctx.fillRect(sx - 6, sy - 130, 12, 110);
        ctx.fillStyle = '#fff';
        ctx.fillRect(sx - 2, sy - 130, 4, 110);
      } else {
        ctx.strokeStyle = '#39ff88';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let s = 0; s < 8; s++) {
          const yy = y + s * 4;
          ctx.lineTo(sx + Math.sin(yy * 0.1 + i) * 20, yy);
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ------------------------------------------------------------------ practice

export class PracticeScene implements Scene {
  cursor = true;
  private menu!: Menu;
  private mode: 'stage' | 'spell' = 'stage';
  constructor() {
    this.build();
  }
  private build() {
    const keep = this.menu?.idx ?? 0;
    const items: ConstructorParameters<typeof Menu>[0] = [
      {
        label: 'MODE',
        value: () => (this.mode === 'stage' ? 'STAGE PRACTICE' : 'EXCEPTION PRACTICE'),
        left: () => this.toggleMode(),
        right: () => this.toggleMode(),
      },
      {
        label: 'ENVIRONMENT',
        value: () => DIFFS[save.settings.lastDiff].name,
        left: () => (save.settings.lastDiff = (save.settings.lastDiff + 3) % 4),
        right: () => (save.settings.lastDiff = (save.settings.lastDiff + 1) % 4),
      },
      {
        label: 'BUILD',
        value: () => SHIPS[save.settings.lastShip].file,
        left: () => (save.settings.lastShip = (save.settings.lastShip + 2) % 3),
        right: () => (save.settings.lastShip = (save.settings.lastShip + 1) % 3),
      },
    ];
    if (this.mode === 'stage') {
      STAGES.forEach((st, i) => {
        const locked = i > save.unlocked;
        items.push({
          label: locked ? `STAGE ${i + 1}  ???` : `STAGE ${i + 1}  ${st.name}`,
          disabled: locked,
          color: st.color,
          hint: locked ? 'Reach this stage in a full run to unlock it.' : `${st.subtitle} — starts with v${(1 + Math.min(4, i * 0.9)).toFixed(2)} and 8 processes.`,
          select: () => this.start({ stage: i }),
        });
      });
    } else {
      let any = false;
      STAGES.forEach((st, si) => {
        for (const which of ['mid', 'boss'] as const) {
          const def = which === 'mid' ? st.mid : st.boss;
          def.phases.forEach((ph, pi) => {
            if (!ph.name) return;
            const id = `${def.id}:${pi}`;
            const seen = save.seenSpells.includes(id);
            const rec = save.spells[id];
            if (seen) any = true;
            items.push({
              label: seen ? `${def.name.padEnd(14).slice(0, 14)} ${ph.name.length > 34 ? ph.name.slice(0, 33) + '…' : ph.name}` : `${'???'.padEnd(14)} ??????????`,
              disabled: !seen,
              color: def.color,
              hint: seen ? `caught ${rec?.caught ?? 0} / ${rec?.tries ?? 0}   ·   one hit = fail` : 'Encounter this exception in a run to unlock practice.',
              select: () => this.start({ spell: { stage: si, which, phase: pi } }),
            });
          });
        }
      });
      if (!any) items.push({ label: 'no exceptions encountered yet', disabled: true });
    }
    this.menu = new Menu(items);
    this.menu.idx = Math.min(keep, items.length - 1);
    this.menu.onBack = () => {
      persist();
      app.set(new TitleScene());
    };
  }
  private toggleMode() {
    this.mode = this.mode === 'stage' ? 'spell' : 'stage';
    this.build();
  }
  private start(o: { stage?: number; spell?: { stage: number; which: 'mid' | 'boss'; phase: number } }) {
    persist();
    if (o.spell) app.set(new GameScene({ diff: save.settings.lastDiff, ship: save.settings.lastShip, mode: 'spell', spell: o.spell }));
    else app.set(new GameScene({ diff: save.settings.lastDiff, ship: save.settings.lastShip, mode: 'stage', stage: o.stage }));
  }
  update() {
    attract.update();
    this.menu.update();
  }
  draw() {
    backdrop(0.75);
    header('PRACTICE', 'git checkout -b practice');
    panelRect(W / 2 - 400, 140, 800, 500, '#1b2540', 'rgba(3,6,14,0.8)');
    const hint = this.menu.draw(W / 2 - 390, 176, { w: 780, gap: 34, size: 15, max: 13 });
    text(hint, W / 2, 668, { size: 12, color: '#9fb0d0', align: 'center' });
    footer(confirmHint());
    post(0, app.fade);
  }
}

// ------------------------------------------------------------------ options

export class OptionsScene implements Scene {
  cursor = true;
  private menu: Menu;
  private confirmReset = false;
  constructor() {
    const s = save.settings;
    const onOff = (v: boolean) => (v ? 'ON' : 'OFF');
    const vol = (k: 'musicVol' | 'sfxVol', d: number) => {
      s[k] = Math.max(0, Math.min(1, Math.round((s[k] + d) * 10) / 10));
      audio.setVolumes(s.musicVol, s.sfxVol);
      if (k === 'sfxVol') audio.play('collect');
    };
    this.menu = new Menu([
      { label: 'MUSIC VOLUME', value: () => '■'.repeat(Math.round(s.musicVol * 10)).padEnd(10, '□'), left: () => vol('musicVol', -0.1), right: () => vol('musicVol', 0.1) },
      { label: 'SFX VOLUME', value: () => '■'.repeat(Math.round(s.sfxVol * 10)).padEnd(10, '□'), left: () => vol('sfxVol', -0.1), right: () => vol('sfxVol', 0.1) },
      { label: 'AUTO-FIRE', hint: 'Fire constantly without holding Z.', value: () => onOff(s.autofire), left: () => (s.autofire = !s.autofire), right: () => (s.autofire = !s.autofire) },
      { label: 'SCREEN SHAKE', value: () => onOff(s.shake), left: () => (s.shake = !s.shake), right: () => (s.shake = !s.shake) },
      { label: 'CRT EFFECTS', hint: 'Scanlines and vignette.', value: () => onOff(s.crt), left: () => (s.crt = !s.crt), right: () => (s.crt = !s.crt) },
      { label: 'ALWAYS SHOW HITBOX', hint: 'Show your hitbox even when not focusing.', value: () => onOff(s.alwaysHitbox), left: () => (s.alwaysHitbox = !s.alwaysHitbox), right: () => (s.alwaysHitbox = !s.alwaysHitbox) },
      {
        label: 'FULLSCREEN',
        value: () => (document.fullscreenElement ? 'ON' : 'OFF'),
        select: () => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen?.().catch(() => {});
        },
      },
      { label: 'RESET SAVE DATA', hint: 'Erase scores, unlocks and exception history.', select: () => (this.confirmReset = true), color: '#ff3b5c' },
      {
        label: 'BACK',
        select: () => {
          persist();
          app.set(new TitleScene());
        },
      },
    ]);
    this.menu.onBack = () => {
      persist();
      app.set(new TitleScene());
    };
  }
  update() {
    attract.update();
    if (this.confirmReset) {
      if (input.pressed('confirm')) {
        save.scores = {};
        save.spells = {};
        save.seenSpells = [];
        save.unlocked = 0;
        save.clears = 0;
        persist();
        audio.play('explodeM');
        this.confirmReset = false;
      } else if (input.pressed('back')) this.confirmReset = false;
      return;
    }
    this.menu.update();
  }
  draw() {
    backdrop(0.75);
    header('OPTIONS', 'vim ~/.kernelpanicrc');
    panelRect(W / 2 - 330, 150, 660, 430, '#1b2540', 'rgba(3,6,14,0.8)');
    const hint = this.menu.draw(W / 2 - 320, 194, { w: 640, gap: 44, size: 17 });
    text(hint, W / 2, 612, { size: 12, color: '#9fb0d0', align: 'center' });
    if (this.confirmReset) {
      base();
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, W, H);
      text('rm -rf ~/.kernel-panic/save ?', W / 2, 320, { size: 22, weight: 800, color: '#ff3b5c', align: 'center' });
      text('[Z] confirm      [X] cancel', W / 2, 370, { size: 14, color: '#cfe3ff', align: 'center' });
    }
    footer(confirmHint());
    post(0, app.fade);
  }
}

// ------------------------------------------------------------------ high scores

export class ScoresScene implements Scene {
  cursor = true;
  private d = save.settings.lastDiff;
  update() {
    attract.update();
    if (input.repeat('left')) {
      this.d = (this.d + 3) % 4;
      audio.play('menuMove');
    }
    if (input.repeat('right')) {
      this.d = (this.d + 1) % 4;
      audio.play('menuMove');
    }
    for (const tp of input.taps) this.d = tp.x < W / 2 ? (this.d + 3) % 4 : (this.d + 1) % 4;
    if (input.pressed('back') || input.pressed('confirm')) {
      audio.play('menuBack');
      app.set(new TitleScene());
    }
  }
  draw() {
    backdrop(0.78);
    const d = DIFFS[this.d];
    header('HIGH SCORES', 'git log --oneline --author=you');
    text(`◀   ${d.name}   ▶`, W / 2, 150, { size: 22, weight: 900, display: true, color: d.color, align: 'center', glow: d.color, glowBlur: 12 });
    panelRect(W / 2 - 420, 180, 840, 450, '#1b2540', 'rgba(3,6,14,0.82)');
    const list = topScores(d.id);
    const cols = [W / 2 - 390, W / 2 - 330, W / 2 - 140, W / 2 + 60, W / 2 + 230];
    ['#', 'NAME', 'SCORE', 'BUILD', 'REACHED'].forEach((h, i) => text(h, cols[i], 214, { size: 11, color: '#6a7ca8', weight: 700, spacing: 2 }));
    for (let i = 0; i < 10; i++) {
      const e = list[i];
      const y = 250 + i * 36;
      const c = i === 0 ? '#ffe14d' : i < 3 ? '#ffffff' : '#9fb0d0';
      text(String(i + 1).padStart(2, '0'), cols[0], y, { size: 15, color: '#445577', weight: 700 });
      if (!e) {
        text('--------', cols[1], y, { size: 15, color: '#2a3550' });
        continue;
      }
      text(e.name, cols[1], y, { size: 16, color: c, weight: 800 });
      text(formatScore(e.score), cols[2], y, { size: 16, color: c, weight: 800 });
      text(e.ship, cols[3], y, { size: 13, color: SHIPS.find((s) => s.file === e.ship)?.color ?? '#9fb0d0' });
      text(e.cleared ? 'ALL CLEAR ★' : e.stage, cols[4], y, { size: 13, color: e.cleared ? '#39ff88' : '#9fb0d0' });
    }
    footer('←→ switch environment   ·   [X] back');
    post(0, app.fade);
  }
}

// ------------------------------------------------------------------ manual

interface Page {
  title: string;
  draw: (x: number, y: number, t: number) => void;
}

function para(lines: string[], x: number, y: number, size = 14, color = '#cfe3ff', lh = 24) {
  lines.forEach((l, i) => {
    const hl = l.startsWith('#');
    text(hl ? l.slice(1) : l, x, y + i * lh, { size: hl ? size + 1 : size, color: hl ? '#00f0ff' : color, weight: hl ? 800 : 400 });
  });
}

export class ManualScene implements Scene {
  cursor = true;
  private page = 0;
  private t = 0;
  private pages: Page[] = [
    {
      title: 'CONTROLS',
      draw: (x, y) => {
        const rows: [string, string, string][] = [
          ['Move', 'Arrows / WASD', 'D-pad / stick'],
          ['Shoot (hold)', 'Z  or  J  or  Space', 'A'],
          ['Focus — slow + precise', 'Shift  or  K', 'LB / RB'],
          ['Bomb  (sudo rm -rf)', 'X  or  L', 'B'],
          ['Overclock', 'C  or  ;', 'X / Y'],
          ['Pause', 'Esc  or  P', 'Start'],
        ];
        text('ACTION', x, y, { size: 11, color: '#6a7ca8', weight: 700, spacing: 2 });
        text('KEYBOARD', x + 330, y, { size: 11, color: '#6a7ca8', weight: 700, spacing: 2 });
        text('GAMEPAD', x + 600, y, { size: 11, color: '#6a7ca8', weight: 700, spacing: 2 });
        rows.forEach(([a, k, p], i) => {
          text(a, x, y + 40 + i * 36, { size: 16, color: '#ffffff', weight: 700 });
          text(k, x + 330, y + 40 + i * 36, { size: 15, color: '#ffe14d' });
          text(p, x + 600, y + 40 + i * 36, { size: 15, color: '#39ff88' });
        });
        para(['Touch: drag anywhere to move (auto-fire). Tap the BOMB / OVERCLOCK pads', 'in the side panels. Tap the logo to pause.'], x, y + 290, 13, '#9fb0d0', 22);
      },
    },
    {
      title: 'THE BASICS',
      draw: (x, y, t) => {
        para(
          [
            '#You are the cursor. Only the tiny white dot at your centre can be hit.',
            'Hold FOCUS to slow down and reveal that hitbox. Most bullets that "hit"',
            'your ship graphic actually miss. Trust the dot.',
            '',
            '#Bullets flash in before they become dangerous.',
            'A glowing bloom = a new bullet spawning. It cannot hurt you yet.',
            '',
            '#Lasers draw a thin warning line first. Get off the line.',
            '',
            '#Bombs (sudo) clear the screen and make you invulnerable.',
            'Just got hit? You have a split second to bomb and survive — a DEATHBOMB.',
            'You get at least 3 sudo tokens back every time you lose a process.',
          ],
          x,
          y,
        );
        ctx.save();
        ctx.translate(x + 780, y + 60);
        cursorPath(ctx, 2.5);
        ctx.fillStyle = '#060912';
        ctx.fill();
        ctx.strokeStyle = '#ffe14d';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.fillStyle = '#ff2a4a';
        ctx.beginPath();
        ctx.arc(0, 0, 6, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 3.6, 0, TAU);
        ctx.fill();
        ctx.restore();
        text('← hitbox', x + 800, y + 64, { size: 12, color: '#ff5a74' });
      },
    },
    {
      title: 'GRAZE → CACHE → OVERCLOCK',
      draw: (x, y) => {
        para(
          [
            '#Graze: let bullets brush past you without touching the dot.',
            'Every graze scores points and fills your CACHE meter.',
            '',
            '#Overclock [C]: with at least 35% cache, overclock the CPU.',
            'The whole world slows to 42% speed — but YOU stay full speed,',
            'and your shots hit 35% harder.',
            '',
            '#Kill an enemy while overclocked and every bullet IT fired',
            'turns into a gold $ bit that flies to you. The more you convert',
            'in one overclock, the more each gold bit is worth (up to ×10).',
            '',
            'Danger feeds cache. Cache buys time. Time turns danger into gold.',
          ],
          x,
          y,
        );
      },
    },
    {
      title: 'SCORING',
      draw: (x, y) => {
        para(
          [
            '#STREAK — kill enemies in quick succession. Each kill adds 1;',
            'the streak drains if you stop hitting things. Multiplier up to ×5.',
            '',
            '#BITS — blue diamonds. Worth more the more you have grazed.',
            'Fly above the AUTO-COLLECT LINE to vacuum up everything at full value.',
            '',
            '#EXCEPTIONS — named boss attacks. Defeat one without dying or',
            'bombing to CATCH it for a large bonus that shrinks as time passes.',
            '',
            '#EXTENDS at 3M, 10M, 25M and 50M points, plus 1UP drops.',
            'BUILD version (power) goes v1.00 → v5.00. Each full version adds a',
            'thread (option) that fires with you. Dying costs one version.',
          ],
          x,
          y,
        );
      },
    },
    {
      title: 'ITEMS',
      draw: (x, y) => {
        const items: [Parameters<typeof itemSprite>[0], string][] = [
          ['power', 'Patch: +0.02 version'],
          ['bigpower', 'Release: +0.20 version'],
          ['bit', 'Bit: points (value rises with graze)'],
          ['cancel', 'Cancelled bullet: small points, flies to you'],
          ['gold', 'Gold bit: overclock conversion, big points'],
          ['bomb', 'Sudo token: +1 bomb'],
          ['life', '1UP: +1 process (life)'],
          ['full', 'MAX: instant v5.00'],
        ];
        items.forEach(([k, d], i) => {
          const spr = itemSprite(k);
          const w = spr.width / SS;
          ctx.drawImage(spr, x + 10 - w / 2 + 12, y + i * 40 - w / 2 - 4, w, w);
          text(d, x + 60, y + i * 40, { size: 15, color: '#cfe3ff' });
        });
      },
    },
    {
      title: 'TIPS FROM THE ON-CALL ENGINEER',
      draw: (x, y) => {
        para(
          [
            '• Look at the bullets, not your ship. Your eyes find the gaps.',
            '• Small taps with FOCUS beat big panicked swerves.',
            '• Aimed bullets follow you: move a little, then a little more (streaming).',
            '• Bosses flash their attack name first. Catch it = big bonus.',
            '• Sit above the collection line when it is safe for massive bit value.',
            '• Save overclock for dense screens full of shooters: that is where gold is.',
            '• Bomb early rather than never. A bomb in stock when you die is wasted.',
            '• Practice mode lets you drill any exception you have met. Use it.',
            '',
            '             "It works on my machine." — every boss in this game',
          ],
          x,
          y,
          14,
          '#cfe3ff',
          28,
        );
      },
    },
  ];
  update() {
    this.t++;
    attract.update();
    const n = this.pages.length;
    if (input.repeat('right') || input.pressed('confirm')) {
      if (this.page === n - 1 && input.pressed('confirm')) {
        app.set(new TitleScene());
        return;
      }
      this.page = Math.min(n - 1, this.page + 1);
      audio.play('menuMove');
    }
    if (input.repeat('left')) {
      this.page = Math.max(0, this.page - 1);
      audio.play('menuMove');
    }
    for (const tp of input.taps) this.page = tp.x < W / 2 ? Math.max(0, this.page - 1) : Math.min(n - 1, this.page + 1);
    if (input.pressed('back')) {
      audio.play('menuBack');
      app.set(new TitleScene());
    }
  }
  draw() {
    backdrop(0.82);
    const p = this.pages[this.page];
    header('HOW TO PLAY', `man kernel-panic  (${this.page + 1}/${this.pages.length})`);
    panelRect(W / 2 - 520, 140, 1040, 500, '#1b2540', 'rgba(3,6,14,0.85)');
    text(p.title, W / 2 - 490, 184, { size: 22, weight: 900, display: true, color: '#ff7ae6', glow: '#ff2bd6', glowBlur: 10 });
    p.draw(W / 2 - 490, 236, this.t);
    for (let i = 0; i < this.pages.length; i++) {
      ctx.fillStyle = i === this.page ? '#00f0ff' : '#2a3550';
      ctx.fillRect(W / 2 - this.pages.length * 12 + i * 24, 662, 16, 4);
    }
    footer('←→ turn page   ·   [X] back');
    post(0, app.fade);
  }
}
