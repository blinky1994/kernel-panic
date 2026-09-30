import { audio, type SfxName } from '../audio/engine';
import { music } from '../audio/music';
import { SONGS } from '../audio/songs';
import {
  BOMB_FRAMES,
  DEATHBOMB_FRAMES,
  EXTENDS,
  MAX_POWER,
  PF_H,
  PF_W,
  PLAYER_GRAZE_R,
  PLAYER_HIT_R,
  POC_Y,
  RESPAWN_INVULN,
  START_BOMBS,
  STREAK_TIME,
} from '../config';
import { input } from '../core/input';
import { angleTo, clamp, dist2, formatScore, hexAddr, lerp, segDist2, TAU } from '../core/math';
import { RNG } from '../core/rng';
import { persist, save, spellRecord } from '../core/save';
import { TaskRunner, type Task } from '../core/tasks';
import { itemSprite, type BType, type BulletColor, type ItemKind } from '../render/sprites';
import { Boss, fightBoss, type FightOpts } from './boss';
import { Bullet, BulletPool, Laser, type BOpts } from './bullets';
import { Diff, DIFFS } from './difficulty';
import { Enemy, type EnemyKind } from './enemy';
import { Item, ItemPool } from './items';
import { Particles } from './particles';
import { Player, ShotPool } from './player';
import { SHIPS } from './ships';
import type { BossDef, DialogueLine, PhaseDef, StageDef } from './types';
import { createBackground, type Background } from '../render/backgrounds';
import { STAGES } from '../content/stages';

export type GameMode = 'arcade' | 'stage' | 'spell';

export interface GameOpts {
  diff: number;
  ship: number;
  mode: GameMode;
  stage?: number;
  spell?: { stage: number; which: 'mid' | 'boss'; phase: number };
}

export interface GameResult {
  score: number;
  stage: number;
  cleared: boolean;
  continues: number;
  diff: number;
  ship: number;
  mode: GameMode;
  quit: boolean;
  graze: number;
  maxStreak: number;
  caught: number;
  seen: number;
  deaths: number;
  bombsUsed: number;
  spellResult?: 'caught' | 'failed';
  spell?: GameOpts['spell'];
  time: number;
}

export interface Banner {
  text: string;
  sub: string;
  color: string;
  t: number;
  dur: number;
  kind: 'center' | 'small' | 'spell' | 'result' | 'boss';
}

export interface LogLine {
  time: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'FATAL' | 'OK' | 'DEBUG';
  msg: string;
  t: number;
}

interface DialogueState {
  lines: DialogueLine[];
  idx: number;
  chars: number;
  t: number;
  done: boolean;
  bossName: string;
}

export class Game {
  diff: Diff;
  diffIndex: number;
  shipIndex: number;
  mode: GameMode;
  rng = new RNG((Math.random() * 0xffffffff) >>> 0);
  frame = 0;
  realFrame = 0;
  ts = 1;
  private tsTarget = 1;
  private slowmoT = 0;
  private slowmoK = 1;
  freeze = 0;

  player: Player;
  bullets = new BulletPool();
  shots = new ShotPool();
  enemies: Enemy[] = [];
  items = new ItemPool();
  fx = new Particles();
  lasers: Laser[] = [];
  boss: Boss | null = null;
  currentOwner: Enemy | null = null;

  // scoring & resources
  score = 0;
  displayScore = 0;
  graze = 0;
  stageGraze = 0;
  streak = 0;
  streakT = 0;
  maxStreak = 0;
  cache = 0;
  overclock = false;
  ocCancels = 0;
  lives: number;
  bombs = START_BOMBS;
  power = 0;
  nextExtend = 0;
  continues = 0;
  deaths = 0;
  bombsUsed = 0;
  caught = 0;
  seenSpells = 0;
  bombT = 0;
  bombX = 0;
  bombY = 0;
  hiScore = 0;

  // stage
  stageIndex = 0;
  stage: StageDef;
  stageTasks = new TaskRunner();
  bg: Background;
  stageT = 0;
  over = false;
  result: GameResult | null = null;
  state: 'play' | 'continue' | 'done' = 'play';
  continueT = 0;
  spellResult: 'caught' | 'failed' | undefined;

  // presentation
  banners: Banner[] = [];
  logs: LogLine[] = [];
  dlg: DialogueState | null = null;
  shakeAmt = 0;
  flashAmt = 0;
  flashColor = '#ffffff';
  glitch = 0;
  spellBgT = 0;
  spellCut: { name: string; boss: string; color: string; t: number } | null = null;
  canShoot = true;
  touchMode = false;
  stageTitleT = 0;
  pocHintT = 0;
  bossHpMult = 1;
  clearTally: { t: number; lines: [string, string][]; total: number } | null = null;
  nowPlaying = '';
  ocFlash = 0;
  private pendingHit = false;

  onExit: ((r: GameResult) => void) | null = null;
  onEnding: ((r: GameResult) => void) | null = null;

  constructor(public opts: GameOpts) {
    this.diffIndex = opts.diff;
    this.shipIndex = opts.ship;
    this.diff = new Diff(DIFFS[opts.diff]);
    this.mode = opts.mode;
    this.lives = this.diff.def.lives;
    this.player = new Player(SHIPS[opts.ship]);
    this.stage = STAGES[0];
    this.bg = createBackground('grid');
    const hs = save.scores[DIFFS[opts.diff].id];
    this.hiScore = hs && hs.length ? Math.max(...hs.map((s) => s.score)) : 100_000;
    this.nextExtend = 0;

    if (opts.mode === 'arcade') {
      this.startStage(0);
    } else if (opts.mode === 'stage') {
      const i = opts.stage ?? 0;
      this.power = Math.min(MAX_POWER, i * 90);
      this.lives = 7;
      this.startStage(i);
    } else if (opts.mode === 'spell' && opts.spell) {
      this.lives = 0;
      this.bombs = 0;
      this.power = MAX_POWER;
      this.startSpellPractice(opts.spell);
    }
    this.player.reset();
  }

