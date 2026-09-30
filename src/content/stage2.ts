import { FONT_MONO, PF_H, PF_W } from '../config';
import { TAU, angleTo, clamp, ease, turnTowards } from '../core/math';
import type { Task } from '../core/tasks';
import type { Boss } from '../game/boss';
import type { Bullet } from '../game/bullets';
import type { Enemy } from '../game/enemy';
import type { Game } from '../game/game';
import { fan, ring, stack, wave } from '../game/patterns';
import type { BossDef, StageDef } from '../game/types';
import { CX, LANES, along, every, fly, mirror, visit, type Pt, type Script } from './common';
import { cookie, crawler, halo, moth, popup, spinner } from './kinds';

// ------------------------------------------------------------------ shared enemy scripts

/** Tracking cookie: drifts down while steering toward the player. */
const tracking: Script = function* (e, g) {
  let a = Math.PI / 2;
  const sp = 1.4;
  e.run(every(90, (en, gg) => {
    gg.shoot(en.x, en.y, gg.aim(en.x, en.y), gg.D.s(2.8), gg.rng.chance(0.5) ? 'bit0' : 'bit1', 'pink');
    if (gg.lv >= 2) gg.shoot(en.x, en.y, gg.aim(en.x, en.y) + 0.25, gg.D.s(2.6), 'bit1', 'pink');
  }, 40 + g.rng.int(0, 40))(e, g));
  for (let i = 0; i < 300; i++) {
    a = turnTowards(a, g.aim(e.x, e.y), 0.012);
    e.vx = Math.cos(a) * sp;
    e.vy = Math.max(0.4, Math.sin(a) * sp);
    yield;
  }
  e.vy = 2;
};

/** A window pops open, fires a few fans, then closes. */
function popupScript(x: number, y: number, volleys = 3): Script {
  return function* (e, g) {
    e.x = e.px = x;
    e.y = e.py = y;
    e.scale = 0.05;
    e.invuln = 20;
    for (let i = 0; i <= 12; i++) {
      e.scale = ease.outBack(i / 12);
      yield;
    }
    for (let v = 0; v < volleys; v++) {
      yield 30;
      const a = g.aim(e.x, e.y);
      fan(g, e.x, e.y, g.D.n(5, 3), 0.9, a, g.D.s(2.9), 'arrow', 'magenta');
      if (g.lv >= 1) fan(g, e.x, e.y, g.D.n(4, 2), 0.7, a, g.D.s(2.1), 'arrow', 'pink');
      g.sfx('eshot');
      yield 20;
    }
    yield 20;
    for (let i = 12; i >= 0; i--) {
      e.scale = Math.max(0.05, i / 12);
      yield;
    }
    e.alive = false; // closed by the user... eventually
  };
}

/** Web crawler: lowers itself on a thread, fires rings, climbs back up. */
function crawl(x: number, y: number, rings = 3): Script {
  return function* (e, g) {
    e.data.thread = 1;
    yield* e.moveWait(x, y, 80, ease.outCubic);
    for (let i = 0; i < rings; i++) {
      ring(g, e.x, e.y, g.D.n(12), g.D.s(2.1), g.rng.next() * TAU, 'orb', 'purple');
      if (g.lv >= 2) ring(g, e.x, e.y, g.D.n(12), g.D.s(1.5), g.rng.next() * TAU, 'orb', 'magenta');
      g.sfx('eshot');
      yield 45;
    }
    yield* e.moveWait(x, -60, 90, ease.inCubic);
    e.alive = false;
  };
}

// ------------------------------------------------------------------ midboss: pop-up hydra

const miniPopup = { ...popup, id: 'popupMini', hp: 18, score: 600, drops: { power: 1, bits: 1 } };

function safeSpot(g: Game, minDist = 150): [number, number] {
  for (let i = 0; i < 20; i++) {
    const x = g.rng.range(60, PF_W - 60);
    const y = g.rng.range(80, PF_H * 0.6);
    if (Math.hypot(x - g.player.x, y - g.player.y) > minDist) return [x, y];
  }
  return [g.rng.range(60, PF_W - 60), 100];
}

