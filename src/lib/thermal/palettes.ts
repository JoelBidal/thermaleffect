export interface Palette {
  id: string;
  name: string;
  /** 7 colors, from the letter core (luminance 0) to the paper (luminance 1). */
  stops: string[];
}

export const PALETTES: Palette[] = [
  {
    id: 'thermal',
    name: 'Thermal',
    stops: ['#000000', '#00166d', '#00aaff', '#ffcb5c', '#ff4400', '#f384ff', '#ffffff'],
  },
  {
    id: 'thermal-night',
    name: 'Thermal Night',
    stops: ['#000000', '#00166d', '#00aaff', '#ffcb5c', '#ff4400', '#f384ff', '#121212'],
  },
  {
    id: 'ironbow',
    name: 'Ironbow',
    stops: ['#fffbe0', '#ffd23f', '#ff8a1f', '#e3305f', '#7a1fa0', '#22094a', '#0a0a0a'],
  },
  {
    id: 'arctic',
    name: 'Arctic',
    stops: ['#020617', '#0a2a8a', '#1f7aff', '#c9f6ff', '#13c4b0', '#a9c8ff', '#ffffff'],
  },
  {
    id: 'acid',
    name: 'Acid',
    stops: ['#0a0a0a', '#3b00ff', '#ff00a8', '#ffe600', '#00e676', '#b3fff0', '#ffffff'],
  },
  {
    id: 'mono',
    name: 'Mono',
    stops: ['#000000', '#262626', '#7a7a7a', '#e6e6e6', '#3d3d3d', '#b5b5b5', '#ffffff'],
  },
];

const channel = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;

const round = (n: number) => +n.toFixed(4);

/** Converts a palette into the tableValues for feFuncR/G/B. */
export function tableValues(stops: string[]): [string, string, string] {
  return [0, 1, 2].map((c) => stops.map((s) => round(channel(normalizeHex(s), c))).join(' ')) as [
    string,
    string,
    string,
  ];
}

export function normalizeHex(hex: string): string {
  let h = hex.trim().replace(/^#/, '').toLowerCase();
  if (h.length === 3) h = h.replace(/./g, (c) => c + c);
  return /^[0-9a-f]{6}$/.test(h) ? `#${h}` : '#000000';
}

export const isHex = (value: string) => /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value.trim());
