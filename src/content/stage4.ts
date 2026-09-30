import { FONT_MONO, PF_H, PF_W } from '../config';
import { TAU, angleTo, dist, ease } from '../core/math';
import type { Task } from '../core/tasks';
import type { Boss } from '../game/boss';
import type { Bullet } from '../game/bullets';
import { Enemy, type EnemyKind } from '../game/enemy';
import type { Game } from '../game/game';
import { fan, ring, stack } from '../game/patterns';
import type { BossDef, StageDef } from '../game/types';
import { glowSprite } from '../render/sprites';
import { CX, LANES, along, every, fly, visit, type Pt, type Script } from './common';
import { halo, mutex, packet, thread } from './kinds';

// ------------------------------------------------------------------ enemy scripts

/** Packets stream diagonally in tight single-file lines. */
function packetStream(g: Game, fromLeft: boolean, y: number, n: number, gap = 7) {
  const a = fromLeft ? 0.35 : Math.PI - 0.35;
  return (function* (): Task {
    for (let i = 0; i < n; i++) {
      g.spawn(packet, fromLeft ? -20 : PF_W + 20, y, fly(g.D.s(4.2), a, every(999, (e, gg) => {
        if (gg.lv >= 1 || i % 2 === 0) gg.shoot(e.x, e.y, gg.aim(e.x, e.y), gg.D.s(3.2), 'orb', 'blue');
      }, 20 + (i % 3) * 8, 1)));
      yield gap;
    }
  })();
}

/** Threads descend in lanes and fire in perfect sync. */
function syncThreads(g: Game, xs: number[]) {
  const clock = { t: 0 };
  for (const x of xs) {
    g.spawn(
      thread,
      x,
      -20,
      visit(x, 140, 60, 240, function* (e, gg) {
        while (true) {
          yield 60;
          stack(gg, e.x, e.y, gg.D.n(3, 2), gg.aim(e.x, e.y), gg.D.s(2.6), gg.D.s(4), 'rice', 'cyan');
          clock.t++;
        }
      }),
    );
  }
}

function mutexScript(x: number, y: number): Script {
  return function* (e, g) {
    yield* e.moveWait(x, y, 60);
    for (let i = 0; i < 5; i++) {
      e.data.open = 0;
      yield 40;
      e.data.open = 1;
      ring(g, e.x, e.y, g.D.n(16), g.D.s(2.0), i * 0.2, 'ball', 'purple');
      if (g.lv >= 2) ring(g, e.x, e.y, g.D.n(16), g.D.s(1.4), i * 0.2 + 0.1, 'orb', 'blue');
      g.sfx('eshot2');
      yield 25;
    }
    e.setVel(1, -Math.PI / 2);
    yield 300;
  };
}

// ------------------------------------------------------------------ midboss: deadlock

const lockKind: EnemyKind = {
  id: 'lockB',
  hp: 1,
  r: 26,
  score: 0,
  color: '#a970ff',
  draw(e, g, c, t) {
    drawLock(c, e.flash > 0, t, 'B');
  },
};

