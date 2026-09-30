/**
 * The soundtrack. Lead lines are "note:steps" tokens (a 16-step bar = one 4/4
 * measure of 16th notes; "-" is a rest). Chords drive the bass, arps and pads.
 */
export interface SectionDef {
  chords: string[];
  lead?: string;
  lead2?: string;
  drums?: string;
  bass?: string;
  arp?: string;
  pad?: boolean;
  crash?: boolean;
}

export interface SongDef {
  id: string;
  title: string;
  bpm: number;
  stepsPerBar?: number;
  beatsPerBar?: number;
  transpose?: number;
  leadWave?: OscillatorType;
  lead2Wave?: OscillatorType;
  bassWave?: OscillatorType;
  leadVol?: number;
  snareVol?: number;
  arpOct?: number;
  /** a delayed copy of the lead (in steps) chasing the melody */
  canon?: number;
  canonShift?: number;
  loop?: number;
  sections: SectionDef[];
}

const titleA = `
a4:6 c5:2 e5:4 d5:4 | c5:6 a4:2 f4:8 | g4:6 c5:2 e5:4 g5:4 | f5:4 e5:4 d5:8 |
a4:6 c5:2 e5:4 a5:4 | g5:4 f5:4 c5:8 | e5:4 d5:4 c5:4 d5:4 | b4:8 g#4:8`;
const titleB = `
e5:2 a5:2 c6:4 b5:4 a5:4 | a5:6 c6:2 f5:8 | g5:2 c6:2 e6:4 d6:4 c6:4 | b5:6 a5:2 g5:8 |
e5:2 a5:2 c6:4 e6:4 d6:4 | c6:4 a5:4 f5:8 | e5:4 f5:4 g5:4 a5:4 | g#5:8 b5:8`;

const s1A = `
e5:3 f#5:3 g5:2 b5:4 a5:2 g5:2 | e5:6 g5:2 c6:4 b5:2 g5:2 | d5:3 e5:3 g5:2 d6:4 b5:2 g5:2 | a5:8 f#5:4 d5:4 |
e5:3 f#5:3 g5:2 b5:4 a5:2 g5:2 | e6:4 d6:2 c6:2 b5:4 g5:2 e5:2 | d5:2 g5:2 b5:2 d6:2 c6:2 b5:2 a5:2 g5:2 | f#5:8 d#5:8`;
const s1B = `
c6:4 b5:2 g5:2 e5:4 g5:4 | d6:4 c6:2 a5:2 f#5:4 a5:4 | b5:6 g5:2 e5:4 b5:2 c6:2 | b5:12 -:4 |
c6:4 b5:2 g5:2 e5:4 c6:4 | d6:4 e6:2 f#6:2 d6:4 a5:4 | b5:2 a5:2 g5:2 f#5:2 e5:2 d#5:2 e5:2 f#5:2 | b5:16`;

const b1A = `
d5:2 a5:2 f5:2 a5:2 d6:2 a5:2 f5:2 a5:2 | d5:2 bb5:2 f5:2 bb5:2 d6:2 bb5:2 f5:2 bb5:2 |
e5:2 c6:2 g5:2 c6:2 e6:2 c6:2 g5:2 c6:2 | c#6:4 e6:4 a6:8 |
d5:2 a5:2 f5:2 a5:2 d6:2 a5:2 f5:2 a5:2 | d6:4 f6:2 d6:2 bb5:4 f5:4 |
g5:2 bb5:2 d6:2 g6:2 f6:2 d6:2 bb5:2 g5:2 | a5:4 c#6:4 e6:4 a6:4`;
const b1B = `
f6:6 d6:2 bb5:8 | g6:6 e6:2 c6:8 | a6:4 f6:4 d6:4 a5:4 | d6:12 -:4 |
f6:6 d6:2 bb5:4 d6:4 | e6:6 g6:2 e6:4 c6:4 | c#6:4 d6:4 e6:4 g6:4 | a6:12 -:4`;

