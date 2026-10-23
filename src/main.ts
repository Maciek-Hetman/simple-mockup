import './style.css';
import { initColorPickers } from './color-picker.ts';
import { cleanFileName, downloadCanvas, EXTENSIONS } from './export.ts';
import { render } from './render.ts';
import { samplePicture } from './sample.ts';
import {
  defaultState,
  type Appearance,
  type BackgroundMode,
  type Device,
  type ExportFormat,
  type MockupState,
  type Picture,
} from './state.ts';

const form = document.querySelector<HTMLFormElement>('#controls')!;
const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
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
/** The name the user last saved under, until a new screenshot comes in. */
let lastFileName: string | null = null;

const syncColorPickers = initColorPickers(form);

const input = (name: string) => form.elements.namedItem(name) as HTMLInputElement;
const radios = (name: string) => form.elements.namedItem(name) as RadioNodeList;

function writeForm(s: MockupState): void {
  radios('device').value = s.device;
  input('simpleColor').value = s.simple.color;
  input('simpleWidth').value = String(s.simple.width);
  input('simpleRadius').value = String(s.simple.radius);
  radios('browserAppearance').value = s.browserAppearance;
  input('punchHoleSize').value = String(s.punchHoleSize);
  input('islandSize').value = String(s.islandSize);
  input('padding').value = String(s.padding);
  input('shadow').checked = s.shadow;
  radios('background').value = s.background;
  input('backgroundColor').value = s.backgroundColor;
  radios('format').value = s.format;
}

function readForm(): void {
  state.device = radios('device').value as Device;
  state.simple = {
    color: input('simpleColor').value,
    width: Number(input('simpleWidth').value),
    radius: Number(input('simpleRadius').value),
  };
  state.browserAppearance = radios('browserAppearance').value as Appearance;
  state.punchHoleSize = Number(input('punchHoleSize').value);
  state.islandSize = Number(input('islandSize').value);
  state.padding = Number(input('padding').value);
  state.shadow = input('shadow').checked;
  state.background = radios('background').value as BackgroundMode;
  state.backgroundColor = input('backgroundColor').value;
  state.format = radios('format').value as ExportFormat;
}

function updateUi(): void {
  for (const el of form.querySelectorAll<HTMLElement>('[data-show-when-device]')) {
    el.hidden = el.dataset.showWhenDevice !== state.device;
  }
  for (const el of form.querySelectorAll<HTMLElement>('[data-show-when-background]')) {
    el.hidden = el.dataset.showWhenBackground !== state.background;
  }
  for (const out of form.querySelectorAll<HTMLOutputElement>('output[data-for]')) {
    out.value = `${input(out.dataset.for!).value}%`;
  }
  syncColorPickers();

  const transparent =
    state.background === 'none' || (state.background === 'image' && !backgroundImage);
  jpegHint.hidden = !(state.format === 'jpeg' && transparent);

  sampleNote.hidden = screenshot !== null;
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

function renderNow(): void {
  render(canvas, state, screenshot ?? samplePicture(state.device), backgroundImage);
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

async function setScreenshot(file: File): Promise<void> {
  try {
    const picture = await loadPicture(file);
    closePicture(screenshot);
    screenshot = picture;
    lastFileName = null;
    update();
  } catch {
    setHint(screenshotHint, `Couldn't read ${file.name} as an image.`, true);
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

form.addEventListener('input', update);
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

window.addEventListener('paste', (event) => {
  const file = firstImage(event.clipboardData?.files);
  if (!file) return;
  event.preventDefault();
  void setScreenshot(file);
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
  const file = firstImage(event.dataTransfer?.files);
  if (file) void setScreenshot(file);
});

function suggestedFileName(): string {
  if (lastFileName) return lastFileName;
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
