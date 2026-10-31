import { defineConfig } from 'astro/config';

// /meme/ for alcosta.ch/meme (default, also what the tests run against).
// The GitHub Pages deploy overrides it, e.g. BASE_PATH=/memento/.
const base = process.env.BASE_PATH ?? '/meme/';

// Final host, used for the absolute URLs in link previews (Open Graph). GitHub Pages overrides it with SITE.
const site = process.env.SITE ?? 'https://alcosta.ch';

export default defineConfig({
  output: 'static',
  site,
  base,
});
