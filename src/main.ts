import '@fontsource/jetbrains-mono/400.css';
import './style.css';
import { LANGUAGES, languageForFile } from './code/languages.ts';
import { CUSTOM_THEME, paletteFor, SLOT_LABELS, SLOTS, THEMES, type Palette, type Slot } from './code/themes.ts';
import { CODE_FONT, codeSubject, type CodeSubject } from './code/window.ts';
import { initColorPickers } from './color-picker.ts';
import { cleanFileName, downloadCanvas, EXTENSIONS } from './export.ts';
import { render, screenshotSubject, type Placement } from './render.ts';
import { initResizeHandles } from './resize-handles.ts';
import { samplePicture } from './sample.ts';
import {
  defaultState,
  type Appearance,
  type BackgroundMode,
  type Device,
  type ExportFormat,
  type MockupState,
  type Mode,
  type Picture,
} from './state.ts';

const form = document.querySelector<HTMLFormElement>('#controls')!;
const preview = document.querySelector<HTMLElement>('.preview')!;
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const codeInput = form.elements.namedItem('code') as HTMLTextAreaElement;
const codeHint = document.querySelector<HTMLElement>('#code-hint')!;
const paletteList = document.querySelector<HTMLElement>('#palette')!;
const screenshotInput = document.querySelector<HTMLInputElement>('#screenshot-input')!;
const backgroundInput = document.querySelector<HTMLInputElement>('#background-input')!;
const screenshotHint = document.querySelector<HTMLElement>('#screenshot-hint')!;
const backgroundHint = document.querySelector<HTMLElement>('#background-hint')!;
const jpegHint = document.querySelector<HTMLElement>('#jpeg-hint')!;
const sampleNote = document.querySelector<HTMLElement>('#sample-note')!;
const dimensions = document.querySelector<HTMLElement>('#dimensions')!;
const downloadButton = document.querySelector<HTMLButtonElement>('#download')!;
const saveDialog = document.querySelector<HTMLDialogElement>('#save-dialog')!;
const saveCancel = document.querySelector<HTMLButtonElement>('#save-cancel')!;
const fileNameInput = document.querySelector<HTMLInputElement>('#file-name')!;
const fileNameExtension = document.querySelector<HTMLElement>('#file-name-extension')!;

const state: MockupState = structuredClone(defaultState);
let screenshot: (Picture & { name: string }) | null = null;
let backgroundImage: (Picture & { name: string }) | null = null;
/** The name the user last saved under, until a new screenshot or code file comes in. */
let lastFileName: string | null = null;
/** The last code window drawn and where it landed, for the resize handles. */
let lastCode: { subject: CodeSubject; placement: Placement } | null = null;

const CODE_HINT = codeHint.textContent ?? '';
const MAX_CODE_FILE_SIZE = 1_000_000;

const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
const radios = (name: string) => form.elements.namedItem(name) as RadioNodeList;
const select = (name: string) => form.elements.namedItem(name) as HTMLSelectElement;

select('language').append(...LANGUAGES.map(({ id, label }) => new Option(label, id)));
const themeGroup = (label: string, dark: boolean) => {
  const group = document.createElement('optgroup');
  group.label = label;
  group.append(...THEMES.filter((theme) => theme.dark === dark).map(({ id, name }) => new Option(name, id)));
  return group;
};
select('theme').append(themeGroup('Dark', true), themeGroup('Light', false), new Option('Custom', CUSTOM_THEME));

paletteList.innerHTML = SLOTS.map(
  (slot) => `
    <div class="palette-row" data-color-picker>
      <input type="color" data-slot="${slot}" aria-label="${SLOT_LABELS[slot]} color" />
      <span>${SLOT_LABELS[slot]}</span>
      <input type="text" class="hex" maxlength="7" spellcheck="false" aria-label="${SLOT_LABELS[slot]} hex value" />
    </div>`,
).join('');
const paletteInputs = paletteList.querySelectorAll<HTMLInputElement>('input[data-slot]');

