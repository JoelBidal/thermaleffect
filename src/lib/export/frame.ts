import { fitAspect, pad, type Box, type TextLayout } from '../thermal/layout';
import type { Settings } from '../thermal/settings';
import { contentBox } from '../thermal/svg';

export const FORMATS = {
  auto: { name: 'Fit to text', aspect: 0 },
  '16:9': { name: '16:9', aspect: 16 / 9 },
  '1:1': { name: '1:1', aspect: 1 },
  '4:5': { name: '4:5', aspect: 4 / 5 },
  '9:16': { name: '9:16', aspect: 9 / 16 },
} as const;

export type Format = keyof typeof FORMATS;
export type Resolution = 1080 | 2160;

export interface Frame {
  viewBox: Box;
  width: number;
  height: number;
}

const even = (v: number) => Math.max(2, Math.round(v / 2) * 2);

/**
 * Export canvas. "auto" fits the text (long side 1920/3840 px); fixed
 * formats center the text with a margin (short side 1080/2160 px).
 */
export function computeFrame(layout: TextLayout, settings: Settings, format: Format, resolution: Resolution): Frame {
  const content = contentBox(layout, settings);
  const aspect = FORMATS[format].aspect;

  if (!aspect) {
    const long = resolution === 1080 ? 1920 : 3840;
    const scale = long / Math.max(content.w, content.h);
    return { viewBox: content, width: even(content.w * scale), height: even(content.h * scale) };
  }

  const viewBox = fitAspect(pad(content, Math.max(content.w, content.h) * 0.06), aspect);
  const width = even(aspect >= 1 ? resolution * aspect : resolution);
  const height = even(aspect >= 1 ? resolution : resolution / aspect);
  return { viewBox, width, height };
}

/** Output pixels per SVG unit. */
export const frameScale = (frame: Frame) => frame.width / frame.viewBox.w;
