import { FONT_MONO, PF_H, PF_W } from '../config';
import { TAU, angleTo, ease } from '../core/math';
import type { Task } from '../core/tasks';
import type { Boss } from '../game/boss';
import type { Bullet } from '../game/bullets';
import type { Game } from '../game/game';
import { fan, ring, stack, textLine, wave } from '../game/patterns';
import type { BossDef, StageDef } from '../game/types';
import { glowSprite } from '../render/sprites';
import { CX, LANES, along, every, fly, mirror, visit, type Pt, type Script } from './common';
import { cronling, daemon, firewall, halo, rootkit, turret, virus } from './kinds';

// ------------------------------------------------------------------ enemy scripts

function rootkitScript(x: number, y: number): Script {
  return function* (e, g) {
    e.x = e.px = x;
    e.y = e.py = y;
    e.invuln = 30;
    e.contact = false;
    e.scale = 0.2;
    for (let i = 0; i <= 20; i++) {
      e.scale = i / 20;
      yield;
    }
    e.contact = true;
    for (let v = 0; v < 2; v++) {
      yield 30;
      stack(g, e.x, e.y, g.D.n(4, 2), g.aim(e.x, e.y), g.D.s(2.8), g.D.s(4.6), 'kunai', 'magenta');
      if (g.lv >= 2) fan(g, e.x, e.y, 3, 0.5, g.aim(e.x, e.y), g.D.s(2.4), 'kunai', 'pink');
      g.sfx('eshot');
    }
    yield 30;
    e.contact = false;
    for (let i = 20; i >= 0; i--) {
      e.scale = Math.max(0.05, i / 20);
      yield;
    }
    e.alive = false;
  };
}

const virusDrift = (angle: number): Script =>
  function* (e, g) {
    e.setVel(1.3, angle);
    e.run(every(60, (en, gg, i) => {
      ring(gg, en.x, en.y, gg.D.n(12), gg.D.s(2), i * 0.3, 'ball', 'green');
      gg.sfx('eshot2');
    }, 30)(e, g));
    yield 1200;
  };

function daemonScript(x: number, y: number): Script {
  return visit(x, y, 60, 300, function* (e, g) {
    let a = 0;
    let t = 0;
    while (true) {
      if (t % 5 === 0) {
        for (let k = 0; k < 2; k++) g.shoot(e.x, e.y, a + k * Math.PI, g.D.s(2.4), 'rice', 'red');
        a += 0.21;
      }
      if (t % 70 === 0) {
        fan(g, e.x, e.y, g.D.n(5, 3), 0.6, g.aim(e.x, e.y), g.D.s(3.2), 'ball', 'orange');
        g.sfx('eshot');
      }
      t++;
      yield;
    }
  });
}

function firewallScript(x: number): Script {
  return visit(x, 90, 60, 260, function* (e, g) {
    while (true) {
      for (let k = 0; k < g.D.n(3, 2); k++) {
        const a = -Math.PI / 2 + g.rng.range(-0.9, 0.9);
        g.shoot(e.x + g.rng.range(-20, 20), e.y - 10, a, g.D.s(g.rng.range(3, 4.2)), 'orb', g.rng.chance(0.5) ? 'orange' : 'yellow', { ay: 0.05, maxSpeed: 3.4, cullGrace: 120 });
      }
      yield 14;
    }
  }, -Math.PI / 2);
}

function turretScript(x: number, y: number, dir: number): Script {
  return visit(x, y, 60, 320, function* (e, g) {
    let a = 0;
    while (true) {
      for (let k = 0; k < 4; k++) g.shoot(e.x, e.y, a + (k / 4) * TAU, g.D.s(2.2), 'orb', 'yellow');
      a += 0.12 * dir;
      yield g.D.i(6, 3);
    }
  });
}

// ------------------------------------------------------------------ midboss: the cron job