  // ------------------------------------------------------------ helpers

  get D() {
    return this.diff;
  }
  get lv() {
    return this.diff.lv;
  }
  get powerLevel(): number {
    return Math.min(4, Math.floor(this.power / 100));
  }
  get pocY() {
    return POC_Y;
  }
  get streakMult(): number {
    return 1 + Math.min(this.streak, 200) * 0.02;
  }
  get bitValue(): number {
    return Math.min(99_990, 3000 + this.graze * 12);
  }

  sfx(name: SfxName, p = 0) {
    audio.play(name, p);
  }

  playMusic(id: string) {
    music.play(id);
    const song = SONGS[id];
    if (song) this.nowPlaying = song.title;
  }

  aim(x: number, y: number): number {
    return angleTo(x, y, this.player.x, this.player.y);
  }

  shake(n: number) {
    if (save.settings.shake) this.shakeAmt = Math.max(this.shakeAmt, n);
  }

  flash(amount = 0.6, color = '#ffffff') {
    this.flashAmt = Math.max(this.flashAmt, amount);
    this.flashColor = color;
  }

  slowmo(frames: number, k: number) {
    this.slowmoT = frames;
    this.slowmoK = k;
  }

  gameTime(): string {
    const s = Math.floor(this.realFrame / 60);
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  log(level: LogLine['level'], msg: string) {
    this.logs.push({ time: this.gameTime(), level, msg, t: this.realFrame });
    if (this.logs.length > 40) this.logs.shift();
  }

  banner(text: string, sub = '', color = '#00f0ff', dur = 120, kind: Banner['kind'] = 'center') {
    this.banners.push({ text, sub, color, t: 0, dur, kind });
  }

  // ------------------------------------------------------------ spawning

  addEnemy<T extends Enemy>(e: T): T {
    this.enemies.push(e);
    return e;
  }

  spawn(kind: EnemyKind, x: number, y: number, script?: (e: Enemy, g: Game) => Task, hpMult = 1): Enemy {
    const e = new Enemy(kind, x, y, hpMult);
    if (script) e.run(script(e, this));
    this.enemies.push(e);
    return e;
  }

  shoot(x: number, y: number, angle: number, speed: number, type: BType, color: BulletColor, o?: BOpts): Bullet | null {
    const b = this.bullets.spawn(x, y, angle, speed, type, color, o);
    if (b) b.owner = this.currentOwner;
    return b;
  }

  laser(x: number, y: number, angle: number, o: Partial<Pick<Laser, 'len' | 'width' | 'warn' | 'active' | 'color' | 'angVel' | 'follow' | 'noCancel'>> = {}): Laser {
    const l = new Laser();
    l.x = x;
    l.y = y;
    l.angle = angle;
    Object.assign(l, o);
    l.owner = this.currentOwner;
    this.lasers.push(l);
    this.sfx('laserWarn');
    return l;
  }

  nearestEnemy(x: number, y: number): Enemy | null {
    let best: Enemy | null = null;
    let bd = Infinity;
    for (const e of this.enemies) {
      if (!e.alive || !e.onScreen || e.invuln > 0) continue;
      const d = dist2(x, y, e.x, e.y) * (e.isBoss ? 0.5 : 1);
      if (d < bd) {
        bd = d;
        best = e;
      }
    }
    return best;
  }

  // ------------------------------------------------------------ stages

  startStage(i: number) {
    this.stageIndex = i;
    this.stage = STAGES[i];
    this.bg = createBackground(this.stage.bg);
    this.stageTasks.clear();
    this.stageGraze = 0;
    // later bosses face a fully-powered player; debug mode is gentler
    this.bossHpMult = [1, 1.2, 1.25, 1.3, 1.3][i] * (this.lv === 0 ? 0.85 : 1);
    this.stageTasks.add(this.stageFlow(this.stage));
    if (i > save.unlocked && this.mode === 'arcade') {
      save.unlocked = i;
      persist();
    }
  }

  private *stageFlow(st: StageDef): Task {
    this.playMusic(st.music);
    this.stageTitleT = 1;
    this.pocHintT = 400;
    this.log('INFO', `mounting ${st.name}`);
    yield 60;
    yield* st.script(this);
    yield* this.waitClear();
    yield* this.stageClear(st);
  }

  /** Wait until no enemies/bosses remain (or timeout). */
  *waitClear(max = 600): Task {
    let t = 0;
    while (this.enemies.some((e) => e.alive) && t < max) {
      t++;
      yield;
    }
  }

  *fight(def: BossDef, opts: FightOpts = {}): Task {
    yield* fightBoss(this, def, opts);
  }

  /** Big boss: warning, then the fight. */
  *bossBattle(def: BossDef): Task {
    yield* this.waitClear(240);
    this.cancelAll(false);
    this.sfx('warning');
    this.banner('WARNING', 'FATAL EXCEPTION APPROACHING', '#ff3b5c', 200, 'center');
    this.log('ERROR', `unhandled ${def.name.toLowerCase().replace(/ /g, '_')} detected`);
    music.stop(1.5);
    yield 200;
    yield* this.fight(def);
  }

  private *stageClear(st: StageDef): Task {
    if (this.over) return;
    this.cancelAll(true);
    this.items.magnetAll();
    yield 60;
    if (this.mode === 'spell') return;
    const stageNo = st.index + 1;
    const base = stageNo * 1_000_000;
    const grazeB = this.stageGraze * 500;
    const lifeB = this.mode === 'arcade' ? (this.lives * 200_000 + this.bombs * 50_000) * (stageNo === STAGES.length ? 3 : 1) : 0;
    const total = base + grazeB + lifeB;
    this.clearTally = {
      t: 0,
      total,
      lines: [
        ['STAGE BONUS', formatScore(base)],
        ['GRAZE ×' + this.stageGraze, formatScore(grazeB)],
        ['PROCESS/SUDO', formatScore(lifeB)],
      ],
    };
    this.sfx('stageClear');
    this.log('OK', `${st.name} patched successfully`);
    this.addScore(total);
    music.stop(2);
    yield 260;
    this.clearTally = null;
    yield 20;
    if (this.mode === 'stage') {
      this.finish(true, false);
      return;
    }
    if (this.stageIndex < STAGES.length - 1) {
      this.startStage(this.stageIndex + 1);
    } else {
      save.clears++;
      persist();
      this.finish(true, false);
    }
  }

  private startSpellPractice(sp: { stage: number; which: 'mid' | 'boss'; phase: number }) {
    this.stageIndex = sp.stage;
    this.stage = STAGES[sp.stage];
    this.bg = createBackground(this.stage.bg);
    this.bossHpMult = [1, 1.2, 1.25, 1.3, 1.3][sp.stage] * (this.lv === 0 ? 0.85 : 1);
    const def = sp.which === 'mid' ? this.stage.mid : this.stage.boss;
    const self = this;
    this.stageTasks.add(
      (function* (): Task {
        yield 30;
        if (def.midboss) self.playMusic(self.stage.music);
        yield* self.fight(def, { phaseOnly: sp.phase, noDialogue: true });
        yield 60;
        self.finish(self.spellResult === 'caught', false);
      })(),
    );
  }

  finish(cleared: boolean, quit: boolean) {
    if (this.state === 'done') return;
    this.state = 'done';
    this.over = true;
    this.result = {
      score: this.score,
      stage: this.stageIndex,
      cleared,
      continues: this.continues,
      diff: this.diffIndex,
      ship: this.shipIndex,
      mode: this.mode,
      quit,
      graze: this.graze,
      maxStreak: this.maxStreak,
      caught: this.caught,
      seen: this.seenSpells,
      deaths: this.deaths,
      bombsUsed: this.bombsUsed,
      spellResult: this.spellResult,
      spell: this.opts.spell,
      time: this.realFrame,
    };
    persist();
    if (cleared && this.mode === 'arcade' && this.onEnding) this.onEnding(this.result);
    else this.onExit?.(this.result);
  }

  // ------------------------------------------------------------ dialogue

  *dialogue(lines: DialogueLine[]): Task {
    this.cancelAll(false);
    this.canShoot = false;
    this.dlg = { lines, idx: 0, chars: 0, t: 0, done: false, bossName: this.boss?.def.name ?? '' };
    while (this.dlg && !this.dlg.done) yield;
    this.dlg = null;
    this.canShoot = true;
    input.resetEdges();
  }

  private updateDialogue() {
    const d = this.dlg;
    if (!d) return;
    const line = d.lines[d.idx];
    d.t++;
    if (d.chars < line.text.length) {
      d.chars += 1.2;
      if (Math.floor(d.chars) % 2 === 0) this.sfx('type');
    }
    const adv = input.pressed('confirm') || input.taps.length > 0 || input.pressed('shoot');
    const skip = input.down('back') && input.down('focus');
    if (adv || skip || d.t > 360) {
      if (d.chars < line.text.length && !skip && d.t <= 360) d.chars = line.text.length;
      else {
        d.idx++;
        d.chars = 0;
        d.t = 0;
        if (d.idx >= d.lines.length) d.done = true;
      }
    }
  }

  // ------------------------------------------------------------ boss hooks

  declareSpell(b: Boss, ph: PhaseDef, idx: number) {
    this.sfx('spell');
    this.flash(0.35, b.def.color);
    this.spellCut = { name: ph.name!, boss: b.def.name, color: b.def.color, t: 0 };
    this.log('ERROR', `throw ${ph.name}`);
    const id = `${b.def.id}:${idx}`;
    const rec = spellRecord(id);
    rec.tries++;
    if (!save.seenSpells.includes(id)) save.seenSpells.push(id);
    this.seenSpells++;
  }

  phaseBreak(b: Boss, ph: PhaseDef, timeout: boolean, idx: number) {
    this.cancelAll(true);
    for (const l of this.lasers) {
      if (l.age < l.warn + l.grow + l.active) l.age = l.warn + l.grow + l.active;
    }
    this.freeze = 5;
    this.shake(8);
    this.flash(0.5, b.def.color);
    this.sfx(timeout ? 'cancel' : 'explodeM');
    this.fx.explode(b.x, b.y, b.def.color, 40);
    if (ph.name) {
      const captured = !b.spellFailed && (!timeout || !!ph.survival);
      const id = `${b.def.id}:${idx}`;
      if (captured) {
        const base = ph.bonus ?? (this.stageIndex + 1) * 1_000_000 + 500_000;
        const frac = ph.survival ? 1 : 0.5 + 0.5 * clamp(b.timer / b.timerMax, 0, 1);
        const bonus = Math.round((base * frac * (1 + this.lv * 0.25)) / 10) * 10;
        this.addScore(bonus);
        this.caught++;
        spellRecord(id).caught++;
        this.banner('EXCEPTION CAUGHT', '+' + formatScore(bonus), '#ffe14d', 150, 'result');
        this.sfx('capture');
        this.log('OK', `caught ${ph.name.split('(')[0]} +${formatScore(bonus)}`);
        if (this.mode === 'spell') this.spellResult = 'caught';
      } else {
        this.banner('UNCAUGHT EXCEPTION', timeout ? 'timed out' : 'stack trace printed', '#ff3b5c', 120, 'result');
        this.sfx('fail');
        this.log('WARN', `uncaught ${ph.name.split('(')[0]}`);
        if (this.mode === 'spell') this.spellResult = 'failed';
      }
      persist();
    }
    if (!timeout || ph.survival) {
      const n = ph.name ? 10 : 6;
      for (let i = 0; i < n; i++) this.items.spawn(i % 2 ? 'power' : 'bit', b.x, b.y, 90);
      if (ph.name) this.items.spawn('bigpower', b.x, b.y, 30);
    }
    this.items.magnetAll();
    this.spellCut = null;
  }

  bossExplosion(b: Boss) {
    this.fx.explode(b.x, b.y, b.def.color, 90);
    this.fx.explode(b.x, b.y, '#ffffff', 50);
    for (let i = 0; i < 4; i++) this.fx.ring(b.x, b.y, 10, 200 + i * 120, i % 2 ? '#ffffff' : b.def.color, 40 + i * 10, 6);
    this.flash(1, '#ffffff');
    this.glitch = 30;
    this.shake(18);
    this.sfx('explodeL');
    const d = b.def.drops ?? {};
    const bigs = b.def.midboss ? 2 : 3;
    for (let i = 0; i < 12; i++) this.items.spawn(i < bigs ? 'bigpower' : 'bit', b.x, b.y, 140);
    for (let i = 0; i < (d.bomb ?? 0); i++) this.items.spawn('bomb', b.x, b.y, 40);
    for (let i = 0; i < (d.life ?? 0); i++) this.items.spawn('life', b.x, b.y, 40);
    for (let i = 0; i < (d.full ?? 0); i++) this.items.spawn('full', b.x, b.y, 40);
    this.addScore((this.stageIndex + 1) * (b.def.midboss ? 200_000 : 1_000_000));
    this.log('OK', `${b.def.name} terminated (exit 0)`);
    this.items.magnetAll();
  }

  // ------------------------------------------------------------ combat

  damageEnemy(e: Enemy, dmg: number, fromBomb: boolean, hx?: number, hy?: number) {
    const tgt = e.hpLink ?? e;
    if (!tgt.alive || !e.alive) return;
    if (tgt.invuln > 0 || e.invuln > 0) return;
    if (!e.onScreen && !e.isBoss) return; // no killing what you can't see
    if (tgt instanceof Boss && tgt.phase?.survival) return;
    let d = dmg * tgt.dmgMult;
    if (this.bombT > 0 && tgt.isBoss) d *= tgt instanceof Boss ? (tgt.def.bombResist ?? 0.25) : 0.25;
    tgt.hp -= d;
    e.flash = 2;
    if (tgt !== e) tgt.flash = 2;
    if (!fromBomb) {
      this.streakT = Math.max(this.streakT, 50);
      if (tgt.isBoss) {
        this.sfx('hitBoss');
        this.score += Math.round(d * 10);
      } else this.sfx('hit');
    }
    if (tgt.hp <= 0 && !tgt.isBoss) this.killEnemy(tgt, true);
  }

  killEnemy(e: Enemy, byPlayer: boolean) {
    if (!e.alive) return;
    e.alive = false;
    e.tasks.clear();
    if (!byPlayer) return;
    const k = e.kind;
    const big = k.explode === 'M' || k.explode === 'L';
    this.fx.explode(e.x, e.y, k.color, big ? 34 : 14 + e.r * 0.3);
    this.sfx(big ? 'explodeM' : 'explodeS');
    if (big) this.shake(4);
    this.streak++;
    this.maxStreak = Math.max(this.maxStreak, this.streak);
    this.streakT = STREAK_TIME;
    const pts = Math.round((k.score * 10 * this.streakMult) / 10) * 10;
    this.addScore(pts);
    if (big || this.streak % 10 === 0) this.fx.text(e.x, e.y - 10, formatScore(pts), this.streak % 10 === 0 ? '#ffe14d' : '#cfe3ff', 45, big ? 13 : 10);
    if (big) this.log('INFO', `free(${k.id}@${hexAddr(0x7f000000 + e.id * 4096)}) +${formatScore(pts)}`);
    this.addCache(big ? 2 : 0.3);
    if (!e.noDrops && k.drops) {
      const d = k.drops;
      // power is rationed: only some popcorn drops are patches, the rest are bits
      for (let i = 0; i < (d.power ?? 0); i++) this.items.spawn(this.power < MAX_POWER && this.rng.chance(0.4) ? 'power' : 'bit', e.x, e.y, 20 + e.r);
      for (let i = 0; i < (d.bigpower ?? 0); i++) this.items.spawn('bigpower', e.x, e.y, 20);
      for (let i = 0; i < (d.bits ?? 0); i++) this.items.spawn('bit', e.x, e.y, 20 + e.r);
      for (let i = 0; i < (d.bomb ?? 0); i++) this.items.spawn('bomb', e.x, e.y, 10);
      for (let i = 0; i < (d.life ?? 0); i++) this.items.spawn('life', e.x, e.y, 10);
    }
    // overclock: this enemy's bullets turn to gold
    if (this.overclock) {
      let n = 0;
      for (const b of this.bullets.list) {
        if (b.alive && b.owner === e && !b.noCancel) {
          this.items.spawnCancel(b.x, b.y, true);
          this.fx.pop(b.x, b.y, '#ffc83d');
          b.alive = false;
          n++;
        }
      }
      if (n > 0) {
        this.ocCancels += n;
        this.fx.text(e.x, e.y + 12, `${n} → $`, '#ffc83d', 40, 11);
      }
    }
    e.onDeath?.(e, this);
  }

  cancelAll(toBits: boolean, gold = this.overclock) {
    let n = 0;
    for (const b of this.bullets.list) {
      if (!b.alive || b.noCancel) continue;
      b.alive = false;
      n++;
      if (toBits && n < 700) this.items.spawnCancel(b.x, b.y, gold);
      if (n % 3 === 0) this.fx.pop(b.x, b.y, gold ? '#ffc83d' : '#9fd0ff');
    }
    if (n > 0) this.sfx('cancel');
  }

  cancelRadius(x: number, y: number, r: number, toBits: boolean) {
    const r2 = r * r;
    for (const b of this.bullets.list) {
      if (!b.alive || b.noCancel) continue;
      if (dist2(x, y, b.x, b.y) < r2) {
        b.alive = false;
        if (toBits) this.items.spawnCancel(b.x, b.y, this.overclock);
        this.fx.pop(b.x, b.y, '#9fd0ff');
      }
    }
  }

  addScore(n: number) {
    this.score += n;
    while (this.nextExtend < EXTENDS.length && this.score >= EXTENDS[this.nextExtend]) {
      this.nextExtend++;
      if (this.mode !== 'spell') this.extend();
    }
  }

  private extend() {
    this.lives++;
    this.sfx('extend');
    this.banner('EXTEND', 'fork() → +1 process', '#ff2bd6', 120, 'small');
    this.log('OK', 'fork(): new process spawned');
  }

  addCache(n: number) {
    if (this.overclock) return;
    const was = this.cache;
    this.cache = Math.min(100, this.cache + n);
    if (was < 100 && this.cache >= 100) {
      this.sfx('ocReady');
      this.log('INFO', 'cache full: overclock ready [C]');
    }
  }

  collect(it: Item) {
    const p = this.player;
    switch (it.kind as ItemKind) {
      case 'power':
      case 'bigpower': {
        const add = it.kind === 'power' ? 2 : 20;
        if (this.power >= MAX_POWER) {
          const v = Math.round(1000 * this.streakMult);
          this.addScore(v);
          this.fx.text(it.x, it.y, formatScore(v), '#ff9aad', 30, 9);
        } else {
          const before = this.powerLevel;
          this.power = Math.min(MAX_POWER, this.power + add);
          if (this.powerLevel > before) {
            this.sfx('power');
            const ver = (1 + this.power / 100).toFixed(2);
            this.fx.text(p.x, p.y - 30, this.power >= MAX_POWER ? 'v5.00 MAX RELEASE' : `UPGRADED v${ver}`, '#ff7ab8', 60, 12);
            this.log('INFO', `upgraded to v${ver}${this.power >= MAX_POWER ? ' (MAX)' : ''}`);
            if (this.power >= MAX_POWER) this.convertPowerToBits();
          }
        }
        this.addScore(10);
        break;
      }
      case 'full':
        this.power = MAX_POWER;
        this.sfx('power');
        this.fx.text(p.x, p.y - 30, 'v5.00 MAX RELEASE', '#ffe14d', 60, 12);
        this.convertPowerToBits();
        break;
      case 'bit': {
        const aboveLine = it.y < POC_Y || it.magnet;
        const frac = aboveLine ? 1 : clamp(1 - (it.y - POC_Y) / (PF_H - POC_Y), 0.4, 1);
        const v = Math.round((this.bitValue * frac) / 10) * 10;
        this.addScore(v);
        this.fx.text(it.x, it.y - 8, formatScore(v), frac >= 1 ? '#ffe14d' : '#9fd0ff', 30, 9);
        this.sfx('collect');
        break;
      }
      case 'cancel':
        this.addScore(Math.round(20 * this.streakMult));
        this.sfx('collect');
        break;
      case 'gold': {
        const v = Math.round(300 * Math.min(10, 1 + this.ocCancels / 40));
        this.addScore(v);
        this.sfx('collect');
        break;
      }
      case 'bomb':
        this.bombs = Math.min(8, this.bombs + 1);
        this.sfx('extend');
        this.banner('+1 SUDO', 'bomb acquired', '#39ff88', 90, 'small');
        break;
      case 'life':
        this.lives++;
        this.sfx('extend');
        this.banner('EXTEND', '1UP: fork() → +1 process', '#ff2bd6', 120, 'small');
        break;
    }
  }

  private convertPowerToBits() {
    for (const it of this.items.list) {
      if (it.kind === 'power' || it.kind === 'bigpower') {
        it.kind = 'bit';
        it.spr = itemSprite('bit');
      }
    }
  }

  // ------------------------------------------------------------ player actions

  private tryBomb() {
    const p = this.player;
    if (this.bombs <= 0 || this.bombT > 0) return;
    if (!p.alive && p.hitT <= 0) return;
    const deathbomb = p.hitT > 0;
    this.bombs--;
    this.bombsUsed++;
    p.hitT = 0;
    this.bombT = BOMB_FRAMES;
    this.bombX = p.x;
    this.bombY = p.y;
    p.invuln = Math.max(p.invuln, BOMB_FRAMES + 40);
    if (this.boss) this.boss.spellFailed = true;
    this.sfx('bomb');
    this.shake(10);
    this.flash(0.6, p.ship.bombColor);
    this.glitch = Math.max(this.glitch, 10);
    this.streakT = Math.max(this.streakT, 60);
    this.log('WARN', `$ sudo ${p.ship.bombName}${deathbomb ? '  # just in time' : ''}`);
    this.banner(p.ship.bombName, deathbomb ? 'DEATHBOMB' : 'sudo', p.ship.bombColor, 80, 'small');
    for (const l of this.lasers) if (!l.noCancel && l.age < l.warn + l.grow + l.active) l.age = Math.max(l.age, l.warn + l.grow + l.active);
    this.items.magnetAll();
  }

  private toggleOverclock() {
    if (this.overclock) {
      this.endOverclock();
      return;
    }
    if (this.cache < 35 || !this.player.alive) return;
    this.overclock = true;
    this.ocCancels = 0;
    this.ocFlash = 1;
    this.sfx('ocOn');
    this.flash(0.4, '#9b5bff');
    this.glitch = Math.max(this.glitch, 8);
    this.log('WARN', `CPU overclocked to ${(3.2 + this.cache / 50).toFixed(1)}GHz`);
    music.setTempo(0.78);
    audio.setMusicFilter(1300);
  }

  private endOverclock() {
    if (!this.overclock) return;
    this.overclock = false;
    this.sfx('ocOff');
    music.setTempo(1);
    audio.setMusicFilter(20000);
    if (this.ocCancels > 0) this.log('OK', `overclock: ${this.ocCancels} bullets → gold`);
  }

  private hitPlayer() {
    const p = this.player;
    if (p.invuln > 0 || p.hitT > 0 || !p.alive || this.bombT > 0) return;
    p.hitT = DEATHBOMB_FRAMES;
    this.sfx('glitch');
  }

  private die() {
    const p = this.player;
    p.alive = false;
    p.deadT = 60;
    p.beamOn = false;
    this.deaths++;
    this.lives--;
    this.fx.explode(p.x, p.y, p.ship.color, 60);
    this.fx.explode(p.x, p.y, '#ffffff', 30);
    this.fx.ring(p.x, p.y, 5, 260, '#ff3b5c', 40, 5);
    this.sfx('death');
    this.shake(14);
    this.flash(0.7, '#ff3b5c');
    this.glitch = 40;
    this.freeze = 6;
    if (this.boss) this.boss.spellFailed = true;
    if (this.streak >= 10) this.log('WARN', `streak ${this.streak} lost`);
    this.streak = 0;
    this.streakT = 0;
    this.endOverclock();
    this.cache *= 0.5;
    this.cancelRadius(p.x, p.y, 2000, false);
    // scatter some power so the player can recover part of it
    const lost = Math.min(this.power, 100);
    this.power -= lost;
    const drops = Math.min(6, Math.ceil(lost / 20));
    for (let i = 0; i < drops; i++) {
      const it = this.items.spawn(i === 0 && lost >= 50 ? 'bigpower' : 'power', p.x, p.y - 20, 60);
      if (it) it.vy = -5 - Math.random() * 3;
    }
    this.log('FATAL', `process killed (SIGSEGV)  lives=${Math.max(0, this.lives)}`);
    if (this.mode === 'spell') this.spellResult = 'failed';
  }

  private respawn() {
    const p = this.player;
    if (this.lives < 0) {
      if (this.mode === 'spell') {
        this.over = true;
        this.finish(false, false);
        return;
      }
      this.state = 'continue';
      this.continueT = 60 * 10;
      this.sfx('gameOver');
      music.stop(1);
      return;
    }
    p.alive = true;
    p.reset();
    p.invuln = RESPAWN_INVULN;
    this.bombs = Math.max(this.bombs, START_BOMBS);
  }

  continueGame(yes: boolean) {
    if (yes) {
      this.continues++;
      this.lives = this.diff.def.lives - 1;
      this.bombs = START_BOMBS;
      this.score = this.continues;
      this.displayScore = this.score;
      this.nextExtend = 0;
      this.state = 'play';
      const p = this.player;
      p.alive = true;
      p.reset();
      p.invuln = RESPAWN_INVULN;
      this.log('WARN', `rebooted (continue ${this.continues})`);
      const song = this.boss && !this.boss.def.midboss && this.boss.def.music ? this.boss.def.music : this.stage.music;
      this.playMusic(song);
    } else {
      this.finish(false, false);
    }
  }

  // ------------------------------------------------------------ update

  update() {
    this.realFrame++;
    this.touchMode = input.lastDevice === 'touch';
    if (this.state === 'continue') {
      this.continueT--;
      this.fx.update(1);
      this.updatePresentation();
      if (this.continueT > 600 - 50) return; // grace period: don't let a mashed Z decide
      if (input.pressed('confirm') || input.pressed('shoot')) this.continueGame(true);
      else if (input.pressed('back') || input.pressed('bomb') || this.continueT <= 0) this.continueGame(false);
      else if (input.taps.length) {
        const t = input.taps[0];
        this.continueGame(t.y < 360 + 40);
      }
      return;
    }
    if (this.state === 'done') {
      this.fx.update(1);
      return;
    }

    this.updateDialogue();
    this.updatePresentation();

    if (this.freeze > 0) {
      this.freeze--;
      return;
    }
    this.frame++;

    // world time scale (overclock / slow-mo)
    let target = this.overclock ? 0.42 : 1;
    if (this.slowmoT > 0) {
      this.slowmoT--;
      target = Math.min(target, this.slowmoK);
    }
    this.tsTarget = target;
    this.ts += (this.tsTarget - this.ts) * 0.2;
    if (Math.abs(this.ts - this.tsTarget) < 0.01) this.ts = this.tsTarget;

    this.updatePlayer();

    this.stageTasks.update(this.ts);
    this.stageT += this.ts;

    for (const e of this.enemies) if (e.alive) e.update(this);
    this.enemies = this.enemies.filter((e) => e.alive);

    this.bullets.update(this);
    this.updateLasers();
    this.shots.update(this);
    this.collideShots();
    this.items.update(this);
    this.collidePlayer();
    this.fx.update(this.ts);
    this.bg.update(this.ts, this);

    // a wounded boss sparks and smokes
    const bb = this.boss;
    if (bb && bb.alive && bb.phase && !bb.phase.survival && bb.hp < bb.maxHp * 0.25 && this.frame % 4 === 0) {
      const a = this.rng.next() * TAU;
      this.fx.spark(bb.x + Math.cos(a) * bb.r * 0.6, bb.y + Math.sin(a) * bb.r * 0.6, a, 2 + this.rng.next() * 3, bb.def.color, 16);
      if (this.frame % 12 === 0) this.fx.glyph(bb.x, bb.y, bb.def.color, 1.5);
    }

    // bomb
    if (this.bombT > 0) this.updateBomb();

    // overclock drain
    if (this.overclock) {
      this.cache -= 0.34;
      if (this.cache <= 0) {
        this.cache = 0;
        this.endOverclock();
      }
    }

    // streak decay
    if (this.streakT > 0) {
      this.streakT--;
      if (this.streakT <= 0 && this.streak > 0) {
        if (this.streak >= 10) {
          this.log('WARN', `streak ${this.streak} expired`);
          this.fx.text(this.player.x, this.player.y - 40, `STREAK ${this.streak} ENDED`, '#5d6f93', 50, 10);
        }
        this.streak = 0;
      }
    }
  }

  private updatePresentation() {
    // score roll-up
    const diff = this.score - this.displayScore;
    this.displayScore += diff > 0 ? Math.max(1, Math.ceil(diff * 0.18)) : diff;
    if (this.score > this.hiScore && this.mode === 'arcade') this.hiScore = this.score;
    this.shakeAmt *= 0.86;
    if (this.shakeAmt < 0.2) this.shakeAmt = 0;
    this.flashAmt *= 0.88;
    if (this.glitch > 0) this.glitch--;
    if (this.ocFlash > 0) this.ocFlash *= 0.9;
    for (const b of this.banners) b.t++;
    this.banners = this.banners.filter((b) => b.t < b.dur);
    const spell = !!this.boss?.inSpell;
    this.spellBgT = clamp(this.spellBgT + (spell ? 0.03 : -0.03), 0, 1);
    if (this.spellCut) this.spellCut.t++;
    if (this.stageTitleT > 0) this.stageTitleT += 1;
    if (this.stageTitleT > 330) this.stageTitleT = 0;
    if (this.pocHintT > 0) this.pocHintT--;
    if (this.clearTally) this.clearTally.t++;
  }

  private updatePlayer() {
    const p = this.player;
    p.t++;
    p.px = p.x;
    p.py = p.y;
    const level = this.powerLevel;

    if (!p.alive) {
      p.deadT--;
      if (p.deadT <= 0) this.respawn();
      p.updateOptions(level);
      return;
    }
    if (p.invuln > 0) p.invuln--;
    if (p.shotCD > 0) p.shotCD--;
    if (p.seekCD > 0) p.seekCD--;

    // deathbomb window
    if (p.hitT > 0) {
      if (input.pressed('bomb') || this.touchBombPressed()) this.tryBomb();
      else {
        p.hitT--;
        if (p.hitT <= 0) {
          this.die();
          return;
        }
      }
      p.updateOptions(level);
      return;
    }

    // entering from the bottom after respawn
    if (p.enterT > 0) {
      p.enterT--;
      p.y = lerp(p.y, PF_H - 90, 0.12);
      p.updateOptions(level);
      return;
    }

    const touching = input.touching;
    p.focus = input.down('focus');
    p.focusT = clamp(p.focusT + (p.focus ? 0.2 : -0.2), 0, 1);
    const sp = p.focus ? p.ship.focusSpeed : p.ship.speed;
    const ax = input.axis();
    let mx = ax.x * sp;
    let my = ax.y * sp;
    if (touching || Math.abs(input.dragX) + Math.abs(input.dragY) > 0) {
      p.touchBacklogX += input.dragX * 1.15;
      p.touchBacklogY += input.dragY * 1.15;
      const cap = 16;
      const tx = clamp(p.touchBacklogX, -cap, cap);
      const ty = clamp(p.touchBacklogY, -cap, cap);
      mx += tx;
      my += ty;
      p.touchBacklogX -= tx;
      p.touchBacklogY -= ty;
    }
    if (!touching) {
      p.touchBacklogX = 0;
      p.touchBacklogY = 0;
    }
    p.x = clamp(p.x + mx, 10, PF_W - 10);
    p.y = clamp(p.y + my, 16, PF_H - 16);
    p.bank = lerp(p.bank, clamp(mx / sp, -1, 1), 0.25);

    const shooting = this.canShoot && (input.down('shoot') || save.settings.autofire || touching);
    if (shooting) p.fire(this, level);
    else p.beamOn = false;

    if (this.canShoot && (input.pressed('bomb') || this.touchBombPressed())) this.tryBomb();
    if (this.canShoot && (input.pressed('overclock') || this.touchOcPressed())) this.toggleOverclock();

    p.updateOptions(level);
  }

  /** On-screen touch pads live in the side panels. */
  touchPad(which: 'bomb' | 'oc'): { x: number; y: number; w: number; h: number } {
    return which === 'bomb' ? { x: 40, y: 560, w: 260, h: 120 } : { x: 980, y: 560, w: 260, h: 120 };
  }

  private touchHit(which: 'bomb' | 'oc'): boolean {
    const r = this.touchPad(which);
    for (const d of input.downs) {
      if (d.x >= r.x && d.x <= r.x + r.w && d.y >= r.y && d.y <= r.y + r.h) {
        input.claim(d.id);
        return true;
      }
    }
    return false;
  }
  private touchBombPressed() {
    return this.touchHit('bomb');
  }
  private touchOcPressed() {
    return this.touchHit('oc');
  }

  private updateBomb() {
    this.bombT--;
    const age = BOMB_FRAMES - this.bombT;
    const r = age * 20;
    const p = this.player;
    if (p.alive) {
      this.bombX = lerp(this.bombX, p.x, 0.1);
      this.bombY = lerp(this.bombY, p.y, 0.1);
    }
    if (age < 70) this.cancelRadius(this.bombX, this.bombY, r, true);
    else if (age % 10 === 0) this.cancelAll(true);
    const dmg = age < 8 ? 10 : 2.2;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (dist2(e.x, e.y, this.bombX, this.bombY) < r * r) this.damageEnemy(e, dmg, true);
    }
    if (age % 6 === 0) {
      const col = p.ship.bombColor;
      const a = Math.random() * TAU;
      this.fx.spark(this.bombX + Math.cos(a) * r * 0.5, this.bombY + Math.sin(a) * r * 0.5, a, 8, col, 20, 2);
    }
  }

