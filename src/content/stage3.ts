import { FONT_MONO, PF_H, PF_W } from '../config';
import { TAU, angleTo, ease } from '../core/math';
import type { Task } from '../core/tasks';
import type { Bullet } from '../game/bullets';
import type { Enemy } from '../game/enemy';
import type { Game } from '../game/game';
import { fan, ring, stack } from '../game/patterns';
import type { BossDef, StageDef } from '../game/types';
import { glowSprite } from '../render/sprites';
import { CX, LANES, along, every, fly, mirror, type Pt, type Script } from './common';
import { comment, forkbomb, halo, pointer, worm } from './kinds';

// ------------------------------------------------------------------ enemy behaviours

function spawnWorm(g: Game, pts: Pt[], frames: number, segs: number) {
  for (let i = 0; i < segs; i++) {
    const e = g.spawn(worm, pts[0][0], pts[0][1]);
    e.data.seg = segs - i;
    if (i === 0) e.data.head = 1;
    e.r = i === 0 ? 13 : 11;
    e.run(
      (function* (): Task {
        yield i * 7;
        e.followPath(pts, frames);
        if (i === 0)
          e.run(every(70, (en, gg) => {
            fan(gg, en.x, en.y, gg.D.n(3, 1), 0.4, gg.aim(en.x, en.y), gg.D.s(3), 'orb', 'yellow');
            gg.sfx('eshot');
          }, 50)(e, g));
        yield frames + 300;
      })(),
    );
  }
}

function forkScript(angle: number, speed: number): Script {
  return function* (e, g) {
    e.onDeath = (en, gg) => {
      if (gg.lv >= 1) ring(gg, en.x, en.y, gg.D.n(6, 3), gg.D.s(1.4), gg.rng.next() * TAU, 'orb', 'red', { delay: 16 });
      if (en.gen >= 2) return;
      for (const s of [-1, 1]) {
        const c = gg.spawn(forkbomb, en.x, en.y, fly(2.2, Math.PI / 2 + s * 0.7));
        c.gen = en.gen + 1;
        c.hp = c.maxHp = Math.max(4, Math.round(forkbomb.hp * (0.55 - c.gen * 0.15)));
        c.r = 15 - c.gen * 3;
        c.invuln = 10;
        c.onDeath = en.onDeath;
      }
      gg.fx.text(en.x, en.y - 16, 'fork()', '#ff5a74', 30, 10);
    };
    e.setVel(speed, angle);
    yield 1200;
  };
}

/** Dangling pointer: hover, lock on (telegraphed), then dash. */
function dangle(x: number, y: number): Script {
  return function* (e, g) {
    yield* e.moveWait(x, y, 40, ease.outCubic);
    const a = g.aim(e.x, e.y);
    e.angle = a;
    for (let i = 0; i < 36; i++) {
      if (i % 6 === 0) g.fx.line(e.x, e.y, e.x + Math.cos(a) * 900, e.y + Math.sin(a) * 900, '#ff3b5c', 8, 1.5);
      yield;
    }
    e.setVel(g.D.s(7.5), a);
    if (g.lv >= 2) g.shoot(e.x, e.y, a + Math.PI, g.D.s(2), 'kunai', 'red');
    yield 400;
  };
}

// ------------------------------------------------------------------ midboss: stack smasher

