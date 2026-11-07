# Thermal Effect

A web tool that applies an animated thermal effect to any text, made 100% with SVG filters. Exports to SVG (animated with SMIL), PNG and MP4.

Based on the SVG filter shared by [@bbssppllvv](https://x.com/bbssppllvv/status/2105312970410537249) and used in the mimosaagency.com hero.

## Development

Requires Node 24 (see `.nvmrc`).

```sh
nvm use
npm install
npm run dev      # http://localhost:4321
npm run build    # static site in dist/
```

Deploys to Vercel as a static site, with no adapter or extra configuration.

## How it works

1. **Text → paths** (`src/lib/thermal/layout.ts`): opentype.js turns the text into outlines, so the SVG doesn't depend on installed fonts. Cap height is fixed (`CAP_HEIGHT`) because the filter blurs are calibrated for that scale.
2. **SVG** (`src/lib/thermal/svg.ts`): `buildSvg()` is the single source of truth for the preview, the downloadable SVG, the PNG and every MP4 frame.
   - A white→black→white stripe (`linearGradient` with `spreadMethod="repeat"`) sweeps across the text.
   - The `material` filter darkens the edges to add depth.
   - The `color` filter blurs, builds the glow and maps luminance to the palette with `feComponentTransfer` (7 colors, from letter core to background).
   - Optional grain (`feTurbulence`) is sized in output pixels, so it looks the same at any zoom level.
3. **Preview** (`src/lib/thermal/preview.ts`): the stripe is animated with `requestAnimationFrame` (not SMIL), so editing the text or parameters never restarts the cycle.
4. **MP4** (`src/lib/export/exporters.ts`): each frame is generated from the SVG, drawn to a canvas and encoded to H.264 with WebCodecs + [Mediabunny](https://mediabunny.dev). The duration is a whole number of cycles, so it loops seamlessly.

## Adding fonts

Copy the `.ttf`, `.otf` or `.woff` file into `public/fonts/` and add an entry to `FONTS` (`src/lib/thermal/fonts.ts`). The first entry is the default font. Users can also upload their own font from the panel (WOFF2 isn't supported).

## Adding palettes

Add an entry to `PALETTES` (`src/lib/thermal/palettes.ts`) with 7 colors: the first is the letter core and the last is the background.

## Compatibility

- **MP4:** requires WebCodecs with H.264 (Chrome, Edge, Safari 16.4+ and recent Firefox).
- **Animated SVG:** animates in browsers. Figma and Illustrator don't support SMIL and only partially support the filters.
