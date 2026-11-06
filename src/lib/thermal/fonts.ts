export interface FontEntry {
  id: string;
  name: string;
  /** File in /public/fonts. Fonts uploaded by the user don't have one. */
  url?: string;
}

/**
 * Bundled fonts. To add one, copy the .ttf/.otf/.woff into public/fonts and
 * add an entry here. The first entry is the default font.
 */
export const FONTS: FontEntry[] = [
  { id: 'jakarta-800', name: 'Plus Jakarta Sans ExtraBold', url: '/fonts/PlusJakartaSans-800.ttf' },
  { id: 'jakarta-700', name: 'Plus Jakarta Sans Bold', url: '/fonts/PlusJakartaSans-700.ttf' },
  { id: 'jakarta-500', name: 'Plus Jakarta Sans Medium', url: '/fonts/PlusJakartaSans-500.ttf' },
  { id: 'manrope-800', name: 'Manrope ExtraBold', url: '/fonts/Manrope-800.ttf' },
  { id: 'space-grotesk-700', name: 'Space Grotesk Bold', url: '/fonts/SpaceGrotesk-700.ttf' },
  { id: 'fraunces-900', name: 'Fraunces Black', url: '/fonts/Fraunces-900.ttf' },
];

export const DEFAULT_FONT_ID = FONTS[0].id;
