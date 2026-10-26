import { THEMES, type Palette } from './code/themes.ts';

export type Mode = 'screenshot' | 'code';
export type Device = 'android' | 'iphone' | 'browser' | 'simple';
export type BackgroundMode = 'none' | 'color' | 'image';
export type ExportFormat = 'png' | 'jpeg';
export type Appearance = 'light' | 'dark';

export interface Picture {
  source: CanvasImageSource;
  width: number;
  height: number;
}

/** Width and radius are percentages of the screenshot's shorter side. */
export interface SimpleFrameOptions {
  color: string;
  width: number;
  radius: number;
}

export interface FrameOptions {
  simple: SimpleFrameOptions;
  browserAppearance: Appearance;
  /** Percentages of the default cutout size. */
  punchHoleSize: number;
  islandSize: number;
}

/** Sizes are in CSS pixels; `scale` multiplies everything on export. */
export interface CodeOptions {
  text: string;
  language: string;
  /** A theme id, or `custom` for `customColors`. */
  theme: string;
  customColors: Palette;
  /** Line length in columns; longer lines wrap. */
  width: number;
  /** Narrow the window to the longest line when that's shorter than `width`. */
  fitWidth: boolean;
  lineNumbers: boolean;
  /** Editor only: Enter keeps the indentation and Tab indents. Doesn't affect the image. */
  autoIndent: boolean;
  title: string;
  windowControls: boolean;
  borderColor: string;
  borderWidth: number;
  radius: number;
  paddingX: number;
  paddingY: number;
  scale: number;
}

export interface MockupState extends FrameOptions {
  mode: Mode;
  code: CodeOptions;
  device: Device;
  /** Percentages of the framed device's shorter side, so equal values give equal space. */
  paddingX: number;
  paddingY: number;
  /** Keep horizontal and vertical padding equal. */
  paddingLocked: boolean;
  shadow: boolean;
  background: BackgroundMode;
  backgroundColor: string;
  format: ExportFormat;
}

const SAMPLE_CODE = `interface User {
  id: number;
  name: string;
}

// Fetch a user and greet them by name.
export async function greet(id: number): Promise<string> {
  const response = await fetch(\`/api/users/\${id}\`);
  if (!response.ok) throw new Error(\`Request failed: \${response.status}\`);
  const user: User = await response.json();
  return \`Hello, \${user.name}!\`;
}
`;

export const defaultState: MockupState = {
  mode: 'screenshot',
  code: {
    text: SAMPLE_CODE,
    language: 'typescript',
    theme: THEMES[0].id,
    customColors: { ...THEMES[0].colors },
    width: 80,
    fitWidth: true,
    lineNumbers: false,
    autoIndent: true,
    title: '',
    windowControls: true,
    borderColor: '#ffffff',
    borderWidth: 0,
    radius: 12,
    paddingX: 48,
    paddingY: 48,
    scale: 2,
  },
  device: 'android',
  simple: { color: '#111111', width: 2, radius: 4 },
  browserAppearance: 'light',
  punchHoleSize: 100,
  islandSize: 100,
  paddingX: 10,
  paddingY: 10,
  paddingLocked: true,
  shadow: true,
  background: 'color',
  backgroundColor: '#e0e7ff',
  format: 'png',
};
