import type { Rect } from './frames/common.ts';

export interface ResizeCallbacks {
  /** The current width in columns and how many canvas pixels one column takes up. */
  start(): { columns: number; columnWidth: number } | null;
  resize(columns: number): void;
  /** The drag is over, so the preview can fit the canvas to its box again. */
  end(): void;
}

/**
 * Drag handles on both sides of the code window. While dragging, the preview keeps its zoom
 * level so the window edge stays under the pointer even as the canvas grows or shrinks.
 */
export function initResizeHandles(
  preview: HTMLElement,
  canvas: HTMLCanvasElement,
  callbacks: ResizeCallbacks,
): (box: Rect | null) => void {
  let box: Rect | null = null;
  /** CSS pixels per canvas pixel, held for the length of a drag. */
  let dragZoom: number | null = null;

  const handles = (['left', 'right'] as const).map((side) => {
    const handle = document.createElement('div');
    handle.className = 'resize-handle';
    handle.hidden = true;
    handle.setAttribute('aria-hidden', 'true');
    preview.append(handle);

    let drag: { x: number; columns: number; columnWidth: number } | null = null;
    handle.addEventListener('pointerdown', (event) => {
      const current = callbacks.start();
      if (!current || event.button !== 0) return;
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      drag = { x: event.clientX, ...current };
      dragZoom = canvas.getBoundingClientRect().width / canvas.width;
      preview.classList.add('resizing');
    });
    handle.addEventListener('pointermove', (event) => {
      if (!drag || dragZoom === null) return;
      const dx = (event.clientX - drag.x) * (side === 'right' ? 1 : -1);
      // The window is centered, so it grows by twice what one edge moves.
      callbacks.resize(Math.round(drag.columns + (2 * dx) / (drag.columnWidth * dragZoom)));
    });
    const end = () => {
      if (!drag) return;
      drag = null;
      dragZoom = null;
      preview.classList.remove('resizing');
      callbacks.end();
      place();
    };
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    return handle;
  });

  function place(): void {
    for (const handle of handles) handle.hidden = box === null;
    if (!box) return;
    const canvasRect = canvas.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const zoom = canvasRect.width / canvas.width;
    const left = canvasRect.left - previewRect.left + box.x * zoom;
    const top = canvasRect.top - previewRect.top + box.y * zoom;
    handles.forEach((handle, i) => {
      handle.style.left = `${left + (i === 0 ? 0 : box!.w * zoom)}px`;
      handle.style.top = `${top}px`;
      handle.style.height = `${box!.h * zoom}px`;
    });
  }

  const observer = new ResizeObserver(() => place());
  observer.observe(canvas);
  observer.observe(preview);

  /** Shows the handles around `next` (in canvas pixels), or hides them for `null`. */
  return (next) => {
    box = next;
    place();
  };
}