const cron: BossDef = {
  id: 'cron',
  name: 'THE CRON JOB',
  title: 'it runs at midnight. it is always midnight.',
  color: '#ffe14d',
  r: 40,
  homeY: 150,
  midboss: true,
  drops: { bomb: 1, life: 1 },
  setup(b) {
    b.data.hand = -Math.PI / 2;
  },
  phases: [
    {
      hp: 1600,
      time: 28,
      *run(b, g) {
        let tick = 0;
        yield 30;
        while (true) {
          b.data.hand += TAU / 12;
          const a = b.data.hand;
          stack(g, b.x + Math.cos(a) * 30, b.y + Math.sin(a) * 30, g.D.n(5, 3), a, g.D.s(2), g.D.s(4), 'arrow', 'yellow');
          if (g.lv >= 1) stack(g, b.x, b.y, g.D.n(3, 2), g.aim(b.x, b.y), g.D.s(2.6), g.D.s(3.8), 'orb', 'white');
          g.sfx('tick');
          tick++;
          if (tick % 6 === 0) {
            ring(g, b.x, b.y, g.D.n(22), g.D.s(1.9), a, 'ball', 'gold');
            g.sfx('eshot2');
          }
          yield 26;
        }
      },
    },
    {
      name: '0 * * * * rm -rf / --no-preserve-root',
      hp: 2000,
      time: 36,
      *run(b, g) {
        yield* b.home(30);
        let t = 0;
        let dir = 1;
        while (true) {
          b.data.hand += 0.034 * dir;
          const a = b.data.hand;
          if (t % 3 === 0) {
            g.shoot(b.x + Math.cos(a) * 36, b.y + Math.sin(a) * 36, a, g.D.s(2.5), 'kunai', 'yellow');
            if (g.lv >= 1) g.shoot(b.x - Math.cos(a) * 36, b.y - Math.sin(a) * 36, a + Math.PI, g.D.s(2.5), 'kunai', 'orange');
          }
          if (t % 120 === 119) {
            dir = -dir;
            ring(g, b.x, b.y, g.D.n(24), g.D.s(1.6), a, 'star', 'white');
            g.fx.text(b.x, b.y - 60, '*/2 * * * *', '#ffe14d', 50, 12);
            g.sfx('eshot2');
          }
          t++;
          yield;
        }
      },
    },
  ],
  draw(b, g, c, t) {
    halo(c, '#ffd000', 80, 0.35);
    c.save();
    c.rotate(t * 0.01);
    c.fillStyle = '#2a2200';
    for (let i = 0; i < 16; i++) {
      c.save();
      c.rotate((i / 16) * TAU);
      c.fillRect(-5, -48, 10, 10);
      c.restore();
    }
    c.restore();
    c.fillStyle = b.flash > 0 ? '#fff' : '#141000';
    c.beginPath();
    c.arc(0, 0, 40, 0, TAU);
    c.fill();
    c.strokeStyle = '#ffe14d';
    c.lineWidth = 3;
    c.stroke();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      c.lineWidth = i % 3 ? 1.5 : 3;
      c.beginPath();
      c.moveTo(Math.cos(a) * 32, Math.sin(a) * 32);
      c.lineTo(Math.cos(a) * 38, Math.sin(a) * 38);
      c.stroke();
    }
    const h = b.data.hand ?? 0;
    c.lineCap = 'round';
    c.strokeStyle = '#ff3b5c';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(h) * 30, Math.sin(h) * 30);
    c.stroke();
    c.strokeStyle = '#ffe14d';
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(h / 12) * 18, Math.sin(h / 12) * 18);
    c.stroke();
    c.font = `800 8px ${FONT_MONO}`;
    c.textAlign = 'center';
    c.fillStyle = '#ffe14d';
    c.fillText('* * * * *', 0, 58);
  },
};

// ------------------------------------------------------------------ boss: kernel panic

function segfault(b: Boss, g: Game): Task {
  return (function* (): Task {
    while (true) {
      const segs = 4;
      const w = PF_W / segs;
      const safe = g.rng.int(0, segs - 1);
      const bounds = [1, 2, 3].map((i) => i * w + g.rng.range(-20, 20));
      for (const x of bounds) g.laser(x, -40, Math.PI / 2, { len: PF_H + 80, width: 22, warn: 80, active: 230, color: 'red' });
      // highlight the safe segment during the warning
      const x0 = safe === 0 ? 0 : bounds[safe - 1];
      const x1 = safe === segs - 1 ? PF_W : bounds[safe];
      for (let i = 0; i < 80; i += 10) {
        g.fx.glow((x0 + x1) / 2, PF_H * 0.75, 70, '#39ff88', 12);
        yield 10;
      }
      g.fx.text((x0 + x1) / 2, PF_H * 0.7, 'mapped', '#39ff88', 40, 12);
      for (let f = 0; f < 230; f++) {
        for (let s = 0; s < segs; s++) {
          const sx0 = s === 0 ? 0 : bounds[s - 1];
          const sx1 = s === segs - 1 ? PF_W : bounds[s];
          const rate = s === safe ? 22 : g.D.pick([7, 5, 4, 3]);
          if (f % rate === 0) g.shoot(g.rng.range(sx0 + 14, sx1 - 14), -6, Math.PI / 2 + g.rng.range(-0.08, 0.08), g.D.s(g.rng.range(2.6, 3.8)), s === safe ? 'orb' : 'bit1', s === safe ? 'green' : 'red', { cullGrace: 30 });
        }
        if (f % 60 === 30) fan(g, b.x, b.y, 3, 0.35, g.aim(b.x, b.y), g.D.s(2.4), 'ball', 'white');
        yield;
      }
      yield 30;
    }
  })();
}

