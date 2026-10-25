# Simple Mockup

Wrap a screenshot in a phone or browser frame, or turn a code snippet into a highlighted image, and export it as PNG or JPEG. Runs entirely in the browser.

## Features

- Frames: Android, iPhone, browser window, or a plain rounded border
- Code screenshots:
  - Syntax highlighting for 30+ languages, picked automatically when you drop a file
  - 11 color schemes, or your own: edit any color and it becomes a custom scheme
  - Drag the window edges (or use the width slider) to resize; long lines wrap at spaces, commas, brackets, and method chains before breaking words, and continuation lines are indented
  - Line numbers, window title and controls, border color and width, corner radius
  - Export at 1x to 4x
- Adjustable horizontal and vertical padding (or locked together), shadow, and background (none, solid color, or image)
- Export as PNG or JPEG with a custom file name

## Development

Requires Node.js (LTS).

```sh
npm install
npm run dev       # start the Vite dev server
npm run build     # type-check and build to dist/
npm run preview   # serve the production build locally
```

## Project layout

- `index.html` - sidebar markup and the preview canvas
- `src/main.ts` - app wiring: form state, uploads, download
- `src/render.ts` - composes the framed screenshot or code window and the background onto the canvas
- `src/frames/` - one renderer per device frame
- `src/code/` - code screenshots: languages (Prism), color schemes, highlighting, line wrapping, and the window renderer
- `src/resize-handles.ts` - drag handles for resizing the code window in the preview
- `src/export.ts` - PNG/JPEG export and file name handling

## Deployment

Pushes to `main` build the site and deploy it to GitHub Pages via `.github/workflows/deploy.yml`.

## License

GPL-3.0. See [LICENSE](LICENSE).
