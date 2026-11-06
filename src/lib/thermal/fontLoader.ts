import { parse, type Font } from 'opentype.js';
import { FONTS, type FontEntry } from './fonts';

const cache = new Map<string, Promise<Font>>();

export function loadFont(id: string): Promise<Font> {
  const entry = FONTS.find((f) => f.id === id) ?? FONTS[0];
  let font = cache.get(entry.id);
  if (!font) {
    if (!entry.url) return Promise.reject(new Error(`Font not available: ${id}`));
    font = fetch(entry.url)
      .then((r) => {
        if (!r.ok) throw new Error(`Couldn't load ${entry.url}`);
        return r.arrayBuffer();
      })
      .then((buf) => parse(buf));
    font.catch(() => cache.delete(entry.id));
    cache.set(entry.id, font);
  }
  return font;
}

/** Registers a font uploaded by the user and returns its entry. */
export async function registerUploadedFont(file: File): Promise<FontEntry> {
  if (/\.woff2$/i.test(file.name)) {
    throw new Error('WOFF2 isn’t supported. Use a .ttf, .otf or .woff file.');
  }
  const font = parse(await file.arrayBuffer());
  const name = font.names.fullName?.en ?? file.name.replace(/\.[^.]+$/, '');
  const entry: FontEntry = { id: `custom-${Date.now()}`, name };
  FONTS.push(entry);
  cache.set(entry.id, Promise.resolve(font));
  return entry;
}
