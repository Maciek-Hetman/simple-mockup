import type { SimpleFrameOptions } from '../state.ts';
import { drawClipped, roundRectPath, type FrameRenderer } from './common.ts';

function metrics(w: number, h: number, opts: SimpleFrameOptions) {
  const unit = Math.min(w, h);
  return {
    border: Math.round((opts.width / 100) * unit),
    radius: (opts.radius / 100) * unit,
  };
}

export const simple: FrameRenderer = {
  insets(w, h, { simple }) {
    const { border, radius } = metrics(w, h, simple);
    return { top: border, right: border, bottom: border, left: border, radius };
  },

  draw(ctx, outer, screen, img, { simple }) {
    const { border, radius } = metrics(screen.w, screen.h, simple);
    if (border > 0) {
      roundRectPath(ctx, outer, radius);
      ctx.fillStyle = simple.color;
      ctx.fill();
    }
    drawClipped(ctx, img, screen, radius - border);
  },
};
