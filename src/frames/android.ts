import { circle } from './common.ts';
import { phoneFrame } from './phone.ts';

export const android = phoneFrame({
  bezel: 0.027,
  screenRadius: 0.085,
  drawCutout(ctx, screen, unit, { punchHoleSize }) {
    const r = 0.0286 * unit * (punchHoleSize / 100);
    const cx = screen.x + screen.w / 2;
    const cy = screen.y + 0.028 * unit + r;
    circle(ctx, cx, cy, r, '#000000');
    circle(ctx, cx, cy, r * 0.45, '#11151f');
  },
});
