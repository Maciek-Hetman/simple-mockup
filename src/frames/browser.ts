import type { Appearance } from '../state.ts';
import { circle, drawClipped, inset, roundRectPath, type FrameRenderer } from './common.ts';

const PALETTES: Record<Appearance, { border: string; highlight: string; chrome: string; contentEdge: string }> = {
  light: {
    border: '#c3c3c7',
    highlight: 'rgba(255, 255, 255, 0.8)',
    chrome: '#f3f3f5',
    contentEdge: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    border: '#000000',
    highlight: 'rgba(255, 255, 255, 0.16)',
    chrome: '#29292c',
    contentEdge: 'rgba(255, 255, 255, 0.1)',
  },
};

interface TrafficLight {
  top: string;
  bottom: string;
  rim: string;
}

const TRAFFIC_LIGHTS: TrafficLight[] = [
  { top: '#ff8a80', bottom: '#ff4b40', rim: 'rgba(150, 20, 10, 0.4)' },
  { top: '#ffd86a', bottom: '#fdb11e', rim: 'rgba(150, 90, 0, 0.4)' },
  { top: '#6ae585', bottom: '#20b83a', rim: 'rgba(10, 110, 30, 0.4)' },
];

/** Measured in points of a 1440pt-wide window, scaled to the screenshot's longer side. */
function metrics(w: number, h: number) {
  const pt = Math.max(w, h) / 1440;
  return {
    pt,
    bar: Math.max(20, Math.round(40 * pt)),
    frame: Math.max(2, Math.round(6 * pt)),
    hairline: Math.max(1, Math.round(pt)),
    radius: 20 * pt,
  };
}

function drawTrafficLight(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  { top, bottom, rim }: TrafficLight,
): void {
  const body = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  body.addColorStop(0, top);
  body.addColorStop(1, bottom);
  circle(ctx, cx, cy, r, body);

  const rimWidth = Math.max(0.5, r * 0.09);
  ctx.beginPath();
  ctx.arc(cx, cy, r - rimWidth / 2, 0, Math.PI * 2);
  ctx.lineWidth = rimWidth;
  ctx.strokeStyle = rim;
  ctx.stroke();

  const gloss = ctx.createLinearGradient(0, cy - r, 0, cy);
  gloss.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
  gloss.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.4, r * 0.62, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fillStyle = gloss;
  ctx.fill();
}

export const browser: FrameRenderer = {
  insets(w, h) {
    const { bar, frame, radius } = metrics(w, h);
    return { top: bar, right: frame, bottom: frame, left: frame, radius };
  },

  draw(ctx, outer, screen, img, { browserAppearance }) {
    const { pt, bar, frame, hairline, radius } = metrics(screen.w, screen.h);
    const palette = PALETTES[browserAppearance];

    roundRectPath(ctx, outer, radius);
    ctx.fillStyle = palette.border;
    ctx.fill();

    roundRectPath(ctx, inset(outer, hairline), radius - hairline);
    ctx.fillStyle = palette.chrome;
    ctx.fill();

    ctx.lineWidth = hairline;
    roundRectPath(ctx, inset(outer, hairline * 1.5), radius - hairline * 1.5);
    ctx.strokeStyle = palette.highlight;
    ctx.stroke();

    const contentRadius = radius - frame;
    drawClipped(ctx, img, screen, contentRadius);
    roundRectPath(ctx, inset(screen, -hairline / 2), contentRadius + hairline / 2);
    ctx.strokeStyle = palette.contentEdge;
    ctx.stroke();

    const cy = outer.y + bar / 2;
    TRAFFIC_LIGHTS.forEach((light, i) => {
      drawTrafficLight(ctx, outer.x + (22 + i * 21) * pt, cy, 6.5 * pt, light);
    });
  },
};