const hydra: BossDef = {
  id: 'hydra',
  name: 'POP-UP HYDRA',
  title: 'close one, two more open',
  color: '#ff2bd6',
  r: 42,
  homeY: 140,
  midboss: true,
  drops: { life: 1 },
  phases: [
    {
      hp: 1150,
      time: 26,
      *run(b, g) {
        let t = 0;
        yield 30;
        while (true) {
          if (t % 50 === 0) {
            fan(g, b.x, b.y + 20, g.D.n(7, 4), 1.1, g.aim(b.x, b.y), g.D.s(3.0), 'arrow', 'magenta');
            g.sfx('eshot');
          }
          if (t % 150 === 75) {
            for (let k = 0; k < 2; k++) {
              const [x, y] = safeSpot(g, 170);
              g.spawn(miniPopup, x, y, popupScript(x, Math.min(y, 320), 2));
            }
          }
          if (t % 200 === 199) b.moveTo(CX + g.rng.range(-140, 140), g.rng.range(110, 170), 60, ease.inOutSine);
          t++;
          yield;
        }
      },
    },
    {
      name: 'window.open() × ∞',
      hp: 1450,
      time: 32,
      *run(b, g) {
        yield* b.home(30);
        let t = 0;
        while (true) {
          if (t % g.D.pick([70, 50, 40, 32]) === 0) {
            // a "window" of stationary bullets appears, then bursts open
            const [cx, cy] = safeSpot(g, 140);
            const w = 70;
            const h = 50;
            const pts: [number, number][] = [];
            for (let i = 0; i <= 5; i++) pts.push([cx - w / 2 + (w * i) / 5, cy - h / 2], [cx - w / 2 + (w * i) / 5, cy + h / 2]);
            for (let i = 1; i < 4; i++) pts.push([cx - w / 2, cy - h / 2 + (h * i) / 4], [cx + w / 2, cy - h / 2 + (h * i) / 4]);
            for (const [x, y] of pts) {
              g.shoot(x, y, angleTo(cx, cy, x, y), 0, 'orb', 'magenta', {
                delay: 36,
                upd: (bl: Bullet) => {
                  if (bl.age > 64 && bl.speed === 0) {
                    bl.speed = 0.3;
                    bl.accel = 0.05;
                    bl.maxSpeed = g.D.s(2.4);
                  }
                },
              });
            }
            g.fx.ring(cx, cy, 10, 60, '#ff2bd6', 30);
          }
          if (t % 90 === 45) {
            ring(g, b.x, b.y, g.D.n(10), g.D.s(1.6), g.aim(b.x, b.y), 'ring', 'white');
            g.sfx('eshot2');
          }
          t++;
          yield;
        }
      },
    },
  ],
  draw(b, g, c, t) {
    halo(c, '#ff00cc', 80, 0.3);
    // heads behind
    for (let i = 0; i < 2; i++) {
      const s = i ? 1 : -1;
      c.save();
      c.translate(s * 46, -24 + Math.sin(t * 0.05 + i) * 6);
      c.rotate(s * 0.15);
      c.fillStyle = '#12051a';
      c.fillRect(-30, -20, 60, 40);
      c.fillStyle = i ? '#4d8dff' : '#39ff88';
      c.fillRect(-30, -20, 60, 8);
      c.strokeStyle = '#ff7ae6';
      c.strokeRect(-30, -20, 60, 40);
      c.font = `800 7px ${FONT_MONO}`;
      c.textAlign = 'center';
      c.fillStyle = '#ffe14d';
      c.fillText(i ? 'HOT SINGLES' : 'FREE RAM', 0, 4);
      c.restore();
    }
    c.fillStyle = '#12051a';
    c.fillRect(-60, -38, 120, 80);
    c.fillStyle = b.flash > 0 ? '#fff' : '#ff2bd6';
    c.fillRect(-60, -38, 120, 12);
    c.strokeStyle = '#ff7ae6';
    c.lineWidth = 2;
    c.strokeRect(-60, -38, 120, 80);
    c.font = `800 8px ${FONT_MONO}`;
    c.textAlign = 'left';
    c.fillStyle = '#fff';
    c.fillText('ads.exe', -55, -29);
    // the close button runs away from the player
    const dx = clamp((b.x - g.player.x) * 0.05, -8, 8);
    c.fillStyle = '#ff3b5c';
    c.fillRect(44 + dx, -37, 14, 10);
    c.fillStyle = '#fff';
    c.textAlign = 'center';
    c.fillText('✕', 51 + dx, -29);
    const blink = Math.floor(t / 10) % 2 === 0;
    c.font = `900 11px ${FONT_MONO}`;
    c.fillStyle = blink ? '#ffe14d' : '#ff7ae6';
    c.fillText('CONGRATULATIONS', 0, -6);
    c.font = `700 8px ${FONT_MONO}`;
    c.fillStyle = '#cfe3ff';
    c.fillText("you're the 1,000,000th visitor", 0, 8);
    c.fillStyle = b.flash > 0 ? '#fff' : '#39ff88';
    c.fillRect(-26, 20, 52, 14);
    c.fillStyle = '#000';
    c.fillText('CLAIM', 0, 30);
  },
};

