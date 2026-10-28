import { THEMES } from './code/themes.ts';
import { CODE_FONT, codeSubject } from './code/window.ts';
import { downloadBlob } from './export.ts';
import {
  BUILT_IN_PRESETS,
  cleanPresetName,
  loadPresets,
  MAX_NAME_LENGTH,
  MAX_PRESETS,
  parsePresets,
  sameSettings,
  savePresets,
  serializePresets,
  styleOf,
  withPreset,
  type Preset,
} from './presets.ts';
import { render, screenshotSubject, type Subject } from './render.ts';
import { samplePicture } from './sample.ts';
import { defaultState, type Device, type MockupState, type Mode } from './state.ts';

/** The box a thumbnail is fitted into, in CSS pixels. Tiles show it at this aspect ratio. */
const THUMB_WIDTH = 160;
const THUMB_HEIGHT = 120;
/** How much of the box the thumbnail may fill, leaving a margin. */
const THUMB_FILL = 0.9;
const THUMB_CODE = `function greet(name) {
  // Say hello
  return \`Hi, \${name}!\`;
}`;
const MAX_FILE_SIZE = 1_000_000;
const EXPORT_FILE_NAME = 'simple-mockup-presets.json';
const DEVICE_NAMES: Record<Device, string> = {
  android: 'Android',
  iphone: 'iPhone',
  browser: 'Browser',
  simple: 'Simple frame',
};

interface Tile {
  item: HTMLElement;
  button: HTMLButtonElement;
  canvas: HTMLCanvasElement;
}

const sameName = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();
const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Draws the preset applied to the sample screenshot, or to a short snippet of code. */
function drawThumbnail(canvas: HTMLCanvasElement, preset: Preset): void {
  const state = withPreset(defaultState, preset);
  const subject: Subject =
    preset.mode === 'code'
      ? codeSubject({ ...state.code, text: THUMB_CODE, language: 'javascript', title: '', fitWidth: true })
      : screenshotSubject(state, samplePicture(state.device));
  const fullW = subject.width + 2 * subject.paddingX;
  const fullH = subject.height + 2 * subject.paddingY;
  const fit = THUMB_FILL * Math.min(THUMB_WIDTH / fullW, THUMB_HEIGHT / fullH);
  render(canvas, state, { ...subject, pixelRatio: fit * Math.min(window.devicePixelRatio, 2) }, null);
  canvas.style.width = `${(100 * fit * fullW) / THUMB_WIDTH}%`;
}

/**
 * Wires up the presets section and its save dialog. `apply` gets the preset a tile was clicked
 * for. Returns a function that shows the current mode's presets and marks the one in use.
 */
