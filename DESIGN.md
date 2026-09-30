# KERNEL//PANIC — Game Design Document

> *You are the cursor. The machine is on fire. Every bug in history has crawled out of the stack
> and it is shooting at you.*

A vertical **danmaku (bullet hell)** shoot 'em up with a programming theme. Five stages descend
through the software stack — from `localhost` down to Ring 0 — each ending in a boss that is a
personified programming disaster (Infinite Loop, Spaghetti Code, Memory Leak, Race Condition,
Kernel Panic). Boss attacks are named exceptions; surviving one without dying or bombing
**catches** it.

---

## 1. Research → Principles

Sources studied: Boghog's *Bullet Hell Shmup Design 101* (shmups wiki), Sparen's *Danmaku Design
Studio*, Touhou Project mechanics (graze, spell cards, deathbomb, point-of-collection), Cave's
DoDonPachi / Espgaluda / Mushihimesama (chains, hyper, kakusei bullet-slowdown, bullet-cancel
scoring), Treasure's Ikaruga (a single signature mechanic reframing every pattern).

| # | Principle (source) | How KERNEL//PANIC applies it |
|---|---|---|
| 1 | **Tiny, perfectly centred hitbox; big readable sprite** (Boghog, Touhou) | 3px hitbox dead-centre on the cursor sprite. Focus shows it as a white dot in a red ring. |
| 2 | **Two-speed movement / focus** (Touhou, Cave) | `Shift` = debug mode: ~0.42× speed, hitbox + graze ring visible, shot tightens. No inertia, diagonals normalised. |
| 3 | **Readability first: bright cores beside dark borders** (Boghog) | Every enemy bullet is pre-rendered: dark rim → saturated body → white-hot core. Backgrounds are dim midtones. |
| 4 | **Enemy bullets on top of everything** (Boghog) | Draw order: bg → items → enemies → player shots (translucent) → player → FX → **enemy bullets**. |
| 5 | **Directional bullets show their heading** (Sparen) | Rice/kunai/arrow bullets rotate to velocity. |
| 6 | **Aimed + static + random, combined** (Boghog, Sparen) | Pattern library mixes aimed fans, fixed rings/spirals, and seeded random fill. |
| 7 | **Fairness: no surprise spawns** | Every bullet has a spawn flash (≈10f) with no hitbox. Lasers draw a warning line before firing. |
| 8 | **Chunk bullets into lines & lanes; avoid lone strays** (Boghog) | Patterns are built from rings, fans and streams with geometric, repeatable gaps. |
| 9 | **Graze: reward risk** (Touhou) | Near-misses give score and fill the **CACHE** meter. |
| 10 | **Bombs as panic button + deathbomb window** (Touhou ~8f, Boghog) | `X` = `sudo rm -rf` — invulnerable screen wipe. A 10-frame deathbomb window after a hit. |
| 11 | **Signature mechanic that reframes patterns** (Espgaluda kakusei, Ikaruga) | **OVERCLOCK** (`C`): spend CACHE to slow the world to 45% while you run full speed; enemies killed during overclock turn *their* bullets into gold bits. Graze → cache → overclock → gold: one loop that turns danger into reward. |
| 12 | **Chain scoring with a decaying gauge** (DoDonPachi) | **STREAK**: kills and hits refresh a draining timer; the multiplier grows up to ×5. |
| 13 | **Bullet cancels shower the player with points** (Cave, Touhou) | Boss phase breaks, bombs and overclock kills convert bullets into homing bits. |
| 14 | **Named boss attacks, time limits, capture bonus** (Touhou spell cards) | Boss attacks are thrown **Exceptions** with code-flavoured names, timers and a *caught* bonus. |
| 15 | **Point-of-collection line** (Touhou) | Fly above the dashed line to auto-collect everything at full value. |
| 16 | **Generous post-death invulnerability, cancel on death** (Boghog) | Death cancels nearby bullets; 3s of invulnerability; power drops scatter so you can reclaim some. |
| 17 | **Big meaty explosions & hit feedback** (Boghog, Nex Machina) | Hit flash, glyph debris (`{ } ; 0 1`), shockwave rings, screen shake, hit-stop on big kills, slow-mo boss deaths. |
| 18 | **Vary intensity; set pieces as landmarks** (Boghog) | Every stage: popcorn → formations → midboss → heavier waves → a quiet breath → WARNING → boss. |
| 19 | **Design for fast/average/slow kills** (Boghog) | Enemies leave the screen if not killed; strong enemies stop shooting and flee after a while. |
| 20 | **Difficulty choice for every skill level** (Touhou) | `DEBUG` / `RELEASE` / `PRODUCTION` / `FRIDAY DEPLOY` scale density & speed. Practice modes for stages and single exceptions. |