// ------------------------------------------------------------------ boss: spaghetti code

function tip(b: Boss, i: number): [number, number] {
  const a = Math.PI / 2 + (i - 3) * 0.42 + Math.sin(b.age * 0.03 + i * 1.7) * 0.3;
  const len = 64 + Math.sin(b.age * 0.05 + i) * 10;
  return [b.x + Math.cos(a) * len, b.y + Math.sin(a) * len];
}

function callbackBig(g: Game, x: number, y: number, a: number) {
  let n = 0;
  g.shoot(x, y, a, g.D.s(1.1), 'big', 'orange', {
    upd: (bl, gg) => {
      if (bl.delay > 0) return;
      bl.data.cd = (bl.data.cd ?? 30) - gg.ts;
      if (bl.data.cd <= 0) {
        bl.data.cd = 38;
        n++;
        const nested = n % 3 === 0;
        const off = gg.rng.next() * TAU;
        const cnt = gg.D.n(8, 5);
        for (let k = 0; k < cnt; k++) {
          const aa = off + (k / cnt) * TAU;
          if (nested) {
            gg.shoot(bl.x, bl.y, aa, gg.D.s(1.5), 'ball', 'yellow', {
              upd: (c2, g3) => {
                if (c2.age >= 44 && !c2.data.fired) {
                  c2.data.fired = 1;
                  fan(g3, c2.x, c2.y, 3, 0.3, g3.aim(c2.x, c2.y), g3.D.s(2.4), 'rice', 'white', { delay: 4 });
                }
              },
            });
          } else gg.shoot(bl.x, bl.y, aa, gg.D.s(1.7), 'orb', 'orange', { delay: 6 });
        }
      }
    },
  });
}

