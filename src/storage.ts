import { CUSTOM_THEME, SLOTS, THEMES } from './code/themes.ts';
import { LANGUAGES } from './code/languages.ts';
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
  state.code.language = oneOf(state.code.language, LANGUAGES.map((l) => l.id), d.code.language);
  if (![1, 2, 3, 4].includes(state.code.scale)) state.code.scale = d.code.scale;
  state.simple.color = hex(state.simple.color, d.simple.color);
  state.backgroundColor = hex(state.backgroundColor, d.backgroundColor);
  state.code.borderColor = hex(state.code.borderColor, d.code.borderColor);
  for (const slot of SLOTS) {
    state.code.customColors[slot] = hex(state.code.customColors[slot], d.code.customColors[slot]);
  }
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

/** Saves shortly after the last change, so dragging a slider doesn't write on every tick. */
export function saveState(state: MockupState): void {
  clearTimeout(timer);
  timer = window.setTimeout(() => {
    try {
      const saved = structuredClone(state);
      if (saved.code.text.length > MAX_CODE_LENGTH) saved.code.text = defaultState.code.text;
      localStorage.setItem(KEY, JSON.stringify({ version: VERSION, state: saved }));
    } catch {
      // Storage can be full or blocked; settings just won't persist.
    }
  }, 300);
}