const s2A = `
f#5:3 a5:3 c#6:2 -:2 b5:2 a5:2 f#5:2 | -:2 f#5:2 a5:2 d6:4 c#6:2 b5:2 a5:2 |
g#5:3 b5:3 e6:2 -:2 d6:2 c#6:2 b5:2 | c#6:6 g#5:2 e5:4 g#5:4 |
f#5:3 a5:3 c#6:2 -:2 e6:2 d6:2 c#6:2 | d6:4 c#6:2 b5:2 a5:4 f#5:4 |
e5:2 g#5:2 b5:2 e6:2 d6:2 c#6:2 b5:2 g#5:2 | a5:4 b5:4 c#6:8`;
const s2B = `
d6:4 c#6:4 b5:4 f#5:4 | e6:4 d6:4 c#6:4 g#5:4 | f#6:4 e6:2 d6:2 a5:4 d6:4 | e6:12 -:4 |
d6:4 c#6:4 b5:4 d6:4 | c#6:4 e6:4 g#6:4 e6:4 | f#6:6 e6:2 d6:4 a5:4 | f6:8 c#6:8`;

// Spaghetti Code: an electro-tarantella in 12
const b2A = `
e5:1 a5:1 b5:1 c6:1 b5:1 a5:1 g#5:1 a5:1 b5:1 c6:1 d6:1 e6:1 | e6:3 c6:3 a5:3 e5:3 |
f5:1 a5:1 c6:1 d6:1 c6:1 a5:1 f5:1 a5:1 d6:1 f6:1 e6:1 d6:1 | d6:3 a5:3 f5:3 d5:3 |
e5:1 g#5:1 b5:1 e6:1 d6:1 b5:1 g#5:1 b5:1 d6:1 f6:1 e6:1 d6:1 | e6:6 b5:3 g#5:3 |
a5:1 c6:1 e6:1 a6:1 g#6:1 e6:1 c6:1 e6:1 a6:1 b6:1 c7:1 b6:1 | a6:6 -:3 e5:3`;
const b2B = `
f6:2 e6:1 d6:2 c6:1 d6:3 a5:3 | e6:2 d6:1 c6:2 b5:1 c6:3 a5:3 |
b5:2 c6:1 d6:2 e6:1 f6:2 e6:1 d6:2 b5:1 | c6:3 b5:3 a5:6 |
f6:2 e6:1 d6:2 c6:1 d6:3 f6:3 | e6:2 c6:1 a5:2 c6:1 e6:3 a6:3 |
g#6:2 f6:1 e6:2 d6:1 c6:2 b5:1 d6:2 b5:1 | g#5:6 b5:3 e6:3`;

const s3A = `
c5:4 eb5:4 g5:6 f5:2 | eb5:4 d5:4 c5:8 | c5:4 eb5:4 ab5:6 g5:2 | f5:4 g5:4 bb5:8 |
c6:4 bb5:4 g5:6 eb5:2 | f5:4 eb5:4 c5:8 | ab5:4 g5:4 f5:4 eb5:4 | d5:8 b4:8`;
const s3B = `
eb6:6 c6:2 ab5:8 | f6:6 d6:2 bb5:8 | g6:4 f6:4 eb6:4 c6:4 | g6:12 -:4 |
ab6:6 g6:2 f6:4 eb6:4 | d6:4 eb6:4 f6:8 | g6:4 f6:4 d6:4 b5:4 | g5:16`;

const b3A = `
g5:2 bb5:2 d6:2 bb5:2 g5:2 a5:2 bb5:2 c6:2 | d6:4 eb6:4 d6:4 bb5:4 |
a5:2 c6:2 f6:2 c6:2 a5:2 bb5:2 c6:2 d6:2 | f#6:8 d6:8 |
g5:2 bb5:2 d6:2 bb5:2 g5:2 a5:2 bb5:2 c6:2 | eb6:4 g6:4 eb6:4 bb5:4 |
c6:2 d6:2 eb6:2 g6:2 f6:2 eb6:2 d6:2 c6:2 | d6:4 f#6:4 a6:8`;
const b3B = `
g6:6 f6:2 eb6:4 bb5:4 | a6:6 g6:2 f6:4 c6:4 | bb6:4 a6:4 g6:4 d6:4 | g6:12 -:4 |
g6:6 f6:2 eb6:4 g6:4 | f6:6 eb6:2 d6:4 f6:4 | f#6:4 g6:4 a6:4 c7:4 | bb6:4 a6:4 f#6:8`;

