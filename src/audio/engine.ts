/**
 * Web Audio engine: buses, a shared noise buffer and a library of fully
 * synthesised sound effects. No audio files are used anywhere in the game.
 */
export type SfxName =
  | 'shot'
  | 'hit'
  | 'hitBoss'
  | 'explodeS'
  | 'explodeM'
  | 'explodeL'
  | 'graze'
  | 'collect'
  | 'power'
  | 'bomb'
  | 'death'
  | 'extend'
  | 'spell'
  | 'capture'
  | 'fail'
  | 'warning'
  | 'menuMove'
  | 'menuOk'
  | 'menuBack'
  | 'eshot'
  | 'eshot2'
  | 'laserWarn'
  | 'laserFire'
  | 'ocOn'
  | 'ocOff'
  | 'ocReady'
  | 'tick'
  | 'quack'
  | 'type'
  | 'cancel'
  | 'boot'
  | 'bossDie'
  | 'stageClear'
  | 'gameOver'
  | 'pause'
  | 'glitch'
  | 'charge';

const THROTTLE: Partial<Record<SfxName, number>> = {
  shot: 0.07,
  hit: 0.055,
  hitBoss: 0.07,
  graze: 0.035,
  collect: 0.03,
  eshot: 0.07,
  eshot2: 0.09,
  explodeS: 0.04,
  explodeM: 0.06,
  type: 0.03,
  cancel: 0.08,
  tick: 0.2,
};

