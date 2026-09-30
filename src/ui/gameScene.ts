import { audio } from '../audio/engine';
import { music } from '../audio/music';
import { PF_H, PF_W, PF_X, PF_Y } from '../config';
import { input } from '../core/input';
import { lerp } from '../core/math';
import { save } from '../core/save';
import { drawLasers } from '../game/bullets';
import { Game, type GameOpts } from '../game/game';
import { drawSpellBackdrop } from '../render/backgrounds';
import { base, ctx, view } from '../render/canvas';
import { glitchText, text } from '../render/draw';
import { post } from '../render/post';
import { glowSprite } from '../render/sprites';
import { drawPanels, drawPlayfieldOverlays } from './hud';
import { app, Menu, type Scene } from './scene';

export function drawGame(g: Game, alpha: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, view.cw, view.ch);
  drawPanels(g);

  const sx = g.shakeAmt ? (Math.random() - 0.5) * g.shakeAmt * 2 : 0;
  const sy = g.shakeAmt ? (Math.random() - 0.5) * g.shakeAmt * 2 : 0;
  const oox = view.ox;
  const ooy = view.oy;
  view.ox += sx * view.k;
  view.oy += sy * view.k;

  ctx.save();
  base();
  ctx.beginPath();
  ctx.rect(PF_X - Math.abs(sx), PF_Y, PF_W + Math.abs(sx) * 2, PF_H);
  ctx.clip();
  const k = view.k;
  const ox = view.ox + PF_X * k;
  const oy = view.oy + PF_Y * k;
  const t = g.realFrame;

  ctx.setTransform(k, 0, 0, k, ox, oy);
  g.bg.draw(ctx, t);
  const tint = g.boss?.inSpell ? g.boss.phase?.bgTint : undefined;
  if (tint) {
    ctx.globalAlpha = 0.9 * g.spellBgT;
    ctx.fillStyle = tint;
    ctx.fillRect(0, 0, PF_W, PF_H);
    ctx.globalAlpha = 1;
  }
  if (g.spellBgT > 0 && g.boss) {
    ctx.setTransform(k, 0, 0, k, ox, oy);
    drawSpellBackdrop(ctx, g.spellBgT, t, g.boss.phase?.name ?? '', g.boss.def.color, g.boss.x, g.boss.y);
  }

  g.items.draw(alpha);

  for (const e of g.enemies) {
    if (!e.alive) continue;
    const x = lerp(e.px, e.x, alpha);
    const y = lerp(e.py, e.y, alpha);
    const s = e.scale;
    ctx.setTransform(k * s, 0, 0, k * s, ox + x * k, oy + y * k);
    if (e.isBoss && 'def' in e) (e as unknown as { def: { draw: Function } }).def.draw(e, g, ctx, t);
    else e.kind.draw(e, g, ctx, t);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.setLineDash([]);
    if (e.flash > 0) {
      ctx.setTransform(k, 0, 0, k, ox + x * k, oy + y * k);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.35;
      ctx.drawImage(glowSprite('#ffffff', 32), -e.r * 1.3, -e.r * 1.3, e.r * 2.6, e.r * 2.6);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  g.shots.draw(alpha, '#39ff88');
  g.player.draw(g, alpha);
  g.fx.draw();
  drawLasers(g.lasers, t);
  g.bullets.draw(alpha, g.overclock);
  g.player.drawHitbox(g, alpha, save.settings.alwaysHitbox);
  drawPlayfieldOverlays(g, alpha);
  ctx.restore();
  view.ox = oox;
  view.oy = ooy;
}

export class GameScene implements Scene {
  g: Game;
  paused = false;
  private menu: Menu;
  private confirm: Menu | null = null;
  private pauseT = 0;

  constructor(public opts: GameOpts) {
    this.g = this.makeGame();
    this.menu = new Menu([
      { label: 'RESUME', select: () => this.resume() },
      { label: 'RESTART', select: () => this.ask('RESTART', () => this.restart()) },
      {
        label: 'MUSIC',
        value: () => `${Math.round(save.settings.musicVol * 10)}`,
        left: () => this.vol('musicVol', -0.1),
        right: () => this.vol('musicVol', 0.1),
      },
      {
        label: 'SFX',
        value: () => `${Math.round(save.settings.sfxVol * 10)}`,
        left: () => this.vol('sfxVol', -0.1),
        right: () => this.vol('sfxVol', 0.1),
      },
      { label: 'QUIT', select: () => this.ask('QUIT', () => this.quit()) },
    ]);
    this.menu.onBack = () => this.resume();
  }

  private makeGame(): Game {
    const g = new Game(this.opts);
    g.onExit = (r) => {
      void import('./results').then((m) => app.set(new m.ResultScene(r)));
    };
    g.onEnding = (r) => {
      void import('./results').then((m) => app.set(new m.EndingScene(r)));
    };
    return g;
  }

  private vol(key: 'musicVol' | 'sfxVol', d: number) {
    save.settings[key] = Math.max(0, Math.min(1, Math.round((save.settings[key] + d) * 10) / 10));
    audio.setVolumes(save.settings.musicVol, save.settings.sfxVol);
  }

  private ask(what: string, yes: () => void) {
    this.confirm = new Menu([
      { label: `YES, ${what}`, select: yes },
      { label: 'NO', select: () => (this.confirm = null) },
    ]);
    this.confirm.idx = 1;
    this.confirm.onBack = () => (this.confirm = null);
  }

  pause() {
    if (this.paused || this.g.state !== 'play') return;
    this.paused = true;
    this.pauseT = 0;
    this.menu.idx = 0;
    audio.play('pause');
    audio.setMusicFilter(500);
    input.resetEdges();
  }

  private resume() {
    this.paused = false;
    this.confirm = null;
    audio.setMusicFilter(this.g.overclock ? 1300 : 20000);
    input.resetEdges();
  }

  private restart() {
    this.paused = false;
    this.confirm = null;
    audio.setMusicFilter(20000);
    music.setTempo(1);
    this.g = this.makeGame();
  }

  private quit() {
    this.paused = false;
    audio.setMusicFilter(20000);
    music.setTempo(1);
    this.g.finish(false, true);
  }

  leave() {
    audio.setMusicFilter(20000);
    music.setTempo(1);
  }

  update() {
    if (this.paused) {
      this.pauseT++;
      if (this.confirm) this.confirm.update();
      else {
        if (input.pressed('pause') && this.pauseT > 2) {
          this.resume();
          return;
        }
        this.menu.update();
      }
      return;
    }
    if (input.pressed('pause') && this.g.state === 'play') {
      this.pause();
      return;
    }
    // tap the top-left logo area to pause on touch devices
    for (const tp of input.taps) if (tp.x < PF_X && tp.y < 90) this.pause();
    this.g.update();
  }

  draw(alpha: number) {
    drawGame(this.g, this.paused ? 1 : alpha);
    if (this.paused) this.drawPause();
    post(this.g.glitch, app.fade);
  }

  private drawPause() {
    base();
    const x = PF_X;
    ctx.fillStyle = 'rgba(2,4,12,0.78)';
    ctx.fillRect(x, 0, PF_W, PF_H);
    glitchText('SIGSTOP', x + PF_W / 2, 200, 44, this.pauseT, 0.5);
    text('process suspended — send SIGCONT to resume', x + PF_W / 2, 238, { size: 11, color: '#8aa0cc', align: 'center' });
    if (this.confirm) {
      text('Are you sure? Progress in this run will be lost.', x + PF_W / 2, 330, { size: 12, color: '#ffb84d', align: 'center' });
      this.confirm.draw(x + PF_W / 2, 390, { w: 300, align: 'center', gap: 44 });
    } else {
      this.menu.draw(x + 120, 310, { w: 360, gap: 44 });
    }
  }
}