const s4A = `
b4:2 d5:2 f#5:2 b5:4 a5:2 f#5:2 d5:2 | g5:4 f#5:2 e5:2 d5:4 b4:4 |
a4:2 d5:2 f#5:2 a5:4 g5:2 f#5:2 e5:2 | e5:6 c#5:2 a4:8 |
b4:2 d5:2 f#5:2 b5:4 c#6:2 d6:2 b5:2 | g5:4 b5:2 d6:2 e6:4 d6:4 |
e6:2 d6:2 c#6:2 b5:2 a5:2 g5:2 f#5:2 e5:2 | f#5:6 a#5:2 c#6:8`;
const s4B = `
d6:4 b5:4 g5:4 b5:4 | e6:4 c#6:4 a5:4 c#6:4 | f#6:6 e6:2 d6:4 c#6:4 | b5:12 -:4 |
d6:4 b5:4 g5:4 d6:4 | e6:4 f#6:4 g6:4 a6:4 | f#6:4 e6:4 c#6:4 a#5:4 | f#6:16`;

const b4A = `
e5:2 g5:2 b5:2 e6:2 d6:2 b5:2 g5:2 b5:2 | e6:2 f#6:2 g6:2 f#6:2 e6:2 d6:2 b5:4 |
c6:2 e6:2 g6:2 e6:2 c6:2 e6:2 g6:2 c7:2 | a6:4 f#6:4 d6:4 a5:4 |
e5:2 g5:2 b5:2 e6:2 d6:2 b5:2 g5:2 b5:2 | g6:4 f#6:2 e6:2 d6:4 b5:4 |
a5:2 c6:2 e6:2 a6:2 g6:2 e6:2 c6:2 a5:2 | b5:4 d#6:4 f#6:4 a6:4`;
const b4B = `
g6:6 e6:2 c6:8 | a6:6 f#6:2 d6:8 | b6:4 a6:4 g6:4 e6:4 | d6:12 -:4 |
g6:6 e6:2 c6:4 e6:4 | f#6:6 a6:2 f#6:4 d6:4 | d#6:4 e6:4 f#6:4 a6:4 | b6:16`;

const s5A = `
c#5:6 e5:2 g#5:8 | a5:4 g#5:4 e5:8 | f#5:4 a5:4 c#6:6 b5:2 | g#5:4 c6:4 d#6:8 |
c#6:6 b5:2 g#5:8 | a5:4 c#6:4 e6:8 | f#6:4 e6:4 c#6:4 a5:4 | g#5:8 c6:4 d#6:4`;
const s5B = `
e6:4 c#6:4 a5:4 c#6:4 | f#6:4 d#6:4 b5:4 d#6:4 | g#6:6 f#6:2 e6:4 c#6:4 | g#6:12 -:4 |
a6:6 g#6:2 f#6:4 e6:4 | d#6:4 e6:4 f#6:8 | g#6:4 f#6:4 d#6:4 c6:4 | c#6:16`;

const b5A = `
d5:1 e5:1 f5:1 a5:1 d6:4 c#6:2 d6:2 e6:2 f6:2 | d6:4 bb5:4 f5:4 bb5:2 d6:2 |
g5:1 a5:1 bb5:1 d6:1 g6:4 f6:2 e6:2 d6:2 bb5:2 | a5:2 c#6:2 e6:2 g6:2 a6:8 |
d5:1 e5:1 f5:1 a5:1 d6:4 c#6:2 d6:2 f6:2 a6:2 | bb6:4 a6:2 g6:2 f6:4 d6:4 |
g6:2 f6:2 e6:2 d6:2 bb5:2 d6:2 g6:2 bb6:2 | a6:4 g6:2 f6:2 e6:4 c#6:4`;
const b5B = `
f6:6 d6:2 bb5:8 | g6:6 e6:2 c6:8 | a6:4 f6:4 d6:4 f6:4 | a6:12 -:4 |
bb6:6 a6:2 g6:4 f6:4 | e6:6 f6:2 g6:8 | a6:2 g6:2 f6:2 e6:2 d6:2 c#6:2 e6:2 g6:2 | a6:16`;
const b5C = `
d6:1 f6:1 g6:2 bb6:4 a6:4 g6:4 | e6:1 g6:1 a6:2 c#7:4 a6:4 e6:4 | f6:4 e6:2 d6:2 a5:4 d6:4 | f6:4 g6:2 a6:2 bb6:8 |
bb6:4 a6:2 g6:2 d6:4 g6:4 | a6:4 g6:2 f6:2 e6:4 c#6:4 | d6:16 | d6:8 a5:8`;