function drawLock(c: CanvasRenderingContext2D, flash: boolean, t: number, label: string) {
  halo(c, '#8a3dff', 52, 0.35);
  c.strokeStyle = flash ? '#fff' : '#c9a8ff';
  c.lineWidth = 6;
  c.beginPath();
  c.arc(0, -10, 14, Math.PI, 0);
  c.lineTo(14, 0);
  c.moveTo(-14, -10);
  c.lineTo(-14, 0);
  c.stroke();
  c.fillStyle = '#12061f';
  c.beginPath();
  c.roundRect(-22, -4, 44, 34, 6);
  c.fill();
  c.lineWidth = 2.5;
  c.stroke();
  c.font = `900 16px ${FONT_MONO}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = flash ? '#fff' : '#c9a8ff';
  c.fillText(label, 0, 13);
  c.textBaseline = 'alphabetic';
}

function lockPair(b: Boss, g: Game): Enemy {
  let partner = b.partners[0];
  if (!partner || !partner.alive) {
    partner = new Enemy(lockKind, b.x, b.y);
    partner.hpLink = b;
    partner.keepAlive = true;
    partner.noDrops = true;
    g.addEnemy(partner);
    b.partners = [partner];
  }
  return partner;
}

function drawChain(c: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, t: number) {
  const d = dist(x0, y0, x1, y1);
  const n = Math.floor(d / 14);
  const a = Math.atan2(y1 - y0, x1 - x0);
  for (let i = 1; i < n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n + Math.sin(t * 0.1 + i) * 2;
    c.save();
    c.translate(x, y);
    c.rotate(a + (i % 2 ? Math.PI / 2 : 0));
    c.strokeStyle = '#6a5a8a';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(0, 0, 7, 4, 0, 0, TAU);
    c.stroke();
    c.restore();
  }
}

const deadlock: BossDef = {
  id: 'deadlock',
  name: 'DEADLOCK',
  title: 'each waits for the other, forever',
  color: '#a970ff',
  r: 26,
  homeY: 140,
  midboss: true,
  drops: { bomb: 1 },
  setup(b, g) {
    b.data.sep = 70;
  },
  phases: [
    {
      hp: 1400,
      time: 28,
      *run(b, g) {
        const p = lockPair(b, g);
        let t = 0;
        while (true) {
          const sep = 90 + Math.sin(t * 0.02) * 40;
          b.data.sep = sep;
          p.x = b.x + sep * 2;
          p.y = b.y + Math.sin(t * 0.04) * 20;
          // each lock fires at the other; the crossfire curls toward the player
          if (t % 8 === 0) {
            const a1 = angleTo(b.x, b.y, p.x, p.y);
            g.shoot(b.x, b.y, a1 + 0.9, g.D.s(2.4), 'rice', 'purple', { angVel: -0.012 });
            g.shoot(p.x, p.y, a1 + Math.PI - 0.9, g.D.s(2.4), 'rice', 'blue', { angVel: 0.012 });
          }
          if (t % 70 === 35) {
            fan(g, b.x, b.y, g.D.n(3, 2), 0.4, g.aim(b.x, b.y), g.D.s(3.2), 'orb', 'white');
            fan(g, p.x, p.y, g.D.n(3, 2), 0.4, g.aim(p.x, p.y), g.D.s(3.2), 'orb', 'white');
          }
          if (t % 200 === 199) b.moveTo(g.rng.range(90, PF_W - 330), g.rng.range(110, 160), 60, ease.inOutSine);
          t++;
          yield;
        }
      },
    },
    {
      name: 'wait(lockA) → wait(lockB) → wait(lockA)…',
      hp: 1700,
      time: 34,
      *run(b, g) {
        const p = lockPair(b, g);
        const cx = CX;
        const cy = 220;
        let ang = 0;
        let t = 0;
        let beam: import('../game/bullets').Laser | null = null;
        while (true) {
          ang += 0.008;
          const r = 150;
          b.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.6, 1, ease.linear);
          p.x = cx - Math.cos(ang) * r;
          p.y = cy - Math.sin(ang) * r * 0.6;
          if (!beam || !beam.alive) {
            beam = g.laser(b.x, b.y, angleTo(b.x, b.y, p.x, p.y), { len: 300, width: 16, warn: 70, active: 99999, color: 'purple', noCancel: true });
          }
          beam.x = b.x;
          beam.y = b.y;
          beam.angle = angleTo(b.x, b.y, p.x, p.y);
          beam.len = dist(b.x, b.y, p.x, p.y);
          if (t % 36 === 0) {
            ring(g, b.x, b.y, g.D.n(10), g.D.s(1.8), g.aim(b.x, b.y), 'ball', 'purple');
            ring(g, p.x, p.y, g.D.n(10), g.D.s(1.8), g.aim(p.x, p.y), 'ball', 'blue');
            g.sfx('eshot');
          }
          t++;
          yield;
        }
      },
    },
  ],
  draw(b, g, c, t) {
    const p = b.partners[0];
    if (p && p.alive) drawChain(c, 0, 0, p.x - b.x, p.y - b.y, t);
    drawLock(c, b.flash > 0, t, 'A');
  },
};

// ------------------------------------------------------------------ boss: race condition (twin threads, shared HP)

const twinKind: EnemyKind = {
  id: 'threadB',
  hp: 1,
  r: 30,
  score: 0,
  color: '#ff2bd6',
  draw(e, g, c, t) {
    drawRacer(c, e.flash > 0, t, '#ff2bd6', 'B', e.x - e.px);
  },
};

function drawRacer(c: CanvasRenderingContext2D, flash: boolean, t: number, col: string, label: string, vx: number) {
  halo(c, col, 60, 0.4);
  // speed trails
  c.globalCompositeOperation = 'lighter';
  for (let i = 1; i < 5; i++) {
    c.globalAlpha = 0.18 / i;
    c.drawImage(glowSprite(col, 32), -24 - vx * i * 6, -24, 48, 48);
  }
  c.globalAlpha = 1;
  c.globalCompositeOperation = 'source-over';
  c.save();
  c.rotate(Math.sin(t * 0.05) * 0.1 + vx * 0.05);
  c.fillStyle = '#0a0418';
  c.strokeStyle = flash ? '#fff' : col;
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(0, 28);
  c.lineTo(-24, -16);
  c.lineTo(0, -6);
  c.lineTo(24, -16);
  c.closePath();
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(0, -2, 13, 0, TAU);
  c.fill();
  c.stroke();
  c.restore();
  c.font = `900 13px ${FONT_MONO}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillStyle = flash ? '#fff' : col;
  c.fillText(label, 0, -1);
  c.textBaseline = 'alphabetic';
  // lap counter
  c.font = `700 8px ${FONT_MONO}`;
  c.fillStyle = 'rgba(255,255,255,0.6)';
  c.fillText(`t=${(t * 16.67).toFixed(0)}ns`, 0, -34);
}

