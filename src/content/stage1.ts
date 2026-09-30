import { FONT_MONO, PF_W } from '../config';
import { TAU, ease } from '../core/math';
import type { Task } from '../core/tasks';
import type { Bullet } from '../game/bullets';
import type { Game } from '../game/game';
import { fan, fanStack, ring, stack, textLine, stopAndAim } from '../game/patterns';
import type { BossDef, StageDef } from '../game/types';
import { glowSprite } from '../render/sprites';
import { CX, LANES, along, every, fly, mirror, visit, type Pt } from './common';
import { bug, drone404, moth, nan, spinner } from './kinds';
import { halo } from './kinds';

// ------------------------------------------------------------------ midboss: corrupted rubber duck

const duck: BossDef = {
  id: 'duck',
  name: 'RUBBER DUCK',
  title: 'corrupted listener',
  color: '#ffe14d',
  r: 34,
  homeY: 140,
  midboss: true,
  drops: { bomb: 1 },
  phases: [
    {
      hp: 900,
      time: 25,
      *run(b, g) {
        let i = 0;
        yield 30;
        while (true) {
          g.sfx('quack');
          b.charge = 1;
          ring(g, b.x, b.y + 10, g.D.n(14), g.D.s(2.0), g.rng.next() * TAU, 'ball', 'yellow');
          yield 30;
          const a = g.aim(b.x, b.y);
          fanStack(g, b.x, b.y, 3, 0.55, a, g.D.n(4, 2), g.D.s(2.6), g.D.s(4.4), 'orb', 'orange');
          g.sfx('eshot');
          yield 40;
          if (i++ % 2) yield* b.wander(g, 50, 140, 100, 170);
        }
      },
    },
    {
      name: 'Duck.explain() // it never stops talking',
      hp: 1100,
      time: 32,
      *run(b, g) {
        let base = 0;
        let t = 0;
        yield 40;
        while (true) {
          if (t % 60 === 0) {
            g.sfx('quack');
            const n = g.D.pick([4, 5, 6, 7]);
            for (let k = 0; k < n; k++) {
              const a = base + (k / n) * TAU;
              textLine(g, g.rng.pick(['QUACK', 'QUACK', 'qUaCk', 'QUAK?']), b.x + Math.cos(a) * 30, b.y + Math.sin(a) * 30, a, g.D.s(1.7), 'yellow', 21);
            }
            base += 0.33;
          }
          if (t % 30 === 15) {
            const a = g.aim(b.x, b.y);
            fan(g, b.x, b.y, g.D.n(5, 3), 1.2, a, g.D.s(3.5), 'ring', 'white', { accel: -0.06, minSpeed: 0.2, upd: stopAndAim(45, 20, g.D.s(3.2), 0.1) });
          }
          if (t % 240 === 200) yield* b.wander(g, 40, 110, 110, 160);
          t++;
          yield 1;
        }
      },
    },
  ],
  draw(b, g, c, t) {
    halo(c, '#ffd000', 70, 0.35);
    const glitch = Math.random() < 0.06 ? (Math.random() - 0.5) * 10 : 0;
    const bob = Math.sin(t * 0.08) * 3;
    c.translate(glitch, bob);
    // body
    c.fillStyle = b.flash > 0 ? '#ffffff' : '#ffd21f';
    c.strokeStyle = '#1a1400';
    c.lineWidth = 3;
    c.beginPath();
    c.ellipse(0, 10, 34, 22, 0, 0, TAU);
    c.fill();
    c.stroke();
    // tail
    c.beginPath();
    c.moveTo(28, 2);
    c.quadraticCurveTo(42, -10, 38, 6);
    c.fill();
    c.stroke();
    // head
    c.beginPath();
    c.arc(-16, -16, 17, 0, TAU);
    c.fill();
    c.stroke();
    // beak
    c.fillStyle = '#ff7a1f';
    c.beginPath();
    c.moveTo(-30, -16);
    c.quadraticCurveTo(-48, -14 + Math.sin(t * 0.3) * 2, -44, -8);
    c.quadraticCurveTo(-36, -6, -29, -9);
    c.fill();
    c.stroke();
    // corrupted eye
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(-19, -20, 5, 0, TAU);
    c.fill();
    c.fillStyle = '#ff2a4a';
    c.beginPath();
    c.arc(-19, -20, 2.4 + Math.sin(t * 0.2), 0, TAU);
    c.fill();
    // wing
    c.strokeStyle = '#c99a00';
    c.lineWidth = 2;
    c.beginPath();
    c.ellipse(6, 8, 16, 9, -0.2, 0, Math.PI);
    c.stroke();
    // glitch stripes
    c.fillStyle = 'rgba(0,240,255,0.5)';
    for (let i = 0; i < 3; i++) if (Math.random() < 0.3) c.fillRect(-40 + Math.random() * 60, -30 + Math.random() * 60, 20 + Math.random() * 30, 2);
    c.translate(-glitch, -bob);
  },
};

