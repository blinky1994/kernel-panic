/**
 * Coroutine scripting. A task is a generator; `yield n` waits n world-frames,
 * a bare `yield` waits one frame. Time advances by `dt` each update, so the
 * world clock (slowed by Overclock) drives every script uniformly.
 */
export type Task<R = void> = Generator<number | undefined | void, R, unknown>;

interface Slot {
  gen: Task<unknown>;
  wait: number;
  done: boolean;
}

export class TaskRunner {
  private list: Slot[] = [];

  add<R>(gen: Task<R>): Task<R> {
    this.list.push({ gen, wait: 0, done: false });
    return gen;
  }

  update(dt: number, before?: () => void, after?: () => void) {
    let anyDone = false;
    for (let i = 0; i < this.list.length; i++) {
      const s = this.list[i];
      if (s.done) continue;
      s.wait -= dt;
      let guard = 0;
      while (s.wait <= 0 && !s.done) {
        before?.();
        let r: IteratorResult<number | undefined | void, unknown>;
        try {
          r = s.gen.next();
        } finally {
          after?.();
        }
        if (r.done) {
          s.done = true;
          anyDone = true;
          break;
        }
        const v = typeof r.value === 'number' && r.value > 0 ? r.value : 1;
        s.wait += v;
        if (++guard > 1000) break;
      }
    }
    if (anyDone) this.list = this.list.filter((s) => !s.done);
  }

  get count(): number {
    return this.list.length;
  }

  has(gen: Task<unknown>): boolean {
    return this.list.some((s) => s.gen === gen && !s.done);
  }

  kill(gen: Task<unknown>) {
    for (const s of this.list) {
      if (s.gen === gen && !s.done) {
        s.done = true;
        try {
          gen.return(undefined);
        } catch {
          /* ignore */
        }
      }
    }
  }

  clear() {
    for (const s of this.list) {
      if (!s.done) {
        s.done = true;
        try {
          s.gen.return(undefined);
        } catch {
          /* ignore */
        }
      }
    }
    this.list = [];
  }
}

/** Wait until predicate is true (checked each frame). */
export function* waitUntil(pred: () => boolean, max = Infinity): Task {
  let t = 0;
  while (!pred() && t < max) {
    t++;
    yield 1;
  }
}

/** Run fn(i) `count` times, `interval` frames apart. */
export function* repeat(count: number, interval: number, fn: (i: number) => void): Task {
  for (let i = 0; i < count; i++) {
    fn(i);
    if (i < count - 1) yield interval;
  }
}
