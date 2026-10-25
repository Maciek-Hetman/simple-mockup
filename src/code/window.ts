import { circle, inset, roundRectPath } from '../frames/common.ts';
import type { Subject } from '../render.ts';
import type { CodeOptions } from '../state.ts';
import { highlight, type Line } from './highlight.ts';
import { mixColors, paletteFor } from './themes.ts';
import { wrapLine, type Glyph } from './wrap.ts';

const FONT_SIZE = 14;
export const CODE_FONT = `${FONT_SIZE}px "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`;
const TITLE_FONT = '500 13px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// In CSS pixels, like everything in CodeOptions.
const LINE_HEIGHT = 22;
const PADDING_X = 20;
const PADDING_Y = 18;
const TITLE_BAR = 40;
const GUTTER_GAP = 20;
const LIGHT_RADIUS = 6;
const LIGHT_SPACING = 20;
const LIGHTS = ['#ff5f57', '#febc2e', '#28c840'];

interface CodeRow {
  glyphs: Glyph[];
  x: number;
  /** `null` on rows that continue a wrapped line. */
  lineNumber: number | null;
}

export interface CodeSubject extends Subject {
  charWidth: number;
  /** Width of the code itself, without the gutter and padding. */
  contentWidth: number;
}

let measureContext: CanvasRenderingContext2D | null = null;
let lastHighlight: { text: string; language: string; lines: Line[] } | null = null;

function highlighted(text: string, language: string): Line[] {
  if (lastHighlight?.text !== text || lastHighlight.language !== language) {
    lastHighlight = { text, language, lines: highlight(text, language) };
  }
  return lastHighlight.lines;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

function graphemes(text: string): string[] {
  if (PRINTABLE_ASCII.test(text)) return [...text];
  return Array.from(segmenter.segment(text), ({ segment }) => segment);
}

/** The smallest indentation step in the code, in columns: usually 2 or 4. */
function indentStep(lines: Glyph[][]): number {
  let step = Infinity;
  for (const glyphs of lines) {
    let indent = 0;
    while (indent < glyphs.length && glyphs[indent].text === ' ') indent++;
    if (indent > 0 && indent < glyphs.length) step = Math.min(step, indent);
  }
  return step === Infinity ? 2 : Math.min(Math.max(step, 2), 4);
}

export function codeSubject(opts: CodeOptions): CodeSubject {
  measureContext ??= document.createElement('canvas').getContext('2d')!;
  const ctx = measureContext;
  ctx.font = CODE_FONT;
  const charWidth = ctx.measureText('0').width;
  const widths = new Map<string, number>();
  const measure = (text: string) => {
    let width = widths.get(text);
    if (width === undefined) {
      width = ctx.measureText(text).width;
      widths.set(text, width);
    }
    return width;
  };

  const lines = highlighted(opts.text, opts.language).map((segments) =>
    segments.flatMap(({ text, slot }) =>
      graphemes(text).map((glyph) => ({ text: glyph, slot, width: measure(glyph) })),
    ),
  );

  // Continuation rows hang between indentation levels, so they don't read as a nested block.
  const continuationIndent = (indentStep(lines) + 2) * charWidth;
  const wrapWidth = opts.width * charWidth;
  const rows: CodeRow[] = [];
  let widestRow = 0;
  lines.forEach((glyphs, i) => {
    wrapLine(glyphs, wrapWidth, continuationIndent).forEach((row, j) => {
      const rowGlyphs = glyphs.slice(row.start, row.end);
      widestRow = Math.max(widestRow, rowGlyphs.reduce((sum, glyph) => sum + glyph.width, row.x));
      rows.push({ glyphs: rowGlyphs, x: row.x, lineNumber: j === 0 ? i + 1 : null });
    });
  });

  const contentWidth = Math.max(charWidth, opts.fitWidth ? widestRow : Math.max(wrapWidth, widestRow));
  const gutter = opts.lineNumbers ? String(lines.length).length * charWidth + GUTTER_GAP : 0;

  const title = opts.title.trim();
  const bar = opts.windowControls || title !== '' ? TITLE_BAR : 0;
  ctx.font = TITLE_FONT;
  const titleWidth = title ? ctx.measureText(title).width : 0;
  // The title is centered, so it needs room for the lights on both sides.
  const lightsWidth = opts.windowControls ? PADDING_X + 2 * LIGHT_SPACING + 2 * LIGHT_RADIUS : 0;
  const titleBarWidth = 2 * Math.max(PADDING_X, lightsWidth + 12) + titleWidth;

  const border = opts.borderWidth;
  const innerWidth = Math.max(2 * PADDING_X + gutter + contentWidth, bar ? titleBarWidth : 0);
  const codeTop = bar || PADDING_Y;
  const width = innerWidth + 2 * border;
  const height = codeTop + rows.length * LINE_HEIGHT + PADDING_Y + 2 * border;
  const radius = Math.min(opts.radius, width / 2, height / 2);

  const palette = paletteFor(opts.theme, opts.customColors);
  const lineNumberColor = mixColors(palette.text, palette.background, 0.55);
  const titleColor = mixColors(palette.text, palette.background, 0.3);

  return {
    width,
    height,
    radius,
    padding: opts.padding,
    pixelRatio: opts.scale,
    charWidth,
    contentWidth,

    draw(ctx, outer) {
      if (border > 0) {
        roundRectPath(ctx, outer, radius);
        ctx.fillStyle = opts.borderColor;
        ctx.fill();
      }
      const body = inset(outer, border);
      roundRectPath(ctx, body, radius - border);
      ctx.fillStyle = palette.background;
      ctx.fill();

      if (bar) {
        const cy = body.y + bar / 2;
        if (opts.windowControls) {
          LIGHTS.forEach((color, i) => {
            circle(ctx, body.x + PADDING_X + LIGHT_RADIUS + i * LIGHT_SPACING, cy, LIGHT_RADIUS, color);
          });
        }
        if (title) {
          ctx.font = TITLE_FONT;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = titleColor;
          ctx.fillText(title, body.x + body.w / 2, cy);
        }
      }

      ctx.font = CODE_FONT;
      ctx.textBaseline = 'alphabetic';
      const metrics = ctx.measureText('M');
      const ascent = metrics.fontBoundingBoxAscent;
      const baseline = (LINE_HEIGHT - ascent - metrics.fontBoundingBoxDescent) / 2 + ascent;
      const left = body.x + PADDING_X + gutter;

      rows.forEach((row, i) => {
        const y = body.y + codeTop + i * LINE_HEIGHT + baseline;
        if (opts.lineNumbers && row.lineNumber !== null) {
          ctx.textAlign = 'right';
          ctx.fillStyle = lineNumberColor;
          ctx.fillText(String(row.lineNumber), left - GUTTER_GAP, y);
        }
        ctx.textAlign = 'left';
        // One glyph at a time, so ligatures can't turn `->` into an arrow and every glyph
        // lands exactly where wrapping measured it.
        let x = left + row.x;
        for (const glyph of row.glyphs) {
          if (glyph.text !== ' ') {
            ctx.fillStyle = palette[glyph.slot ?? 'text'];
            ctx.fillText(glyph.text, x, y);
          }
          x += glyph.width;
        }
      });
    },
  };
}
