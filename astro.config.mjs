// @ts-check
import { defineConfig } from 'astro/config';

// Absolute URLs for the social preview tags. On Vercel the production domain
// is exposed at build time; locally it falls back to the dev server.
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

// https://astro.build/config
export default defineConfig({
  site: productionHost ? `https://${productionHost}` : 'http://localhost:4321',
  devToolbar: { enabled: false },
});
