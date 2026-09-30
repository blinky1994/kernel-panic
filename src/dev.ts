/**
 * Development-only helpers for automated play-testing from the browser console.
 * Never included in production builds (imported behind import.meta.env.DEV).
 *
 *   __kp.sim(opts, frames)       run a headless, invulnerable bot through a game
 *   __kp.shot(opts, frames)      fast-forward, then freeze the frame for a screenshot
 */
import { input } from './core/input';
import type { Game, GameOpts } from './game/game';
import { GameScene } from './ui/gameScene';
import { app } from './ui/scene';

function key(type: 'keydown' | 'keyup', code: string) {
  window.dispatchEvent(new KeyboardEvent(type, { code, key: code }));
}

function start(opts: GameOpts): { sc: GameScene; g: Game } {
  app.set(new GameScene(opts), true);
  app.fade = 0;
  const sc = app.scene as GameScene;
  return { sc, g: sc.g };
}

/** Headless run with a simple bot: follows targets, focuses on bosses, collects items. */
export function sim(opts: GameOpts, maxFrames = 60 * 60 * 25) {
  const { sc, g } = start(opts);
  key('keydown', 'KeyZ');
  const phases: string[] = [];
  let last: string | null = null;
  let t0 = 0;
  let limit = 0;
  let focused = false;
  let i = 0;
  let err: string | null = null;
  try {
    for (; i < maxFrames; i++) {
      sc.paused = false;
      g.player.invuln = 99999;
      const p = g.player;
      const boss = g.boss && g.boss.alive ? g.boss : null;
      if (!!boss !== focused) {
        key(boss ? 'keydown' : 'keyup', 'ShiftLeft');
        focused = !!boss;
      }
      const tgt = boss ?? g.nearestEnemy(p.x, p.y);
      const tx = tgt ? tgt.x : p.x;
      const ty = !boss && i % 600 < 50 ? 150 : 560;
      const sp = focused ? 2.6 : 6;
      p.x += Math.max(-sp, Math.min(sp, tx - p.x));
      p.y += Math.max(-sp, Math.min(sp, ty - p.y));
      input.update();
      app.update();
      if (g.dlg) g.dlg.done = true;
      const ph = g.boss ? `${g.boss.def.id}:${g.boss.phaseIdx}` : null;
      if (ph !== last) {
        if (last) phases.push(`${last} ${((i - t0) / 60).toFixed(0)}/${limit}`);
        last = ph;
        t0 = i;
      }
      if (g.boss?.phase) limit = g.boss.phase.time;
      if (g.state === 'done' || app.scene !== sc) break;
    }
  } catch (e) {
    err = (e as Error).stack ?? String(e);
  }
  key('keyup', 'ShiftLeft');
  key('keyup', 'KeyZ');
  return { minutes: (i / 3600).toFixed(1), phases: phases.join('  '), score: g.score, err };
}

/** Fast-forward `frames` (player invulnerable), then freeze the simulation for inspection. */
export function shot(opts: GameOpts, frames: number, shoot = false) {
  const { sc, g } = start(opts);
  key(shoot ? 'keydown' : 'keyup', 'KeyZ');
  key('keyup', 'ShiftLeft');
  for (let i = 0; i < frames; i++) {
    sc.paused = false;
    g.player.invuln = 1e9;
    g.player.x += Math.sin(i * 0.02) * 2;
    input.update();
    app.update();
    if (g.dlg && i < frames - 30) g.dlg.done = true;
  }
  g.player.invuln = 0;
  g.update = function (this: Game) {
    this.realFrame++;
  };
  return `bullets=${g.bullets.count} enemies=${g.enemies.length} boss=${g.boss ? `${g.boss.def.id}:${g.boss.phaseIdx}` : '-'}`;
}