const smasher: BossDef = {
  id: 'smasher',
  name: 'STACK SMASHER',
  title: 'the canary is not ok',
  color: '#ff7a3c',
  r: 38,
  homeY: 140,
  midboss: true,
  drops: { bomb: 1 },
  phases: [
    {
      hp: 1300,
      time: 26,
      *run(b, g) {
        let i = 0;
        yield 30;
        while (true) {
          // push a "frame": a row of diamonds
          const off = (i % 2) * 15;
          const n = g.D.n(10, 6);
          for (let k = 0; k < n; k++) {
            const x = b.x - 150 + off + (k * 300) / (n - 1);
            g.shoot(x, b.y + 30, Math.PI / 2, g.D.s(2.1), 'diamond', i % 2 ? 'orange' : 'yellow');
          }
          if (i % 2) stack(g, b.x, b.y, g.D.n(3, 2), g.aim(b.x, b.y), g.D.s(3), g.D.s(4.6), 'kunai', 'white');
          g.sfx('eshot');
          i++;
          yield 34;
          if (i % 6 === 0) yield* b.wander(g, 50, 130, 110, 160);
        }
      },
    },
    {
      name: 'strcpy(buf, input); // no bounds check',
      hp: 1550,
      time: 34,
      *run(b, g) {
        yield* b.home(30);
        while (true) {
          const rows = g.D.pick([3, 4, 5, 5]);
          const cols = g.D.pick([7, 8, 9, 10]);
          const bx = g.rng.range(170, PF_W - 170);
          const by = g.rng.range(210, 290);
          const buf = { overflow: -1 };
          let idx = 0;
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const tx = bx - 130 + (c * 260) / (cols - 1);
              const ty = by - 45 + (r * 90) / Math.max(1, rows - 1);
              const my = idx++;
              g.shoot(b.x, b.y, angleTo(b.x, b.y, tx, ty), 0, 'orb', 'orange', {
                delay: 6,
                upd: (bl: Bullet, gg: Game) => {
                  const st = bl.data.st ?? 0;
                  if (st === 0) {
                    bl.x += (tx - bl.x) * 0.12 * gg.ts;
                    bl.y += (ty - bl.y) * 0.12 * gg.ts;
                    if (buf.overflow >= 0) bl.data.st = 1;
                  } else if (st === 1 && gg.stageT - buf.overflow > my * 1.1) {
                    bl.data.st = 2;
                    bl.setAngle(gg.aim(bl.x, bl.y) + gg.rng.range(-0.2, 0.2));
                    bl.speed = 0.5;
                    bl.accel = 0.07;
                    bl.maxSpeed = gg.D.s(3.4);
                    bl.setType('orb', 'red');
                  }
                },
              });
              if (idx % 3 === 0) yield 1;
            }
          }
          g.fx.text(bx, by - 70, `buf[${rows * cols}] full`, '#ffb84d', 50, 11);
          yield 50;
          buf.overflow = g.stageT;
          g.sfx('glitch');
          g.fx.text(bx, by - 70, 'BUFFER OVERFLOW', '#ff3b5c', 60, 14);
          yield 70 + rows * cols;
          yield* b.wander(g, 40, 120, 110, 150);
        }
      },
    },
  ],
  draw(b, g, c, t) {
    halo(c, '#ff5a00', 80, 0.3);
    const frames = ['main()', 'parse()', 'eval()', 'eval()', 'eval()'];
    frames.forEach((f, i) => {
      const y = 34 - i * 17;
      const jit = i === frames.length - 1 ? Math.sin(t * 0.3) * 2 : 0;
      c.fillStyle = b.flash > 0 ? '#fff' : i % 2 ? '#2a1405' : '#1c0e03';
      c.fillRect(-44 + jit, y - 8, 88, 15);
      c.strokeStyle = '#ff7a3c';
      c.lineWidth = 1.5;
      c.strokeRect(-44 + jit, y - 8, 88, 15);
      c.font = `700 9px ${FONT_MONO}`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = '#ffd0a0';
      c.fillText(f, jit, y);
    });
    // the canary
    const cx = 36;
    const cy = -58 + Math.sin(t * 0.2) * 2;
    c.fillStyle = '#ffe14d';
    c.beginPath();
    c.ellipse(cx, cy, 8, 6, 0, 0, TAU);
    c.fill();
    c.beginPath();
    c.arc(cx + 6, cy - 4, 4, 0, TAU);
    c.fill();
    c.fillStyle = '#ff7a1f';
    c.fillRect(cx + 9, cy - 5, 4, 2);
    c.fillStyle = '#000';
    c.font = `800 6px ${FONT_MONO}`;
    c.fillText(b.hp < b.maxHp * 0.3 ? 'x' : '•', cx + 7, cy - 4);
    c.textBaseline = 'alphabetic';
  },
};

// ------------------------------------------------------------------ boss: memory leak

