import { CUSTOM_THEME, SLOTS, THEMES } from './code/themes.ts';
import { AUTO, LANGUAGES } from './code/languages.ts';
import { defaultState, type MockupState } from './state.ts';

const KEY = 'simple-mockup:settings';
const VERSION = 1;
/** Anything bigger would risk blowing the storage quota, and isn't worth restoring. */
const MAX_CODE_LENGTH = 200_000;
const HEX = /^#[0-9a-f]{6}$/i;

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Copies the values from `saved` that have the same shape as `fallback`, and keeps the rest. */
export function merge<T>(fallback: T, saved: unknown): T {
  if (!isObject(fallback)) return typeof saved === typeof fallback && saved !== null ? (saved as T) : fallback;
  const source = isObject(saved) ? saved : {};
  return Object.fromEntries(Object.entries(fallback).map(([k, v]) => [k, merge(v, source[k])])) as T;
}

function oneOf<T extends string>(value: T, allowed: readonly string[], fallback: T): T {
  return allowed.includes(value) ? value : fallback;
}

/** Colors must stay `#rrggbb` for the color inputs. */
function hex(value: string, fallback: string): string {
  return HEX.test(value) ? value.toLowerCase() : fallback;
}

/**
 * Clamps a number to a slider's range and snaps it to the slider's step, so a restored value is one
 * the form could have produced. Non-finite values (from `1e999`) use the fallback.
 */
function range(value: number, min: number, max: number, step: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  const snapped = min + Math.round((Math.min(max, Math.max(min, value)) - min) / step) * step;
  // Two decimals strips float noise like 0.30000000000000004; every slider step has at most one.
  return Number(Math.min(max, snapped).toFixed(2));
}

/** The defaults, overridden by every value in `saved` that has the right type and is allowed. */
export function restoreState(saved: unknown): MockupState {
  const d = defaultState;
  const state = merge(d, saved);
  state.mode = oneOf(state.mode, ['screenshot', 'code'], d.mode);
  state.device = oneOf(state.device, ['android', 'iphone', 'browser', 'simple'], d.device);
  state.browserAppearance = oneOf(state.browserAppearance, ['light', 'dark'], d.browserAppearance);
  state.background = oneOf(state.background, ['none', 'color', 'image'], d.background);
  state.format = oneOf(state.format, ['png', 'jpeg'], d.format);
  state.code.theme = oneOf(state.code.theme, [...THEMES.map((t) => t.id), CUSTOM_THEME], d.code.theme);
  state.code.language = oneOf(state.code.language, [AUTO, ...LANGUAGES.map((l) => l.id)], d.code.language);
  if (![1, 2, 3, 4].includes(state.code.scale)) state.code.scale = d.code.scale;
  state.simple.color = hex(state.simple.color, d.simple.color);
  state.backgroundColor = hex(state.backgroundColor, d.backgroundColor);
  state.code.borderColor = hex(state.code.borderColor, d.code.borderColor);
  for (const slot of SLOTS) {
    state.code.customColors[slot] = hex(state.code.customColors[slot], d.code.customColors[slot]);
  }
  // These ranges are the sliders' in index.html.
  state.code.width = range(state.code.width, 20, 200, 1, d.code.width);
  state.code.borderWidth = range(state.code.borderWidth, 0, 12, 0.5, d.code.borderWidth);
  state.code.radius = range(state.code.radius, 0, 32, 1, d.code.radius);
  state.code.paddingX = range(state.code.paddingX, 0, 160, 4, d.code.paddingX);
  state.code.paddingY = range(state.code.paddingY, 0, 160, 4, d.code.paddingY);
  state.simple.width = range(state.simple.width, 0, 10, 0.1, d.simple.width);
  state.simple.radius = range(state.simple.radius, 0, 20, 0.5, d.simple.radius);
  state.punchHoleSize = range(state.punchHoleSize, 50, 150, 1, d.punchHoleSize);
  state.islandSize = range(state.islandSize, 50, 150, 1, d.islandSize);
  state.paddingX = range(state.paddingX, 0, 30, 1, d.paddingX);
  state.paddingY = range(state.paddingY, 0, 30, 1, d.paddingY);
  return state;
}

export function loadState(): MockupState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(defaultState);
    const saved = JSON.parse(raw) as { version?: number; state?: unknown };
    return saved.version === VERSION ? restoreState(saved.state) : structuredClone(defaultState);
  } catch {
    return structuredClone(defaultState);
  }
}

let timer: number | undefined;
let pending: MockupState | null = null;

function write(state: MockupState): void {
  try {
    const saved = structuredClone(state);
    if (saved.code.text.length > MAX_CODE_LENGTH) saved.code.text = defaultState.code.text;
    localStorage.setItem(KEY, JSON.stringify({ version: VERSION, state: saved }));
  } catch {
    // Storage can be full or blocked; settings just won't persist.
  }
}

/** Writes a pending save now. Runs when the page is hidden, so the last change isn't lost. */
function flush(): void {
  clearTimeout(timer);
  timer = undefined;
  const state = pending;
  pending = null;
  if (state) write(state);
}

/** Saves shortly after the last change, so dragging a slider doesn't write on every tick. */
export function saveState(state: MockupState): void {
  pending = state;
  clearTimeout(timer);
  timer = window.setTimeout(flush, 300);
}

// Guarded because this module is also imported under Node, where there's no page to hide.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