function readPalette(): Palette {
  return Object.fromEntries(Array.from(paletteInputs, (el) => [el.dataset.slot, el.value])) as Palette;
}

function writePalette(palette: Palette): void {
  for (const el of paletteInputs) el.value = palette[el.dataset.slot as Slot];
}

const syncColorPickers = initColorPickers(form);

function writeForm(s: MockupState): void {
  radios('mode').value = s.mode;
  codeInput.value = s.code.text;
  select('language').value = s.code.language;
  input('codeWidth').value = String(s.code.width);
  input('fitWidth').checked = s.code.fitWidth;
  input('lineNumbers').checked = s.code.lineNumbers;
  select('theme').value = s.code.theme;
  input('windowTitle').value = s.code.title;
  input('windowControls').checked = s.code.windowControls;
  input('codeBorderColor').value = s.code.borderColor;
  input('codeBorderWidth').value = String(s.code.borderWidth);
  input('codeRadius').value = String(s.code.radius);
  input('codePaddingX').value = String(s.code.paddingX);
  input('codePaddingY').value = String(s.code.paddingY);
  radios('codeScale').value = String(s.code.scale);
  radios('device').value = s.device;
  input('simpleColor').value = s.simple.color;
  input('simpleWidth').value = String(s.simple.width);
  input('simpleRadius').value = String(s.simple.radius);
  radios('browserAppearance').value = s.browserAppearance;
  input('punchHoleSize').value = String(s.punchHoleSize);
  input('islandSize').value = String(s.islandSize);
  input('paddingX').value = String(s.paddingX);
  input('paddingY').value = String(s.paddingY);
  input('shadow').checked = s.shadow;
  radios('background').value = s.background;
  input('backgroundColor').value = s.backgroundColor;
  radios('format').value = s.format;
}

function readForm(): void {
  state.mode = radios('mode').value as Mode;
  state.code = {
    text: codeInput.value,
    language: select('language').value,
    theme: select('theme').value,
    customColors: state.code.customColors,
    width: Number(input('codeWidth').value),
    fitWidth: input('fitWidth').checked,
    lineNumbers: input('lineNumbers').checked,
    title: input('windowTitle').value,
    windowControls: input('windowControls').checked,
    borderColor: input('codeBorderColor').value,
    borderWidth: Number(input('codeBorderWidth').value),
    radius: Number(input('codeRadius').value),
    paddingX: Number(input('codePaddingX').value),
    paddingY: Number(input('codePaddingY').value),
    scale: Number(radios('codeScale').value),
  };
  state.device = radios('device').value as Device;
  state.simple = {
    color: input('simpleColor').value,
    width: Number(input('simpleWidth').value),
    radius: Number(input('simpleRadius').value),
  };
  state.browserAppearance = radios('browserAppearance').value as Appearance;
  state.punchHoleSize = Number(input('punchHoleSize').value);
  state.islandSize = Number(input('islandSize').value);
  state.paddingX = Number(input('paddingX').value);
  state.paddingY = Number(input('paddingY').value);
  state.shadow = input('shadow').checked;
  state.background = radios('background').value as BackgroundMode;
  state.backgroundColor = input('backgroundColor').value;
  state.format = radios('format').value as ExportFormat;
}

