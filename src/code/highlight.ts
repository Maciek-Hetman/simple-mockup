import Prism from 'prismjs';
import type { Token, TokenStream } from 'prismjs';
import { grammarFor } from './languages.ts';
import type { TokenSlot } from './themes.ts';

export interface Segment {
  text: string;
  /** `null` is plain text. */
  slot: TokenSlot | null;
}

export type Line = Segment[];

const TAB_SIZE = 4;

/** Maps Prism token types and aliases to palette slots. */
const TOKEN_SLOTS = new Map<string, TokenSlot>(
  Object.entries({
    comment: 'comment',
    prolog: 'comment',
    doctype: 'comment',
    cdata: 'comment',
    shebang: 'comment',
    keyword: 'keyword',
    atrule: 'keyword',
    important: 'keyword',
    directive: 'keyword',
    tag: 'keyword',
    string: 'string',
    char: 'string',
    'attr-value': 'string',
    regex: 'string',
    url: 'string',
    number: 'number',
    boolean: 'number',
    constant: 'number',
    symbol: 'number',
    entity: 'number',
    function: 'function',
    decorator: 'function',
    annotation: 'function',
    macro: 'function',
    selector: 'function',
    'class-name': 'type',
    'maybe-class-name': 'type',
    builtin: 'type',
    namespace: 'type',
    property: 'property',
    'property-access': 'property',
    'attr-name': 'property',
    key: 'property',
    variable: 'property',
    parameter: 'property',
    operator: 'operator',
    punctuation: 'punctuation',
  }),
);

/** Tokens whose content is ordinary code again, e.g. `${...}` inside a template string. */
const RESET_TOKENS = new Set(['interpolation', 'script', 'style']);

/** Splits code into lines of colored segments. */
export function highlight(code: string, language: string): Line[] {
  const lines: Line[] = [[]];
  const push = (text: string, slot: TokenSlot | null) => {
    text.split('\n').forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part === '') return;
      const line = lines[lines.length - 1];
      const last = line[line.length - 1];
      if (last?.slot === slot) last.text += part;
      else line.push({ text: part, slot });
    });
  };

  const walk = (stream: TokenStream, slot: TokenSlot | null): void => {
    if (typeof stream === 'string') push(stream, slot);
    else if (Array.isArray(stream)) for (const item of stream) walk(item, slot);
    else walk(stream.content, RESET_TOKENS.has(stream.type) ? null : (slotOf(stream) ?? slot));
  };

  const text = normalize(code);
  const grammar = grammarFor(language);
  if (grammar) walk(Prism.tokenize(text, grammar), null);
  else push(text, null);
  return lines;
}

function slotOf(token: Token): TokenSlot | undefined {
  const aliases = Array.isArray(token.alias) ? token.alias : token.alias ? [token.alias] : [];
  for (const name of [token.type, ...aliases]) {
    const slot = TOKEN_SLOTS.get(name);
    if (slot) return slot;
  }
  return undefined;
}

/** Expands tabs, drops trailing whitespace and strips blank lines around the code. */
function normalize(code: string): string {
  const lines = code
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => expandTabs(line).trimEnd());
  let start = 0;
  let end = lines.length;
  while (start < end && lines[start] === '') start++;
  while (end > start && lines[end - 1] === '') end--;
  return lines.slice(start, end).join('\n');
}

function expandTabs(line: string): string {
  if (!line.includes('\t')) return line;
  let out = '';
  for (const char of line) {
    out += char === '\t' ? ' '.repeat(TAB_SIZE - (out.length % TAB_SIZE)) : char;
  }
  return out;
}