const BSOD_PHRASES = ['YOUR PC', 'RAN INTO', 'A PROBLEM', 'AND NEEDS', 'TO RESTART', ':(', '0% COMPLETE', 'STOP CODE'];

function haltingMotif(b: Boss, g: Game, m: number, t: number) {
  const k = t;
  switch (m) {
    case 0: // infinite loop flower
      if (k % 4 === 0) {
        const arms = g.D.pick([4, 5, 6, 7]);
        const dir = Math.floor(k / 120) % 2 ? 1 : -1;
        for (let i = 0; i < arms; i++) g.shoot(b.x, b.y, (b.data.a ?? 0) + (i / arms) * TAU, g.D.s(2.2), 'orb', 'cyan', { angVel: dir * 0.004 });
        b.data.a = (b.data.a ?? 0) + 0.08 * dir;
      }
      break;
    case 1: // spaghetti waves from the sides
      if (k % 9 === 0) {
        for (const side of [0, PF_W]) g.shoot(side, g.rng.range(40, 300), side ? Math.PI - 0.3 : 0.3, g.D.s(2.3), 'rice', 'yellow', { upd: wave(0.5, 0.05), cullGrace: 60 });
      }
      if (k % 50 === 0) fan(g, b.x, b.y, g.D.n(5, 3), 0.8, g.aim(b.x, b.y), g.D.s(3), 'orb', 'orange');
      break;
    case 2: // memory leak: rings that stop, then drip
      if (k % 36 === 0) {
        ring(g, b.x, b.y, g.D.n(14), g.D.s(3), g.rng.next() * TAU, 'orb', 'gold', {
          accel: -0.06,
          minSpeed: 0,
          upd: (bl: Bullet) => {
            if (bl.age > 150 && !bl.data.d) {
              bl.data.d = 1;
              bl.ay = 0.03;
              bl.maxSpeed = 2.6;
            }
          },
        });
      }
      break;
    case 3: // race condition: mirrored ghosts
      if (k % 40 === 0) {
        for (const gx of [120, PF_W - 120]) fan(g, gx, 120, g.D.n(7, 4), 1.0, angleTo(gx, 120, g.player.x, g.player.y), g.D.s(2.8), 'kunai', gx < CX ? 'cyan' : 'magenta');
        g.fx.glow(120, 120, 30, '#00f0ff', 20);
        g.fx.glow(PF_W - 120, 120, 30, '#ff2bd6', 20);
      }
      break;
    case 4: // segfault rain everywhere, with shifting lanes
      if (k % 4 === 0) {
        const gap = PF_W / 2 + Math.sin(k * 0.012) * 200;
        const x = g.rng.range(10, PF_W - 10);
        if (Math.abs(x - gap) > 55) g.shoot(x, -6, Math.PI / 2, g.D.s(3), 'bit0', 'red', { cullGrace: 30 });
      }
      break;
  }
}

