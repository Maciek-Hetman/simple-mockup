const CLOSERS: Record<string, string> = { '{': '}', '[': ']', '(': ')' };

/** One indentation step: a tab if the code uses them, else the most common jump between lines, else 2. */
function indentUnit(text: string): string {
  const jumps = new Map<number, number>();
  let previous: number | null = null;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    if (line.startsWith('\t')) return '\t';
    const spaces = line.length - line.trimStart().length;
    // Jumps rather than absolute indents, so code that's indented as a whole still gives its step.
    if (previous !== null && spaces - previous >= 2) jumps.set(spaces - previous, (jumps.get(spaces - previous) ?? 0) + 1);
    previous = spaces;
  }
  let step = 2;
  let best = 0;
  for (const [jump, count] of jumps) {
    if (count > best || (count === best && jump < step)) [step, best] = [jump, count];
  }
  return ' '.repeat(Math.min(step, 8));
}

/** Languages whose nesting follows brackets, so indentation can be rebuilt from them. */
const BRACKET_LANGUAGES = new Set([
  'c', 'cpp', 'csharp', 'css', 'dart', 'go', 'graphql', 'java', 'javascript', 'json', 'jsx',
  'kotlin', 'php', 'rust', 'scala', 'scss', 'swift', 'tsx', 'typescript',
]);

type OpenState = '' | '*/' | '`' | '"""' | "'''";

interface LineScan {
  /** Brackets opened minus brackets closed on the line. */
  net: number;
  /** Closers before any other code, which dedent the line itself. */
  leading: number;
}

const JS_FAMILY = new Set(['javascript', 'typescript', 'jsx', 'tsx']);
/** Languages where `//` is not a comment (url(http://...) and the like). */
const NO_LINE_COMMENT = new Set(['css', 'json', 'graphql']);
const TRIPLE_DOUBLE = new Set(['kotlin', 'swift', 'java', 'scala', 'dart', 'csharp']);
/** A Rust char literal: 'x', '\n', '\x41', '\u{1F600}', '\''. Anything else after a `'` is a lifetime. */
const RUST_CHAR = /'(?:\\(?:u\{[0-9a-fA-F]+\}|x[0-9a-fA-F]{2}|.)|[^\\'])'/uy;

/** Whether a `/` after this code can only start a regex literal rather than divide. */
function startsRegex(before: string): boolean {
  const prefix = before.trimEnd();
  if (!prefix) return true;
  if ('(,=:[!&|?{};'.includes(prefix.at(-1)!)) return true;
  return /(?:^|[^\w$])(?:return|typeof|case)$/.test(prefix);
}

/** Index of the `/` closing a regex literal that opens at `start`, or -1. Character classes are opaque. */
function regexEnd(line: string, start: number): number {
  let inClass = false;
  for (let i = start + 1; i < line.length; i++) {
    const char = line[i];
    if (char === '\\') i++;
    else if (char === '[') inClass = true;
    else if (char === ']') inClass = false;
    else if (char === '/' && !inClass) return i;
  }
  return -1;
}

/** Counts brackets on one line, skipping strings and comments. `open` carries multi-line ones over. */
function scanLine(line: string, state: { open: OpenState }, language: string): LineScan {
  let net = 0;
  let leading = 0;
  let code = false;
  let quote = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (state.open === '*/') {
      if (line.startsWith('*/', i)) {
        state.open = '';
        i++;
      }
    } else if (state.open === '"""' || state.open === "'''") {
      if (char === '\\' && language !== 'kotlin') i++;
      else if (line.startsWith(state.open, i)) {
        state.open = '';
        i += 2;
      }
    } else if (state.open === '`' || quote) {
      if (char === '\\') i++;
      else if (char === (state.open || quote)) state.open = quote = '';
    } else if (line.startsWith('//', i) && !NO_LINE_COMMENT.has(language) && line[i - 1] !== ':') {
      break;
    } else if (line.startsWith('/*', i)) {
      state.open = '*/';
      code = true;
      i++;
    } else if (char === '/' && JS_FAMILY.has(language) && startsRegex(line.slice(0, i))) {
      const end = regexEnd(line, i);
      if (end !== -1) i = end;
      code = true;
    } else if (char === '`') {
      state.open = '`';
      code = true;
    } else if (char === '"' && TRIPLE_DOUBLE.has(language) && line.startsWith('"""', i)) {
      state.open = '"""';
      code = true;
      i += 2;
    } else if (char === "'" && language === 'dart' && line.startsWith("'''", i)) {
      state.open = "'''";
      code = true;
      i += 2;
    } else if (char === "'" && language === 'rust') {
      // Only a char literal is a quote; `'a` is a lifetime and just ordinary code.
      RUST_CHAR.lastIndex = i;
      const match = RUST_CHAR.exec(line);
      if (match) i += match[0].length - 1;
      code = true;
    } else if (char === '"' || char === "'") {
      quote = char;
      code = true;
    } else if ('{[('.includes(char)) {
      net++;
      code = true;
    } else if ('}])'.includes(char)) {
      net--;
      if (!code) leading++;
    } else if (char.trim()) {
      code = true;
    }
  }
  return { net, leading };
}

/**
 * Indents flat code from its bracket nesting. Code that already has any indentation is returned
 * as is, since rebuilding would flatten structure brackets don't show (JSX, switch bodies,
 * braceless ifs). Other languages are returned as is too, since there indentation is the
 * structure. Lines inside multi-line strings are left alone.
 */
