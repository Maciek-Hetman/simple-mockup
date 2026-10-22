import { frames } from './frames/index.ts';
import { roundRectPath, type Rect } from './frames/common.ts';
import type { MockupState, Picture } from './state.ts';

// Browsers refuse to allocate canvases beyond these limits, so huge inputs are scaled down.
const MAX_SIDE = 16384;
const MAX_AREA = 36_000_000;

export function render(
  canvas: HTMLCanvasElement,
  state: MockupState,
  shot: Picture,
  background: Picture | null,
): void {
  const frame = frames[state.device];
  const insets = frame.insets(shot.width, shot.height, state);
  const frameW = shot.width + insets.left + insets.right;
  const frameH = shot.height + insets.top + insets.bottom;
  const pad = Math.round((Math.min(frameW, frameH) * state.padding) / 100);
  const fullW = frameW + 2 * pad;
  const fullH = frameH + 2 * pad;
  const scale = Math.min(
    1,
    MAX_SIDE / Math.max(fullW, fullH),
    Math.sqrt(MAX_AREA / (fullW * fullH)),
  );

  canvas.width = Math.round(fullW * scale);
  canvas.height = Math.round(fullH * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingQuality = 'high';

  drawBackground(ctx, state, background, fullW, fullH);

  const outer: Rect = { x: pad, y: pad, w: frameW, h: frameH };
  const screen: Rect = { x: pad + insets.left, y: pad + insets.top, w: shot.width, h: shot.height };
  if (state.shadow) drawShadow(ctx, outer, insets.radius, scale);
  frame.draw(ctx, outer, screen, shot.source, state);
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