const kernel: BossDef = {
  id: 'kernel',
  name: 'KERNEL PANIC',
  title: 'the fatal exception at ring 0',
  color: '#ff3b5c',
  r: 44,
  music: 'boss5',
  bombResist: 0.2,
  drops: {},
  before: [
    { who: 'sys', text: '*** STOP: 0x000000EF (CRITICAL_PROCESS_DIED)' },
    { who: 'boss', text: 'SO. THE CURSOR REACHES RING ZERO.' },
    { who: 'you', text: 'Every bug up there traces back to you.' },
    { who: 'boss', text: 'I AM NOT A BUG. I AM WHAT HAPPENS WHEN EVERYTHING ELSE FAILS.' },
    { who: 'boss', text: 'WHEN I PANIC, THE WHOLE MACHINE STOPS. INCLUDING YOU.' },
    { who: 'you', text: "Then let's see if you can handle an exception." },
  ],
  after: [
    { who: 'boss', text: 'SYSTEM... RECOVERING... CORE DUMP... COMPLETE...' },
    { who: 'you', text: 'Reboot clean. And this time, write the tests first.' },
  ],
  phases: [
    {
      hp: 2800,
      time: 35,
      *run(b, g) {
        let t = 0;
        yield 30;
        while (true) {
          if (t % 20 === 0) {
            const i = t / 20;
            ring(g, b.x, b.y, g.D.n(18), g.D.s(2.2), i % 2 ? Math.PI / 18 : 0, i % 3 ? 'orb' : 'ball', i % 2 ? 'red' : 'pink');
          }
          if (t % 50 === 25) {
            fan(g, b.x, b.y, g.D.n(7, 4), 1.0, g.aim(b.x, b.y), g.D.s(3.4), 'kunai', 'white');
            g.sfx('eshot');
          }
          if (t % 200 === 199) b.moveTo(CX + g.rng.range(-120, 120), g.rng.range(120, 170), 60, ease.inOutSine);
          t++;
          yield;
        }
      },
    },
    {
      name: '0xDEADBEEF',
      hp: 3200,
      time: 45,
      *run(b, g) {
        yield* b.home(30);
        const hex = 'DEADBEEF';
        let t = 0;
        let ci = 0;
        while (true) {
          if (t % 6 === 0) {
            const arms = g.D.pick([4, 6, 7, 8]);
            const base = t * 0.018;
            for (let k = 0; k < arms; k++) g.shoot(b.x, b.y, base + (k / arms) * TAU, g.D.s(2.1), 'glyph', k % 2 ? 'red' : 'pink', { glyph: hex[ci % 8] });
            ci++;
          }
          if (t % 110 === 55) {
            const x = g.rng.range(170, PF_W - 170);
            textLine(g, 'DEAD', x - 70 - 40, -10, Math.PI / 2, g.D.s(1.6), 'orange', 22, { cullGrace: 60 });
            textLine(g, 'BEEF', x + 70 + 40, -10, Math.PI / 2, g.D.s(1.6), 'orange', 22, { cullGrace: 60 });
            g.sfx('eshot2');
          }
          t++;
          yield;
        }
      },
    },
    {
      hp: 2800,
      time: 35,
      *run(b, g) {
        let i = 0;
        yield 30;
        while (true) {
          const n = g.D.pick([2, 3, 4, 4]);
          const base = g.aim(b.x, b.y);
          const dir = i % 2 ? 1 : -1;
          for (let k = 0; k < n; k++) g.laser(b.x, b.y, base + (k / n) * TAU + dir * 0.6, { len: 900, width: 18, warn: 55, active: 90, color: 'red', angVel: -dir * 0.012 });
          for (let r = 0; r < 4; r++) {
            yield 30;
            ring(g, b.x, b.y, g.D.n(12), g.D.s(2), r * 0.26, 'ball', 'pink');
          }
          i++;
          yield 30;
          if (i % 2 === 0) yield* b.wander(g, 40);
        }
      },
    },
    {
      name: 'Segmentation fault (core dumped)',
      hp: 3400,
      time: 50,
      *run(b, g) {
        yield* b.home(30);
        b.run(segfault(b, g));
        while (true) yield 600;
      },
    },
    {
      hp: 2800,
      time: 35,
      *run(b, g) {
        let t = 0;
        yield 30;
        while (true) {
          if (t % 36 === 0) {
            ring(g, b.x, b.y, g.D.n(20), 0.5, g.rng.next() * TAU, 'rice', 'red', { accel: g.D.s(0.05), maxSpeed: g.D.s(4) });
            g.sfx('eshot');
          }
          if (t % 6 === 0 && Math.floor(t / 90) % 2 === 0) g.shoot(b.x, b.y, g.aim(b.x, b.y) + g.rng.range(-0.15, 0.15), g.D.s(4.4), 'kunai', 'white');
          t++;
          yield;
        }
      },
    },
    {
      name: ':( Your PC ran into a problem',
      hp: 3600,
      time: 52,
      bgTint: '#0a3bb5',
      *run(b, g) {
        yield* b.home(30);
        let t = 0;
        while (true) {
          if (t % g.D.pick([100, 84, 72, 62]) === 0) {
            // two or three phrases with honest gaps between them
            const picks = [g.rng.pick(BSOD_PHRASES), g.rng.pick(BSOD_PHRASES), g.rng.pick(BSOD_PHRASES)].slice(0, g.lv >= 2 ? 3 : 2);
            let x = g.rng.range(0, 40);
            for (const p of picks) {
              const w = (p.length - 1) * 19;
              if (x + w > PF_W - 10) break;
              textLine(g, p, x + w / 2 + 10, -10, Math.PI / 2, g.D.s(1.35), 'white', 19, { cullGrace: 60 });
              x += w + g.rng.range(70, 120);
            }
          }
          if (t % 64 === 32) {
            fan(g, b.x, b.y, g.D.n(5, 3), 0.9, g.aim(b.x, b.y), g.D.s(2.6), 'ball', 'cyan');
            g.sfx('eshot');
          }
          t++;
          yield;
        }
      },
    },
    {
      name: 'The Halting Problem',
      hp: 1,
      time: 60,
      survival: true,
      bonus: 12_000_000,
      *run(b, g) {
        yield* b.home(30);
        g.banner('SURVIVE', 'the boss cannot be damaged — outlast it', '#ffffff', 150, 'small');
        let t = 0;
        const names = ['while(true)', 'spaghetti', 'malloc()', 'race', 'segfault'];
        while (true) {
          const m = Math.floor(t / 660) % 5;
          if (t % 660 === 0) {
            g.fx.text(b.x, b.y + 70, `replaying: ${names[m]}`, '#ff5a74', 80, 13);
            g.log('ERROR', `halting check: ${names[m]}... undecidable`);
          }
          haltingMotif(b, g, m, t);
          if (t % 90 === 45 && g.lv >= 1) stack(g, b.x, b.y, 3, g.aim(b.x, b.y), g.D.s(2.6), g.D.s(3.6), 'orb', 'white');
          t++;
          yield;
        }
      },
    },
  ],
  draw(b, g, c, t) {
    const panic = b.phase?.survival ? 1 : 0;
    halo(c, '#ff0033', 110, 0.4 + 0.1 * Math.sin(t * 0.1));
    // protection rings 0..3
    for (let r = 0; r < 4; r++) {
      const rad = 50 + r * 12;
      c.save();
      c.rotate(t * (0.01 + r * 0.006) * (r % 2 ? -1 : 1));
      c.strokeStyle = `rgba(255,${60 + r * 30},${90 + r * 20},${0.8 - r * 0.15})`;
      c.lineWidth = 3 - r * 0.5;
      const segs = 6 + r * 2;
      for (let s = 0; s < segs; s++) {
        const a0 = (s / segs) * TAU;
        c.beginPath();
        c.arc(0, 0, rad, a0, a0 + (TAU / segs) * 0.65);
        c.stroke();
      }
      c.fillStyle = '#ff5a74';
      c.font = `700 7px ${FONT_MONO}`;
      c.textAlign = 'center';
      c.fillText(`ring${r}`, 0, -rad - 3);
      c.restore();
    }
    // hex core
    c.fillStyle = b.flash > 0 ? '#fff' : '#12020a';
    c.strokeStyle = '#ff3b5c';
    c.lineWidth = 3;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      c.lineTo(Math.cos(a) * 40, Math.sin(a) * 40);
    }
    c.closePath();
    c.fill();
    c.stroke();
    // eye
    const a = Math.atan2(g.player.y - b.y, g.player.x - b.x);
    const blink = (t % 220) < 5;
    c.fillStyle = '#fff4f6';
    c.beginPath();
    c.ellipse(0, 0, 28, blink ? 2 : 17, 0, 0, TAU);
    c.fill();
    if (!blink) {
      c.save();
      c.beginPath();
      c.ellipse(0, 0, 28, 17, 0, 0, TAU);
      c.clip();
      const px = Math.cos(a) * 9;
      const py = Math.sin(a) * 5;
      c.fillStyle = '#c4001f';
      c.beginPath();
      c.arc(px, py, 13, 0, TAU);
      c.fill();
      c.fillStyle = '#000';
      c.beginPath();
      c.ellipse(px, py, panic ? 2.5 : 4, 10, 0, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.8)';
      c.fillRect(px - 6, py - 6, 3, 3);
      // glitch scan
      c.fillStyle = 'rgba(0,240,255,0.35)';
      const gy = ((t * 2) % 40) - 20;
      c.fillRect(-30, gy, 60, 2);
      c.restore();
    }
    // lightning
    if (Math.random() < 0.08) {
      c.strokeStyle = 'rgba(255,120,150,0.8)';
      c.lineWidth = 1.5;
      c.beginPath();
      let x = 0;
      let y = 0;
      const la = Math.random() * TAU;
      c.moveTo(0, 0);
      for (let i = 0; i < 6; i++) {
        x += Math.cos(la) * 14 + (Math.random() - 0.5) * 14;
        y += Math.sin(la) * 14 + (Math.random() - 0.5) * 14;
        c.lineTo(x, y);
      }
      c.stroke();
    }
    c.globalCompositeOperation = 'lighter';
    c.drawImage(glowSprite('#ff0033', 32), -20, -20, 40, 40);
    c.globalCompositeOperation = 'source-over';
  },
};