function updateUi(): void {
  for (const el of form.querySelectorAll<HTMLElement>('[data-show-when-mode]')) {
    el.hidden = el.dataset.showWhenMode !== state.mode;
  }
  for (const el of form.querySelectorAll<HTMLElement>('[data-show-when-device]')) {
    el.hidden = el.dataset.showWhenDevice !== state.device;
  }
  for (const el of form.querySelectorAll<HTMLElement>('[data-show-when-background]')) {
    el.hidden = el.dataset.showWhenBackground !== state.background;
  }
  for (const out of form.querySelectorAll<HTMLOutputElement>('output[data-for]')) {
    out.value = `${input(out.dataset.for!).value}${out.dataset.unit ?? '%'}`;
  }
  writePalette(paletteFor(state.code.theme, state.code.customColors));
  syncColorPickers();

  const transparent =
    state.background === 'none' || (state.background === 'image' && !backgroundImage);
  jpegHint.hidden = !(state.format === 'jpeg' && transparent);

  sampleNote.hidden = screenshot !== null || state.mode === 'code';
  if (screenshot) {
    setHint(screenshotHint, `Using ${screenshot.name} (${screenshot.width} × ${screenshot.height}).`);
  }
  setHint(backgroundHint, backgroundImage ? `Using ${backgroundImage.name}.` : '');
}

function setHint(el: HTMLElement, text: string, warning = false): void {
  el.textContent = text;
  el.hidden = text === '';
  el.classList.toggle('warning', warning);
}

const placeResizeHandles = initResizeHandles(preview, canvas, {
  start() {
    if (!lastCode) return null;
    const { subject, placement } = lastCode;
    return {
      columns: Math.round(subject.contentWidth / subject.charWidth),
      columnWidth: subject.charWidth * placement.scale,
    };
  },
  resize(columns) {
    input('codeWidth').value = String(columns);
    input('fitWidth').checked = false;
    update();
  },
});

let fontLoading = false;

/** Text measured before the code font loads comes out wrong, so render again once it has. */
function ensureCodeFont(text: string): void {
  if (fontLoading || document.fonts.check(CODE_FONT, text)) return;
  fontLoading = true;
  document.fonts
    .load(CODE_FONT, text)
    .then(() => {
      if (document.fonts.check(CODE_FONT, text)) scheduleRender();
    })
    .catch(() => {})
    .finally(() => {
      fontLoading = false;
    });
}

function renderNow(): void {
  if (state.mode === 'code') {
    ensureCodeFont(state.code.text);
    const subject = codeSubject(state.code);
    const placement = render(canvas, state, subject, backgroundImage);
    lastCode = { subject, placement };
    const { outer, scale } = placement;
    placeResizeHandles({ x: outer.x * scale, y: outer.y * scale, w: outer.w * scale, h: outer.h * scale });
  } else {
    render(canvas, state, screenshotSubject(state, screenshot ?? samplePicture(state.device)), backgroundImage);
    lastCode = null;
    placeResizeHandles(null);
  }
  dimensions.textContent = `${canvas.width} × ${canvas.height} px`;
}

let renderQueued = false;
function scheduleRender(): void {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderNow();
  });
}

function update(): void {
  readForm();
  updateUi();
  scheduleRender();
}

async function loadPicture(file: File): Promise<Picture & { name: string }> {
  const bitmap = await createImageBitmap(file);
  return { source: bitmap, width: bitmap.width, height: bitmap.height, name: file.name };
}

function closePicture(picture: Picture | null): void {
  if (picture?.source instanceof ImageBitmap) picture.source.close();
}

function showMode(mode: Mode): void {
  radios('mode').value = mode;
  update();
}

async function setScreenshot(file: File): Promise<void> {
  try {
    const picture = await loadPicture(file);
    closePicture(screenshot);
    screenshot = picture;
    lastFileName = null;
    showMode('screenshot');
  } catch {
    showMode('screenshot');
    setHint(screenshotHint, `Couldn't read ${file.name} as an image.`, true);
  }
}

function setCode(text: string, fileName?: string): void {
  codeInput.value = text;
  if (fileName) {
    const language = languageForFile(fileName);
    if (language) select('language').value = language;
    input('windowTitle').value = fileName;
    lastFileName = null;
  }
  setHint(codeHint, CODE_HINT);
  showMode('code');
}