const endA = `
e5:4 g5:4 c6:6 b5:2 | d6:6 b5:2 g5:8 | c6:4 e6:4 a5:6 g5:2 | f5:4 a5:4 c6:8 |
e6:4 d6:4 c6:4 g5:4 | d6:4 g6:4 f6:4 d6:4 | c6:4 a5:4 f6:6 e6:2 | d6:16`;
const endB = `
c6:6 b5:2 a5:8 | a5:4 c6:4 f6:8 | e6:4 d6:4 c6:4 e6:4 | d6:12 -:4 |
c6:6 d6:2 e6:8 | f6:4 e6:4 d6:4 c6:4 | b5:4 c6:4 d6:4 g6:4 | c6:16`;

export const SONGS: Record<string, SongDef> = {
  title: {
    id: 'title',
    title: 'POST /boot',
    bpm: 112,
    leadWave: 'triangle',
    loop: 1,
    sections: [
      { chords: ['Am', 'F', 'C', 'G'], drums: 'none', bass: 'long', arp: 'eighth', pad: true },
      { chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'E'], lead: titleA, drums: 'intro', bass: 'octave', arp: 'up', pad: true },
      { chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'E'], lead: titleB, drums: 'four', bass: 'octave', arp: 'up', pad: true, crash: true },
    ],
  },
  stage1: {
    id: 'stage1',
    title: 'Hello, World (Goodbye, World)',
    bpm: 152,
    loop: 1,
    sections: [
      { chords: ['Em', 'C', 'G', 'D'], drums: 'hats', bass: 'eighths', arp: 'up', crash: true },
      { chords: ['Em', 'C', 'G', 'D', 'Em', 'C', 'G', 'B'], lead: s1A, drums: 'drive', bass: 'octave', arp: 'eighth', crash: true },
      { chords: ['C', 'D', 'Em', 'Em', 'C', 'D', 'B', 'B'], lead: s1B, drums: 'drive', bass: 'synco', arp: 'up' },
    ],
  },
  boss1: {
    id: 'boss1',
    title: 'while(true) { spin(); }',
    bpm: 168,
    transpose: -12,
    loop: 1,
    sections: [
      { chords: ['Dm', 'Bb', 'C', 'A'], drums: 'half', bass: 'drive', arp: 'up', crash: true },
      { chords: ['Dm', 'Bb', 'C', 'A', 'Dm', 'Bb', 'Gm', 'A'], lead: b1A, drums: 'dnb', bass: 'octave', crash: true },
      { chords: ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'], lead: b1B, drums: 'drive', bass: 'gallop', arp: 'up' },
    ],
  },
  stage2: {
    id: 'stage2',
    title: '404: Sleep Not Found',
    bpm: 156,
    transpose: -12,
    leadWave: 'sawtooth',
    loop: 1,
    sections: [
      { chords: ['F#m', 'D', 'E', 'C#m'], drums: 'break', bass: 'pump', arp: 'bits', crash: true },
      { chords: ['F#m', 'D', 'E', 'C#m', 'F#m', 'D', 'E', 'E'], lead: s2A, drums: 'break', bass: 'synco', arp: 'eighth', crash: true },
      { chords: ['Bm', 'C#m', 'D', 'E', 'Bm', 'C#m', 'D', 'C#'], lead: s2B, drums: 'drive', bass: 'octave', arp: 'up' },
    ],
  },
  boss2: {
    id: 'boss2',
    title: 'Tarantella al Dente',
    bpm: 146,
    stepsPerBar: 12,
    transpose: -12,
    loop: 1,
    sections: [
      { chords: ['Am', 'Am', 'E', 'E'], drums: 'taran', bass: 'taran', arp: 'trip', crash: true },
      { chords: ['Am', 'Am', 'Dm', 'Dm', 'E', 'E', 'Am', 'Am'], lead: b2A, drums: 'taran', bass: 'taran', crash: true },
      { chords: ['Dm', 'Am', 'E', 'Am', 'Dm', 'Am', 'E', 'E'], lead: b2B, drums: 'taranFill', bass: 'taran', arp: 'trip' },
    ],
  },
  stage3: {
    id: 'stage3',
    title: 'Segmentation of the Soul',
    bpm: 138,
    leadWave: 'sawtooth',
    loop: 1,
    sections: [
      { chords: ['Cm', 'Cm', 'Ab', 'Bb'], drums: 'industrial', bass: 'heavy', pad: true, crash: true },
      { chords: ['Cm', 'Cm', 'Ab', 'Bb', 'Cm', 'Cm', 'Fm', 'G'], lead: s3A, drums: 'industrial', bass: 'heavy', arp: 'pulse', crash: true },
      { chords: ['Ab', 'Bb', 'Cm', 'Eb', 'Ab', 'Bb', 'G', 'G'], lead: s3B, drums: 'drive', bass: 'octave', arp: 'up' },
    ],
  },
  boss3: {
    id: 'boss3',
    title: 'malloc() Without free()',
    bpm: 160,
    transpose: -12,
    loop: 1,
    sections: [
      { chords: ['Gm', 'Eb', 'F', 'D'], drums: 'half', bass: 'drive', arp: 'bits', crash: true },
      { chords: ['Gm', 'Eb', 'F', 'D', 'Gm', 'Eb', 'Cm', 'D'], lead: b3A, drums: 'dnb', bass: 'octave', crash: true },
      { chords: ['Eb', 'F', 'Gm', 'Gm', 'Eb', 'F', 'D', 'D'], lead: b3B, drums: 'drive', bass: 'gallop', arp: 'up' },
    ],
  },
  stage4: {
    id: 'stage4',
    title: 'Parallel Lines, Shared State',
    bpm: 162,
    loop: 1,
    sections: [
      { chords: ['Bm', 'G', 'D', 'A'], drums: 'hats', bass: 'drive', arp: 'up', crash: true },
      { chords: ['Bm', 'G', 'D', 'A', 'Bm', 'G', 'Em', 'F#'], lead: s4A, drums: 'drive', bass: 'drive', arp: 'up', crash: true },
      { chords: ['G', 'A', 'Bm', 'Bm', 'G', 'A', 'F#', 'F#'], lead: s4B, drums: 'blast', bass: 'octave', arp: 'cascade' },
    ],
  },
  boss4: {
    id: 'boss4',
    title: 'Who Writes First',
    bpm: 176,
    transpose: -12,
    canon: 3,
    loop: 1,
    sections: [
      { chords: ['Em', 'Em', 'C', 'D'], drums: 'half', bass: 'drive', arp: 'up', crash: true },
      { chords: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'Am', 'B'], lead: b4A, drums: 'dnb', bass: 'octave', crash: true },
      { chords: ['C', 'D', 'Em', 'G', 'C', 'D', 'B', 'B'], lead: b4B, drums: 'blast', bass: 'gallop', arp: 'up' },
    ],
  },
  stage5: {
    id: 'stage5',
    title: 'Ring 0 Requiem',
    bpm: 150,
    leadWave: 'sawtooth',
    loop: 1,
    sections: [
      { chords: ['C#m', 'A', 'F#m', 'G#'], drums: 'intro', bass: 'heavy', arp: 'bits', pad: true, crash: true },
      { chords: ['C#m', 'A', 'F#m', 'G#', 'C#m', 'A', 'F#m', 'G#'], lead: s5A, drums: 'industrial', bass: 'synco', arp: 'pulse', crash: true },
      { chords: ['A', 'B', 'C#m', 'C#m', 'A', 'B', 'G#', 'G#'], lead: s5B, drums: 'drive', bass: 'octave', arp: 'up' },
    ],
  },
  boss5: {
    id: 'boss5',
    title: 'Fatal Exception at 0xDEADBEEF',
    bpm: 182,
    transpose: -12,
    loop: 1,
    sections: [
      { chords: ['Dm', 'Dm', 'Bb', 'A'], drums: 'half', bass: 'drive', arp: 'cascade', crash: true },
      { chords: ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb', 'Gm', 'A'], lead: b5A, drums: 'dnb', bass: 'octave', arp: 'up', crash: true },
      { chords: ['Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'A', 'A'], lead: b5B, drums: 'blast', bass: 'gallop', arp: 'up', crash: true },
      { chords: ['Gm', 'A', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Dm'], lead: b5C, drums: 'drive', bass: 'drive', arp: 'cascade' },
    ],
  },
  ending: {
    id: 'ending',
    title: 'exit(0)',
    bpm: 118,
    leadWave: 'triangle',
    loop: 0,
    sections: [
      { chords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G'], lead: endA, drums: 'four', bass: 'octave', arp: 'up', pad: true, crash: true },
      { chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'C'], lead: endB, drums: 'four', bass: 'walk', arp: 'up', pad: true },
    ],
  },
};