const leak: BossDef = {
  id: 'leak',
  name: 'MEMORY LEAK',
  title: 'the process that never frees',
  color: '#ffb000',
  r: 40,
  music: 'boss3',
  drops: { bomb: 1, life: 1 },
  before: [
    { who: 'boss', text: 'More. I need MORE. Just one more allocation...' },
    { who: 'you', text: "You've eaten 64 gigs of RAM. The swap file is crying." },
    { who: 'boss', text: 'Freeing memory is for processes with commitment issues.' },
    { who: 'you', text: 'Let me introduce you to the garbage collector.' },
  ],
  after: [
    { who: 'boss', text: 'free()... so this is what letting go feels like...' },
    { who: 'you', text: '64 gigabytes reclaimed. The swap file can rest now.' },
  ],
  phases: [
    {
      hp: 2100,
      time: 30,
      *run(b, g) {
        let t = 0;
        yield 30;
        while (true) {
          if (t % g.D.pick([8, 6, 5, 4]) === 0) {
            const a = -Math.PI / 2 + g.rng.range(-1.2, 1.2);
            g.shoot(b.x, b.y - 10, a, g.D.s(g.rng.range(2.6, 4)), 'orb', g.rng.chance(0.5) ? 'yellow' : 'orange', { ay: 0.045, maxSpeed: g.D.s(3.2), cullGrace: 120 });
          }
          if (t % 80 === 40) {
            ring(g, b.x, b.y, g.D.n(14), g.D.s(2.2), g.aim(b.x, b.y), 'ball', 'gold');
            g.sfx('eshot2');
          }
          if (t % 200 === 199) b.moveTo(CX + g.rng.range(-130, 130), g.rng.range(110, 160), 70, ease.inOutSine);
          t++;
          yield;
        }
      },
    },
    {
      name: 'malloc(); /* free() never called */',
      hp: 2500,
      time: 45,
      *run(b, g) {
        yield* b.home(30);
        let i = 0;
        while (true) {
          const n = g.D.n(14, 8);
          const off = g.rng.next() * TAU;
          for (let k = 0; k < n; k++) {
            g.shoot(b.x, b.y, off + (k / n) * TAU, g.D.s(g.rng.range(2.4, 3.6)), 'orb', 'gold', {
              accel: -0.05,
              minSpeed: 0,
              upd: (bl: Bullet) => {
                if (bl.age > 330 && !bl.data.drip) {
                  bl.data.drip = 1;
                  bl.ay = 0.025;
                  bl.maxSpeed = 2.6;
                  bl.setType('orb', 'orange');
                }
              },
              maxAge: 900,
            });
          }
          if (i % 2 === 0) stack(g, b.x, b.y, g.D.n(3, 2), g.aim(b.x, b.y), g.D.s(3.2), g.D.s(4.8), 'rice', 'white');
          g.sfx('eshot');
          i++;
          if (i % 12 === 0) g.log('WARN', `heap: ${(4 + i * 0.5).toFixed(1)} GiB and rising`);
          yield 30;
          if (i % 8 === 0) yield* b.wander(g, 60, 110, 110, 160);
        }
      },
    },
    {
      hp: 2100,
      time: 30,
      *run(b, g) {
        let t = 0;
        yield 30;
        while (true) {
          if (t % 30 === 0) {
            ring(g, b.x, b.y, g.D.n(16), 0.4, (t / 30) % 2 ? Math.PI / 16 : 0, 'rice', (t / 30) % 2 ? 'yellow' : 'orange', { accel: g.D.s(0.035), maxSpeed: g.D.s(3.4) });
            g.sfx('eshot');
          }
          if (t % 10 === 0) {
            for (const side of [0, 1]) {
              const x = side ? PF_W - 4 : 4;
              const a = side ? -Math.PI / 2 - g.rng.range(0.2, 0.9) : -Math.PI / 2 + g.rng.range(0.2, 0.9);
              if (g.lv >= 1 || t % 20 === 0) g.shoot(x, PF_H * 0.55, a, g.D.s(g.rng.range(3, 4.4)), 'orb', 'gold', { ay: 0.05, maxSpeed: 3.5, cullGrace: 200 });
            }
          }
          t++;
          yield;
        }
      },
    },
    {
      name: 'java.lang.OutOfMemoryError: heap space',
      hp: 2700,
      time: 45,
      *run(b, g) {
        yield* b.home(30);
        let row = 0;
        let t = 0;
        let rowsNow: Bullet[] = [];
        while (true) {
          if (t % 55 === 0 && row < 7) {
            const y = PF_H - 40 - row * 46;
            const gaps = [g.rng.range(60, PF_W - 60)];
            if (g.lv < 2) gaps.push(g.rng.range(60, PF_W - 60));
            for (let x = 14; x < PF_W; x += 24) {
              if (gaps.some((gx) => Math.abs(x - gx) < 40)) continue;
              const bl = g.shoot(x, y, 0, 0, 'diamond', 'orange', { delay: 45 });
              if (bl) rowsNow.push(bl);
            }
            row++;
            g.sfx('eshot2');
          }
          if (t % 50 === 25) {
            fan(g, b.x, b.y, g.D.n(5, 3), 0.8, g.aim(b.x, b.y), g.D.s(2.6), 'ball', 'gold');
          }
          if (t % 420 === 419) {
            // garbage collection cycle
            g.flash(0.4, '#ffe14d');
            g.banner('GC PAUSE', 'heap compacted', '#ffe14d', 70, 'small');
            g.log('OK', `GC reclaimed ${rowsNow.length * 8} KiB`);
            for (const bl of rowsNow) {
              if (bl.alive) {
                bl.alive = false;
                g.items.spawnCancel(bl.x, bl.y, g.overclock);
              }
            }
            rowsNow = [];
            row = 0;
          }
          t++;
          yield;
        }
      },
    },
    {
      name: 'System.gc(); // STOP-THE-WORLD',
      hp: 2300,
      time: 40,
      *run(b, g) {
        yield* b.home(30);
        const w = { stopped: false };
        const freeze = (bl: Bullet) => {
          if (w.stopped && !bl.data.fz) {
            bl.data.fz = 1;
            bl.data.sp = bl.speed;
            bl.speed = 0;
          } else if (!w.stopped && bl.data.fz) {
            bl.data.fz = 0;
            bl.speed = bl.data.sp;
          }
        };
        let t = 0;
        while (true) {
          const cyc = t % 240;
          if (cyc === 170) {
            w.stopped = true;
            g.flash(0.3, '#ffffff');
            g.banner('STOP THE WORLD', '', '#ffffff', 60, 'small');
            g.sfx('ocOn');
          }
          if (cyc === 239) {
            w.stopped = false;
            g.sfx('ocOff');
          }
          if (t % 16 === 0) {
            const off = t * 0.05;
            ring(g, b.x, b.y, g.D.n(12), g.D.s(2.3), off, 'ball', w.stopped ? 'white' : 'gold', { upd: freeze });
          }
          if (t % 40 === 20 && !w.stopped) stack(g, b.x, b.y, g.D.n(4, 2), g.aim(b.x, b.y), g.D.s(2.5), g.D.s(4), 'orb', 'orange', { upd: freeze });
          t++;
          yield;
        }
      },
    },
  ],
  draw(b, g, c, t) {
    halo(c, '#ffae00', 90, 0.35);
    // gooey body
    const blobs = 7;
    c.fillStyle = b.flash > 0 ? '#fff' : '#d98a00';
    for (let i = 0; i < blobs; i++) {
      const a = (i / blobs) * TAU + t * 0.01;
      const r = 14 + Math.sin(t * 0.07 + i * 2) * 4;
      c.beginPath();
      c.arc(Math.cos(a) * 20, Math.sin(a) * 16, r, 0, TAU);
      c.fill();
    }
    c.beginPath();
    c.arc(0, 0, 28, 0, TAU);
    c.fill();
    // drips
    for (let i = 0; i < 4; i++) {
      const x = -24 + i * 16;
      const len = 10 + ((t * 0.6 + i * 23) % 30);
      c.beginPath();
      c.moveTo(x - 4, 20);
      c.quadraticCurveTo(x, 20 + len * 1.4, x + 4, 20);
      c.fill();
    }
    c.fillStyle = 'rgba(255,240,180,0.4)';
    c.beginPath();
    c.ellipse(-10, -12, 9, 5, -0.4, 0, TAU);
    c.fill();
    // face
    c.fillStyle = '#2a1600';
    c.beginPath();
    c.arc(-10, -2, 4, 0, TAU);
    c.arc(10, -2, 4, 0, TAU);
    c.fill();
    c.beginPath();
    c.ellipse(0, 12, 8, 4 + Math.abs(Math.sin(t * 0.1)) * 3, 0, 0, TAU);
    c.fill();
    // RAM gauge
    const ram = Math.min(0.999, 0.6 + (b.age % 3000) / 7500);
    c.fillStyle = 'rgba(0,0,0,0.6)';
    c.fillRect(-36, -58, 72, 10);
    c.fillStyle = ram > 0.9 ? '#ff3b5c' : '#ffb000';
    c.fillRect(-35, -57, 70 * ram, 8);
    c.font = `800 8px ${FONT_MONO}`;
    c.textAlign = 'center';
    c.fillStyle = '#fff';
    c.fillText(`RAM ${(ram * 100).toFixed(1)}%`, 0, -62);
    c.globalCompositeOperation = 'lighter';
    c.drawImage(glowSprite('#ffe14d', 32), -12, -14, 24, 24);
    c.globalCompositeOperation = 'source-over';
  },
};

