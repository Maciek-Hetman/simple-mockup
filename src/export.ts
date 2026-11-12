import type { ExportFormat } from './state.ts';

const MIME_TYPES: Record<ExportFormat, string> = { png: 'image/png', jpeg: 'image/jpeg' };
export const EXTENSIONS: Record<ExportFormat, string> = { png: 'png', jpeg: 'jpg' };

/** Characters that aren't allowed in file names on at least one common OS. */
const INVALID_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/** Strips unsafe characters and any image extension from user input. May return an empty string. */
export function cleanFileName(name: string): string {
  return name
    .replace(INVALID_CHARS, '')
    .trim()
    .replace(/\.(png|jpe?g)$/i, '')
    .replace(/[. ]+$/, '');
}

export async function downloadCanvas(
  canvas: HTMLCanvasElement,
  format: ExportFormat,
  name: string,
): Promise<void> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, MIME_TYPES[format], 0.92),
  );
  if (!blob) throw new Error('Could not encode the image.');
  downloadBlob(blob, `${cleanFileName(name) || 'mockup'}.${EXTENSIONS[format]}`);
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // Some browsers haven't started the download after a 0 ms delay, so keep the URL alive longer.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
