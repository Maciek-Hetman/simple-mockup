const CLOSERS: Record<string, string> = { '{': '}', '[': ']', '(': ')' };

/** One indentation step: a tab if the code uses them, else the smallest space indent, else 2. */
function indentUnit(text: string): string {
  let step = Infinity;
  for (const line of text.split('\n')) {
    if (line.startsWith('\t')) return '\t';
    const spaces = line.length - line.trimStart().length;
    if (spaces > 0 && spaces < line.length) step = Math.min(step, spaces);
  }
  return ' '.repeat(Number.isFinite(step) ? Math.min(step, 8) : 2);
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
 * focus instead, so the field isn't a keyboard trap.
 */
export function initAutoIndent(area: HTMLTextAreaElement, isEnabled: () => boolean): void {
  let releaseTab = false;
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
