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

export interface MockupState extends FrameOptions {
  device: Device;
  /** Percentage of the framed device's shorter side. */
  padding: number;
  shadow: boolean;
  background: BackgroundMode;
  backgroundColor: string;
  format: ExportFormat;
}

export const defaultState: MockupState = {
  device: 'android',
  simple: { color: '#111111', width: 2, radius: 4 },
  browserAppearance: 'light',
  punchHoleSize: 100,
  islandSize: 100,
  padding: 10,
  shadow: true,
  background: 'color',
  backgroundColor: '#e0e7ff',
  format: 'png',
};
