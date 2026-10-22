import type { Device } from '../state.ts';
import { android } from './android.ts';
import { browser } from './browser.ts';
import { iphone } from './iphone.ts';
import { simple } from './simple.ts';
import type { FrameRenderer } from './common.ts';

export const frames: Record<Device, FrameRenderer> = { android, iphone, browser, simple };