  private updateLasers() {
    const ts = this.ts;
    for (const l of this.lasers) {
      l.age += ts;
      if (l.angVel) l.angle += l.angVel * ts;
      if (l.follow) {
        l.x = l.follow.x;
        l.y = l.follow.y;
      }
      if (!l.fired && l.age >= l.warn) {
        l.fired = true;
        this.sfx('laserFire');
      }
      if (l.age > l.warn + l.grow + l.active + l.fade) l.alive = false;
    }
    this.lasers = this.lasers.filter((l) => l.alive);
  }

  private collideShots() {
    const enemies = this.enemies;
    for (const s of this.shots.list) {
      if (!s.alive) continue;
      for (const e of enemies) {
        if (!e.alive) continue;
        const rr = e.r + s.r;
        const dx = e.x - s.x;
        const dy = e.y - s.y;
        if (dx * dx + dy * dy < rr * rr) {
          if (!e.onScreen && !e.isBoss) continue;
          this.damageEnemy(e, s.dmg, false, s.x, s.y);
          s.alive = false;
          if (Math.random() < 0.5) this.fx.spark(s.x, s.y - 4, -Math.PI / 2 + (Math.random() - 0.5) * 2.2, 2 + Math.random() * 3, s.homing ? '#39ff88' : this.player.ship.color, 10);
          break;
        }
      }
    }
    this.shots.compact();
  }