function twin(b: Boss, g: Game): Enemy {
  let p = b.partners[0];
  if (!p || !p.alive) {
    p = new Enemy(twinKind, PF_W - b.x, b.y);
    p.hpLink = b;
    p.keepAlive = true;
    p.noDrops = true;
    g.addEnemy(p);
    b.partners = [p];
  }
  return p;
}

const race: BossDef = {
  id: 'race',
  name: 'RACE CONDITION',
  title: 'two threads, one variable, zero locks',
  color: '#00f0ff',
  r: 30,
  music: 'boss4',
  drops: { bomb: 2 },
  before: [
    { who: 'boss', text: '[A] We were here first!' },
    { who: 'boss', text: '[B] No, WE were here first!' },
    { who: 'you', text: 'Two threads. One variable. Zero locks. Classic.' },
    { who: 'boss', text: '[A] Whoever writes last wins!   [B] Whoever writes FIRST wins!' },
    { who: 'you', text: 'Whoever gets synchronized loses. That is you. Both of you.' },
  ],
  after: [
    { who: 'boss', text: '[B] Wait... if we both crashed...' },
    { who: 'boss', text: '[A] ...then who wrote the final value?' },
    { who: 'you', text: 'Me. With a mutex.' },
  ],
  setup(b, g) {
    b.x = b.px = CX - 120;
  },
  phases: [
    {
      hp: 2300,
      time: 30,
      *run(b, g) {
        const p = twin(b, g);
        let t = 0;
        b.moveTo(CX - 130, 140, 40);
        while (true) {
          const ox = Math.sin(t * 0.015) * 90;
          b.moveTo(CX - 130 + ox, 140 + Math.sin(t * 0.03) * 20, 1, ease.linear);
          p.x = PF_W - b.x;
          p.y = b.y;
          if (t % 40 === 0) {
            fan(g, b.x, b.y, g.D.n(7, 4), 0.9, g.aim(b.x, b.y), g.D.s(3), 'kunai', 'cyan');
            fan(g, p.x, p.y, g.D.n(7, 4), 0.9, g.aim(p.x, p.y), g.D.s(3), 'kunai', 'magenta');
            g.sfx('eshot');
          }
          if (t % 40 === 20) {
            ring(g, b.x, b.y, g.D.n(10), g.D.s(1.7), t * 0.01, 'orb', 'cyan');
            ring(g, p.x, p.y, g.D.n(10), g.D.s(1.7), -t * 0.01, 'orb', 'magenta');
          }
          t++;
          yield;
        }
      },
    },
    {
      name: 'Thread.sleep(Math.random())',
      hp: 2700,
      time: 42,
      *run(b, g) {
        const p = twin(b, g);
        yield* b.moveWait(CX - 140, 150, 40);
        p.x = PF_W - b.x;
        let na = 30;
        let nb = 50;
        let t = 0;
        while (true) {
          na--;
          nb--;
          const fireA = na <= 0;
          const fireB = nb <= 0;
          if (fireA && fireB) {
            // both wrote at once: collision burst
            g.fx.text(CX, 200, 'DATA RACE!', '#ffe14d', 40, 14);
            ring(g, CX, b.y, g.D.n(28), g.D.s(2.2), g.rng.next() * TAU, 'star', 'yellow');
            g.sfx('glitch');
          }
          if (fireA) {
            ring(g, b.x, b.y, g.D.n(16), g.D.s(g.rng.range(1.8, 3)), g.rng.next() * TAU, 'kunai', 'cyan');
            na = g.rng.int(18, 70);
            g.sfx('eshot');
          }
          if (fireB) {
            ring(g, p.x, p.y, g.D.n(16), g.D.s(g.rng.range(1.8, 3)), g.rng.next() * TAU, 'kunai', 'magenta');
            nb = g.rng.int(18, 70);
            g.sfx('eshot');
          }
          if (t % 180 === 179) {
            const nx = g.rng.range(90, CX - 60);
            b.moveTo(nx, g.rng.range(110, 190), 50, ease.inOutSine);
          }
          p.x = PF_W - b.x;
          p.y = b.y + Math.sin(t * 0.05) * 10;
          t++;
          yield;
        }
      },
    },
    {
      hp: 2300,
      time: 30,
      *run(b, g) {
        const p = twin(b, g);
        yield* b.moveWait(40, 120, 50);
        p.x = PF_W - 40;
        p.y = 120;
        let i = 0;
        while (true) {
          const target = g.player.x;
          const la = angleTo(b.x, b.y, target + 60, PF_H);
          const lb = angleTo(p.x, p.y, target - 60, PF_H);
          g.laser(b.x, b.y, la, { len: 900, width: 20, warn: 48, active: 40, color: 'cyan' });
          g.laser(p.x, p.y, lb, { len: 900, width: 20, warn: 48, active: 40, color: 'magenta' });
          yield 40;
          fan(g, b.x, b.y, g.D.n(9, 5), 1.4, la, g.D.s(2.2), 'orb', 'cyan');
          fan(g, p.x, p.y, g.D.n(9, 5), 1.4, lb, g.D.s(2.2), 'orb', 'magenta');
          g.sfx('eshot2');
          yield 55;
          i++;
          if (i % 3 === 0) {
            const y = g.rng.range(90, 180);
            b.moveTo(40, y, 30);
            p.y = y;
          }
          p.y = b.y;
        }
      },
    },
    {
      name: 'mutex.lock(); // forgot unlock()',
      hp: 2900,
      time: 45,
      *run(b, g) {
        const p = twin(b, g);
        const cx = CX;
        const cy = 250;
        let ang = -Math.PI;
        let t = 0;
        let beam: import('../game/bullets').Laser | null = null;
        yield* b.moveWait(cx - 170, cy, 50);
        while (true) {
          ang += g.D.pick([0.006, 0.008, 0.0095, 0.011]);
          b.moveTo(cx + Math.cos(ang) * 170, cy + Math.sin(ang) * 120, 1, ease.linear);
          p.x = cx - Math.cos(ang) * 170;
          p.y = cy - Math.sin(ang) * 120;
          if (!beam || !beam.alive) beam = g.laser(b.x, b.y, 0, { len: 340, width: 18, warn: 90, active: 99999, color: 'white', noCancel: true });
          beam.x = b.x;
          beam.y = b.y;
          beam.angle = angleTo(b.x, b.y, p.x, p.y);
          beam.len = dist(b.x, b.y, p.x, p.y);
          if (t % 45 === 0) {
            fan(g, b.x, b.y, g.D.n(5, 3), 0.8, g.aim(b.x, b.y), g.D.s(2.4), 'ball', 'cyan');
            fan(g, p.x, p.y, g.D.n(5, 3), 0.8, g.aim(p.x, p.y), g.D.s(2.4), 'ball', 'magenta');
            g.sfx('eshot');
          }
          if (g.lv >= 1 && t % 90 === 60) ring(g, cx, cy, g.D.n(14), g.D.s(1.5), t * 0.03, 'orb', 'white');
          t++;
          yield;
        }
      },
    },
    {
      name: 'Heisenbug // observing it changes it',
      hp: 2500,
      time: 42,
      *run(b, g) {
        const p = twin(b, g);
        yield* b.moveWait(CX - 110, 140, 40);
        p.x = CX + 110;
        p.y = 140;
        g.banner('FOCUS = OBSERVE', 'observed bullets slow down', '#ffe14d', 120, 'small');
        const heisen = (bl: Bullet, gg: Game) => {
          const base = bl.data.base ?? (bl.data.base = bl.speed);
          const want = gg.player.focus ? base * 0.5 : base * 1.2;
          bl.speed += (want - bl.speed) * 0.1;
          bl.alpha = gg.player.focus ? 1 : 0.8;
        };
        let t = 0;
        while (true) {
          if (t % 7 === 0) {
            const a = t * 0.05;
            g.shoot(b.x, b.y, a, g.D.s(2.6), 'rice', 'cyan', { upd: heisen });
            g.shoot(b.x, b.y, a + Math.PI, g.D.s(2.6), 'rice', 'cyan', { upd: heisen });
            g.shoot(p.x, p.y, -a, g.D.s(2.6), 'rice', 'magenta', { upd: heisen });
            g.shoot(p.x, p.y, -a + Math.PI, g.D.s(2.6), 'rice', 'magenta', { upd: heisen });
          }
          if (t % 60 === 30) {
            stack(g, b.x, b.y, g.D.n(3, 2), g.aim(b.x, b.y), g.D.s(2.8), g.D.s(4), 'orb', 'white', { upd: heisen });
            stack(g, p.x, p.y, g.D.n(3, 2), g.aim(p.x, p.y), g.D.s(2.8), g.D.s(4), 'orb', 'white', { upd: heisen });
          }
          t++;
          yield;
        }
      },
    },
  ],
  draw(b, g, c, t) {
    drawRacer(c, b.flash > 0, t, '#00f0ff', 'A', b.x - b.px);
  },
};

