import { FONTS } from './thermal/fonts';
import { normalizeHex } from './thermal/palettes';
import { DEFAULTS, MAX_CHARS, type Settings } from './thermal/settings';

/** Short URL keys. Only values that differ from the defaults are stored. */
const KEYS: Record<keyof Settings, string> = {
  text: 't',
  fontId: 'f',
  letterSpacing: 'ls',
  lineHeight: 'lh',
  align: 'a',
  duration: 'd',
  angle: 'an',
  stripe: 'sw',
  reverse: 'rv',
  material: 'm',
  glow: 'g',
  glowStrength: 'gs',
  softness: 'sf',
  grain: 'gr',
  paletteId: 'p',
  palette: 'c',
};

export function toQuery(s: Settings): string {
  const q = new URLSearchParams();
  for (const key of Object.keys(KEYS) as (keyof Settings)[]) {
    const value = s[key];
    if (key === 'palette') {
      const joined = (value as string[]).map((c) => c.slice(1)).join('-');
      if (joined !== DEFAULTS.palette.map((c) => c.slice(1)).join('-')) q.set(KEYS[key], joined);
    } else if (key === 'fontId' && value.toString().startsWith('custom-')) {
      continue;
    } else if (value !== DEFAULTS[key]) {
      q.set(KEYS[key], typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
    }
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

export function fromQuery(search: string): Settings {
  const q = new URLSearchParams(search);
  const s: Settings = { ...DEFAULTS, palette: [...DEFAULTS.palette] };
  const target = s as unknown as Record<string, unknown>;

  for (const key of Object.keys(KEYS) as (keyof Settings)[]) {
    const raw = q.get(KEYS[key]);
    if (raw === null) continue;
    const def = DEFAULTS[key];
    if (key === 'palette') {
      const stops = raw.split('-').map((c) => normalizeHex(c));
      if (stops.length === 7) s.palette = stops;
    } else if (typeof def === 'number') {
      const v = parseFloat(raw);
      if (Number.isFinite(v)) target[key] = v;
    } else if (typeof def === 'boolean') {
      target[key] = raw === '1';
    } else {
      target[key] = raw;
    }
  }

  s.text = s.text.slice(0, MAX_CHARS);
  if (!FONTS.some((f) => f.id === s.fontId)) s.fontId = DEFAULTS.fontId;
  if (!['left', 'center', 'right'].includes(s.align)) s.align = DEFAULTS.align;
  s.duration = Math.max(0.5, s.duration);
  return s;
}
