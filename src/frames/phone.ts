import type { FrameOptions } from '../state.ts';
import { drawClipped, roundRectPath, type FrameRenderer, type Rect } from './common.ts';

/** Sizes are fractions of the screenshot's shorter side. */
export interface PhoneSpec {
  bezel: number;
  screenRadius: number;
  drawCutout(ctx: CanvasRenderingContext2D, screen: Rect, unit: number, opts: FrameOptions): void;
}

export function phoneFrame(spec: PhoneSpec): FrameRenderer {
  const metrics = (w: number, h: number) => {
    const unit = Math.min(w, h);
    const bezel = Math.max(2, Math.round(spec.bezel * unit));
    const screenRadius = spec.screenRadius * unit;
    return { unit, bezel, screenRadius, outerRadius: screenRadius + bezel };
  };

  return {
    insets(w, h) {
      const { bezel, outerRadius } = metrics(w, h);
      return { top: bezel, right: bezel, bottom: bezel, left: bezel, radius: outerRadius };
    },

    draw(ctx, outer, screen, img, opts) {
      const m = metrics(screen.w, screen.h);

      roundRectPath(ctx, outer, m.outerRadius);
      ctx.fillStyle = '#050505';
      ctx.fill();

      drawClipped(ctx, img, screen, m.screenRadius);
      spec.drawCutout(ctx, screen, m.unit, opts);
    },
  };
}
