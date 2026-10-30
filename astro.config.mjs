import { defineConfig } from 'astro/config';

// /meme/ for alcosta.ch/meme (default, also what the tests run against).
// The GitHub Pages deploy overrides it, e.g. BASE_PATH=/memento/.
const base = process.env.BASE_PATH ?? '/meme/';

export default defineConfig({
  output: 'static',
  base,
});
