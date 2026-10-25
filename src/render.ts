import { frames } from './frames/index.ts';
import { roundRectPath, type Rect } from './frames/common.ts';
import type { MockupState, Picture } from './state.ts';

// Browsers refuse to allocate canvases beyond these limits, so huge inputs are scaled down.
const MAX_SIDE = 16384;
const MAX_AREA = 36_000_000;

/** What sits on the background: a framed screenshot or a code window. */
export interface Subject {
  width: number;
  height: number;
  /** Outer corner radius, for the shadow. */
  radius: number;
  /** Space around the subject, on every side. */
  padding: number;
  /** Canvas pixels per unit, unless the canvas size limits force fewer. */
  pixelRatio: number;
  draw(ctx: CanvasRenderingContext2D, outer: Rect): void;
}

/** Where the subject landed, in subject units, and how many canvas pixels make one unit. */
export interface Placement {
  outer: Rect;
  scale: number;
}

export function screenshotSubject(state: MockupState, shot: Picture): Subject {
  const frame = frames[state.device];
  const insets = frame.insets(shot.width, shot.height, state);
  const width = shot.width + insets.left + insets.right;
  const height = shot.height + insets.top + insets.bottom;
  return {
    width,
    height,
    radius: insets.radius,
    padding: Math.round((Math.min(width, height) * state.padding) / 100),
    pixelRatio: 1,
    draw(ctx, outer) {
      const screen: Rect = {
        x: outer.x + insets.left,
        y: outer.y + insets.top,
        w: shot.width,
        h: shot.height,
      };
      frame.draw(ctx, outer, screen, shot.source, state);
    },
  };
}

export function render(
  canvas: HTMLCanvasElement,
  state: MockupState,
  subject: Subject,
  background: Picture | null,
): Placement {
  const pad = subject.padding;
  const fullW = subject.width + 2 * pad;
  const fullH = subject.height + 2 * pad;
  const scale = Math.min(
    subject.pixelRatio,
    MAX_SIDE / Math.max(fullW, fullH),
    Math.sqrt(MAX_AREA / (fullW * fullH)),
  );

  canvas.width = Math.round(fullW * scale);
  canvas.height = Math.round(fullH * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  drawBackground(ctx, state, background, fullW, fullH);

  const outer: Rect = { x: pad, y: pad, w: subject.width, h: subject.height };
  if (state.shadow) drawShadow(ctx, outer, subject.radius, scale);
  subject.draw(ctx, outer);
  return { outer, scale };
}

function drawBackground(
  ctx: CanvasRenderingContext2D,
  state: MockupState,
  background: Picture | null,
  w: number,
  h: number,
): void {
  if (state.format === 'jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
  }
  if (state.background === 'color') {
    ctx.fillStyle = state.backgroundColor;
    ctx.fillRect(0, 0, w, h);
  } else if (state.background === 'image' && background) {
    const s = Math.max(w / background.width, h / background.height);
    const dw = background.width * s;
    const dh = background.height * s;
    ctx.drawImage(background.source, (w - dw) / 2, (h - dh) / 2, dw, dh);
  }
}

/**
 * Draws only the shadow: the shape itself is placed off-canvas and the shadow offset brings
 * the shadow back underneath the frame. Shadow values are in device pixels, hence `scale`.
 */
function drawShadow(ctx: CanvasRenderingContext2D, rect: Rect, radius: number, scale: number): void {
  const unit = Math.min(rect.w, rect.h);
  const shift = rect.x + rect.w;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.shadowBlur = 0.05 * unit * scale;
  ctx.shadowOffsetX = shift * scale;
  ctx.shadowOffsetY = 0.02 * unit * scale;
  roundRectPath(ctx, { ...rect, x: rect.x - shift }, radius);
  ctx.fillStyle = '#000000';
  ctx.fill();
  ctx.restore();
}
