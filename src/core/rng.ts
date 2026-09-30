/** Small, fast, seedable PRNG (mulberry32). Gameplay uses this; cosmetic FX use Math.random. */
export class RNG {
  private s: number;
  constructor(seed = 0x9e3779b9) {
    this.s = seed >>> 0;
  }
  seed(seed: number) {
    this.s = seed >>> 0;
  }
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a: number, b: number): number {
    return a + (b - a) * this.next();
  }
  int(a: number, b: number): number {
    return Math.floor(this.range(a, b + 1));
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  sign(): number {
    return this.next() < 0.5 ? -1 : 1;
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
}

export const frand = (a: number, b: number) => a + (b - a) * Math.random();
export const fpick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