  private collidePlayer() {
    const p = this.player;
    if (!p.alive || p.hitT > 0) return;
    const invuln = p.invuln > 0 || this.bombT > 0;
    const px = p.x;
    const py = p.y;
    const G = PLAYER_GRAZE_R;
    let grazed = 0;
    for (const b of this.bullets.list) {
      if (!b.alive || b.delay > 0) continue;
      const dx = b.x - px;
      const dy = b.y - py;
      const d2 = dx * dx + dy * dy;
      const gr = b.r + G;
      if (d2 > gr * gr) continue;
      const hr = b.r + PLAYER_HIT_R;
      if (d2 < hr * hr) {
        if (!invuln) {
          this.hitPlayer();
          return;
        }
        continue;
      }
      if (!b.grazed) {
        b.grazed = true;
        grazed++;
        if (grazed < 4) this.fx.spark(b.x, b.y, Math.atan2(py - b.y, px - b.x) + Math.PI + (Math.random() - 0.5), 3, '#ffffff', 10, 1);
      }
    }
    for (const l of this.lasers) {
      if (!l.hot) continue;
      const w = l.widthNow;
      const d2 = segDist2(px, py, l.x, l.y, l.endX, l.endY);
      const hr = w * 0.32 + PLAYER_HIT_R;
      if (d2 < hr * hr && w > l.width * 0.6) {
        if (!invuln) {
          this.hitPlayer();
          return;
        }
      } else if (d2 < (w * 0.5 + G) ** 2) {
        l.grazeT -= 1;
        if (l.grazeT <= 0) {
          l.grazeT = 6;
          grazed++;
        }
      }
    }
    for (const e of this.enemies) {
      if (!e.alive || !e.contact || e.invuln > 99) continue;
      const rr = e.r * 0.65 + PLAYER_HIT_R;
      if (dist2(e.x, e.y, px, py) < rr * rr && !invuln && e.onScreen) {
        this.hitPlayer();
        return;
      }
    }
    if (grazed > 0) {
      this.graze += grazed;
      this.stageGraze += grazed;
      this.addScore(grazed * (200 + 50 * this.lv) * (this.overclock ? 2 : 1));
      this.addCache(grazed * 1.5);
      this.sfx('graze');
      if (Math.floor(this.graze / 100) !== Math.floor((this.graze - grazed) / 100)) this.log('DEBUG', `graze_count=${Math.floor(this.graze / 100) * 100}`);
    }
  }
}
