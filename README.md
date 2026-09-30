# KERNEL//PANIC

**A debug-hell shoot 'em up.** You are the cursor. The machine is on fire. Every bug in history
has crawled out of the stack, and it is shooting at you.

▶ **Play in your browser: https://blinky1994.github.io/kernel-panic/**

A vertical danmaku (bullet hell) shmup with a programming theme: five stages descending through
the software stack, from `localhost:3000` down to Ring 0, each ending in a boss that is a
personified programming disaster — **Infinite Loop**, **Spaghetti Code**, **Memory Leak**,
**Race Condition** and **Kernel Panic**. Boss attacks are thrown *exceptions*; survive one
without dying or bombing to **catch** it.

## Features

- **5 stages, 5 midbosses, 5 bosses, 30+ named boss attacks** — recursive bullets that spawn
  children (`for (;;) recurse();`), `goto` bullets that wrap across the screen, merge-conflict
  walls, bullets that never free themselves (`malloc()`), twin bosses sharing one HP bar, a
  Heisenbug that slows down when you *observe* it, a Blue Screen of Death, and the final
  survival exception: **The Halting Problem**.
- **3 builds**: `spread.js` (wide fan), `laser.rs` (piercing focus beam), `homing.py` (seekers).
- **4 difficulties**: `DEBUG`, `RELEASE`, `PRODUCTION`, `FRIDAY DEPLOY`.
- **Systems**: focus/hitbox, graze, deathbomb window, point-of-collection line, chain scoring
  (STREAK), and **OVERCLOCK** — spend graze-filled cache to slow time; enemies you kill while
  overclocked turn their bullets into gold.
- **Practice modes**: any stage you've reached, or drill any single exception you've met.
- **Original soundtrack** — 11 songs, synthesised live in the browser by a tiny tracker-style
  sequencer (no audio files). Every sound effect is synthesised too.
- **Zero assets**: every sprite, boss and background is drawn in code.
- Keyboard, gamepad and touch. Local high scores with name entry.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows / WASD | D-pad / left stick |
| Shoot (hold) | `Z` / `J` / `Space` | A |
| Focus (slow, show hitbox) | `Shift` / `K` | LB / RB |
| Bomb — `sudo rm -rf` | `X` / `L` | B |
| Overclock | `C` / `;` | X / Y |
| Pause | `Esc` / `P` | Start |

Touch: drag anywhere to move (auto-fire); tap the BOMB / OVERCLOCK pads in the side panels.

## Run locally

```bash
npm install
npm run dev
```

`npm run build` produces a single self-contained `dist/index.html` (fonts and code inlined) that
runs by double-clicking it — no server needed.

## Design

The game was designed from research into the genre's best (Touhou, DoDonPachi, Espgaluda,
Ikaruga) and Boghog's *Bullet Hell Shmup Design 101*. See [DESIGN.md](DESIGN.md) for how each
principle — readability, fairness, graze, bullet cancels, chain scoring — maps to a mechanic.

## Tech

TypeScript + Vite, no runtime dependencies. Custom engine: fixed 60 Hz simulation with render
interpolation, generator-coroutine scripting for every enemy and boss (`yield 30` waits 30
frames on a world clock that Overclock can slow), pooled entities, Canvas 2D with pre-rendered
sprites, Web Audio synthesis.

---

Built with [Claude Code](https://claude.com/claude-code).
