import { DEFAULT_FONT_ID } from './fonts';
import { PALETTES } from './palettes';

export type Align = 'left' | 'center' | 'right';

export interface Settings {
  /** User text. Empty = show the placeholder. */
  text: string;
  fontId: string;
  /** Letter spacing, in em. */
  letterSpacing: number;
  /** Line height, as a multiple of the font size. */
  lineHeight: number;
  align: Align;

  /** Seconds per stripe cycle. */
  duration: number;
  /** Stripe angle, in degrees. */
  angle: number;
  /** Width of one stripe cycle, in SVG units. */
  stripe: number;
  reverse: boolean;

  /** Edge depth (stdDeviation of the material filter). */
  material: number;
  /** Glow radius (stdDeviation of the glow blur). */
  glow: number;
  /** Glow intensity (alpha slope). */
  glowStrength: number;
  /** Color softness (stdDeviation of the color blur). */
  softness: number;
  /** Grain amount, 0 = off. */
  grain: number;

  paletteId: string;
  /** 7 colors, from the letter core (dark) to the paper (background). */
  palette: string[];
}

export const PLACEHOLDER = 'Thermal';
export const MAX_LINES = 4;
export const MAX_CHARS = 80;

export const DEFAULTS: Settings = {
  text: '',
  fontId: DEFAULT_FONT_ID,
  letterSpacing: -0.02,
  lineHeight: 1,
  align: 'center',
  duration: 4.4,
  angle: -35,
  stripe: 486,
  reverse: false,
  material: 4.5,
  glow: 11,
  glowStrength: 4,
  softness: 7.3,
  grain: 0.25,
  paletteId: PALETTES[0].id,
  palette: [...PALETTES[0].stops],
};

export const displayText = (s: Settings) => (s.text.trim() ? s.text : PLACEHOLDER);