// ------------------------------------------------------------------ stage script

function* script(g: Game): Task {
  yield 150;
  // W1: packet streams
  g.stageTasks.add(packetStream(g, true, 60, 10));
  yield 90;
  g.stageTasks.add(packetStream(g, false, 120, 10));
  yield 90;
  g.stageTasks.add(packetStream(g, true, 180, 10));
  g.stageTasks.add(packetStream(g, false, 40, 10));
  yield 200;
  // W2: synchronized threads
  syncThreads(g, [LANES[0], LANES[2], LANES[3], LANES[5]]);
  yield 240;
  syncThreads(g, [LANES[1], LANES[4]]);
  g.stageTasks.add(packetStream(g, true, 30, 8, 9));
  yield 260;
  // W3: mutex pairs
  g.spawn(mutex, 150, -30, mutexScript(150, 130));
  g.spawn(mutex, 450, -30, mutexScript(450, 130));
  yield 260;
  g.stageTasks.add(packetStream(g, false, 200, 12, 6));
  g.stageTasks.add(packetStream(g, true, 260, 12, 6));
  yield 200;
  g.spawn(mutex, CX, -30, mutexScript(CX, 170));
  yield 280;

  yield* g.fight(deadlock);
  yield 90;

  // W4: packet storm + threads
  for (let i = 0; i < 4; i++) {
    g.stageTasks.add(packetStream(g, i % 2 === 0, 40 + i * 50, 8, 7));
    yield 50;
  }
  syncThreads(g, [LANES[0], LANES[1], LANES[4], LANES[5]]);
  yield 300;
  // W5: mutex gauntlet
  for (const [x, y] of [
    [110, 110],
    [490, 110],
    [300, 200],
  ] as const) {
    g.spawn(mutex, x, -30, mutexScript(x, y));
    yield 70;
  }
  yield 240;
  const loop: Pt[] = [
    [-30, 300],
    [150, 120],
    [300, 60],
    [450, 120],
    [630, 300],
  ];
  for (let i = 0; i < 14; i++) {
    g.spawn(thread, loop[0][0], loop[0][1], along(loop, 200, every(999, (e, gg) => {
      gg.shoot(e.x, e.y, gg.aim(e.x, e.y), gg.D.s(3), 'rice', 'cyan');
    }, 80, 1)));
    yield 12;
  }
  yield 260;
  yield* g.bossBattle(race);
}

export const stage4: StageDef = {
  index: 3,
  name: 'Thread Pool',
  title: 'STAGE 4',
  subtitle: 'parallel lines never meet. threads always do.',
  music: 'stage4',
  bg: 'threads',
  color: '#a970ff',
  mid: deadlock,
  boss: race,
  script,
};
