import { audio } from './engine';
import { SONGS, type SongDef, type SectionDef } from './songs';

/**
 * Tiny tracker-style sequencer. Songs are sections of bars; each bar has a
 * chord, and bass/arp/drums are generated from compact pattern strings while
 * leads are hand-written melodies ("note:duration" tokens in steps).
 */

const NOTE_BASE: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };

export function noteToMidi(tok: string): number {
  const m = /^([a-g])(#|b)?(-?\d)$/.exec(tok.toLowerCase());
  if (!m) return -1;
  let n = NOTE_BASE[m[1]];
  if (m[2] === '#') n += 1;
  if (m[2] === 'b') n -= 1;
  return n + (parseInt(m[3], 10) + 1) * 12;
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

const CHORD_Q: Record<string, number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '7': [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  maj7: [0, 4, 7, 11],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  add9: [0, 4, 7, 14],
  m9: [0, 3, 7, 14],
  '5': [0, 7, 12],
};

function parseChord(name: string): number[] {
  const m = /^([A-G])(#|b)?(.*)$/.exec(name);
  if (!m) return [48, 52, 55];
  let root = NOTE_BASE[m[1].toLowerCase()];
  if (m[2] === '#') root += 1;
  if (m[2] === 'b') root -= 1;
  const q = CHORD_Q[m[3]] ?? CHORD_Q[''];
  return q.map((i) => 36 + root + i); // root around C2..B2
}

interface NoteEv {
  midi: number;
  dur: number;
}

interface CompiledSection {
  def: SectionDef;
  steps: number;
  lead: (NoteEv | null)[];
  lead2: (NoteEv | null)[];
  chords: number[][];
}

function parseMelody(src: string | undefined, total: number, transpose: number): (NoteEv | null)[] {
  const out: (NoteEv | null)[] = new Array(total).fill(null);
  if (!src) return out;
  let pos = 0;
  for (const tok of src.split(/[\s|]+/).filter(Boolean)) {
    const [n, d] = tok.split(':');
    const dur = d ? parseFloat(d) : 2;
    if (n !== '-' && pos < total) {
      const midi = noteToMidi(n);
      if (midi >= 0) out[pos] = { midi: midi + transpose, dur };
    }
    pos += dur;
  }
  if (import.meta.env.DEV && pos !== total) console.warn(`melody length ${pos} != ${total}:`, src.slice(0, 40));
  return out;
}

export const DRUMS: Record<string, { k: string; s: string; h: string; o?: string }> = {
  none: { k: '', s: '', h: '' },
  hats: { k: '', s: '', h: 'x.x.x.x.x.x.x.x.' },
  four: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', o: '' },
  drive: { k: 'x...x...x...x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
  dnb: { k: 'x.........x.....', s: '....x.......x..x', h: 'x.x.x.x.x.x.x.x.' },
  half: { k: 'x.........x.....', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
  break: { k: 'x..x..x...x..x..', s: '....x.......x..x', h: 'x.x.x.x.x.x.x.x.' },
  blast: { k: 'x.x.x.x.x.x.x.x.', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
  gallop: { k: 'x.xxx.xxx.xxx.xx', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
  intro: { k: 'x.......x.......', s: '', h: '..x...x...x...x.' },
  taran: { k: 'x.....x.....', s: '...x.....x..', h: 'xxxxxxxxxxxx' },
  taranFill: { k: 'x..x..x..x..', s: '...x..xx.xxx', h: 'xxxxxxxxxxxx' },
  industrial: { k: 'x..x....x.x.....', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
};

export const BASS: Record<string, string> = {
  none: '',
  long: 'R...............',
  eighths: 'R.R.R.R.R.R.R.R.',
  octave: 'R.O.R.O.R.O.R.O.',
  drive: 'RRRRRRRRRRRRRRRR',
  synco: 'R..R..R.R..R..O.',
  walk: 'R...F...O...F...',
  gallop: 'R.RRR.RRR.RRR.RR',
  pump: '-.R.-.R.-.R.-.RO',
  taran: 'R..F..R..O..',
  heavy: 'R.....R.R.....F.',
};

export const ARPS: Record<string, string> = {
  up: '0123454321012345',
  eighth: '0-2-4-2-0-2-4-2-',
  cascade: '6543210123456543',
  pulse: '3-3-4-3-3-5-3-4-',
  trip: '012012012012',
  bits: '0-4-2-5-1-3-5-4-',
};

class Sequencer {
  private song: SongDef | null = null;
  private songId = '';
  private sections: CompiledSection[] = [];
  private secIdx = 0;
  private step = 0;
  private nextTime = 0;
  private timer: number | null = null;
  tempoScale = 1;
  private tempoTarget = 1;
  private cache = new Map<string, CompiledSection[]>();
  private voiceGain: GainNode | null = null;

  get current(): string {
    return this.songId;
  }

  private compile(song: SongDef): CompiledSection[] {
    const cached = this.cache.get(song.id);
    if (cached) return cached;
    const spb = song.stepsPerBar ?? 16;
    const out = song.sections.map((def) => {
      const steps = def.chords.length * spb;
      return {
        def,
        steps,
        lead: parseMelody(def.lead, steps, song.transpose ?? 0),
        lead2: parseMelody(def.lead2, steps, song.transpose ?? 0),
        chords: def.chords.map(parseChord),
      };
    });
    this.cache.set(song.id, out);
    return out;
  }

  play(id: string, restart = false) {
    const ctx = audio.ctx;
    if (!ctx) {
      this.songId = id;
      return;
    }
    if (this.songId === id && this.song && !restart) return;
    const song = SONGS[id];
    if (!song) return;
    this.fadeOutVoice();
    this.song = song;
    this.songId = id;
    this.sections = this.compile(song);
    this.secIdx = 0;
    this.step = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.voiceGain = ctx.createGain();
    this.voiceGain.gain.value = 1;
    this.voiceGain.connect(audio.musicBus);
    if (this.timer === null) this.timer = window.setInterval(() => this.tick(), 25);
  }

  /** Resume a song that was requested before the AudioContext existed. */
  kick() {
    if (this.songId && !this.song) this.play(this.songId, true);
  }

  stop(fade = 0.4) {
    this.fadeOutVoice(fade);
    this.song = null;
    this.songId = '';
  }

  private fadeOutVoice(fade = 0.25) {
    const ctx = audio.ctx;
    if (this.voiceGain && ctx) {
      const g = this.voiceGain;
      g.gain.cancelScheduledValues(ctx.currentTime);
      g.gain.setValueAtTime(g.gain.value, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fade);
      setTimeout(() => g.disconnect(), (fade + 0.6) * 1000);
    }
    this.voiceGain = null;
  }

  setTempo(scale: number) {
    this.tempoTarget = scale;
  }

  private tick() {
    const ctx = audio.ctx;
    if (!ctx || !this.song || !this.voiceGain) return;
    this.tempoScale += (this.tempoTarget - this.tempoScale) * 0.15;
    if (this.nextTime < ctx.currentTime - 0.3) this.nextTime = ctx.currentTime + 0.05; // recovered from a stall
    const song = this.song;
    const spb = song.stepsPerBar ?? 16;
    const beatsPerBar = song.beatsPerBar ?? 4;
    while (this.nextTime < ctx.currentTime + 0.14) {
      const stepDur = 60 / (song.bpm * this.tempoScale) / (spb / beatsPerBar);
      this.playStep(this.nextTime, stepDur, spb);
      this.nextTime += stepDur;
      this.step++;
      const sec = this.sections[this.secIdx];
      if (this.step >= sec.steps) {
        this.step = 0;
        this.secIdx++;
        if (this.secIdx >= this.sections.length) this.secIdx = song.loop ?? 0;
      }
    }
  }

  private playStep(t: number, sd: number, spb: number) {
    const song = this.song!;
    const sec = this.sections[this.secIdx];
    const def = sec.def;
    const s = this.step;
    const bar = Math.floor(s / spb);
    const sib = s % spb; // step in bar
    const chord = sec.chords[bar];
    const out = this.voiceGain!;

    // drums
    const dr = DRUMS[def.drums ?? 'none'] ?? DRUMS.none;
    const kick = dr.k[sib] === 'x';
    if (kick) this.kick808(t, out);
    if (dr.s[sib] === 'x') this.snare(t, out, song.snareVol ?? 1);
    if (dr.h[sib] === 'x') this.hat(t, out, sib % 4 === 2 ? 0.05 : 0.03, 0.03);
    if (sib === 0 && bar === 0 && def.crash) this.crash(t, out);

    // bass
    const bp = BASS[def.bass ?? 'none'] ?? '';
    const bt = bp[sib];
    if (bt && bt !== '.' && bt !== '-') {
      let len = 1;
      while (sib + len < bp.length && bp[sib + len] === '.') len++;
      let n = chord[0];
      if (bt === 'O') n += 12;
      if (bt === 'F') n += 7;
      this.bass(t, mtof(n), len * sd * 0.92, out, song.bassWave ?? 'sawtooth');
    }

    // arp
    if (def.arp) {
      const ap = ARPS[def.arp] ?? '';
      const ch = ap[sib % ap.length];
      if (ch && ch !== '-') {
        const idx = parseInt(ch, 10);
        const tones = chord.length;
        const oct = Math.floor(idx / tones);
        const n = chord[idx % tones] + 24 + 12 * oct + (song.arpOct ?? 0) * 12;
        this.arp(t, mtof(n), sd * 0.9, out);
      }
    }

    // pad
    if (def.pad && sib === 0) {
      for (const n of chord.slice(0, 3)) this.pad(t, mtof(n + 24), sd * spb, out);
    }

    // leads
    const ev = sec.lead[s];
    if (ev) this.lead(t, mtof(ev.midi), ev.dur * sd, out, song.leadWave ?? 'square', song.leadVol ?? 1, 0);
    const ev2 = sec.lead2[s];
    if (ev2) this.lead(t, mtof(ev2.midi), ev2.dur * sd, out, song.lead2Wave ?? 'sawtooth', (song.leadVol ?? 1) * 0.55, 0.4);
    // canon voice (race condition): the melody chasing itself
    if (song.canon) {
      const cs = s - song.canon;
      const cev = cs >= 0 ? sec.lead[cs] : null;
      if (cev) this.lead(t, mtof(cev.midi + (song.canonShift ?? 0)), cev.dur * sd, out, 'sawtooth', (song.leadVol ?? 1) * 0.45, 0.6);
    }
  }

  // ---------- instruments ----------

  private kick808(t: number, out: AudioNode) {
    const ctx = audio.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.55, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.35);
  }

  private snare(t: number, out: AudioNode, vol: number) {
    const ctx = audio.ctx!;
    const src = audio.noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.22 * vol, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random());
    src.stop(t + 0.2);
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.0001, t);
    g2.gain.linearRampToValueAtTime(0.18 * vol, t + 0.002);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g2);
    g2.connect(out);
    o.start(t);
    o.stop(t + 0.12);
  }

  private hat(t: number, out: AudioNode, vol: number, dur: number) {
    const ctx = audio.ctx!;
    const src = audio.noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 7500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.001);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  private crash(t: number, out: AudioNode) {
    const ctx = audio.ctx!;
    const src = audio.noiseSrc();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 4000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random());
    src.stop(t + 1.5);
  }

  private bass(t: number, f: number, dur: number, out: AudioNode, wave: OscillatorType) {
    const ctx = audio.ctx!;
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = f;
    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = f / 2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 6;
    lp.frequency.setValueAtTime(1600, t);
    lp.frequency.exponentialRampToValueAtTime(260, t + Math.min(dur, 0.25));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.004);
    g.gain.setTargetAtTime(0.11, t + 0.02, 0.05);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.02);
    const sg = ctx.createGain();
    sg.gain.value = 0.9;
    o.connect(lp);
    lp.connect(g);
    sub.connect(sg);
    sg.connect(g);
    g.connect(out);
    o.start(t);
    sub.start(t);
    o.stop(t + dur + 0.12);
    sub.stop(t + dur + 0.12);
  }

  private arp(t: number, f: number, dur: number, out: AudioNode) {
    const ctx = audio.ctx!;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(0.05, dur));
    o.connect(lp);
    lp.connect(g);
    g.connect(out);
    g.connect(audio.delaySend);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private pad(t: number, f: number, dur: number, out: AudioNode) {
    const ctx = audio.ctx!;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.022, t + Math.min(0.4, dur * 0.3));
    g.gain.setTargetAtTime(0.0001, t + dur * 0.92, 0.08);
    lp.connect(g);
    g.connect(out);
    for (const d of [-9, 0, 8]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = d;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.4);
    }
  }

  private lead(t: number, f: number, dur: number, out: AudioNode, wave: OscillatorType, vol: number, pan: number) {
    const ctx = audio.ctx!;
    const g = ctx.createGain();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(5200, t);
    lp.frequency.setTargetAtTime(2600, t + 0.02, 0.15);
    const peak = 0.075 * vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.006);
    g.gain.setTargetAtTime(peak * 0.7, t + 0.03, 0.08);
    g.gain.setTargetAtTime(0.0001, t + dur * 0.95, 0.03);
    let node: AudioNode = g;
    if (pan !== 0 && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      node = p;
    }
    node.connect(out);
    node.connect(audio.delaySend);
    lp.connect(g);
    const vib = ctx.createOscillator();
    vib.frequency.value = 5.5;
    const vg = ctx.createGain();
    vg.gain.setValueAtTime(0, t);
    if (dur > 0.25) vg.gain.linearRampToValueAtTime(f * 0.012, t + Math.min(dur, 0.6));
    vib.connect(vg);
    for (const [d, w] of [
      [0, wave],
      [7, wave === 'square' ? 'sawtooth' : 'square'],
    ] as const) {
      const o = ctx.createOscillator();
      o.type = w as OscillatorType;
      o.frequency.value = f;
      o.detune.value = d;
      vg.connect(o.frequency);
      const og = ctx.createGain();
      og.gain.value = d === 0 ? 0.7 : 0.35;
      o.connect(og);
      og.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.2);
    }
    vib.start(t);
    vib.stop(t + dur + 0.2);
  }
}

export const music = new Sequencer();
