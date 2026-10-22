import type { Device, Picture } from './state.ts';

type SampleKind = 'phone' | 'desktop';

const cache = new Map<SampleKind, Picture>();

export function samplePicture(device: Device): Picture {
  const kind: SampleKind = device === 'android' || device === 'iphone' ? 'phone' : 'desktop';
  let picture = cache.get(kind);
  if (!picture) {
    picture = kind === 'phone' ? drawPhoneSample() : drawDesktopSample();
    cache.set(kind, picture);
  }
  return picture;
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d')! };
}

function card(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function drawPhoneSample(): Picture {
  const width = 1179;
  const height = 2556;
  const { canvas, ctx } = createCanvas(width, height);

  const bg = ctx.createLinearGradient(0, 0, width, height);
  bg.addColorStop(0, '#6366f1');
  bg.addColorStop(1, '#ec4899');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.font = '600 50px system-ui, sans-serif';
  ctx.fillText('9:41', 130, 100);
  card(ctx, width - 220, 82, 90, 40, 12, '#ffffff');

  ctx.font = '700 120px system-ui, sans-serif';
  ctx.fillText('Hello', 90, 400);
  ctx.font = '400 54px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.fillText('Upload a screenshot to replace me', 90, 520);

  for (let i = 0; i < 4; i++) {
    const y = 680 + i * 400;
    card(ctx, 90, y, width - 180, 340, 64, 'rgba(255, 255, 255, 0.92)');
    card(ctx, 150, y + 60, 120, 120, 36, i % 2 ? '#f9a8d4' : '#a5b4fc');
    card(ctx, 310, y + 75, 520, 36, 18, '#e4e4e7');
    card(ctx, 310, y + 135, 360, 36, 18, '#f4f4f5');
  }

  card(ctx, 90, height - 230, width - 180, 160, 80, 'rgba(255, 255, 255, 0.25)');
  return { source: canvas, width, height };
}

function drawDesktopSample(): Picture {
  const width = 1440;
  const height = 900;
  const { canvas, ctx } = createCanvas(width, height);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, width, 64);
  card(ctx, 24, 18, 28, 28, 8, '#818cf8');
  ctx.fillStyle = '#ffffff';
  ctx.textBaseline = 'middle';
  ctx.font = '600 20px system-ui, sans-serif';
  ctx.fillText('Dashboard', 66, 32);

  ctx.fillStyle = '#eef2ff';
  ctx.fillRect(0, 64, 240, height - 64);
  for (let i = 0; i < 6; i++) {
    card(ctx, 24, 96 + i * 48, i === 0 ? 192 : 150, 28, 8, i === 0 ? '#c7d2fe' : '#e0e7ff');
  }

  ctx.fillStyle = '#111827';
  ctx.font = '700 36px system-ui, sans-serif';
  ctx.fillText('Upload a screenshot to replace me', 288, 120);

  const colors = ['#a5b4fc', '#f9a8d4', '#86efac'];
  for (let i = 0; i < 3; i++) {
    const x = 288 + i * 376;
    card(ctx, x, 176, 352, 200, 16, '#ffffff');
    card(ctx, x + 24, 200, 64, 64, 14, colors[i]);
    card(ctx, x + 24, 290, 240, 20, 10, '#e2e8f0');
    card(ctx, x + 24, 326, 160, 20, 10, '#f1f5f9');
  }
  card(ctx, 288, 404, 1104, 448, 16, '#ffffff');
  for (let i = 0; i < 7; i++) {
    card(ctx, 320, 440 + i * 56, 1040 - (i % 3) * 180, 24, 12, i % 2 ? '#f1f5f9' : '#e2e8f0');
  }

  return { source: canvas, width, height };
}
