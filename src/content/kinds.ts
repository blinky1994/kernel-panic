import { FONT_MONO } from '../config';
import { TAU } from '../core/math';
import type { Enemy, EnemyKind } from '../game/enemy';
import type { Game } from '../game/game';
import { glowSprite } from '../render/sprites';

type C = CanvasRenderingContext2D;

export function halo(c: C, color: string, r: number, a = 0.5) {
  c.globalCompositeOperation = 'lighter';
  c.globalAlpha = a;
  c.drawImage(glowSprite(color, 32), -r, -r, r * 2, r * 2);
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
}

export const fc = (e: Enemy, col: string) => (e.flash > 0 ? '#ffffff' : col);

function label(c: C, s: string, size: number, color: string, y = 0, weight = 800) {
  c.font = `${weight} ${size}px ${FONT_MONO}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(s, 0, y);
}

function eyes(c: C, e: Enemy, g: Game, y: number, spread: number, r: number, col = '#ff2a4a') {
  const a = Math.atan2(g.player.y - e.y, g.player.x - e.x);
  for (const sx of [-spread, spread]) {
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(sx, y, r, 0, TAU);
    c.fill();
    c.fillStyle = fc(e, col);
    c.beginPath();
    c.arc(sx + Math.cos(a) * r * 0.4, y + Math.sin(a) * r * 0.4, r * 0.55, 0, TAU);
    c.fill();
  }
}

// ---------------------------------------------------------------- kinds

export const bug: EnemyKind = {
  id: 'bug',
  hp: 7,
  r: 13,
  score: 200,
  color: '#39ff88',
  drops: { power: 1 },
  draw(e, g, c, t) {
    halo(c, '#00ff66', 22, 0.35);
    c.rotate(Math.atan2(e.vy || 1, e.vx || 0) - Math.PI / 2 + (e.tween ? 0 : 0));
    const leg = Math.sin(t * 0.5 + e.id) * 2.5;
    c.strokeStyle = fc(e, '#1dd36a');
    c.lineWidth = 1.6;
    c.beginPath();
    for (const s of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        const l = i === 0 ? leg : -leg;
        c.moveTo(s * 5, i * 5);
        c.lineTo(s * 12, i * 6 + l);
        c.lineTo(s * 14, i * 8 + 3 + l);
      }
      c.moveTo(s * 2, 9);
      c.quadraticCurveTo(s * 6, 16, s * 8, 17 + leg * 0.5);
    }
    c.stroke();
    c.fillStyle = '#04140a';
    c.beginPath();
    c.ellipse(0, -2, 8, 10, 0, 0, TAU);
    c.fill();
    c.strokeStyle = fc(e, '#39ff88');
    c.lineWidth = 2;
    c.stroke();
    c.beginPath();
    c.moveTo(0, -12);
    c.lineTo(0, 8);
    c.stroke();
    c.fillStyle = fc(e, '#39ff88');
    c.beginPath();
    c.arc(0, 9, 5, 0, TAU);
    c.fill();
    c.fillStyle = '#ff2a4a';
    c.fillRect(-3, 9, 2, 2);
    c.fillRect(1, 9, 2, 2);
  },
};

export const moth: EnemyKind = {
  id: 'moth',
  hp: 5,
  r: 13,
  score: 160,
  color: '#ffb84d',
  drops: { power: 1 },
  draw(e, g, c, t) {
    halo(c, '#ff9a3c', 24, 0.3);
    const flap = 0.55 + 0.45 * Math.abs(Math.sin(t * 0.35 + e.id));
    for (const s of [-1, 1]) {
      c.save();
      c.scale(s * flap, 1);
      c.fillStyle = 'rgba(40,20,5,0.9)';
      c.strokeStyle = fc(e, '#ffb84d');
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(1, -3);
      c.quadraticCurveTo(14, -16, 20, -6);
      c.quadraticCurveTo(18, 2, 2, 2);
      c.moveTo(1, 2);
      c.quadraticCurveTo(14, 4, 13, 13);
      c.quadraticCurveTo(6, 14, 1, 5);
      c.fill();
      c.stroke();
      c.fillStyle = fc(e, '#ff5a3c');
      c.beginPath();
      c.arc(11, -5, 2.6, 0, TAU);
      c.fill();
      c.restore();
    }
    c.fillStyle = fc(e, '#ffd9a0');
    c.beginPath();
    c.ellipse(0, 1, 2.6, 8, 0, 0, TAU);
    c.fill();
    c.strokeStyle = '#ffd9a0';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(-1, -6);
    c.lineTo(-5, -12);
    c.moveTo(1, -6);
    c.lineTo(5, -12);
    c.stroke();
  },
};

export const drone404: EnemyKind = {
  id: 'drone404',
  hp: 26,
  r: 17,
  score: 700,
  color: '#00f0ff',
  drops: { power: 2, bits: 1 },
  draw(e, g, c, t) {
    halo(c, '#00e5ff', 30, 0.35);
    c.strokeStyle = fc(e, '#00f0ff');
    c.lineWidth = 1.5;
    const sp = t * 0.6;
    for (const [x, y] of [
      [-15, -15],
      [15, -15],
      [-15, 15],
      [15, 15],
    ]) {
      c.beginPath();
      c.moveTo(x - Math.cos(sp) * 7, y - Math.sin(sp) * 2);
      c.lineTo(x + Math.cos(sp) * 7, y + Math.sin(sp) * 2);
      c.stroke();
    }
    c.fillStyle = '#021418';
    c.beginPath();
    c.roundRect(-14, -12, 28, 24, 5);
    c.fill();
    c.lineWidth = 2;
    c.stroke();
    label(c, '404', 11, fc(e, '#bff9ff'));
  },
};

export const nan: EnemyKind = {
  id: 'nan',
  hp: 14,
  r: 15,
  score: 400,
  color: '#ff9a3c',
  drops: { power: 1, bits: 1 },
  draw(e, g, c, t) {
    halo(c, '#ff6a00', 26, 0.35);
    const w = 1 + Math.sin(t * 0.2 + e.id) * 0.08;
    c.scale(w, 2 - w);
    c.fillStyle = '#1a0c00';
    c.beginPath();
    c.arc(0, 0, 14, 0, TAU);
    c.fill();
    c.strokeStyle = fc(e, '#ff9a3c');
    c.lineWidth = 2;
    c.setLineDash([4, 3]);
    c.lineDashOffset = t * 0.5;
    c.stroke();
    c.setLineDash([]);
    label(c, 'NaN', 10, fc(e, '#ffd2a0'));
  },
};

export const spinner: EnemyKind = {
  id: 'spinner',
  hp: 12,
  r: 14,
  score: 350,
  color: '#a970ff',
  drops: { power: 1 },
  draw(e, g, c, t) {
    halo(c, '#8a3dff', 24, 0.35);
    c.fillStyle = '#0c0616';
    c.beginPath();
    c.arc(0, 0, 13, 0, TAU);
    c.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + t * 0.15;
      c.globalAlpha = 0.25 + ((i + Math.floor(t * 0.3)) % 8) / 10;
      c.fillStyle = fc(e, '#c9a8ff');
      c.beginPath();
      c.arc(Math.cos(a) * 9, Math.sin(a) * 9, 2.4, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  },
};

export const popup: EnemyKind = {
  id: 'popup',
  hp: 55,
  r: 22,
  score: 1500,
  color: '#ff2bd6',
  drops: { power: 3, bits: 2 },
  explode: 'M',
  draw(e, g, c, t) {
    halo(c, '#ff00cc', 38, 0.3);
    c.fillStyle = '#12051a';
    c.fillRect(-24, -17, 48, 34);
    c.fillStyle = fc(e, '#ff2bd6');
    c.fillRect(-24, -17, 48, 8);
    c.strokeStyle = fc(e, '#ff7ae6');
    c.lineWidth = 1.5;
    c.strokeRect(-24, -17, 48, 34);
    c.fillStyle = '#fff';
    c.font = `800 7px ${FONT_MONO}`;
    c.textAlign = 'right';
    c.textBaseline = 'middle';
    c.fillText('✕', 21, -13);
    const blink = Math.floor(t / 12) % 2 === 0;
    label(c, blink ? 'YOU WON!' : 'CLICK ME', 7, blink ? '#ffe14d' : '#ff7ae6', 0);
    c.fillStyle = fc(e, '#39ff88');
    c.fillRect(-12, 8, 24, 5);
    label(c, 'OK', 5, '#000', 10.5);
  },
};

export const cookie: EnemyKind = {
  id: 'cookie',
  hp: 16,
  r: 13,
  score: 450,
  color: '#e8b36a',
  drops: { power: 1, bits: 1 },
  draw(e, g, c, t) {
    halo(c, '#ffae00', 22, 0.25);
    c.rotate(t * 0.03);
    c.fillStyle = fc(e, '#c98a3e');
    c.beginPath();
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * TAU;
      const r = 13 + (i % 2 ? -1 : 0.5);
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.fillStyle = '#3a1d05';
    for (const [x, y] of [
      [-6, -5],
      [5, -7],
      [7, 4],
      [-4, 6],
      [0, 0],
    ])
      c.fillRect(x - 1.5, y - 1.5, 3, 3);
    c.rotate(-t * 0.03);
    eyes(c, e, g, -1, 4, 2.6, '#ff2a4a');
  },
};

export const crawler: EnemyKind = {
  id: 'crawler',
  hp: 34,
  r: 16,
  score: 900,
  color: '#b77bff',
  drops: { power: 2, bits: 1 },
  draw(e, g, c, t) {
    if (e.data.thread) {
      c.strokeStyle = 'rgba(200,170,255,0.45)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, -e.y - 10);
      c.lineTo(0, -4);
      c.stroke();
    }
    halo(c, '#8a3dff', 28, 0.3);
    c.strokeStyle = fc(e, '#b77bff');
    c.lineWidth = 1.6;
    c.beginPath();
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const ph = Math.sin(t * 0.4 + i * 1.3 + (s > 0 ? 1 : 0)) * 3;
        const ay = -6 + i * 4;
        c.moveTo(s * 6, ay);
        c.lineTo(s * 15, ay - 6 + ph);
        c.lineTo(s * 20, ay + 4 + ph);
      }
    }
    c.stroke();
    c.fillStyle = '#0e0518';
    c.beginPath();
    c.arc(0, 2, 9, 0, TAU);
    c.fill();
    c.stroke();
    c.beginPath();
    c.arc(0, -8, 5, 0, TAU);
    c.fill();
    c.stroke();
    c.fillStyle = '#ff2a4a';
    for (const [x, y] of [
      [-2, -9],
      [2, -9],
      [-3.5, -7],
      [3.5, -7],
    ])
      c.fillRect(x - 0.8, y - 0.8, 1.6, 1.6);
    label(c, '</>', 6, fc(e, '#e2cfff'), 3);
  },
};

export const worm: EnemyKind = {
  id: 'worm',
  hp: 10,
  r: 12,
  score: 250,
  color: '#ffb000',
  drops: { power: 1 },
  draw(e, g, c, t) {
    halo(c, '#ff9a00', 20, 0.3);
    const head = e.data.head === 1;
    c.fillStyle = '#1a0f00';
    c.beginPath();
    c.arc(0, 0, head ? 12 : 10, 0, TAU);
    c.fill();
    c.strokeStyle = fc(e, head ? '#ffd24d' : '#ffb000');
    c.lineWidth = 2;
    c.stroke();
    if (head) {
      const a = Math.atan2(e.vy || 1, e.vx || 0);
      c.rotate(a);
      c.fillStyle = fc(e, '#ffd24d');
      c.beginPath();
      c.moveTo(10, -6);
      c.lineTo(17, -3 + Math.sin(t * 0.5) * 2);
      c.lineTo(10, -1);
      c.moveTo(10, 6);
      c.lineTo(17, 3 - Math.sin(t * 0.5) * 2);
      c.lineTo(10, 1);
      c.fill();
      c.fillStyle = '#ff2a4a';
      c.fillRect(3, -5, 3, 3);
      c.fillRect(3, 2, 3, 3);
    } else {
      label(c, (e.data.seg ?? 0).toString(16).toUpperCase().padStart(2, '0'), 8, fc(e, '#ffe2a0'));
    }
  },
};

export const forkbomb: EnemyKind = {
  id: 'forkbomb',
  hp: 18,
  r: 15,
  score: 500,
  color: '#ff3b5c',
  drops: { power: 1 },
  draw(e, g, c, t) {
    const s = 1 - e.gen * 0.2;
    c.scale(s, s);
    halo(c, '#ff0033', 26, 0.35);
    c.fillStyle = '#16040a';
    c.beginPath();
    c.arc(0, 2, 13, 0, TAU);
    c.fill();
    c.strokeStyle = fc(e, '#ff3b5c');
    c.lineWidth = 2;
    c.stroke();
    c.strokeStyle = '#ffe14d';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(4, -9);
    c.quadraticCurveTo(10, -18, 14, -14);
    c.stroke();
    const sp = Math.sin(t * 0.8) > 0;
    c.fillStyle = sp ? '#fff' : '#ffe14d';
    c.beginPath();
    c.arc(14, -14, sp ? 3 : 2, 0, TAU);
    c.fill();
    label(c, ':(){}', 6, fc(e, '#ffb0bd'), 3);
  },
};

export const pointer: EnemyKind = {
  id: 'pointer',
  hp: 9,
  r: 11,
  score: 300,
  color: '#ff3b5c',
  drops: { power: 1 },
  draw(e, g, c, t) {
    halo(c, '#ff0033', 20, 0.35);
    c.rotate(e.angle);
    c.fillStyle = '#16040a';
    c.strokeStyle = fc(e, '#ff5a74');
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(15, 0);
    c.lineTo(-8, -9);
    c.lineTo(-3, 0);
    c.lineTo(-8, 9);
    c.closePath();
    c.fill();
    c.stroke();
    c.rotate(-e.angle);
    label(c, '*', 12, fc(e, '#ffd0d8'), 2);
  },
};

export const packet: EnemyKind = {
  id: 'packet',
  hp: 8,
  r: 11,
  score: 260,
  color: '#4d8dff',
  drops: { power: 1 },
  draw(e, g, c, t) {
    halo(c, '#1f5fff', 22, 0.4);
    const a = Math.atan2(e.vy, e.vx);
    c.rotate(a);
    c.strokeStyle = 'rgba(77,141,255,0.5)';
    c.lineWidth = 1;
    c.beginPath();
    for (let i = 0; i < 3; i++) {
      c.moveTo(-10 - i * 5, -4 + i * 4);
      c.lineTo(-24 - i * 6, -4 + i * 4);
    }
    c.stroke();
    c.rotate(-a);
    c.fillStyle = '#040a1c';
    c.strokeStyle = fc(e, '#7aaaff');
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, -11);
    c.lineTo(11, 0);
    c.lineTo(0, 11);
    c.lineTo(-11, 0);
    c.closePath();
    c.fill();
    c.stroke();
    label(c, 'TCP', 6, fc(e, '#cfe0ff'));
  },
};

export const mutex: EnemyKind = {
  id: 'mutex',
  hp: 60,
  r: 19,
  score: 1400,
  color: '#a970ff',
  drops: { power: 2, bits: 2 },
  explode: 'M',
  draw(e, g, c, t) {
    halo(c, '#8a3dff', 34, 0.35);
    const open = e.data.open ?? 0;
    c.strokeStyle = fc(e, '#c9a8ff');
    c.lineWidth = 4;
    c.beginPath();
    c.arc(0, -6 - open * 5, 9, Math.PI, 0);
    c.lineTo(9, 0 - open * 5);
    c.moveTo(-9, -6 - open * 5);
    c.lineTo(-9, 0);
    c.stroke();
    c.fillStyle = '#12061f';
    c.beginPath();
    c.roundRect(-15, -4, 30, 22, 4);
    c.fill();
    c.lineWidth = 2;
    c.stroke();
    c.fillStyle = fc(e, '#c9a8ff');
    c.beginPath();
    c.arc(0, 5, 3, 0, TAU);
    c.fill();
    c.fillRect(-1.2, 5, 2.4, 7);
  },
};

export const thread: EnemyKind = {
  id: 'thread',
  hp: 12,
  r: 12,
  score: 380,
  color: '#00f0ff',
  drops: { power: 1 },
  draw(e, g, c, t) {
    halo(c, '#00e5ff', 22, 0.35);
    c.rotate(t * 0.1 + e.id);
    c.fillStyle = '#021418';
    c.strokeStyle = fc(e, '#5ff6ff');
    c.lineWidth = 2;
    c.beginPath();
    c.roundRect(-6, -11, 12, 22, 3);
    c.fill();
    c.stroke();
    c.lineWidth = 1;
    c.beginPath();
    for (let i = -8; i <= 8; i += 3) {
      c.moveTo(-6, i);
      c.lineTo(6, i + 2);
    }
    c.stroke();
    c.fillStyle = fc(e, '#5ff6ff');
    c.fillRect(-9, -13, 18, 3);
    c.fillRect(-9, 10, 18, 3);
  },
};

export const daemon: EnemyKind = {
  id: 'daemon',
  hp: 180,
  r: 25,
  score: 5000,
  color: '#ff3b5c',
  drops: { power: 4, bits: 4, bigpower: 1 },
  explode: 'M',
  draw(e, g, c, t) {
    halo(c, '#ff0033', 46, 0.35);
    c.fillStyle = '#18040a';
    c.strokeStyle = fc(e, '#ff3b5c');
    c.lineWidth = 2.5;
    // horns
    for (const s of [-1, 1]) {
      c.beginPath();
      c.moveTo(s * 12, -14);
      c.quadraticCurveTo(s * 24, -26, s * 18, -34);
      c.quadraticCurveTo(s * 18, -22, s * 6, -18);
      c.fill();
      c.stroke();
    }
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      c.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
    }
    c.closePath();
    c.fill();
    c.stroke();
    const blink = (t + e.id * 17) % 140 < 6;
    c.fillStyle = '#000';
    c.beginPath();
    c.ellipse(0, -2, 11, blink ? 1 : 7, 0, 0, TAU);
    c.fill();
    if (!blink) {
      const a = Math.atan2(g.player.y - e.y, g.player.x - e.x);
      c.fillStyle = fc(e, '#ff2a4a');
      c.beginPath();
      c.arc(Math.cos(a) * 5, -2 + Math.sin(a) * 3, 4, 0, TAU);
      c.fill();
      c.fillStyle = '#fff';
      c.fillRect(Math.cos(a) * 5 - 1, -3 + Math.sin(a) * 3, 2, 2);
    }
    label(c, 'systemd', 6, '#ff8a9e', 13);
  },
};

export const virus: EnemyKind = {
  id: 'virus',
  hp: 90,
  r: 20,
  score: 2600,
  color: '#39ff88',
  drops: { power: 3, bits: 3 },
  explode: 'M',
  draw(e, g, c, t) {
    halo(c, '#00ff66', 38, 0.35);
    c.rotate(t * 0.04);
    c.strokeStyle = fc(e, '#39ff88');
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      c.moveTo(Math.cos(a) * 14, Math.sin(a) * 14);
      c.lineTo(Math.cos(a) * 22, Math.sin(a) * 22);
    }
    c.stroke();
    c.fillStyle = fc(e, '#39ff88');
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      c.beginPath();
      c.arc(Math.cos(a) * 23, Math.sin(a) * 23, 2.8, 0, TAU);
      c.fill();
    }
    c.fillStyle = '#021a0a';
    c.beginPath();
    c.arc(0, 0, 14, 0, TAU);
    c.fill();
    c.stroke();
    c.rotate(-t * 0.04);
    label(c, 'EXE', 8, fc(e, '#b0ffcf'));
  },
};

export const turret: EnemyKind = {
  id: 'turret',
  hp: 140,
  r: 22,
  score: 4000,
  color: '#ffe14d',
  drops: { power: 3, bits: 3, bigpower: 1 },
  explode: 'M',
  draw(e, g, c, t) {
    halo(c, '#ffd000', 40, 0.35);
    c.save();
    c.rotate(t * 0.08);
    c.strokeStyle = fc(e, '#ffe14d');
    c.lineWidth = 2;
    c.setLineDash([6, 5]);
    c.beginPath();
    c.arc(0, 0, 24, 0, TAU);
    c.stroke();
    c.setLineDash([]);
    c.restore();
    c.fillStyle = '#1a1600';
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      c.lineTo(Math.cos(a) * 18, Math.sin(a) * 18);
    }
    c.closePath();
    c.fill();
    c.strokeStyle = fc(e, '#ffe14d');
    c.stroke();
    label(c, '∞', 18, fc(e, '#fff6b0'), 1, 700);
  },
};

export const rootkit: EnemyKind = {
  id: 'rootkit',
  hp: 22,
  r: 15,
  score: 700,
  color: '#ff2bd6',
  drops: { power: 1, bits: 1 },
  draw(e, g, c, t) {
    const vis = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.07 + e.id));
    c.globalAlpha = vis;
    halo(c, '#ff00cc', 26, 0.4);
    c.globalAlpha = vis;
    c.fillStyle = '#0c0010';
    c.strokeStyle = fc(e, '#ff2bd6');
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, 16);
    c.lineTo(-15, -10);
    c.lineTo(15, -10);
    c.closePath();
    c.fill();
    c.stroke();
    label(c, '#', 13, fc(e, '#ffb0f0'), -1);
    c.globalAlpha = 1;
  },
};

export const firewall: EnemyKind = {
  id: 'firewall',
  hp: 260,
  r: 28,
  score: 6000,
  color: '#ff9a3c',
  drops: { power: 4, bits: 5, bigpower: 1 },
  explode: 'M',
  draw(e, g, c, t) {
    halo(c, '#ff6a00', 50, 0.35);
    for (let i = 0; i < 5; i++) {
      const x = -24 + i * 12;
      const h = 8 + Math.sin(t * 0.3 + i * 1.7) * 4;
      c.fillStyle = i % 2 ? '#ff6a00' : '#ffd000';
      c.globalAlpha = 0.8;
      c.beginPath();
      c.moveTo(x - 5, -14);
      c.quadraticCurveTo(x, -14 - h * 2, x + 5, -14);
      c.fill();
    }
    c.globalAlpha = 1;
    c.fillStyle = '#1a0b00';
    c.fillRect(-30, -14, 60, 28);
    c.strokeStyle = fc(e, '#ff9a3c');
    c.lineWidth = 1.5;
    for (let r = 0; r < 3; r++) {
      for (let i = 0; i < 5; i++) {
        const off = r % 2 ? 6 : 0;
        c.strokeRect(-30 + i * 12 + off - (r % 2 ? 6 : 0), -14 + r * 9.33, 12, 9.33);
      }
    }
    c.lineWidth = 2;
    c.strokeRect(-30, -14, 60, 28);
  },
};

export const cronling: EnemyKind = {
  id: 'cronling',
  hp: 30,
  r: 14,
  score: 600,
  color: '#ffe14d',
  drops: { power: 1, bits: 1 },
  draw(e, g, c, t) {
    halo(c, '#ffd000', 24, 0.35);
    c.fillStyle = '#141000';
    c.beginPath();
    c.arc(0, 0, 13, 0, TAU);
    c.fill();
    c.strokeStyle = fc(e, '#ffe14d');
    c.lineWidth = 2;
    c.stroke();
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(t * 0.2) * 9, Math.sin(t * 0.2) * 9);
    c.moveTo(0, 0);
    c.lineTo(Math.cos(t * 0.02) * 6, Math.sin(t * 0.02) * 6);
    c.stroke();
  },
};

/** Floating "comment" block - passive shield enemy that just soaks shots. */
export const comment: EnemyKind = {
  id: 'comment',
  hp: 40,
  r: 18,
  score: 800,
  color: '#5d6f93',
  drops: { bits: 2 },
  draw(e, g, c, t) {
    c.fillStyle = 'rgba(20,26,40,0.95)';
    c.strokeStyle = fc(e, '#7f93bf');
    c.lineWidth = 1.5;
    c.beginPath();
    c.roundRect(-26, -10, 52, 20, 3);
    c.fill();
    c.stroke();
    label(c, '// TODO', 8, fc(e, '#9fb3dd'));
  },
};
