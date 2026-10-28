import { CUSTOM_THEME } from './code/themes.ts';
import { isObject, merge, restoreState } from './storage.ts';
import type { CodeOptions, MockupState, Mode } from './state.ts';

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

export type PresetSettings = DeepPartial<MockupState>;

/** A saved look for one mode. Content (the screenshot, the code) and export options aren't part of it. */
export interface Preset {
  name: string;
  mode: Mode;
  settings: PresetSettings;
}

const STORAGE_KEY = 'simple-mockup:presets';
const FILE_TYPE = 'simple-mockup-presets';
const VERSION = 1;
export const MAX_NAME_LENGTH = 40;
/** Custom presets, across both modes. Each one gets a thumbnail, so there's a limit. */
export const MAX_PRESETS = 100;

/** The settings of `state` that a preset for `mode` keeps. */
export function styleOf(state: MockupState, mode: Mode): PresetSettings {
  const { shadow, background, backgroundColor } = state;
  if (mode === 'screenshot') {
    const { device, simple, browserAppearance, punchHoleSize, islandSize, paddingX, paddingY } = state;
    return {
      device,
      simple: { ...simple },
      browserAppearance,
      punchHoleSize,
      islandSize,
      paddingX,
      paddingY,
      shadow,
      background,
      backgroundColor,
    };
  }
  const { theme, customColors, width, fitWidth, lineNumbers, windowControls, borderColor, borderWidth, radius, paddingX, paddingY } =
    state.code;
  const code: DeepPartial<CodeOptions> = {
    theme,
    // The custom palette only matters while it's the one in use.
    ...(theme === CUSTOM_THEME && { customColors: { ...customColors } }),
    width,
    fitWidth,
    lineNumbers,
    windowControls,
    borderColor,
    borderWidth,
    radius,
    paddingX,
    paddingY,
  };
  return { code, shadow, background, backgroundColor };
}

/** Whether two presets' settings are the same, whatever order their keys are in. */
export function sameSettings(a: unknown, b: unknown): boolean {
  if (!isObject(a) || !isObject(b)) return a === b;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((key) => sameSettings(a[key], b[key]));
}

/** `state` with the preset applied. Unlocks padding if the preset's sides differ. */
export function withPreset(state: MockupState, preset: Preset): MockupState {
  const next = merge(state, preset.settings);
  next.mode = preset.mode;
  const { paddingX, paddingY } = preset.mode === 'code' ? next.code : next;
  if (paddingX !== paddingY) next.paddingLocked = false;
  return next;
}

export function cleanPresetName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH).trim();
}

/** Built-ins list only what differs from the defaults; the rest is filled in. */
function preset(name: string, mode: Mode, settings: PresetSettings): Preset {
  return { name, mode, settings: styleOf(restoreState(settings), mode) };
}

export const BUILT_IN_PRESETS: Preset[] = [
  preset('Default', 'screenshot', {}),
  preset('Blush', 'screenshot', { device: 'iphone', backgroundColor: '#fce7f3', paddingX: 12, paddingY: 12 }),
  preset('Clear', 'screenshot', { device: 'iphone', background: 'none', paddingX: 6, paddingY: 6 }),
  preset('Paper', 'screenshot', { device: 'browser', backgroundColor: '#fef3c7', paddingX: 6, paddingY: 6 }),
  preset('Midnight', 'screenshot', {
    device: 'browser',
    browserAppearance: 'dark',
    backgroundColor: '#18181b',
    paddingX: 6,
    paddingY: 6,
  }),
  preset('Outline', 'screenshot', {
    device: 'simple',
    simple: { width: 1.5, radius: 3 },
    backgroundColor: '#ffffff',
    paddingX: 6,
    paddingY: 6,
    shadow: false,
  }),

  preset('Default', 'code', {}),
  preset('Midnight', 'code', {
    code: { theme: 'tokyo-night', borderWidth: 1, borderColor: '#3f3f46' },
    backgroundColor: '#18181b',
  }),
  preset('Paper', 'code', {
    code: { theme: 'github-light', lineNumbers: true, borderWidth: 1, borderColor: '#e4e4e7', radius: 10, paddingX: 40, paddingY: 40 },
    backgroundColor: '#f4f4f5',
    shadow: false,
  }),
  preset('Dawn', 'code', { code: { theme: 'rose-pine-dawn' }, backgroundColor: '#fce7f3' }),
  preset('Bare', 'code', {
    code: { theme: 'github-dark', windowControls: false, radius: 8, paddingX: 0, paddingY: 0 },
    background: 'none',
    shadow: false,
  }),
  preset('Bare light', 'code', {
    code: {
      theme: 'github-light',
      windowControls: false,
      borderWidth: 1,
      borderColor: '#000000',
      radius: 8,
      paddingX: 0,
      paddingY: 0,
    },
    background: 'none',
    shadow: false,
  }),
];

/** Checks one preset from a file or storage, filling in or replacing whatever is missing or invalid. */
function readPreset(raw: unknown): Preset | null {
  if (!isObject(raw) || typeof raw.name !== 'string') return null;
  const name = cleanPresetName(raw.name);
  const mode = raw.mode;
  if (!name || (mode !== 'screenshot' && mode !== 'code')) return null;
  return { name, mode, settings: styleOf(restoreState(raw.settings), mode) };
}

export function serializePresets(presets: Preset[]): string {
  const list = presets.map(({ name, mode, settings }) => ({ name, mode, settings }));
  return JSON.stringify({ type: FILE_TYPE, version: VERSION, presets: list }, null, 2);
}

/** Throws if `text` isn't a presets file. Skips the presets in it that can't be read. */
export function parsePresets(text: string): Preset[] {
  const data: unknown = JSON.parse(text);
  if (!isObject(data) || data.type !== FILE_TYPE || data.version !== VERSION || !Array.isArray(data.presets)) {
    throw new Error('Not a presets file.');
  }
  return data.presets.map(readPreset).filter((p) => p !== null);
}

export function loadPresets(): Preset[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? parsePresets(raw).slice(0, MAX_PRESETS) : [];
  } catch {
    return [];
  }
}

/** Returns false if the browser wouldn't store them. */
export function savePresets(presets: Preset[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, serializePresets(presets));
    return true;
  } catch {
    return false;
  }
}