export function initPresetPanel(getState: () => MockupState, apply: (preset: Preset) => void): () => void {
  const grid = document.querySelector<HTMLElement>('#preset-grid')!;
  const hint = document.querySelector<HTMLElement>('#preset-hint')!;
  const saveButton = document.querySelector<HTMLButtonElement>('#preset-save')!;
  const exportButton = document.querySelector<HTMLButtonElement>('#preset-export')!;
  const fileInput = document.querySelector<HTMLInputElement>('#preset-file-input')!;
  const dialog = document.querySelector<HTMLDialogElement>('#preset-dialog')!;
  const nameInput = document.querySelector<HTMLInputElement>('#preset-name')!;
  const note = document.querySelector<HTMLElement>('#preset-note')!;
  const replaceHint = document.querySelector<HTMLElement>('#preset-replace-hint')!;
  const confirmButton = document.querySelector<HTMLButtonElement>('#preset-confirm')!;
  const cancelButton = document.querySelector<HTMLButtonElement>('#preset-cancel')!;

  const custom = loadPresets();
  const tiles = new Map<Preset, Tile>();
  let shownMode: Mode | null = null;

  function showHint(text: string, warning = false, undo?: () => void): void {
    hint.replaceChildren(text);
    hint.hidden = text === '';
    hint.classList.toggle('warning', warning);
    if (!undo) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'link-button';
    button.textContent = 'Undo';
    button.addEventListener('click', undo);
    hint.append(' ', button);
    button.focus();
  }

  function createTile(preset: Preset): Tile {
    const item = document.createElement('div');
    item.className = 'preset';
    item.setAttribute('role', 'listitem');

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-apply';
    button.title = preset.name;
    const thumb = document.createElement('span');
    thumb.className = 'preset-thumb';
    const canvas = document.createElement('canvas');
    thumb.append(canvas);
    const label = document.createElement('span');
    label.className = 'preset-name';
    label.textContent = preset.name;
    button.append(thumb, label);
    button.addEventListener('click', () => apply(preset));
    item.append(button);

    if (custom.includes(preset)) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'preset-delete';
      remove.title = 'Delete preset';
      remove.setAttribute('aria-label', `Delete ${preset.name}`);
      remove.innerHTML =
        '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="m4.5 4.5 7 7m0-7-7 7" /></svg>';
      remove.addEventListener('click', () => deletePreset(preset));
      item.append(remove);
    }

    drawThumbnail(canvas, preset);
    return { item, button, canvas };
  }

  function showPresets(): void {
    const all = [...BUILT_IN_PRESETS, ...custom];
    for (const preset of tiles.keys()) {
      if (!all.includes(preset)) tiles.delete(preset);
    }
    grid.replaceChildren(
      ...all.map((preset) => {
        let tile = tiles.get(preset);
        if (!tile) {
          tile = createTile(preset);
          tiles.set(preset, tile);
        }
        return tile.item;
      }),
    );
    exportButton.disabled = custom.length === 0;
    sync();
  }

  function sync(): void {
    const state = getState();
    // Messages are about the presets that were on screen.
    if (shownMode !== null && shownMode !== state.mode) showHint('');
    shownMode = state.mode;
    const current = styleOf(state, state.mode);
    for (const [preset, { item, button }] of tiles) {
      const shown = preset.mode === state.mode;
      item.hidden = !shown;
      button.setAttribute('aria-pressed', String(shown && sameSettings(preset.settings, current)));
    }
  }

  /** Stores the custom presets and redraws the list. */
  function commit(): void {
    if (!savePresets(custom)) {
      showHint("This browser won't store your presets, so they'll be gone after a reload. Export them to keep them.", true);
    }
    showPresets();
  }

  function findCustom(name: string, mode: Mode): number {
    return custom.findIndex((preset) => preset.mode === mode && sameName(preset.name, name));
  }

  /** `name`, or `name 2`, `name 3`... if a preset in `mode` already has it. */
  function uniqueName(name: string, mode: Mode): string {
    const taken = (candidate: string) =>
      [...BUILT_IN_PRESETS, ...custom].some((preset) => preset.mode === mode && sameName(preset.name, candidate));
    let candidate = name;
    for (let i = 2; taken(candidate); i++) {
      const suffix = ` ${i}`;
      candidate = name.slice(0, MAX_NAME_LENGTH - suffix.length).trimEnd() + suffix;
    }
    return candidate;
  }

  function savePreset(name: string): void {
    const state = getState();
    const preset: Preset = { name, mode: state.mode, settings: styleOf(state, state.mode) };
    const index = findCustom(name, state.mode);
    if (index >= 0) {
      custom[index] = preset;
    } else if (custom.length >= MAX_PRESETS) {
      showHint(`You can keep up to ${MAX_PRESETS} presets. Delete one to save another.`, true);
      return;
    } else {
      custom.push(preset);
    }
    showHint('');
    commit();
  }

  function deletePreset(preset: Preset): void {
    const index = custom.indexOf(preset);
    if (index < 0) return;
    custom.splice(index, 1);
    commit();
    showHint(`Deleted ${preset.name}.`, false, () => {
      custom.splice(Math.min(index, custom.length), 0, preset);
      showHint('');
      commit();
    });
  }

  async function importFile(file: File): Promise<void> {
    let presets: Preset[];
    try {
      if (file.size > MAX_FILE_SIZE) throw new Error('Too big.');
      presets = parsePresets(await file.text());
    } catch {
      showHint(`${file.name} isn't a Simple Mockup presets file.`, true);
      return;
    }
    if (presets.length === 0) {
      showHint(`${file.name} has no presets in it.`, true);
      return;
    }

    const mode = getState().mode;
    let added = 0;
    let elsewhere = 0;
    let left = 0;
    for (const preset of presets) {
      // Importing the same file twice shouldn't double everything up.
      const duplicate = custom.some(
        (p) => p.mode === preset.mode && sameName(p.name, preset.name) && sameSettings(p.settings, preset.settings),
      );
      if (duplicate) continue;
      if (custom.length >= MAX_PRESETS) {
        left++;
        continue;
      }
      custom.push({ ...preset, name: uniqueName(preset.name, preset.mode) });
      added++;
      if (preset.mode !== mode) elsewhere++;
    }

    if (added === 0 && left === 0) {
      showHint(`You already have every preset in ${file.name}.`);
      return;
    }
    const other = mode === 'code' ? 'screenshot' : 'code';
    let message = `Imported ${plural(added, 'preset')}.`;
    if (elsewhere === added && added > 0) {
      message += ` Switch to ${other} mode to see ${added === 1 ? 'it' : 'them'}.`;
    } else if (elsewhere > 0) {
      message += ` ${elsewhere} of them ${elsewhere === 1 ? 'is' : 'are'} in ${other} mode.`;
    }
    if (left > 0) message += ` ${left} didn't fit: you can keep up to ${MAX_PRESETS}.`;
    showHint(message, left > 0);
    commit();
  }

  function updateDialog(): void {
    const name = cleanPresetName(nameInput.value);
    const replacing = name !== '' && findCustom(name, getState().mode) >= 0;
    replaceHint.hidden = !replacing;
    confirmButton.textContent = replacing ? 'Replace' : 'Save';
    nameInput.setCustomValidity(name ? '' : 'Give the preset a name.');
  }

  saveButton.addEventListener('click', () => {
    const state = getState();
    const suggestion =
      state.mode === 'code'
        ? (THEMES.find((theme) => theme.id === state.code.theme)?.name ?? 'Custom')
        : DEVICE_NAMES[state.device];
    nameInput.value = uniqueName(suggestion, state.mode);
    note.textContent =
      state.mode === 'code'
        ? 'Keeps the theme, window and canvas settings, but not the code itself.'
        : 'Keeps the device, frame and canvas settings, but not the screenshot itself.';
    if (state.background === 'image') note.textContent += " The background image isn't saved either.";
    updateDialog();
    dialog.returnValue = '';
    dialog.showModal();
    nameInput.select();
  });

  nameInput.maxLength = MAX_NAME_LENGTH;
  nameInput.addEventListener('input', updateDialog);
  cancelButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    const name = cleanPresetName(nameInput.value);
    if (dialog.returnValue === 'save' && name) savePreset(name);
  });

  exportButton.addEventListener('click', () => {
    downloadBlob(new Blob([serializePresets(custom)], { type: 'application/json' }), EXPORT_FILE_NAME);
  });

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) void importFile(file);
    fileInput.value = '';
  });

  showPresets();

  // Code thumbnails drawn before the code font loads measure the fallback font instead.
  if (!document.fonts.check(CODE_FONT, THUMB_CODE)) {
    document.fonts
      .load(CODE_FONT, THUMB_CODE)
      .then(() => {
        for (const [preset, { canvas }] of tiles) {
          if (preset.mode === 'code') drawThumbnail(canvas, preset);
        }
      })
      .catch(() => {});
  }

  return sync;
}
