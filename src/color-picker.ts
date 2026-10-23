const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Accepts `#rgb`, `#rrggbb` and the same without the `#`, and returns `#rrggbb`. */
function normalizeHex(value: string): string | null {
  const match = HEX.exec(value.trim());
  if (!match) return null;
  const digits = match[1].toLowerCase();
  const full = digits.length === 3 ? [...digits].map((digit) => digit + digit).join('') : digits;
  return `#${full}`;
}

/** Wires up one `[data-color-picker]`: preset swatches, the native picker and a hex field. */
function setUpPicker(picker: HTMLElement): () => void {
  const colorInput = picker.querySelector<HTMLInputElement>('input[type="color"]')!;
  const hexInput = picker.querySelector<HTMLInputElement>('.hex')!;
  const swatchList = picker.querySelector<HTMLElement>('.swatches')!;

  const setColor = (color: string) => {
    colorInput.value = color;
    colorInput.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const swatches = (picker.dataset.presets ?? '')
    .split(',')
    .map((preset) => normalizeHex(preset))
    .filter((color): color is string => color !== null)
    .map((color) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'swatch';
      swatch.title = color;
      swatch.setAttribute('aria-label', color);
      swatch.style.setProperty('--swatch', color);
      swatch.addEventListener('click', () => setColor(color));
      swatchList.append(swatch);
      return { swatch, color };
    });

  hexInput.addEventListener('input', () => {
    const color = normalizeHex(hexInput.value);
    if (color && color !== colorInput.value) setColor(color);
  });
  hexInput.addEventListener('blur', () => {
    hexInput.value = colorInput.value;
  });

  return () => {
    // Don't rewrite the field while the user is typing in it.
    if (document.activeElement !== hexInput) hexInput.value = colorInput.value;
    for (const { swatch, color } of swatches) {
      swatch.setAttribute('aria-pressed', String(color === colorInput.value));
    }
  };
}

/** Returns a function that refreshes every picker from its color input's current value. */
export function initColorPickers(root: ParentNode): () => void {
  const syncs = Array.from(root.querySelectorAll<HTMLElement>('[data-color-picker]'), setUpPicker);
  return () => {
    for (const sync of syncs) sync();
  };
}
