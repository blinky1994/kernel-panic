export type Action =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'shoot'
  | 'bomb'
  | 'focus'
  | 'overclock'
  | 'pause'
  | 'confirm'
  | 'back';

const ACTIONS: Action[] = ['up', 'down', 'left', 'right', 'shoot', 'bomb', 'focus', 'overclock', 'pause', 'confirm', 'back'];

const KEYMAP: Record<string, Action[]> = {
  ArrowUp: ['up'],
  ArrowDown: ['down'],
  ArrowLeft: ['left'],
  ArrowRight: ['right'],
  KeyW: ['up'],
  KeyS: ['down'],
  KeyA: ['left'],
  KeyD: ['right'],
  KeyZ: ['shoot', 'confirm'],
  KeyJ: ['shoot'],
  Space: ['shoot', 'confirm'],
  Enter: ['confirm'],
  NumpadEnter: ['confirm'],
  KeyX: ['bomb', 'back'],
  KeyL: ['bomb'],
  ShiftLeft: ['focus'],
  ShiftRight: ['focus'],
  KeyK: ['focus'],
  KeyC: ['overclock'],
  Semicolon: ['overclock'],
  Escape: ['pause', 'back'],
  KeyP: ['pause'],
  Backspace: ['back'],
};

// Standard gamepad mapping
const PADMAP: Record<number, Action[]> = {
  0: ['shoot', 'confirm'],
  1: ['bomb', 'back'],
  2: ['overclock'],
  3: ['overclock'],
  4: ['focus'],
  5: ['focus'],
  6: ['focus'],
  7: ['focus'],
  8: ['back'],
  9: ['pause'],
  12: ['up'],
  13: ['down'],
  14: ['left'],
  15: ['right'],
};

export interface PointerInfo {
  id: number;
  type: string;
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  t0: number;
  claimed: boolean;
}

export interface TapInfo {
  x: number;
  y: number;
  type: string;
}

export class Input {
  private keys = new Set<string>();
  private latched = new Set<Action>();
  private cur: Record<string, boolean> = {};
  private prev: Record<string, boolean> = {};
  private repeatT: Record<string, number> = {};
  private padAxes = { x: 0, y: 0 };
  lastDevice: 'keyboard' | 'gamepad' | 'touch' | 'mouse' = 'keyboard';
  anyPressed = false;
  private anyLatched = false;

  // pointers
  pointers = new Map<number, PointerInfo>();
  downs: PointerInfo[] = [];
  taps: TapInfo[] = [];
  dragX = 0;
  dragY = 0;
  hover: { x: number; y: number } | null = null;
  /** true only on ticks where the mouse actually moved */
  hoverMoved = false;
  private pendHoverMoved = false;
  private pendingDowns: PointerInfo[] = [];
  private pendingTaps: TapInfo[] = [];
  private pendDX = 0;
  private pendDY = 0;
  wheel = 0;
  private pendWheel = 0;

  // text entry
  chars: string[] = [];
  private pendChars: string[] = [];

  toLogical: (cx: number, cy: number) => [number, number] = (x, y) => [x, y];
  onFirstGesture: (() => void) | null = null;

