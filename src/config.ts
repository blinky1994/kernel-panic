// Logical screen & playfield geometry. Everything is authored in these units
// and scaled to the real canvas at draw time.
export const W = 1280;
export const H = 720;

export const PF_X = 340;
export const PF_Y = 0;
export const PF_W = 600;
export const PF_H = 720;

export const FPS = 60;

/** Items auto-collect when the player flies above this line (Touhou-style PoC). */
export const POC_Y = PF_H * 0.27;

export const PLAYER_HIT_R = 3;
export const PLAYER_GRAZE_R = 26;
export const PLAYER_SPEED = 6.2;
export const PLAYER_FOCUS_SPEED = 2.6;

export const DEATHBOMB_FRAMES = 10;
export const RESPAWN_INVULN = 190;
export const BOMB_FRAMES = 150;

export const MAX_POWER = 400; // v1.00 -> v5.00
export const START_BOMBS = 3;

export const STREAK_TIME = 120;

export const EXTENDS = [3_000_000, 10_000_000, 25_000_000, 50_000_000];

export const COLORS = {
  bg: '#05060b',
  panel: '#070a12',
  panelLine: '#1b2540',
  text: '#cfe3ff',
  dim: '#5d6f93',
  cyan: '#00f0ff',
  magenta: '#ff2bd6',
  yellow: '#ffe14d',
  green: '#39ff88',
  red: '#ff3b5c',
  orange: '#ff9a3c',
  purple: '#a970ff',
  blue: '#4d8dff',
  white: '#ffffff',
  gold: '#ffc83d',
};

export const FONT_MONO = '"JetBrains Mono", Consolas, "Courier New", monospace';
export const FONT_DISPLAY = 'Orbitron, "JetBrains Mono", Consolas, sans-serif';
