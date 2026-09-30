import { audio } from '../audio/engine';
import { H, W } from '../config';
import { input } from '../core/input';
import { base, ctx, view } from '../render/canvas';
import { glitchText, text } from '../render/draw';
import { post } from '../render/post';
import { TitleScene } from './menus';
import { app, type Scene } from './scene';

const LINES = [
  'KPBIOS (C) 1970-2038  Kernel//Panic Systems Inc.',
  'CPU: Danmaku Core i9-0xDEAD @ 6.66GHz  x 64 threads',
  'Memory Test: 67108864K OK',
  '',
  'Detecting primary master ... /dev/stack',
  'Detecting primary slave  ... /dev/heap',
  '',
  '[  OK  ] Mounted /localhost',
  '[  OK  ] Started Network Manager (World Wide Web)',
  '[ WARN ] Heap usage at 99.7% and climbing',
  '[ WARN ] Two threads writing to the same address',
  '[FAILED] Failed to start kernel.service',
  '[FAILED] Infinite loop detected in pid 1',
  '',
  '*** KERNEL PANIC: not syncing: attempted to kill init! ***',
  '',
  'Loading debugger: cursor.ko ... done',
  'Attaching to ring 3 ... done',
];

export class BootScene implements Scene {
  cursor = true;
  private t = 0;
  private done = false;
  update() {
    this.t++;
    const shown = Math.floor(this.t / 5);
    if (shown >= LINES.length) this.done = true;
    if (input.anyPressed || input.taps.length) {
      if (!this.done) {
        this.t = LINES.length * 5;
        this.done = true;
        input.resetEdges();
        return;
      }
      audio.init();
      audio.play('boot');
      app.set(new TitleScene());
    }
  }
  draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, view.cw, view.ch);
    base();
    ctx.fillStyle = '#020308';
    ctx.fillRect(0, 0, W, H);
    const shown = Math.min(LINES.length, Math.floor(this.t / 5));
    for (let i = 0; i < shown; i++) {
      const l = LINES[i];
      const col = l.includes('FAILED') || l.includes('PANIC') ? '#ff3b5c' : l.includes('WARN') ? '#ffb84d' : l.includes('OK') ? '#39ff88' : '#b8c6e0';
      text(l, 60, 60 + i * 24, { size: 15, color: col, weight: l.includes('PANIC') ? 800 : 400 });
    }
    if (this.done) {
      glitchText('KERNEL//PANIC', W / 2, H - 150, 56, this.t, 1.2);
      if (Math.floor(this.t / 30) % 2 === 0)
        text(input.lastDevice === 'touch' ? 'TAP TO BOOT' : 'PRESS ANY KEY TO BOOT', W / 2, H - 80, { size: 16, weight: 800, color: '#00f0ff', align: 'center', spacing: 4 });
      text('best with headphones · keyboard or gamepad', W / 2, H - 44, { size: 11, color: '#445577', align: 'center' });
    } else if (Math.floor(this.t / 10) % 2 === 0) {
      text('█', 60, 60 + shown * 24, { size: 15, color: '#b8c6e0' });
    }
    post(this.done ? (Math.random() < 0.03 ? 6 : 0) : 0, app.fade);
  }
}