  attach(el: HTMLElement) {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F11' || (e.ctrlKey && e.code !== 'KeyZ') || e.metaKey) return;
      if (KEYMAP[e.code] || e.code.startsWith('Arrow') || e.code === 'Space' || e.code === 'Tab') e.preventDefault();
      this.gesture();
      this.lastDevice = 'keyboard';
      if (!e.repeat) {
        this.keys.add(e.code);
        const acts = KEYMAP[e.code];
        if (acts) for (const a of acts) this.latched.add(a);
        this.anyLatched = true;
      }
      if (e.key.length === 1) this.pendChars.push(e.key);
      else if (e.key === 'Backspace') this.pendChars.push('\b');
      else if (e.key === 'Enter') this.pendChars.push('\n');
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.pointers.clear();
    });

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.focus();
      this.gesture();
      this.lastDevice = e.pointerType === 'touch' || e.pointerType === 'pen' ? 'touch' : 'mouse';
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const [x, y] = this.toLogical(e.clientX, e.clientY);
      const p: PointerInfo = { id: e.pointerId, type: e.pointerType, x, y, lastX: x, lastY: y, startX: x, startY: y, t0: performance.now(), claimed: false };
      this.pointers.set(e.pointerId, p);
      this.pendingDowns.push(p);
      this.anyLatched = true;
    });
    el.addEventListener('pointermove', (e) => {
      const [x, y] = this.toLogical(e.clientX, e.clientY);
      if (e.pointerType === 'mouse') {
        this.hover = { x, y };
        this.pendHoverMoved = true;
        if (this.lastDevice !== 'mouse' && this.lastDevice !== 'touch') {
          // only switch to mouse on real movement
          this.lastDevice = 'mouse';
        }
      }
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      if (!p.claimed && p.type !== 'mouse') {
        this.pendDX += x - p.x;
        this.pendDY += y - p.y;
      }
      p.lastX = p.x;
      p.lastY = p.y;
      p.x = x;
      p.y = y;
    });
    const up = (e: PointerEvent) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      this.pointers.delete(e.pointerId);
      const moved = Math.hypot(p.x - p.startX, p.y - p.startY);
      if (moved < 18 && performance.now() - p.t0 < 500) this.pendingTaps.push({ x: p.x, y: p.y, type: p.type });
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse') this.hover = null;
    });
    el.addEventListener(
      'wheel',
      (e) => {
        this.pendWheel += Math.sign(e.deltaY);
        e.preventDefault();
      },
      { passive: false },
    );
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('gamepadconnected', () => {
      this.lastDevice = 'gamepad';
    });
  }

  private gesture() {
    if (this.onFirstGesture) {
      const f = this.onFirstGesture;
      this.onFirstGesture = null;
      f();
    }
  }

  claim(id: number) {
    const p = this.pointers.get(id);
    if (p) p.claimed = true;
  }

  get touching(): boolean {
    for (const p of this.pointers.values()) if (p.type !== 'mouse' && !p.claimed) return true;
    return false;
  }

  /** Call once per logic tick, before scenes read input. */
  update() {
    for (const a of ACTIONS) this.prev[a] = this.cur[a];
    const now: Record<string, boolean> = {};
    for (const code of this.keys) {
      const acts = KEYMAP[code];
      if (acts) for (const a of acts) now[a] = true;
    }
    // gamepads
    this.padAxes.x = 0;
    this.padAxes.y = 0;
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const gp of pads) {
      if (!gp || !gp.connected) continue;
      gp.buttons.forEach((b, i) => {
        if (b.pressed || b.value > 0.5) {
          const acts = PADMAP[i];
          if (acts) {
            for (const a of acts) now[a] = true;
            this.lastDevice = 'gamepad';
          }
        }
      });
      const ax = gp.axes[0] ?? 0;
      const ay = gp.axes[1] ?? 0;
      const mag = Math.hypot(ax, ay);
      if (mag > 0.25) {
        const k = Math.min(1, (mag - 0.25) / 0.65) / mag;
        this.padAxes.x += ax * k;
        this.padAxes.y += ay * k;
        this.lastDevice = 'gamepad';
        if (ay < -0.5) now.up = true;
        if (ay > 0.5) now.down = true;
        if (ax < -0.5) now.left = true;
        if (ax > 0.5) now.right = true;
      }
    }
    for (const a of this.latched) now[a] = true;
    this.cur = now;
    this.anyPressed = this.anyLatched;
    for (const a of ACTIONS) {
      if (this.cur[a] && !this.prev[a]) this.anyPressed = true;
    }
    this.latched.clear();
    this.anyLatched = false;

    this.downs = this.pendingDowns;
    this.pendingDowns = [];
    this.taps = this.pendingTaps;
    this.pendingTaps = [];
    this.dragX = this.pendDX;
    this.dragY = this.pendDY;
    this.pendDX = 0;
    this.pendDY = 0;
    this.chars = this.pendChars;
    this.pendChars = [];
    this.wheel = this.pendWheel;
    this.pendWheel = 0;
    this.hoverMoved = this.pendHoverMoved;
    this.pendHoverMoved = false;

    for (const a of ACTIONS) {
      if (this.cur[a]) this.repeatT[a] = (this.repeatT[a] ?? 0) + 1;
      else this.repeatT[a] = 0;
    }
  }

  down(a: Action): boolean {
    return !!this.cur[a];
  }
  pressed(a: Action): boolean {
    return !!this.cur[a] && !this.prev[a];
  }
  /** Pressed with auto-repeat (for menu navigation). */
  repeat(a: Action): boolean {
    const t = this.repeatT[a] ?? 0;
    return t === 1 || (t > 18 && (t - 18) % 5 === 0);
  }

  /** Normalised movement vector (keyboard digital, gamepad analog). */
  axis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.cur.left) x -= 1;
    if (this.cur.right) x += 1;
    if (this.cur.up) y -= 1;
    if (this.cur.down) y += 1;
    if (Math.abs(this.padAxes.x) + Math.abs(this.padAxes.y) > 0.01) {
      x = this.padAxes.x;
      y = this.padAxes.y;
      // snap d-pad overrides analog
      if (this.cur.left && !this.cur.right && this.padAxes.x > -0.5) x = -1;
      if (this.cur.right && !this.cur.left && this.padAxes.x < 0.5) x = 1;
    }
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    return { x, y };
  }

  resetEdges() {
    for (const a of ACTIONS) this.prev[a] = this.cur[a];
    this.latched.clear();
  }
}

export const input = new Input();