export function reindent(text: string, language: string): string {
  if (!BRACKET_LANGUAGES.has(language)) return text;
  const lines = text.split(/\r?\n/);
  // Lines inside strings and block comments don't count: their leading space is content or ` *` alignment.
  const probe: { open: OpenState } = { open: '' };
  const indented = lines.some((line) => {
    const startedOutside = !probe.open;
    scanLine(line, probe, language);
    return startedOutside && line.trim() !== '' && /^[ \t]/.test(line);
  });
  if (indented) return text;
  const unit = indentUnit(text);
  const state: { open: OpenState } = { open: '' };
  const chains = language !== 'css' && language !== 'scss';
  let depth = 0;
  return lines
    .map((line) => {
      const trimmed = line.trim();
      const startedIn = state.open;
      const { net, leading } = scanLine(line, state, language);
      const level = Math.max(0, depth - leading);
      depth = Math.max(0, depth + net);
      if (startedIn && startedIn !== '*/') return line;
      if (!trimmed) return '';
      if (startedIn === '*/') return trimmed.startsWith('*') ? `${unit.repeat(level)} ${trimmed}` : line;
      // Chained calls hang one level in from the line they continue.
      return unit.repeat(level + (chains && /^\.[A-Za-z_$]/.test(trimmed) ? 1 : 0)) + trimmed;
    })
    .join('\n');
}

/** Replaces a range through the browser's editing stack, so undo still works. */
function replace(area: HTMLTextAreaElement, start: number, end: number, text: string, selStart: number, selEnd = selStart): void {
  area.setSelectionRange(start, end);
  if (!document.execCommand('insertText', false, text)) {
    area.setRangeText(text, start, end, 'end');
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }
  area.setSelectionRange(selStart, selEnd);
}

function insertNewline(area: HTMLTextAreaElement): void {
  const { value, selectionStart: start, selectionEnd: end } = area;
  const before = value.slice(value.lastIndexOf('\n', start - 1) + 1, start);
  const indent = /^[ \t]*/.exec(before)![0];
  const opener = before.trimEnd().at(-1) ?? '';
  const unit = indentUnit(value);

  if (!(opener in CLOSERS)) {
    const text = `\n${indent}`;
    replace(area, start, end, text, start + text.length);
  } else if (value[end] === CLOSERS[opener]) {
    // Between a pair of brackets: open a block and push the closer onto its own line.
    const inner = `\n${indent}${unit}`;
    replace(area, start, end, `${inner}\n${indent}`, start + inner.length);
  } else {
    const text = `\n${indent}${unit}`;
    replace(area, start, end, text, start + text.length);
  }
}

/** Indents or outdents every line the selection touches. */
function shiftLines(area: HTMLTextAreaElement, outdent: boolean): void {
  const { value, selectionStart: start, selectionEnd: end } = area;
  const unit = indentUnit(value);
  const blockStart = value.lastIndexOf('\n', start - 1) + 1;
  // A selection that ends at the very start of a line doesn't include that line.
  const lastChar = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nl = value.indexOf('\n', lastChar);
  const blockEnd = nl === -1 ? value.length : nl;

  let firstDelta = 0;
  let total = 0;
  const lines = value.slice(blockStart, blockEnd).split('\n').map((line, i) => {
    let delta: number;
    if (!outdent) {
      line = unit + line;
      delta = unit.length;
    } else {
      const removed = line.startsWith('\t') ? 1 : Math.min(unit.length, line.length - line.trimStart().length);
      line = line.slice(removed);
      delta = -removed;
    }
    if (i === 0) firstDelta = delta;
    total += delta;
    return line;
  });

  replace(area, blockStart, blockEnd, lines.join('\n'), Math.max(blockStart, start + firstDelta), end + total);
}

/**
 * Makes the code editor behave like a code editor: Enter keeps the indentation (and adds a level
 * after an opening bracket), Tab and Shift+Tab indent and outdent. Escape lets the next Tab move
 * focus instead, so the field isn't a keyboard trap. Pasting over the whole text indents it from its
 * bracket nesting, but only when it has no indentation at all; already-indented code is left as is.
 */
export function initAutoIndent(
  area: HTMLTextAreaElement,
  isEnabled: () => boolean,
  /** The language of `text`, which is about to replace the editor's content. */
  language: (text: string) => string,
): void {
  let releaseTab = false;
  area.addEventListener('paste', (event) => {
    const text = event.clipboardData?.getData('text/plain');
    if (!isEnabled() || !text || area.selectionStart !== 0 || area.selectionEnd !== area.value.length) return;
    const indented = reindent(text, language(text));
    if (indented === text) return;
    event.preventDefault();
    replace(area, 0, area.value.length, indented, indented.length);
  });
  area.addEventListener('blur', () => (releaseTab = false));
  area.addEventListener('keydown', (event) => {
    if (!isEnabled() || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'Escape') {
      releaseTab = true;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      insertNewline(area);
    } else if (event.key === 'Tab') {
      if (releaseTab) return;
      event.preventDefault();
      if (event.shiftKey || area.selectionStart !== area.selectionEnd) {
        shiftLines(area, event.shiftKey);
      } else {
        const unit = indentUnit(area.value);
        replace(area, area.selectionStart, area.selectionEnd, unit, area.selectionStart + unit.length);
      }
    } else if (event.key !== 'Shift') {
      releaseTab = false;
    }
  });
}
