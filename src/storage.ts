import { CUSTOM_THEME, THEMES } from './code/themes.ts';
import { LANGUAGES } from './code/languages.ts';
import { defaultState, type MockupState } from './state.ts';

const KEY = 'simple-mockup:settings';
const VERSION = 1;
/** Anything bigger would risk blowing the storage quota, and isn't worth restoring. */
const MAX_CODE_LENGTH = 200_000;

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Copies the values from `saved` that have the same shape as `fallback`, and keeps the rest. */
function merge<T>(fallback: T, saved: unknown): T {
  if (!isObject(fallback)) return typeof saved === typeof fallback && saved !== null ? (saved as T) : fallback;
  const source = isObject(saved) ? saved : {};
  return Object.fromEntries(Object.entries(fallback).map(([k, v]) => [k, merge(v, source[k])])) as T;
}

function oneOf<T extends string>(value: T, allowed: readonly string[], fallback: T): T {
  return allowed.includes(value) ? value : fallback;
}

export function loadState(): MockupState {
  const state = structuredClone(defaultState);
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return state;
    const saved = JSON.parse(raw) as { version?: number; state?: unknown };
    if (saved.version !== VERSION) return state;
    const merged = merge(state, saved.state);
    const d = defaultState;
    merged.mode = oneOf(merged.mode, ['screenshot', 'code'], d.mode);
    merged.device = oneOf(merged.device, ['android', 'iphone', 'browser', 'simple'], d.device);
    merged.browserAppearance = oneOf(merged.browserAppearance, ['light', 'dark'], d.browserAppearance);
    merged.background = oneOf(merged.background, ['none', 'color', 'image'], d.background);
    merged.format = oneOf(merged.format, ['png', 'jpeg'], d.format);
    merged.code.theme = oneOf(merged.code.theme, [...THEMES.map((t) => t.id), CUSTOM_THEME], d.code.theme);
    merged.code.language = oneOf(merged.code.language, LANGUAGES.map((l) => l.id), d.code.language);
    if (![1, 2, 3, 4].includes(merged.code.scale)) merged.code.scale = d.code.scale;
    // Colors must stay `#rrggbb` for the color inputs.
    const hex = /^#[0-9a-f]{6}$/i;
    const colors: string[] = [merged.simple.color, merged.backgroundColor, merged.code.borderColor, ...Object.values(merged.code.customColors)];
    if (!colors.every((c) => hex.test(c))) return state;
    return merged;
  } catch {
    return state;
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
