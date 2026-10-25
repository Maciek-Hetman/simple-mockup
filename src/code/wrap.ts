import type { TokenSlot } from './themes.ts';

export interface Glyph {
  /** One grapheme cluster. */
  text: string;
  slot: TokenSlot | null;
  width: number;
}

/** One visual row of a logical line: `glyphs[start..end)`, drawn `x` pixels in. */
export interface Row {
  start: number;
  end: number;
  x: number;
}

// Kinds of break opportunity, worst to best.
const NONE = 0;
const CAMEL_CASE = 1;
const WORD_EDGE = 2;
const PUNCTUATION = 3;
const SPACE = 4;

/** A break must fill this much of the row, or a worse kind of break further along wins. */
const MIN_FILL = 0.4;

const WORD = /^[\p{L}\p{N}_$]/u;
const WIDE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const DOT_TARGET = /^[\p{L}_$)\]]/u;
const LOWER = /^\p{Ll}/u;
const UPPER = /^\p{Lu}/u;

/** How good a place it is to end a row between `prev` and `next`; `before` precedes `prev`. */
function breakKind(before: string, prev: string, next: string): number {
  if (prev === ' ') return next === ' ' ? NONE : SPACE;
  if (next === ' ') return NONE;
  // Keep interpolation openers like `${` and `#{` whole and attached to what's inside.
  if ((next === '{' && '$#'.includes(prev)) || (prev === '{' && before !== '' && '$#'.includes(before))) {
    return NONE;
  }
  // Separators and closing brackets stay with whatever they follow.
  if (',;)]}'.includes(next)) return NONE;
  if (',;([{'.includes(prev)) return PUNCTUATION;
  // Method chains break before the dot.
  if (next === '.' && DOT_TARGET.test(prev)) return PUNCTUATION;
  if (WIDE.test(prev) || WIDE.test(next)) return WORD_EDGE;
  if (WORD.test(prev) !== WORD.test(next)) return WORD_EDGE;
  if (LOWER.test(prev) && UPPER.test(next)) return CAMEL_CASE;
  return NONE;
}

/**
 * Wraps one logical line to `maxWidth`. Rows break after whitespace when that fills enough of
 * the row, then after `,;([{` or before a `.`, then between a word and punctuation, then inside
 * camelCase, and only as a last resort mid-word. Continuation rows hang `continuationIndent`
 * past the line's own indentation, but never past half the width.
 */
export function wrapLine(glyphs: Glyph[], maxWidth: number, continuationIndent: number): Row[] {
  const n = glyphs.length;
  // x[i] is the width of glyphs[0..i).
  const x = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) x[i + 1] = x[i] + glyphs[i].width;
  if (x[n] <= maxWidth) return [{ start: 0, end: n, x: 0 }];

  let indent = 0;
  while (indent < n && glyphs[indent].text === ' ') indent++;
  const hang = Math.min(x[indent] + continuationIndent, maxWidth / 2);

  const rows: Row[] = [];
  let start = 0;
  let offset = 0;
  if (x[indent] > maxWidth / 2) {
    // Too deeply indented to leave room for the code: pull the whole line in.
    start = indent;
    offset = hang;
  }
  // Where the row's own content begins, to judge how full a row is.
  let contentStart = indent;

  while (start < n) {
    const available = maxWidth - offset;
    if (x[n] - x[start] <= available) {
      rows.push({ start, end: n, x: offset });
      break;
    }
    const end = findBreak(glyphs, x, start, contentStart, available);
    let visibleEnd = end;
    while (visibleEnd > start && glyphs[visibleEnd - 1].text === ' ') visibleEnd--;
    rows.push({ start, end: visibleEnd, x: offset });

    start = end;
    while (start < n && glyphs[start].text === ' ') start++;
    offset = hang;
    contentStart = start;
  }
  return rows;
}

/** Returns the index the next row starts at. */
function findBreak(
  glyphs: Glyph[],
  x: Float64Array,
  start: number,
  contentStart: number,
  available: number,
): number {
  // The last opportunity of each kind, and where the row's visible content would end there.
  const breakAt = [0, 0, 0, 0, 0];
  const contentEndAt = [0, 0, 0, 0, 0];
  let contentEnd = start;
  for (let j = start + 1; j < glyphs.length; j++) {
    if (glyphs[j - 1].text !== ' ') contentEnd = j;
    // Trailing whitespace may overhang the edge; visible content may not.
    if (x[contentEnd] - x[start] > available) break;
    if (contentEnd <= contentStart) continue;
    const kind = breakKind(glyphs[j - 2]?.text ?? '', glyphs[j - 1].text, glyphs[j].text);
    if (kind === NONE) continue;
    breakAt[kind] = j;
    contentEndAt[kind] = contentEnd;
  }

  const usable = available - (x[contentStart] - x[start]);
  const fill = (kind: number) => (x[contentEndAt[kind]] - x[contentStart]) / usable;
  for (const kind of [SPACE, PUNCTUATION, WORD_EDGE]) {
    if (breakAt[kind] && fill(kind) >= MIN_FILL) return breakAt[kind];
  }
  for (const kind of [SPACE, PUNCTUATION, WORD_EDGE, CAMEL_CASE]) {
    if (breakAt[kind]) return breakAt[kind];
  }

  // No good spot: fit as many glyphs as possible, but always make progress.
  let end = start + 1;
  while (end < glyphs.length && x[end + 1] - x[start] <= available) end++;
  return end;
}
