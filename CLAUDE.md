# Memento

Personal, curated album of memes and illustrations. One click copies a meme, ready to paste into any chat.
Caption: "There is always a time for memes. Yet we don't find them when we need them. They are now one-click away."
Full brief and reasoning: `docs/brief.md`. If a decision changes, update this file and the brief.

## Goals
- Value is in the content and the ease of use. Adding a meme must take about 30 seconds.
- Static site, no backend, free hosting. Private repo for now (rights on found memes are uncertain).
- Final URL: `alcosta.ch/meme`. The build output is copied into the existing alcosta.ch site.

## Hard rules
- Build with base path `/meme/`. All asset and `index.json` links must work under that path.
- No accents in URLs, folder names or filenames. Slugs are lowercase ASCII kebab-case.
- Only originals and `meta.json` are committed. Thumbnails, WebP versions, clipboard PNGs and `index.json` are generated at build time and never committed.
- Click-to-copy uses the Clipboard API with PNG only. Animated GIFs fall back to a "copy link" button.
- Every meme requires `source` and `author`. Attribution is shown on each card.

## Content structure
One folder per meme, named by its slug. The slug is the permanent ID and is never renamed. To change what visitors read, edit `caption` in `meta.json`.

```
memes/
  chaton-lundi/
    original.png
    meta.json
inbox/        untagged images waiting for the admin page
```

`meta.json` fields: `caption`, `category`, `language` (FR, EN, ...), `tags`, `source` (mandatory), `author` (mandatory), `description`, `mine` (true for Alvaro's own creations).
On slug collision, append `-2`.

## Build script
- Globs `memes/*/meta.json`, validates it, and fails loudly if a folder lacks its image or a mandatory field.
- Generates thumbnails, optimized WebP and a clipboard-ready PNG per meme, plus one merged `index.json`.
- Optional: content hash at import to catch duplicates.

## Admin page
Local only, started with `npm run admin` (small Node server that writes files, `http://127.0.0.1:4322`, no dependency beyond sharp). Code in `scripts/admin/` and `admin/`; slug, hash and meta helpers in `scripts/lib/`. Decisions: exact SHA-256 duplicate check (computed on demand, never stored); `inbox/` is committed; commit is on by default, push is off by default; "mine" fills author `Alvaro` and source `original`; only `memes/<slug>` (and the consumed inbox file) is ever staged; the Library tab edits an existing meme's metadata (slug and image never change) or deletes its folder, with the same commit/push options; the server only answers to its own `127.0.0.1`/`localhost` Host and Origin. Drag and drop an image or process the `inbox/`, auto-generate the slug and thumbnail, metadata form with tag autocomplete, save writes one folder, optional commit and push. It deserves as much care as the public site.

## Public site
Album grid with thumbnails, filters (category, language), client-side search (e.g. Fuse.js), click to copy with visible feedback. Must work on desktop and mobile.

## Roadmap
1. Walking skeleton: 5 sample memes, build script, bare grid with click-to-copy. Test the clipboard on desktop Chrome, Safari and a phone first, it is the biggest risk.
2. Filters and search.
3. Admin page.
4. Deployment into alcosta.ch/meme.
5. Later: count every click-to-copy as the popularity KPI (small Cloudflare Worker with KV or D1 keyed by slug, "Popular" sort). Counts never go into git.

## Working style
- Stack is chosen in plan mode before coding. Keep it boring and light, no heavy framework.
- Small tasks, commit after each working step, run the build script as the check.
- Postponed for now: Roberto Ferraro's illustrations (written permission) and the report-or-remove contact line. Neither is on the site; revisit before any public launch.