// ------------------------------------------------------------------ stage script

const wormA: Pt[] = [
  [100, -30],
  [140, 160],
  [420, 220],
  [460, 380],
  [160, 440],
  [120, 560],
  [300, 780],
];

function* script(g: Game): Task {
  yield 150;
  // W1: worms
  spawnWorm(g, wormA, 520, 12);
  yield 200;
  spawnWorm(g, mirror(wormA), 520, 12);
  yield 330;
  // W2: fork bombs in lanes
  const order = [0, 5, 2, 3, 1, 4];
  for (const li of order) {
    g.spawn(forkbomb, LANES[li], -20, forkScript(Math.PI / 2, 1.1));
    yield 55;
  }
  yield 150;
  // W3: dangling pointers
  for (let i = 0; i < 8; i++) {
    const x = i % 2 ? 90 + i * 20 : PF_W - 90 - i * 20;
    g.spawn(pointer, x, -20, dangle(x, 80 + (i % 3) * 30));
    yield 34;
  }
  yield 150;
  // W4: comment shields drifting ahead of worms
  for (let i = 0; i < 4; i++) g.spawn(comment, 100 + i * 133, -20, fly(0.8, Math.PI / 2));
  yield 40;
  spawnWorm(
    g,
    [
      [-30, 100],
      [300, 150],
      [630, 110],
    ],
    300,
    10,
  );
  yield 200;
  spawnWorm(
    g,
    [
      [630, 60],
      [300, 110],
      [-30, 70],
    ],
    300,
    10,
  );
  yield 260;

  yield* g.fight(smasher);
  yield 90;

  // W5: double worms
  spawnWorm(g, wormA, 480, 10);
  spawnWorm(g, mirror(wormA), 480, 10);
  yield 360;
  // W6: pointer rain + forks
  for (let i = 0; i < 10; i++) {
    const x = 60 + ((i * 7) % 10) * 53;
    g.spawn(pointer, x, -20, dangle(x, 70 + (i % 2) * 40));
    if (i % 3 === 0) g.spawn(forkbomb, PF_W - x, -20, forkScript(Math.PI / 2 + (x < CX ? 0.2 : -0.2), 1.3));
    yield 30;
  }
  yield 180;
  // W7: fork cluster
  for (let i = 0; i < 5; i++) {
    g.spawn(forkbomb, 100 + i * 100, -20, forkScript(Math.PI / 2, 0.9));
    yield 16;
  }
  yield 300;
  for (let i = 0; i < 6; i++) {
    const x = i % 2 ? 120 : 480;
    g.spawn(pointer, x, -20, dangle(x, 100));
    yield 24;
  }
  yield 220;
  yield* g.bossBattle(leak);
}

export const stage3: StageDef = {
  index: 2,
  name: 'The Heap',
  title: 'STAGE 3',
  subtitle: 'everything you allocate comes back',
  music: 'stage3',
  bg: 'heap',
  color: '#ffb000',
  mid: smasher,
  boss: leak,
  script,
};

