import type { FrameOptions } from '../state.ts';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Space the frame adds around the screenshot, plus the outer corner radius. */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
  radius: number;
}

export interface FrameRenderer {
  insets(w: number, h: number, opts: FrameOptions): Insets;
  draw(
    ctx: CanvasRenderingContext2D,
    outer: Rect,
    screen: Rect,
    img: CanvasImageSource,
    opts: FrameOptions,
  ): void;
}

export function roundRectPath(ctx: CanvasRenderingContext2D, rect: Rect, radius: number): void {
  ctx.beginPath();
  ctx.roundRect(rect.x, rect.y, rect.w, rect.h, Math.max(0, radius));
}

export function inset(rect: Rect, by: number): Rect {
  return { x: rect.x + by, y: rect.y + by, w: rect.w - 2 * by, h: rect.h - 2 * by };
}

export function circle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string | CanvasGradient,
): void {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function drawClipped(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  screen: Rect,
  radius: number,
): void {
  ctx.save();
  roundRectPath(ctx, screen, radius);
  ctx.clip();
  ctx.drawImage(img, screen.x, screen.y, screen.w, screen.h);
  ctx.restore();
}
