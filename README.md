# Simple Mockup

Wrap a screenshot in a phone or browser frame, or turn a code snippet into a highlighted image, and export it as PNG or JPEG. Runs entirely in the browser.

## Features

- Frames: Android, iPhone, browser window, or a plain rounded border
- Code screenshots:
  - An editor with line numbers next to the preview; paste code, open a file, or drop one on the page
  - Optional auto-indent in the editor: Enter keeps the indentation and opens a level after a bracket, Tab and Shift+Tab indent and outdent (Escape, then Tab, moves focus); pasted or opened code in bracket-based languages is first stripped of its indentation and re-indented from its nesting
  - Syntax highlighting for 30+ languages, picked automatically when you drop a file
  - 11 color schemes, or your own: edit any color and it becomes a custom scheme
  - Drag the window edges (or use the width slider) to resize; long lines wrap at spaces, commas, brackets, and method chains before breaking words, and continuation lines are indented
  - Line numbers, window title and controls, border color and width, corner radius
- Adjustable horizontal and vertical padding (or locked together), shadow, and background (none, solid color, or image)
- Presets for each mode, with live thumbnails: six built-in looks, or save the current device, frame, theme, window, and canvas settings as your own (the screenshot, code, and background image aren't included). Saving under an existing name replaces that preset. Your presets stay in the browser, and Export and Import move them between browsers as a JSON file
- Export as PNG or JPEG with a custom file name, and code at 1x to 4x

## Development

Requires Node.js (LTS).

```sh
npm install
npm run dev       # start the Vite dev server
npm run build     # type-check and build to dist/
npm run preview   # serve the production build locally
```

## Project layout

- `index.html` - page markup: top bar, code editor, settings inspector, preview canvas, and export dialog
- `src/main.ts` - app wiring: form state, uploads, download
- `src/render.ts` - composes the framed screenshot or code window and the background onto the canvas
- `src/frames/` - one renderer per device frame
- `src/code/` - code screenshots: languages (Prism), color schemes, highlighting, line wrapping, and the window renderer
- `src/resize-handles.ts` - drag handles for resizing the code window in the preview
- `src/presets.ts` - built-in presets, what a preset keeps, and saving, exporting, and importing presets
- `src/preset-panel.ts` - the presets section: thumbnails, the save dialog, delete with undo, import and export
- `src/storage.ts` - saves settings in the browser and checks saved or imported settings
- `src/export.ts` - PNG/JPEG export and file name handling

## Deployment

Pushes to `main` build the site and deploy it to GitHub Pages via `.github/workflows/deploy.yml`.

## License

GPL-3.0. See [LICENSE](LICENSE).