const spaghetti: BossDef = {
  id: 'spaghetti',
  name: 'SPAGHETTI CODE',
  title: 'the unmaintainable tangle',
  color: '#ff9a3c',
  r: 40,
  music: 'boss2',
  drops: { bomb: 1 },
  before: [
    { who: 'boss', text: 'Mamma mia! A debugger! Nobody has read me since 2009!' },
    { who: 'you', text: 'Seventeen thousand lines in a single function. Who wrote you?' },
    { who: 'boss', text: 'Everyone! Nobody! A contractor named Gary! It is all... interconnected.' },
    { who: 'you', text: 'Time to refactor.' },
    { who: 'boss', text: 'You cannot refactor what you cannot understand! AL DENTE!' },
  ],
  after: [
    { who: 'boss', text: '...you extracted my methods. I feel so... modular.' },
    { who: 'you', text: 'And documented. You are welcome.' },
  ],
  phases: [
    {
      hp: 1800,
      time: 30,
      *run(b, g) {
        let t = 0;
        yield 30;
        while (true) {
          if (t % 5 === 0) {
            for (let k = 0; k < 7; k += g.lv >= 2 ? 2 : 3) {
              const i = (k + Math.floor(t / 5)) % 7;
              const [x, y] = tip(b, i);
              const a = Math.PI / 2 + (i - 3) * 0.3;
              g.shoot(x, y, a, g.D.s(2.4), 'rice', 'yellow', { upd: wave(0.4, 0.06) });
            }
          }
          if (t % 60 === 30) {
            fan(g, b.x, b.y, g.D.n(5, 3), 0.7, g.aim(b.x, b.y), g.D.s(3.4), 'orb', 'orange');
            g.sfx('eshot');
          }
          if (t % 180 === 179) b.moveTo(CX + g.rng.range(-120, 120), g.rng.range(110, 160), 60, ease.inOutSine);
          t++;
          yield;
        }
      },
    },
    {
      name: 'goto considered_harmful;',
      hp: 2200,
      time: 40,
      *run(b, g) {
        yield* b.home(30);
        let t = 0;
        while (true) {
          if (t % 42 === 0) {
            for (const side of [0, PF_W]) {
              const a = angleTo(b.x, b.y, side, g.player.y + g.rng.range(-60, 60));
              fan(g, b.x, b.y, g.D.n(6, 3), 0.5, a, g.D.s(2.6), 'kunai', side ? 'orange' : 'yellow', { wrap: 1 });
            }
            g.sfx('eshot2');
          }
          if (t % 90 === 60) stack(g, b.x, b.y, g.D.n(3, 2), g.aim(b.x, b.y), g.D.s(2.5), g.D.s(4), 'ball', 'red');
          t++;
          yield;
        }
      },
    },
    {
      hp: 1900,
      time: 30,
      *run(b, g) {
        let i = 0;
        yield 30;
        while (true) {
          const dir = i % 2 ? 1 : -1;
          ring(g, b.x, b.y, g.D.n(18), g.D.s(2.0), i * 0.21, 'rice', dir > 0 ? 'yellow' : 'orange', { angVel: dir * 0.009 });
          g.sfx('eshot');
          i++;
          yield 26;
          if (i % 8 === 0) yield* b.wander(g, 50);
        }
      },
    },
    {
      name: 'callback(callback(callback(hell)))',
      hp: 2500,
      time: 45,
      *run(b, g) {
        yield* b.home(30);
        while (true) {
          const a = g.aim(b.x, b.y);
          const n = g.D.pick([2, 3, 3, 4]);
          for (let k = 0; k < n; k++) callbackBig(g, b.x, b.y, a + (k - (n - 1) / 2) * 0.7);
          g.sfx('eshot2');
          yield 150;
          yield* b.wander(g, 40, 100, 110, 150);
        }
      },
    },
    {
      name: 'git merge --no-ff // <<<<<<< HEAD',
      hp: 2300,
      time: 42,
      *run(b, g) {
        yield* b.home(30);
        let t = 0;
        let k = 0;
        while (true) {
          if (t % g.D.pick([110, 90, 78, 66]) === 0) {
            const kind = k % 3;
            const sp = g.D.s(1.5);
            if (kind === 0 || kind === 1) {
              // vertical wall of < or > with a gap
              const fromLeft = kind === 0;
              const gapY = g.rng.range(140, PF_H - 120);
              for (let y = 12; y < PF_H; y += 22) {
                if (Math.abs(y - gapY) < 50) continue;
                g.shoot(fromLeft ? -10 : PF_W + 10, y, fromLeft ? 0 : Math.PI, sp, 'glyph', fromLeft ? 'green' : 'red', { glyph: fromLeft ? '<' : '>', cullGrace: 60, delay: 14 });
              }
            } else {
              // horizontal ======= row with a gap, falling
              const gapX = g.rng.range(90, PF_W - 90);
              for (let x = 12; x < PF_W; x += 22) {
                if (Math.abs(x - gapX) < 48) continue;
                g.shoot(x, -8, Math.PI / 2, sp * 0.9, 'glyph', 'white', { glyph: '=', cullGrace: 60, delay: 14 });
              }
            }
            k++;
            g.sfx('eshot2');
          }
          if (g.lv >= 1 && t % 70 === 35) fan(g, b.x, b.y, 3, 0.4, g.aim(b.x, b.y), g.D.s(2.4), 'orb', 'orange');
          t++;
          yield;
        }
      },
    },
  ],
  draw(b, g, c, t) {
    halo(c, '#ff6a00', 90, 0.35);
    // noodles
    for (let i = 0; i < 7; i++) {
      const [tx, ty] = tip(b, i);
      const lx = tx - b.x;
      const ly = ty - b.y;
      const mx = lx * 0.5 + Math.sin(t * 0.08 + i) * 16;
      const my = ly * 0.5 + Math.cos(t * 0.07 + i * 2) * 12;
      for (const [w, col] of [
        [7, '#5a2e00'],
        [4, b.flash > 0 ? '#fff' : '#ffd27a'],
      ] as const) {
        c.strokeStyle = col;
        c.lineWidth = w;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(0, 0);
        c.quadraticCurveTo(mx, my, lx, ly);
        c.stroke();
      }
    }
    // meatball
    c.fillStyle = b.flash > 0 ? '#fff' : '#8a3b1a';
    c.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      const r = 32 + Math.sin(i * 3.3 + t * 0.05) * 3;
      c.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    c.closePath();
    c.fill();
    c.strokeStyle = '#3a1405';
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = '#b8552a';
    for (let i = 0; i < 6; i++) c.fillRect(Math.cos(i * 2.1) * 16 - 3, Math.sin(i * 1.7) * 14 - 2, 6, 3);
    // googly eyes
    const a = Math.atan2(g.player.y - b.y, g.player.x - b.x);
    for (const s of [-1, 1]) {
      const ex = s * 13;
      const ey = -30;
      c.strokeStyle = '#ffd27a';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(s * 6, -22);
      c.lineTo(ex, ey + 8);
      c.stroke();
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(ex, ey, 10, 0, TAU);
      c.fill();
      c.strokeStyle = '#000';
      c.lineWidth = 1.5;
      c.stroke();
      const wob = Math.sin(t * 0.3 + s) * 1.5;
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(ex + Math.cos(a) * 4 + wob, ey + Math.sin(a) * 4, 4.5, 0, TAU);
      c.fill();
    }
    c.font = `800 9px ${FONT_MONO}`;
    c.textAlign = 'center';
    c.fillStyle = '#ffe2b0';
    c.fillText('main()', 0, 8);
  },
};

