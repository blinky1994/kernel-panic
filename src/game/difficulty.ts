export interface DiffDef {
  id: string;
  name: string;
  flag: string;
  desc: string;
  density: number;
  speed: number;
  lives: number;
  color: string;
  lv: number;
}

export const DIFFS: DiffDef[] = [
  {
    id: 'debug',
    name: 'DEBUG',
    flag: '--debug',
    desc: 'Learning mode. Fewer, slower bullets. 5 processes.',
    density: 0.55,
    speed: 0.8,
    lives: 4,
    color: '#39ff88',
    lv: 0,
  },
  {
    id: 'release',
    name: 'RELEASE',
    flag: '--release',
    desc: 'The intended experience. Tough but fair.',
    density: 1,
    speed: 1,
    lives: 3,
    color: '#00f0ff',
    lv: 1,
  },
  {
    id: 'production',
    name: 'PRODUCTION',
    flag: '--prod',
    desc: 'Real users. Real traffic. Real bullets.',
    density: 1.4,
    speed: 1.12,
    lives: 3,
    color: '#ff9a3c',
    lv: 2,
  },
  {
    id: 'friday',
    name: 'FRIDAY DEPLOY',
    flag: '--force',
    desc: 'You pushed to main at 4:59 PM. Good luck.',
    density: 1.85,
    speed: 1.24,
    lives: 3,
    color: '#ff3b5c',
    lv: 3,
  },
];

export class Diff {
  constructor(public def: DiffDef) {}
  get lv() {
    return this.def.lv;
  }
  /** scale a bullet count */
  n(v: number, min = 1): number {
    return Math.max(min, Math.round(v * this.def.density));
  }
  /** scale a bullet speed */
  s(v: number): number {
    return v * this.def.speed;
  }
  /** scale an interval (frames between volleys) inversely with density */
  i(v: number, min = 1): number {
    return Math.max(min, Math.round(v / Math.sqrt(this.def.density)));
  }
  /** pick by level: [debug, release, production, friday] */
  pick<T>(arr: readonly T[]): T {
    return arr[Math.min(arr.length - 1, this.def.lv)];
  }
}