async function loadCodeFile(file: File): Promise<void> {
  const fail = (message: string) => {
    showMode('code');
    setHint(codeHint, message, true);
  };
  if (file.size > MAX_CODE_FILE_SIZE) return fail(`${file.name} is over 1 MB, which is too much code for one image.`);
  try {
    const text = await file.text();
    if (text.includes('\0')) return fail(`${file.name} doesn't look like a text file.`);
    setCode(text, file.name);
  } catch {
    fail(`Couldn't read ${file.name}.`);
  }
}

async function setBackgroundImage(file: File): Promise<void> {
  try {
    const picture = await loadPicture(file);
    closePicture(backgroundImage);
    backgroundImage = picture;
    update();
  } catch {
    setHint(backgroundHint, `Couldn't read ${file.name} as an image.`, true);
  }
}

function firstImage(files: FileList | undefined | null): File | undefined {
  return Array.from(files ?? []).find((file) => file.type.startsWith('image/'));
}

form.addEventListener('input', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.dataset.slot) {
    // Editing any color turns the current scheme into a custom one.
    state.code.customColors = readPalette();
    select('theme').value = CUSTOM_THEME;
  }
  update();
});
form.addEventListener('change', update);
form.addEventListener('submit', (event) => event.preventDefault());

screenshotInput.addEventListener('change', () => {
  const file = firstImage(screenshotInput.files);
  if (file) void setScreenshot(file);
  screenshotInput.value = '';
});

backgroundInput.addEventListener('change', () => {
  const file = firstImage(backgroundInput.files);
  if (file) void setBackgroundImage(file);
  backgroundInput.value = '';
});

/** Pastes into these go to the field itself instead of replacing the code. */
const TEXT_FIELDS = 'textarea, input[type="text"], [contenteditable]';

window.addEventListener('paste', (event) => {
  const file = firstImage(event.clipboardData?.files);
  if (file) {
    event.preventDefault();
    void setScreenshot(file);
    return;
  }
  const text = event.clipboardData?.getData('text/plain');
  const inTextField = event.target instanceof Element && event.target.closest(TEXT_FIELDS);
  if (state.mode !== 'code' || !text || inTextField) return;
  event.preventDefault();
  setCode(text);
});

let dragDepth = 0;
const isFileDrag = (event: DragEvent) => event.dataTransfer?.types.includes('Files') ?? false;

window.addEventListener('dragenter', (event) => {
  if (!isFileDrag(event)) return;
  dragDepth++;
  document.body.classList.add('dragging');
});

window.addEventListener('dragleave', (event) => {
  if (!isFileDrag(event)) return;
  dragDepth = Math.max(0, dragDepth - 1);
  if (dragDepth === 0) document.body.classList.remove('dragging');
});

window.addEventListener('dragover', (event) => {
  if (isFileDrag(event)) event.preventDefault();
});

window.addEventListener('drop', (event) => {
  event.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  const files = event.dataTransfer?.files;
  const image = firstImage(files);
  if (image) void setScreenshot(image);
  else if (files?.length) void loadCodeFile(files[0]);
});

function suggestedFileName(): string {
  if (lastFileName) return lastFileName;
  if (state.mode === 'code') return state.code.title.trim() || 'code';
  if (!screenshot) return 'mockup';
  return `${screenshot.name.replace(/\.[^.]+$/, '')}-mockup`;
}

downloadButton.addEventListener('click', () => {
  fileNameInput.value = suggestedFileName();
  fileNameExtension.textContent = `.${EXTENSIONS[state.format]}`;
  saveDialog.returnValue = '';
  saveDialog.showModal();
  fileNameInput.select();
});

saveCancel.addEventListener('click', () => saveDialog.close());

saveDialog.addEventListener('close', () => {
  if (saveDialog.returnValue !== 'save') return;
  lastFileName = cleanFileName(fileNameInput.value) || null;
  renderNow();
  void downloadCanvas(canvas, state.format, fileNameInput.value);
});

writeForm(state);
update();
