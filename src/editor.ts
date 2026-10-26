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

interface LineScan {
  /** Brackets opened minus brackets closed on the line. */
  net: number;
  /** Closers before any other code, which dedent the line itself. */
  leading: number;
}

/** Counts brackets on one line, skipping strings and comments. `open` carries multi-line ones over. */
function scanLine(line: string, state: { open: '' | '*/' | '`' }): LineScan {
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
    } else if (state.open === '`' || quote) {
      if (char === '\\') i++;
      else if (char === (state.open || quote)) state.open = quote = '';
    } else if (line.startsWith('//', i)) {
      break;
    } else if (line.startsWith('/*', i)) {
      state.open = '*/';
      code = true;
      i++;
    } else if (char === '`') {
      state.open = '`';
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
 * Throws away the existing indentation and rebuilds it from bracket nesting. Other languages are
 * returned as is, since there indentation is the structure. Lines inside multi-line strings are
 * left alone.
 */
export function reindent(text: string, language: string): string {
  if (!BRACKET_LANGUAGES.has(language)) return text;
  const unit = indentUnit(text);
  const state: { open: '' | '*/' | '`' } = { open: '' };
  let depth = 0;
  return text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      const startedIn = state.open;
      const { net, leading } = scanLine(line, state);
      const level = Math.max(0, depth - leading);
      depth = Math.max(0, depth + net);
      if (startedIn === '`') return line;
      if (!trimmed) return '';
      if (startedIn === '*/') return trimmed.startsWith('*') ? `${unit.repeat(level)} ${trimmed}` : line;
      // Chained calls hang one level in from the line they continue.
      return unit.repeat(level + (trimmed.startsWith('.') ? 1 : 0)) + trimmed;
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
 * focus instead, so the field isn't a keyboard trap. Pasting over the whole text reindents it.
 */
export function initAutoIndent(area: HTMLTextAreaElement, isEnabled: () => boolean, language: () => string): void {
  let releaseTab = false;
  area.addEventListener('paste', (event) => {
    const text = event.clipboardData?.getData('text/plain');
    if (!isEnabled() || !text || area.selectionStart !== 0 || area.selectionEnd !== area.value.length) return;
    const indented = reindent(text, language());
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
