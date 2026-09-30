export type ShipId = 'js' | 'rs' | 'py';

export interface ShipDef {
  id: ShipId;
  file: string;
  lang: string;
  color: string;
  accent: string;
  tagline: string;
  desc: string[];
  focusDesc: string;
  speed: number;
  focusSpeed: number;
  bombName: string;
  bombColor: string;
  stats: { power: number; spread: number; speed: number };
}

export const SHIPS: ShipDef[] = [
  {
    id: 'js',
    file: 'spread.js',
    lang: 'JavaScript',
    color: '#ffe14d',
    accent: '#ff9a3c',
    tagline: 'Fires everywhere. Somehow works.',
    desc: ['Wide fan of shots that grows', 'with every version.', 'Great for crowds.'],
    focusDesc: 'Focus: fan collapses into a dense stream.',
    speed: 6.4,
    focusSpeed: 2.6,
    bombName: 'delete window.bullets',
    bombColor: '#ffe14d',
    stats: { power: 3, spread: 5, speed: 5 },
  },
  {
    id: 'rs',
    file: 'laser.rs',
    lang: 'Rust',
    color: '#ff7a3c',
    accent: '#ff3b5c',
    tagline: 'Memory-safe. Boss-unsafe.',
    desc: ['Narrow, heavy twin stream.', 'Focus fires a piercing beam', 'that shreds single targets.'],
    focusDesc: 'Focus: continuous beam, highest single-target damage.',
    speed: 6.0,
    focusSpeed: 2.4,
    bombName: 'drop(bullets)',
    bombColor: '#ff7a3c',
    stats: { power: 5, spread: 2, speed: 4 },
  },
  {
    id: 'py',
    file: 'homing.py',
    lang: 'Python',
    color: '#39ff88',
    accent: '#4d8dff',
    tagline: 'Import antigravity. Aim optional.',
    desc: ['Snaking seekers find targets', 'on their own.', 'Lower damage, zero aiming.'],
    focusDesc: 'Focus: tighter, faster, hungrier seekers.',
    speed: 6.2,
    focusSpeed: 2.7,
    bombName: 'del bullets[:]',
    bombColor: '#39ff88',
    stats: { power: 2, spread: 4, speed: 5 },
  },
];
