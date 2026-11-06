import { pad, type Box, type TextLayout } from './layout';
import { tableValues } from './palettes';
import type { Settings } from './settings';

export interface BuildOptions {
  layout: TextLayout;
  settings: Settings;
  /** Prefix for internal IDs, so several SVGs can live on the same page. */
  id: string;
  viewBox: Box;
  /** Stripe position within the cycle (0–1). Ignored when `animated`. */
  phase?: number;
  /** Includes the SMIL animation (for the downloadable SVG). */
  animated?: boolean;
  /** Paints a paper-colored rectangle behind the effect. */
  background?: boolean;
  /** Output pixels per SVG unit, so the grain keeps a constant pixel size. */
  grainScale?: number;
  width?: number;
  height?: number;
  label?: string;
}

const n = (v: number) => +v.toFixed(2);
const box = (b: Box) => `${n(b.x)} ${n(b.y)} ${n(b.w)} ${n(b.h)}`;
const region = (b: Box) => `filterUnits="userSpaceOnUse" x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}"`;
const escape = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

/** Grain frequency in cycles per output pixel. */
const GRAIN_FREQ = 0.6;

/** feTurbulence works in SVG units; this converts it to a constant on-screen grain size. */
export const grainFrequency = (pxPerUnit: number) => n(Math.min(20, Math.max(0.05, GRAIN_FREQ * pxPerUnit)));

/** Margin around the outlines taken up by the visible glow. */
export const haloPad = (s: Settings) => s.glow * 2.6 + 8;

/** Smallest box that contains the whole effect. */
export const contentBox = (layout: TextLayout, s: Settings) => pad(layout.bbox, haloPad(s));

export function stripeTransform(s: Settings, phase: number): string {
  const offset = (phase % 1) * s.stripe * (s.reverse ? -1 : 1);
  return `rotate(${n(s.angle)}) translate(${n(offset)} 0)`;
}

export function buildSvg(o: BuildOptions): string {
  const { layout, settings: s, id } = o;
  const [r, g, b] = tableValues(s.palette);
  const materialRegion = pad(layout.bbox, s.material * 3 + 2);
  const colorRegion = pad(layout.bbox, s.glow * 3 + s.softness * 3);

  const size = o.width && o.height ? ` width="${o.width}" height="${o.height}"` : '';
  const label = escape(o.label ?? 'Text with a thermal effect');

  const stripe = o.animated
    ? `<linearGradient id="${id}-stripe" gradientUnits="userSpaceOnUse" x2="${n(s.stripe)}" spreadMethod="repeat" gradientTransform="rotate(${n(s.angle)})">` +
      `<stop stop-color="#fff"/><stop offset=".5" stop-color="#000"/><stop offset="1" stop-color="#fff"/>` +
      `<animateTransform attributeName="gradientTransform" type="translate" from="0 0" to="${n(s.reverse ? -s.stripe : s.stripe)} 0" dur="${n(s.duration)}s" repeatCount="indefinite" additive="sum"/>` +
      `</linearGradient>`
    : `<linearGradient id="${id}-stripe" gradientUnits="userSpaceOnUse" x2="${n(s.stripe)}" spreadMethod="repeat" gradientTransform="${stripeTransform(s, o.phase ?? 0)}">` +
      `<stop stop-color="#fff"/><stop offset=".5" stop-color="#000"/><stop offset="1" stop-color="#fff"/>` +
      `</linearGradient>`;

  // Optional grain: grayscale noise added before the color map.
  const grain =
    s.grain > 0
      ? `<feTurbulence id="${id}-grain" type="fractalNoise" baseFrequency="${grainFrequency(o.grainScale ?? 1.5)}" numOctaves="2" seed="7" stitchTiles="stitch"/>` +
        `<feColorMatrix type="matrix" values=".33 .33 .33 0 0 .33 .33 .33 0 0 .33 .33 .33 0 0 0 0 0 0 1" result="noise"/>` +
        `<feComposite in="lit" in2="noise" operator="arithmetic" k2="1" k3="${n(s.grain * 0.4)}" k4="${n(-s.grain * 0.2)}"/>`
      : '';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box(o.viewBox)}"${size} role="img" aria-label="${label}">` +
    `<defs>` +
    stripe +
    `<filter id="${id}-material" ${region(materialRegion)} color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(s.material)}"/>` +
    `<feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1"/>` +
    `<feBlend in="SourceGraphic" mode="overlay"/>` +
    `</filter>` +
    `<filter id="${id}-color" ${region(colorRegion)} color-interpolation-filters="sRGB">` +
    `<feGaussianBlur in="SourceAlpha" stdDeviation="${n(s.glow)}"/>` +
    `<feComponentTransfer result="glow"><feFuncA type="linear" slope="${n(s.glowStrength)}"/></feComponentTransfer>` +
    `<feFlood flood-color="#fff" result="paper"/>` +
    `<feComposite in="SourceGraphic" in2="paper" operator="over"/>` +
    `<feGaussianBlur stdDeviation="${n(s.softness)}" result="soft"/>` +
    `<feComponentTransfer><feFuncA type="linear" slope=".12"/></feComponentTransfer>` +
    `<feBlend in2="soft" mode="soft-light" result="lit"/>` +
    grain +
    `<feComponentTransfer>` +
    `<feFuncR type="table" tableValues="${r}"/>` +
    `<feFuncG type="table" tableValues="${g}"/>` +
    `<feFuncB type="table" tableValues="${b}"/>` +
    `</feComponentTransfer>` +
    `<feComposite in2="glow" operator="in"/>` +
    `</filter>` +
    `</defs>` +
    (o.background ? `<rect x="${n(o.viewBox.x)}" y="${n(o.viewBox.y)}" width="${n(o.viewBox.w)}" height="${n(o.viewBox.h)}" fill="${s.palette[6]}"/>` : '') +
    `<g filter="url(#${id}-color)"><path d="${layout.d}" filter="url(#${id}-material)" fill="url(#${id}-stripe)"/></g>` +
    `</svg>`
  );
}