// ------------------------------------------------------------------ stage script

function* script(g: Game): Task {
  yield 150;
  // W1: rootkits materialise
  const spots: [number, number][] = [
    [120, 120],
    [480, 160],
    [300, 90],
    [200, 220],
    [420, 240],
    [80, 200],
    [520, 100],
  ];
  for (const [x, y] of spots) {
    g.spawn(rootkit, x, y, rootkitScript(x, y));
    yield 34;
  }
  yield 140;
  // W2: viruses + daemons
  g.spawn(virus, -20, 60, virusDrift(0.45));
  g.spawn(virus, PF_W + 20, 60, virusDrift(Math.PI - 0.45));
  yield 90;
  g.spawn(daemon, CX, -40, daemonScript(CX, 130));
  yield 260;
  g.spawn(virus, 150, -20, virusDrift(Math.PI / 2 + 0.2));
  g.spawn(virus, 450, -20, virusDrift(Math.PI / 2 - 0.2));
  yield 220;
  // W3: firewall line
  for (const x of [100, 300, 500]) {
    g.spawn(firewall, x, -30, firewallScript(x));
    yield 40;
  }
  yield 200;
  for (let i = 0; i < 6; i++) {
    const x = LANES[i % 2 ? 5 - (i >> 1) : i >> 1];
    g.spawn(rootkit, x, 250, rootkitScript(x, 200 + (i % 2) * 40));
    yield 26;
  }
  yield 160;
  // W4: turrets
  g.spawn(turret, 110, -30, turretScript(110, 120, 1));
  g.spawn(turret, 490, -30, turretScript(490, 120, -1));
  yield 300;
  for (let i = 0; i < 8; i++) {
    const p: Pt[] = [
      [i % 2 ? -20 : PF_W + 20, 300],
      [CX, 160],
      [i % 2 ? PF_W + 20 : -20, 40],
    ];
    g.spawn(cronling, p[0][0], p[0][1], along(p, 200, every(999, (e, gg) => fan(gg, e.x, e.y, 3, 0.4, gg.aim(e.x, e.y), gg.D.s(3), 'orb', 'yellow'), 60, 1)));
    yield 18;
  }
  yield 220;

  yield* g.fight(cron);
  yield 90;

  // W5: daemon trio + rootkits
  g.spawn(daemon, 130, -40, daemonScript(130, 120));
  g.spawn(daemon, 470, -40, daemonScript(470, 120));
  yield 150;
  for (let i = 0; i < 5; i++) {
    const x = 150 + i * 75;
    g.spawn(rootkit, x, 260, rootkitScript(x, 230 + (i % 2) * 40));
    yield 40;
  }
  yield 220;
  // W6: viruses + firewalls
  g.spawn(firewall, 150, -30, firewallScript(150));
  g.spawn(firewall, 450, -30, firewallScript(450));
  for (let i = 0; i < 4; i++) {
    g.spawn(virus, i % 2 ? PF_W + 20 : -20, 100 + i * 40, virusDrift(i % 2 ? Math.PI - 0.3 : 0.3));
    yield 60;
  }
  yield 260;
  // W7: everything at once
  g.spawn(turret, CX, -30, turretScript(CX, 110, 1));
  const cp: Pt[] = [
    [-20, 400],
    [150, 200],
    [450, 200],
    [620, 400],
  ];
  for (let i = 0; i < 10; i++) {
    g.spawn(cronling, cp[0][0], cp[0][1], along(i % 2 ? mirror(cp) : cp, 220));
    yield 16;
  }
  yield 120;
  g.spawn(daemon, CX, -40, daemonScript(CX, 190));
  yield 400;
  yield* g.bossBattle(kernel);
}

export const stage5: StageDef = {
  index: 4,
  name: 'Ring 0',
  title: 'FINAL STAGE',
  subtitle: 'here, every exception is fatal',
  music: 'stage5',
  bg: 'kernel',
  color: '#ff3b5c',
  mid: cron,
  boss: kernel,
  script,
};