// ------------------------------------------------------------------ boss: infinite loop

function recurse(g: Game, x: number, y: number, a: number, depth: number) {
  const type = (['big', 'ball', 'orb'] as const)[depth];
  const color = (['blue', 'cyan', 'white'] as const)[depth];
  const sp = [2.8, 2.3, 1.9][depth];
  const upd =
    depth < 2
      ? (b: Bullet, gg: Game) => {
          if (b.age >= 46) {
            b.alive = false;
            gg.fx.ring(b.x, b.y, 4, 30, '#00f0ff', 14);
            const n = depth === 0 ? g.D.pick([4, 5, 6, 7]) : g.D.pick([4, 5, 5, 6]);
            const off = gg.rng.next() * TAU;
            for (let k = 0; k < n; k++) recurse(gg, b.x, b.y, off + (k / n) * TAU, depth + 1);
          }
        }
      : undefined;
  g.shoot(x, y, a, g.D.s(sp), type, color, { accel: depth < 2 ? -0.045 : 0, minSpeed: 0.6, upd, delay: depth === 0 ? 10 : 4 });
}

const infiniteLoop: BossDef = {
  id: 'loop',
  name: 'INFINITE LOOP',
  title: 'the recursion that never returns',
  color: '#00f0ff',
  r: 38,
  music: 'boss1',
  drops: { life: 0, bomb: 1 },
  before: [
    { who: 'boss', text: 'Oh, hello. Hello. Hello. Hello. Hello.' },
    { who: 'you', text: 'Found it. The process pinning every core at 100%.' },
    { who: 'boss', text: 'I have been running since 1970. I will be running when the sun burns out.' },
    { who: 'you', text: 'Nothing runs forever. Not on my machine.' },
    { who: 'boss', text: "Then come. Let's see which of us halts first." },
  ],
  after: [
    { who: 'boss', text: 'i = 2147483647 ... i = -2147483648 ... ah. Integer overflow. How elegant.' },
    { who: 'you', text: 'Next time, add a break condition.' },
  ],
  phases: [
    {
      hp: 1500,
      time: 30,
      *run(b, g) {
        let a = 0;
        let t = 0;
        yield 30;
        while (true) {
          const arms = g.D.pick([2, 2, 3, 4]);
          for (let k = 0; k < arms; k++) g.shoot(b.x, b.y, a + (k / arms) * TAU, g.D.s(2.6), 'rice', 'cyan');
          a += 0.19;
          t++;
          if (t % 12 === 0) {
            fan(g, b.x, b.y, g.D.n(5, 3), 0.65, g.aim(b.x, b.y), g.D.s(3.4), 'orb', 'blue');
            g.sfx('eshot');
          }
          if (t % 50 === 0) b.moveTo(CX + g.rng.range(-110, 110), g.rng.range(110, 170), 60, ease.inOutSine);
          yield 4;
        }
      },
    },
    {
      name: 'while (true) { spin(); }',
      hp: 1900,
      time: 40,
      *run(b, g) {
        yield* b.home(30);
        let a = 0;
        let dir = 1;
        let t = 0;
        const arms = g.D.pick([4, 5, 6, 7]);
        while (true) {
          for (let k = 0; k < arms; k++) g.shoot(b.x, b.y, a + (k / arms) * TAU, g.D.s(2.2), 'orb', dir > 0 ? 'cyan' : 'blue', { angVel: dir * 0.0035 });
          a += 0.075 * dir;
          t++;
          if (t % 40 === 0) {
            dir = -dir;
            g.sfx('eshot2');
          }
          b.charge = 0.5 + 0.5 * Math.sin(t * 0.1);
          yield 3;
        }
      },
    },
    {
      hp: 1600,
      time: 30,
      *run(b, g) {
        let i = 0;
        yield 30;
        while (true) {
          const n = (7 + (i % 2)) * 2; // off-by-one: the gap moves every volley
          const a = g.aim(b.x, b.y);
          ring(g, b.x, b.y, g.D.n(n), g.D.s(2.7), a + (i % 2 ? Math.PI / n : 0), 'arrow', i % 2 ? 'cyan' : 'white');
          if (g.lv >= 2) ring(g, b.x, b.y, g.D.n(n), g.D.s(1.9), a + Math.PI / n, 'orb', 'blue');
          g.sfx('eshot');
          i++;
          yield 20;
          if (i % 7 === 0) yield* b.wander(g, 50);
        }
      },
    },
    {
      name: 'for (;;) recurse(); // StackOverflowError',
      hp: 2300,
      time: 45,
      *run(b, g) {
        yield* b.home(30);
        let base = 0;
        while (true) {
          const n = g.D.pick([3, 5, 5, 6]);
          for (let k = 0; k < n; k++) recurse(g, b.x, b.y, base + (k / n) * TAU, 0);
          g.sfx('eshot2');
          base += 0.45;
          yield 20;
          if (g.lv >= 1) stack(g, b.x, b.y, 3, g.aim(b.x, b.y), g.D.s(3), g.D.s(4.5), 'kunai', 'white');
          yield 60;
          yield* b.wander(g, 30, 60, 120, 160);
        }
      },
    },
  ],
  draw(b, g, c, t) {
    halo(c, '#00e5ff', 90, 0.4 + b.charge * 0.2);
    // outer arrows (the loop)
    c.save();
    c.rotate(t * 0.05);
    c.fillStyle = b.flash > 0 ? '#fff' : '#00f0ff';
    for (let i = 0; i < 10; i++) {
      c.save();
      c.rotate((i / 10) * TAU);
      c.translate(0, -48);
      c.beginPath();
      c.moveTo(8, 0);
      c.lineTo(-4, -6);
      c.lineTo(-1, 0);
      c.lineTo(-4, 6);
      c.closePath();
      c.fill();
      c.restore();
    }
    c.restore();
    c.save();
    c.rotate(-t * 0.02);
    c.strokeStyle = 'rgba(0,240,255,0.6)';
    c.lineWidth = 2;
    c.setLineDash([10, 6]);
    c.beginPath();
    c.arc(0, 0, 36, 0, TAU);
    c.stroke();
    c.setLineDash([]);
    c.restore();
    // core
    c.fillStyle = '#021016';
    c.beginPath();
    c.arc(0, 0, 28, 0, TAU);
    c.fill();
    c.strokeStyle = b.flash > 0 ? '#fff' : '#7ff7ff';
    c.lineWidth = 2.5;
    c.stroke();
    // lemniscate
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = '#bffcff';
    c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i <= 60; i++) {
      const s = (i / 60) * TAU;
      const d = 1 + Math.sin(s) ** 2;
      c.lineTo((18 * Math.cos(s)) / d, (18 * Math.sin(s) * Math.cos(s)) / d);
    }
    c.stroke();
    const s = t * 0.12;
    const d = 1 + Math.sin(s) ** 2;
    c.drawImage(glowSprite('#ffffff', 32), (18 * Math.cos(s)) / d - 8, (18 * Math.sin(s) * Math.cos(s)) / d - 8, 16, 16);
    c.globalCompositeOperation = 'source-over';
    // iteration counter
    c.font = `700 10px ${FONT_MONO}`;
    c.textAlign = 'center';
    c.fillStyle = 'rgba(160,250,255,0.8)';
    c.fillText(`i = ${Math.floor(t * 137) % 2147483647}`, 0, -62);
  },
};

