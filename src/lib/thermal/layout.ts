import type { Font, Path } from 'opentype.js';
import type { Align } from './settings';

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface TextLayout {
  /** Path with all the text, in SVG units. */
  d: string;
  /** Bounding box of the outlines (without glow). */
  bbox: Box;
}

/**
 * Fixed cap height in SVG units. The filter blur values are calibrated for
 * this scale, so text is always generated at the same size and only the
 * viewBox changes.
 */
export const CAP_HEIGHT = 110;

interface LayoutOptions {
  letterSpacing: number;
  lineHeight: number;
  align: Align;
}

/**
 * Positions the glyphs of a line: character map + kerning, without GSUB
 * substitutions (opentype.js doesn't support all of them and throws; a
 * display effect doesn't want ligatures anyway).
 */
function placeLine(font: Font, line: string, fontSize: number, letterSpacing: number) {
  const scale = fontSize / (font.unitsPerEm || 1000);
  const glyphs = Array.from(line, (ch) => font.charToGlyph(ch));
  const xs: number[] = [];
  let x = 0;
  glyphs.forEach((glyph, i) => {
    xs.push(x);
    x += (glyph.advanceWidth ?? 0) * scale;
    const next = glyphs[i + 1];
    if (next) {
      try {
        x += (font.getKerningValue(glyph, next) || 0) * scale;
      } catch {
        // Unsupported kerning tables: skip kerning.
      }
      x += letterSpacing * fontSize;
    }
  });
  return { glyphs, xs, width: x };
}

const r = (v: number) => +v.toFixed(2);

/** Serializes a path's commands. (opentype.js's toPathData yields NaN for integer values.) */
function pathData(path: Path): string {
  let d = '';
  for (const c of path.commands) {
    if (c.type === 'M' || c.type === 'L') d += `${c.type}${r(c.x)} ${r(c.y)}`;
    else if (c.type === 'Q') d += `Q${r(c.x1)} ${r(c.y1)} ${r(c.x)} ${r(c.y)}`;
    else if (c.type === 'C') d += `C${r(c.x1)} ${r(c.y1)} ${r(c.x2)} ${r(c.y2)} ${r(c.x)} ${r(c.y)}`;
    else if (c.type === 'Z') d += 'Z';
  }
  return d;
}

export function layoutText(font: Font, text: string, opts: LayoutOptions): TextLayout | null {
  const upm = font.unitsPerEm || 1000;
  const capRatio = (font.tables.os2?.sCapHeight || upm * 0.7) / upm;
  const fontSize = CAP_HEIGHT / capRatio;

  const lines = text.split('\n').map((line) => placeLine(font, line, fontSize, opts.letterSpacing));
  const maxWidth = Math.max(...lines.map((l) => l.width));

  let d = '';
  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;

  lines.forEach((line, i) => {
    const offset =
      opts.align === 'center' ? (maxWidth - line.width) / 2 : opts.align === 'right' ? maxWidth - line.width : 0;
    const y = i * fontSize * opts.lineHeight;
    line.glyphs.forEach((glyph, j) => {
      const path = glyph.getPath(offset + line.xs[j], y, fontSize);
      const bb = path.getBoundingBox();
      if (!isFinite(bb.x1) || bb.x2 - bb.x1 <= 0) return;
      d += pathData(path);
      x1 = Math.min(x1, bb.x1);
      y1 = Math.min(y1, bb.y1);
      x2 = Math.max(x2, bb.x2);
      y2 = Math.max(y2, bb.y2);
    });
  });

  if (!d) return null;
  return { d, bbox: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } };
}

export function pad(box: Box, p: number): Box {
  return { x: box.x - p, y: box.y - p, w: box.w + p * 2, h: box.h + p * 2 };
}

/** Grows a box (centered) to the given aspect ratio. */
export function fitAspect(box: Box, aspect: number): Box {
  const current = box.w / box.h;
  if (current > aspect) {
    const h = box.w / aspect;
    return { x: box.x, y: box.y - (h - box.h) / 2, w: box.w, h };
  }
  const w = box.h * aspect;
  return { x: box.x - (w - box.w) / 2, y: box.y, w, h: box.h };
}

/** Grows a box (centered) to at least the given size. */
export function minSize(box: Box, w: number, h: number): Box {
  const nw = Math.max(box.w, w);
  const nh = Math.max(box.h, h);
  return { x: box.x - (nw - box.w) / 2, y: box.y - (nh - box.h) / 2, w: nw, h: nh };
}