class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  musicFilter!: BiquadFilterNode;
  musicOut!: GainNode;
  delaySend!: GainNode;
  private noise!: AudioBuffer;
  private last: Partial<Record<SfxName, number>> = {};
  private musicVol = 0.7;
  private sfxVol = 0.75;
  collectPitch = 0;
  private collectT = 0;
  /** hard mute (e.g. `?mute` in the URL for silent testing) */
  muted = new URLSearchParams(location.search).has('mute');

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 5;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVol;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 20000;
    this.musicFilter.Q.value = 0.8;
    this.musicOut = ctx.createGain();
    this.musicOut.gain.value = this.musicVol * 0.8;
    this.musicBus.connect(this.musicFilter);
    this.musicFilter.connect(this.musicOut);
    this.musicOut.connect(this.master);

    // feedback delay for the music leads
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = 0.3;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const dFilter = ctx.createBiquadFilter();
    dFilter.type = 'lowpass';
    dFilter.frequency.value = 2600;
    this.delaySend = ctx.createGain();
    this.delaySend.gain.value = 0.9;
    this.delaySend.connect(delay);
    delay.connect(dFilter);
    dFilter.connect(fb);
    fb.connect(delay);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    dFilter.connect(wet);
    wet.connect(this.musicBus);

    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get now(): number {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  setVolumes(music: number, sfx: number) {
    this.musicVol = music;
    this.sfxVol = sfx;
    if (!this.ctx) return;
    this.musicOut.gain.setTargetAtTime(music * 0.8, this.ctx.currentTime, 0.05);
    this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.05);
  }

  /** Muffle music (pause menu / overclock). */
  setMusicFilter(freq: number, time = 0.15) {
    if (!this.ctx) return;
    this.musicFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, time);
  }

  noiseSrc(): AudioBufferSourceNode {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    return s;
  }

  // ---------- low-level voices ----------

  private env(g: GainNode, t: number, a: number, peak: number, d: number, sustain = 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    if (sustain > 0) g.gain.setTargetAtTime(sustain, t + a, d / 3);
    else g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  tone(o: {
    type?: OscillatorType;
    f0: number;
    f1?: number;
    t?: number;
    dur: number;
    vol: number;
    attack?: number;
    curve?: 'exp' | 'lin';
    dest?: AudioNode;
    detune?: number;
    lp?: number;
  }) {
    const ctx = this.ctx!;
    const t = o.t ?? ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.detune) osc.detune.value = o.detune;
    if (o.f1 !== undefined) {
      if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(o.f1, t + o.dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    }
    const g = ctx.createGain();
    this.env(g, t, o.attack ?? 0.003, o.vol, o.dur);
    let node: AudioNode = osc;
    if (o.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(o.dest ?? this.sfxBus);
    osc.start(t);
    osc.stop(t + (o.attack ?? 0.003) + o.dur + 0.05);
  }

  noiseBurst(o: {
    t?: number;
    dur: number;
    vol: number;
    type?: BiquadFilterType;
    f0: number;
    f1?: number;
    q?: number;
    attack?: number;
    dest?: AudioNode;
  }) {
    const ctx = this.ctx!;
    const t = o.t ?? ctx.currentTime;
    const src = this.noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = o.type ?? 'bandpass';
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
    f.Q.value = o.q ?? 1;
    const g = ctx.createGain();
    this.env(g, t, o.attack ?? 0.002, o.vol, o.dur);
    src.connect(f);
    f.connect(g);
    g.connect(o.dest ?? this.sfxBus);
    src.start(t, Math.random() * 1.5);
    src.stop(t + (o.attack ?? 0.002) + o.dur + 0.05);
  }

  // ---------- sound effects ----------

  play(name: SfxName, param = 0) {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const th = THROTTLE[name];
    if (th !== undefined) {
      const l = this.last[name] ?? -1;
      if (now - l < th) return;
      this.last[name] = now;
    }
    const t = now;
    switch (name) {
      case 'shot':
        this.noiseBurst({ dur: 0.035, vol: 0.05, type: 'highpass', f0: 5000, q: 0.7 });
        this.tone({ type: 'triangle', f0: 520, f1: 260, dur: 0.05, vol: 0.035 });
        break;
      case 'hit':
        this.noiseBurst({ dur: 0.03, vol: 0.07, type: 'bandpass', f0: 2600, q: 2 });
        break;
      case 'hitBoss':
        this.noiseBurst({ dur: 0.04, vol: 0.06, type: 'bandpass', f0: 1800, q: 3 });
        this.tone({ type: 'square', f0: 180, f1: 120, dur: 0.03, vol: 0.02 });
        break;
      case 'explodeS':
        this.noiseBurst({ dur: 0.22, vol: 0.22, type: 'lowpass', f0: 3200, f1: 250, q: 0.8 });
        this.tone({ type: 'sine', f0: 170, f1: 45, dur: 0.18, vol: 0.28 });
        break;
      case 'explodeM':
        this.noiseBurst({ dur: 0.45, vol: 0.3, type: 'lowpass', f0: 2600, f1: 120, q: 0.9 });
        this.tone({ type: 'sine', f0: 130, f1: 35, dur: 0.35, vol: 0.45 });
        this.tone({ type: 'square', f0: 90, f1: 30, dur: 0.25, vol: 0.08, lp: 600 });
        break;
      case 'explodeL':
        this.noiseBurst({ dur: 1.4, vol: 0.4, type: 'lowpass', f0: 4000, f1: 60, q: 0.7 });
        this.noiseBurst({ dur: 0.5, vol: 0.2, type: 'highpass', f0: 3000, f1: 800, q: 0.5 });
        this.tone({ type: 'sine', f0: 110, f1: 25, dur: 1.1, vol: 0.6 });
        this.tone({ type: 'sawtooth', f0: 70, f1: 20, dur: 0.8, vol: 0.12, lp: 400 });
        break;
      case 'bossDie':
        for (let i = 0; i < 6; i++) {
          this.noiseBurst({ t: t + i * 0.12, dur: 0.35, vol: 0.28, type: 'lowpass', f0: 3500, f1: 150 });
          this.tone({ t: t + i * 0.12, type: 'sine', f0: 150 - i * 12, f1: 30, dur: 0.3, vol: 0.4 });
        }
        this.noiseBurst({ t: t + 0.75, dur: 2.2, vol: 0.45, type: 'lowpass', f0: 5000, f1: 50 });
        this.tone({ t: t + 0.75, type: 'sine', f0: 90, f1: 20, dur: 1.8, vol: 0.7 });
        break;
      case 'graze':
        this.tone({ type: 'sine', f0: 3400 + Math.random() * 400, f1: 2600, dur: 0.025, vol: 0.05 });
        break;
      case 'collect': {
        const now2 = performance.now();
        if (now2 - this.collectT > 350) this.collectPitch = 0;
        this.collectT = now2;
        const semis = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
        const f = 880 * Math.pow(2, semis[this.collectPitch % semis.length] / 12) * (this.collectPitch >= semis.length ? 2 : 1);
        this.collectPitch = Math.min(this.collectPitch + 1, semis.length * 2 - 1);
        this.tone({ type: 'sine', f0: f, dur: 0.06, vol: 0.06 });
        this.tone({ type: 'square', f0: f * 2, dur: 0.03, vol: 0.012 });
        break;
      }
      case 'power':
        [0, 4, 7, 12].forEach((s, i) => this.tone({ t: t + i * 0.045, type: 'square', f0: 523 * Math.pow(2, s / 12), dur: 0.07, vol: 0.05, lp: 3500 }));
        break;
      case 'bomb':
        this.noiseBurst({ dur: 1.6, vol: 0.4, type: 'lowpass', f0: 300, f1: 6000, attack: 0.08, q: 2 });
        this.noiseBurst({ t: t + 0.25, dur: 1.4, vol: 0.3, type: 'lowpass', f0: 5000, f1: 100 });
        this.tone({ type: 'sawtooth', f0: 55, f1: 220, dur: 0.5, vol: 0.18, lp: 900 });
        this.tone({ t: t + 0.2, type: 'sine', f0: 120, f1: 30, dur: 1.2, vol: 0.5 });
        break;
      case 'death':
        this.tone({ type: 'sawtooth', f0: 900, f1: 40, dur: 0.9, vol: 0.2, lp: 2500 });
        this.tone({ type: 'square', f0: 1300, f1: 60, dur: 0.7, vol: 0.08, curve: 'lin' });
        this.noiseBurst({ dur: 0.9, vol: 0.35, type: 'lowpass', f0: 6000, f1: 150 });
        for (let i = 0; i < 5; i++) this.tone({ t: t + i * 0.06, type: 'square', f0: 200 + Math.random() * 1400, dur: 0.04, vol: 0.05 });
        break;
      case 'extend':
        [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => this.tone({ t: t + i * 0.06, type: 'square', f0: 659 * Math.pow(2, s / 12), dur: 0.12, vol: 0.06, lp: 4000 }));
        break;
      case 'spell':
        this.noiseBurst({ dur: 0.6, vol: 0.25, type: 'bandpass', f0: 300, f1: 5000, q: 3, attack: 0.3 });
        [0, 3, 7, 10].forEach((s) => this.tone({ t: t + 0.3, type: 'sawtooth', f0: 220 * Math.pow(2, s / 12), dur: 0.8, vol: 0.06, lp: 2200 }));
        this.tone({ t: t + 0.3, type: 'sine', f0: 55, dur: 0.8, vol: 0.4 });
        break;
      case 'capture':
        [0, 7, 12, 16, 19, 24].forEach((s, i) => this.tone({ t: t + i * 0.07, type: 'square', f0: 523 * Math.pow(2, s / 12), dur: 0.2, vol: 0.06, lp: 5000 }));
        [0, 4, 7].forEach((s) => this.tone({ t: t + 0.45, type: 'sawtooth', f0: 1046 * Math.pow(2, s / 12), dur: 0.7, vol: 0.04, lp: 3000 }));
        break;
      case 'fail':
        [0, -1, -5].forEach((s, i) => this.tone({ t: t + i * 0.12, type: 'square', f0: 440 * Math.pow(2, s / 12), dur: 0.15, vol: 0.05, lp: 1800 }));
        break;
      case 'warning':
        for (let i = 0; i < 6; i++) {
          this.tone({ t: t + i * 0.5, type: 'sawtooth', f0: 440, f1: 660, dur: 0.25, vol: 0.09, lp: 2000, curve: 'lin' });
          this.tone({ t: t + i * 0.5 + 0.25, type: 'sawtooth', f0: 660, f1: 440, dur: 0.25, vol: 0.09, lp: 2000, curve: 'lin' });
        }
        break;
      case 'menuMove':
        this.tone({ type: 'square', f0: 1320, dur: 0.035, vol: 0.04, lp: 5000 });
        break;
      case 'menuOk':
        this.tone({ type: 'square', f0: 880, dur: 0.05, vol: 0.05, lp: 5000 });
        this.tone({ t: t + 0.05, type: 'square', f0: 1760, dur: 0.08, vol: 0.05, lp: 5000 });
        break;
      case 'menuBack':
        this.tone({ type: 'square', f0: 880, dur: 0.05, vol: 0.04, lp: 4000 });
        this.tone({ t: t + 0.05, type: 'square', f0: 440, dur: 0.08, vol: 0.04, lp: 4000 });
        break;
      case 'eshot':
        this.tone({ type: 'square', f0: 1500 + param * 200, f1: 700, dur: 0.045, vol: 0.022, lp: 3000 });
        break;
      case 'eshot2':
        this.noiseBurst({ dur: 0.08, vol: 0.05, type: 'bandpass', f0: 1200, f1: 400, q: 4 });
        this.tone({ type: 'triangle', f0: 400, f1: 200, dur: 0.07, vol: 0.05 });
        break;
      case 'laserWarn':
        this.tone({ type: 'sine', f0: 600, f1: 1800, dur: 0.5, vol: 0.05, curve: 'lin' });
        break;
      case 'laserFire':
        this.tone({ type: 'sawtooth', f0: 110, f1: 90, dur: 0.6, vol: 0.12, lp: 1400 });
        this.noiseBurst({ dur: 0.6, vol: 0.14, type: 'bandpass', f0: 2000, q: 1.2 });
        break;
      case 'ocOn':
        this.tone({ type: 'sawtooth', f0: 900, f1: 90, dur: 0.6, vol: 0.14, lp: 1800 });
        this.noiseBurst({ dur: 0.6, vol: 0.18, type: 'bandpass', f0: 3000, f1: 300, q: 2 });
        this.tone({ type: 'sine', f0: 80, f1: 40, dur: 0.6, vol: 0.4 });
        break;
      case 'ocOff':
        this.tone({ type: 'sawtooth', f0: 90, f1: 900, dur: 0.35, vol: 0.1, lp: 1800 });
        break;
      case 'ocReady':
        this.tone({ type: 'sine', f0: 1320, dur: 0.08, vol: 0.06 });
        this.tone({ t: t + 0.08, type: 'sine', f0: 1980, dur: 0.12, vol: 0.06 });
        break;
      case 'tick':
        this.tone({ type: 'square', f0: 2000, dur: 0.03, vol: 0.05, lp: 5000 });
        break;
      case 'quack':
        this.tone({ type: 'sawtooth', f0: 520, f1: 380, dur: 0.16, vol: 0.12, lp: 1400 });
        this.noiseBurst({ dur: 0.12, vol: 0.06, type: 'bandpass', f0: 1100, q: 5 });
        break;
      case 'type':
        this.tone({ type: 'square', f0: 700 + Math.random() * 300, dur: 0.018, vol: 0.02, lp: 3000 });
        break;
      case 'cancel':
        this.noiseBurst({ dur: 0.35, vol: 0.12, type: 'highpass', f0: 2000, f1: 8000, q: 0.5 });
        break;
      case 'boot':
        this.tone({ type: 'sine', f0: 1000, dur: 0.15, vol: 0.08 });
        this.tone({ t: t + 0.16, type: 'sine', f0: 2000, dur: 0.25, vol: 0.06 });
        break;
      case 'stageClear':
        [0, 4, 7, 11, 12, 16, 19, 24].forEach((s, i) => this.tone({ t: t + i * 0.08, type: 'square', f0: 440 * Math.pow(2, s / 12), dur: 0.16, vol: 0.05, lp: 4500 }));
        [0, 4, 7, 12].forEach((s) => this.tone({ t: t + 0.7, type: 'sawtooth', f0: 440 * Math.pow(2, s / 12), dur: 1.2, vol: 0.04, lp: 2500 }));
        break;
      case 'gameOver':
        [0, -2, -3, -7, -12].forEach((s, i) => this.tone({ t: t + i * 0.28, type: 'square', f0: 440 * Math.pow(2, s / 12), dur: 0.35, vol: 0.06, lp: 1500 }));
        break;
      case 'pause':
        this.tone({ type: 'sine', f0: 660, f1: 440, dur: 0.1, vol: 0.06 });
        break;
      case 'glitch':
        for (let i = 0; i < 6; i++) this.tone({ t: t + i * 0.03, type: 'square', f0: 100 + Math.random() * 2000, dur: 0.025, vol: 0.04 });
        this.noiseBurst({ dur: 0.18, vol: 0.08, type: 'highpass', f0: 3000 });
        break;
      case 'charge':
        this.tone({ type: 'sawtooth', f0: 100, f1: 1200, dur: 1.0, vol: 0.07, lp: 2500 });
        this.noiseBurst({ dur: 1.0, vol: 0.06, type: 'bandpass', f0: 400, f1: 4000, q: 4, attack: 0.5 });
        break;
    }
  }
}

export const audio = new AudioEngine();
