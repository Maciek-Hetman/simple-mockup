# Simple Mockup

Wrap a screenshot in a phone or browser frame and export it as PNG or JPEG. Runs entirely in the browser.

## Features

- Frames: Android, iPhone, browser window, or a plain rounded border
- Adjustable padding, shadow, and background (none, solid color, or image)
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
- `src/render.ts` - composes the screenshot, frame, and background onto the canvas
- `src/frames/` - one renderer per device frame
- `src/export.ts` - PNG/JPEG export and file name handling

## Deployment

Pushes to `main` build the site and deploy it to GitHub Pages via `.github/workflows/deploy.yml`.

## License

GPL-3.0. See [LICENSE](LICENSE).