// ------------------------------------------------------------------ stage script

function* script(g: Game): Task {
  yield 150;
  // W1: tracking cookies
  for (let i = 0; i < 10; i++) {
    g.spawn(cookie, i % 2 ? 160 : 440, -20, tracking);
    yield 24;
  }
  yield 160;
  // W2: pop-ups in alternating lanes
  const lanes = [1, 4, 2, 5, 0, 3];
  for (let i = 0; i < lanes.length; i++) {
    const x = LANES[lanes[i]];
    g.spawn(popup, x, 100 + (i % 3) * 50, popupScript(x, 100 + (i % 3) * 50));
    const side = i % 2 ? 1 : -1;
    for (let j = 0; j < 3; j++) {
      const pts: Pt[] = [
        [side > 0 ? -20 : PF_W + 20, 40 + j * 20],
        [CX, 200 + j * 20],
        [side > 0 ? PF_W + 40 : -40, 360],
      ];
      g.spawn(moth, pts[0][0], pts[0][1], along(pts, 230));
      yield 10;
    }
    yield 60;
  }
  yield 100;
  // W3: web crawlers
  for (let i = 0; i < 6; i++) {
    const x = [120, 480, 240, 360, 80, 520][i];
    g.spawn(crawler, x, -30, crawl(x, 140 + (i % 3) * 50));
    yield 70;
  }
  yield 60;
  // W4: spinners flank a cookie column
  for (const x of [110, 490]) {
    g.spawn(
      spinner,
      x,
      -30,
      visit(x, 130, 50, 220, function* (e, gg) {
        let a = 0;
        while (true) {
          for (let k = 0; k < 3; k++) gg.shoot(e.x, e.y, a + (k / 3) * TAU, gg.D.s(2.2), 'rice', 'magenta');
          a += 0.17;
          yield gg.D.i(7, 3);
        }
      }),
    );
  }
  for (let i = 0; i < 8; i++) {
    g.spawn(cookie, CX + g.rng.range(-60, 60), -20, tracking);
    yield 26;
  }
  yield 180;

  yield* g.fight(hydra);
  yield 90;

  // W5: cookie swarm + popups
  for (let i = 0; i < 12; i++) {
    g.spawn(cookie, 60 + ((i * 5) % 12) * 44, -20, tracking);
    if (i % 4 === 3) {
      const x = LANES[(i * 2) % 6];
      g.spawn(popup, x, 150, popupScript(x, 150, 2));
    }
    yield 22;
  }
  yield 140;
  // W6: crawler line + bit rain
  for (let i = 0; i < 5; i++) {
    const x = 80 + i * 110;
    g.spawn(crawler, x, -30, crawl(x, 110 + Math.abs(i - 2) * 40, 2));
    yield 30;
  }
  yield 120;
  for (let i = 0; i < 16; i++) {
    const left = i % 2 === 0;
    g.spawn(moth, left ? -20 : PF_W + 20, 80 + (i % 4) * 30, fly(2.6, left ? 0.25 : Math.PI - 0.25, every(999, (e, gg) => {
      gg.shoot(e.x, e.y, gg.aim(e.x, e.y), gg.D.s(3), 'rice', 'pink');
    }, 35, 1)));
    yield 12;
  }
  yield 120;
  // W7: pop-up barrage
  for (let i = 0; i < 8; i++) {
    const x = 70 + ((i * 3) % 8) * 66;
    const y = 90 + (i % 3) * 60;
    g.spawn(popup, x, y, popupScript(x, y, 2));
    yield 34;
  }
  yield 220;
  yield* g.bossBattle(spaghetti);
}

export const stage2: StageDef = {
  index: 1,
  name: 'The World Wide Web',
  title: 'STAGE 2',
  subtitle: 'accept all cookies?',
  music: 'stage2',
  bg: 'dom',
  color: '#ff2bd6',
  mid: hydra,
  boss: spaghetti,
  script,
};

