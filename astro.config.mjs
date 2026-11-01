import { defineConfig } from 'astro/config';

// /meme/ is the default, also what the tests run against.
// The GitHub Pages deploy overrides it with BASE_PATH=/ (served at the root of meme.alvarocosta.ch).
const base = process.env.BASE_PATH ?? '/meme/';

// Final host, used for the absolute URLs in link previews (Open Graph). the CI deploy sets the same value explicitly.
const site = process.env.SITE ?? 'https://meme.alvarocosta.ch';

export default defineConfig({
  output: 'static',
  site,
  base,
});
