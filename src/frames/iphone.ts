import { phoneFrame } from './phone.ts';

export const iphone = phoneFrame({
  bezel: 0.034,
  screenRadius: 0.14,
  drawCutout(ctx, screen, unit, { islandSize }) {
    const scale = islandSize / 100;
    const w = 0.183 * unit * scale;
    const h = 0.083 * unit * scale;
    const x = screen.x + (screen.w - w) / 2;
    const y = screen.y + 0.028 * unit;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fillStyle = '#000000';
    ctx.fill();
  },
});