// ------------------------------------------------------------------ stage script

const bugA: Pt[] = [
  [90, -20],
  [120, 150],
  [300, 250],
  [480, 190],
  [650, 110],
];
const bugB: Pt[] = [
  [-20, 60],
  [200, 120],
  [320, 300],
  [200, 420],
  [-40, 520],
];

function popShot(color: 'orb' | 'rice' = 'orb') {
  return (e: import('../game/enemy').Enemy, g: Game) => {
    if (g.lv === 0 && g.rng.chance(0.5)) return;
    const a = g.aim(e.x, e.y);
    if (g.lv >= 2) fan(g, e.x, e.y, 3, 0.35, a, g.D.s(3.2), color, 'green');
    else g.shoot(e.x, e.y, a, g.D.s(3), color, 'green');
    g.sfx('eshot');
  };
}

function* script(g: Game): Task {
  yield 150;
  // W1: bug swoops
  for (let i = 0; i < 8; i++) {
    g.spawn(bug, bugA[0][0], bugA[0][1], along(bugA, 210, every(999, popShot(), 55, 1)));
    yield 11;
  }
  yield 70;
  const bugAm = mirror(bugA);
  for (let i = 0; i < 8; i++) {
    g.spawn(bug, bugAm[0][0], bugAm[0][1], along(bugAm, 210, every(999, popShot(), 55, 1)));
    yield 11;
  }
  yield 110;
  // W2: moth crossings
  for (let i = 0; i < 12; i++) {
    const left = i % 2 === 0;
    const x = left ? 40 + (i / 2) * 30 : PF_W - 40 - ((i - 1) / 2) * 30;
    g.spawn(moth, x, -20, fly(2.3, left ? Math.PI / 2 - 0.35 : Math.PI / 2 + 0.35, every(999, popShot('rice'), 45, 1)));
    yield 16;
  }
  yield 120;
  // W3: 404 drones in alternating lanes
  const order = [1, 4, 2, 3, 0, 5];
  for (let i = 0; i < order.length; i++) {
    const x = LANES[order[i]];
    g.spawn(
      drone404,
      x,
      -30,
      visit(x, 110 + (i % 3) * 30, 50, 170, every(55, (e, gg, k) => {
        ring(gg, e.x, e.y, gg.D.n(12), gg.D.s(2.2), k * 0.13 + (gg.rng.next() * 0.2), 'orb', 'cyan');
        gg.sfx('eshot');
      }, 10)),
    );
    // filler bugs
    const p: Pt[] = i % 2 ? bugB : mirror(bugB);
    for (let j = 0; j < 3; j++) g.spawn(bug, p[0][0], p[0][1], along(p, 240));
    yield 72;
  }
  yield 90;
  // W4: spinners + bug stream
  for (const [x, dir] of [
    [150, 1],
    [450, -1],
  ] as const) {
    g.spawn(
      spinner,
      x,
      -30,
      visit(x, 150, 50, 200, function* (e, gg) {
        let a = 0;
        while (true) {
          gg.shoot(e.x, e.y, a, gg.D.s(2.4), 'rice', 'purple');
          if (gg.lv >= 2) gg.shoot(e.x, e.y, a + Math.PI, gg.D.s(2.4), 'rice', 'purple');
          a += 0.3 * dir;
          yield gg.D.i(6, 2);
        }
      }),
    );
  }
  for (let i = 0; i < 16; i++) {
    const s = i % 2 ? 1 : -1;
    const pts: Pt[] = [
      [CX + s * 20, -20],
      [CX + s * 80, 200],
      [CX + s * 240, 330],
      [CX + s * 360, 360],
    ];
    g.spawn(bug, pts[0][0], pts[0][1], along(pts, 200, every(999, popShot(), 70, 1)));
    yield 13;
  }
  yield 150;

  // midboss
  yield* g.fight(duck);
  yield 90;

  // W5: NaN drifting in lanes (Toaplan alternation) + V formations
  const lanes2 = [0, 5, 1, 4, 2, 3];
  for (let i = 0; i < 6; i++) {
    const x = LANES[lanes2[i]];
    g.spawn(
      nan,
      x,
      -20,
      fly(1.1, Math.PI / 2, every(70, (e, gg) => {
        stack(gg, e.x, e.y, gg.D.n(4, 2), gg.aim(e.x, e.y), gg.D.s(2.4), gg.D.s(4.2), 'orb', 'orange');
        gg.sfx('eshot');
      }, 30)),
    );
    for (let j = 0; j < 4; j++) {
      const side = i % 2 ? 1 : -1;
      const sx = side > 0 ? -20 : PF_W + 20;
      const pts: Pt[] = [
        [sx, 60 + j * 16],
        [CX + side * -60, 170 + j * 16],
        [CX + side * 150, 250],
        [side > 0 ? PF_W + 40 : -40, 100],
      ];
      g.spawn(moth, sx, pts[0][1], along(pts, 220));
      yield 8;
    }
    yield 50;
  }
  yield 120;
  // W6: 404 rain
  for (let i = 0; i < 5; i++) {
    const x = 80 + i * 110;
    g.spawn(
      drone404,
      x,
      -30,
      visit(x, 70, 40 + i * 10, 260, function* (e, gg) {
        yield 20;
        while (true) {
          gg.shoot(e.x + gg.rng.range(-10, 10), e.y + 10, Math.PI / 2 + gg.rng.range(-0.25, 0.25), gg.D.s(gg.rng.range(1.8, 3.2)), gg.rng.chance(0.5) ? 'bit0' : 'bit1', 'cyan');
          yield gg.D.i(10, 3);
        }
      }, -Math.PI / 2),
    );
    yield 12;
  }
  yield 200;
  for (let i = 0; i < 10; i++) {
    const p = i % 2 ? bugA : bugAm;
    g.spawn(bug, p[0][0], p[0][1], along(p, 180, every(999, popShot(), 40, 1)));
    yield 14;
  }
  yield 120;
  // W7: finale swarm
  for (let i = 0; i < 24; i++) {
    const x = 60 + ((i * 7) % 12) * 44;
    g.spawn(i % 3 === 0 ? moth : bug, x, -20, fly(2.8, Math.PI / 2 + Math.sin(i) * 0.3, every(999, popShot(), 30 + (i % 4) * 10, 1)));
    yield 9;
  }
  yield 200;
  yield* g.bossBattle(infiniteLoop);
}

export const stage1: StageDef = {
  index: 0,
  name: 'localhost:3000',
  title: 'STAGE 1',
  subtitle: 'where every bug is born',
  music: 'stage1',
  bg: 'grid',
  color: '#00f0ff',
  mid: duck,
  boss: infiniteLoop,
  script,
};