## 2. Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | Arrows / WASD | D-pad / left stick |
| Shoot | `Z` / `J` (hold) — or auto-fire option | A |
| Focus (debug mode) | `Shift` / `K` | LB / RB / RT |
| Bomb (`sudo rm -rf`) | `X` / `L` | B |
| Overclock | `C` / `;` | X / Y |
| Pause | `Esc` / `P` | Start |

Touch: drag anywhere to move (relative), auto-fire; tap the BOMB / OVERCLOCK pads in the side panels.

## 3. Player Builds

| Build | Shot | Focus shot | Bomb |
|---|---|---|---|
| `spread.js` | Wide fan that grows with power | Fan narrows and speeds up | `delete window.bullets` — shockwave |
| `laser.rs` | Straight twin stream | **Piercing beam** that stops on the first target | `drop(bullets)` — sweeping beam column |
| `homing.py` | Snaking shots that seek targets | Faster, tighter seekers | `del bullets[:]` — seeker swarm |

Power is a **version number**: `v1.00` → `v5.00 MAX`. Each full version adds a *thread* (option)
that fires alongside you.

## 4. Scoring Hierarchy (simple plan first, depth later)

1. **Kill things fast** → kill score × STREAK multiplier.
2. **Collect bits** → worth more the more you've grazed; full value above the collection line.
3. **Graze** → points + CACHE.
4. **Overclock** at the right moment → gold bits from cancelled bullets.
5. **Catch exceptions** → big bonus for not dying/bombing in a boss attack.

Extends at 3M, 10M, 25M, 50M, plus 1UP drops from some midbosses.

## 5. Stages

| # | Stage | Palette | Enemies | Midboss | Boss |
|---|---|---|---|---|---|
| 1 | `localhost:3000` | cyan / green grid | bugs, moths, 404 drones | Corrupted Rubber Duck | **INFINITE LOOP** — the recursion that never returns |
| 2 | `The World Wide Web` | magenta DOM tree | pop-ups, tracking cookies, crawlers | Pop-up Hydra | **SPAGHETTI CODE** — the unmaintainable tangle |
| 3 | `The Heap` | amber memory cells | worms, fork bombs, dangling pointers | Stack Smasher | **MEMORY LEAK** — the process that never frees |
| 4 | `Thread Pool` | violet lanes | packets, mutexes, threads | Deadlock | **RACE CONDITION** — twin threads, shared mutable HP |
| 5 | `Ring 0` | red circuit glitch | daemons, viruses, rootkits | The Cron Job | **KERNEL PANIC** — the fatal exception |

Signature boss mechanics: recursive bullets that spawn children (Infinite Loop), wrap-around
`goto` bullets and nested callback bullets (Spaghetti Code), bullets that never free themselves
(Memory Leak), mirrored twins sharing one HP bar (Race Condition), and a final survival spell —
**The Halting Problem** — where you cannot damage the boss and must outlast it.

## 6. Tech

- **Vite + TypeScript**, zero runtime dependencies, custom engine.
- **Fixed 60 Hz simulation** with render interpolation (smooth on 120/144 Hz screens).
- **Generator coroutines** for all enemy/stage/boss scripts (`yield 30` = wait 30 frames),
  running on a world clock so Overclock slows everything but the player.
- **Pooled entities** (4096 bullets, 1024 items, 4096 particles), pre-rendered sprites,
  additive-blend FX, cheap post-processing (scanlines, vignette, glitch slices, RGB split).
- **Web Audio**: every sound effect is synthesised; music is a tiny tracker-style sequencer
  with hand-written songs per stage and boss.
- `npm run build` produces a **single self-contained HTML file**.
