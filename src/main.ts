import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-800.css';
import '@fontsource/orbitron/latin-700.css';
import '@fontsource/orbitron/latin-900.css';

import { audio } from './audio/engine';
import { music } from './audio/music';
import { FPS } from './config';
import { input } from './core/input';
import { save } from './core/save';
import { canvas, resize, toLogical } from './render/canvas';
import { prewarmBullets } from './render/sprites';
import { BootScene } from './ui/boot';
import { GameScene } from './ui/gameScene';
import { app } from './ui/scene';

async function loadFonts() {
  const fonts = ['400 16px "JetBrains Mono"', '700 16px "JetBrains Mono"', '800 16px "JetBrains Mono"', '700 16px Orbitron', '900 16px Orbitron'];
  const timeout = new Promise((r) => setTimeout(r, 2500));
  try {
    await Promise.race([Promise.all(fonts.map((f) => document.fonts.load(f))), timeout]);
  } catch {
    /* fall back to system monospace */
  }
}

async function main() {
  resize();
  window.addEventListener('resize', resize);
  input.toLogical = toLogical;
  input.attach(canvas);
  input.onFirstGesture = () => {
    audio.init();
    audio.setVolumes(save.settings.musicVol, save.settings.sfxVol);
    music.kick();
  };
  canvas.focus();

  await loadFonts();
  prewarmBullets();

  app.set(new BootScene(), true);

  const testMode = import.meta.env.DEV && new URLSearchParams(location.search).has('test');
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && !testMode && app.scene instanceof GameScene) app.scene.pause();
  });

  const STEP = 1000 / FPS;
  let last = performance.now();
  let acc = 0;
  let vw = 0;
  let vh = 0;
  let vdpr = 0;
  const frame = (now: number) => {
    // catch viewport / DPI changes that don't fire a resize event
    if (window.innerWidth !== vw || window.innerHeight !== vh || window.devicePixelRatio !== vdpr) {
      vw = window.innerWidth;
      vh = window.innerHeight;
      vdpr = window.devicePixelRatio;
      resize();
    }
    let dt = now - last;
    last = now;
    if (dt > 250) dt = STEP; // tab was asleep
    acc += dt;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      input.update();
      app.update();
      acc -= STEP;
      steps++;
    }
    if (steps === 5) acc = 0;
    canvas.classList.toggle('show-cursor', !!app.scene?.cursor && input.lastDevice === 'mouse');
    app.draw(acc / STEP);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);

  // debug handle for development & automated play-testing
  if (import.meta.env.DEV) {
    const dev = await import('./dev');
    (window as unknown as { __kp: unknown }).__kp = { app, input, audio, music, save, ...dev };
  }
}

void main();
