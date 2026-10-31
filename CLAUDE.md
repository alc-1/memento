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
- Committed per meme: the original, `meta.json` and `generated/` (thumbnail, WebP, clipboard PNG, `stamp.json`). `index.json` and `public/generated/` are build output, never committed. Repo size is traded for a CI time that does not grow with the number of memes (`docs/adr/0002-commit-generated-images.md`).
- The Copy button uses the Clipboard API with PNG only. Animated GIFs fall back to a "copy link" button.
- Every meme requires `source` and `author`. Attribution is shown on each card.

## Content structure
One folder per meme, named by its slug. The slug is the permanent ID and is never renamed. To change what visitors read, edit `caption` in `meta.json`.

```
memes/
  chaton-lundi/
    original.png
    meta.json
    generated/    thumb.webp, full.webp, copy.png, stamp.json
inbox/        untagged images waiting for the admin page
```

`meta.json` fields: `caption`, `category`, `language` (FR, EN, ...), `tags`, `source` (mandatory), `author` (mandatory), `description`, `mine` (true for Alvaro's own creations).
On slug collision, append `-2`.

## Build script
- Globs `memes/*/meta.json`, validates it, and fails loudly if a folder lacks its image or a mandatory field.
- Per meme, generates (only when `memes/<slug>/generated/` is missing or its `stamp.json` hash no longer matches the original; `scripts/lib/derived.mjs`) a thumbnail, optimized WebP and a clipboard-ready PNG, then copies them with the original into `public/generated/<slug>/` and writes one merged `index.json`. The admin generates them on save and commits them with the meme.
- Optional: content hash at import to catch duplicates.

## Admin page
Local only, started with `npm run admin` (small Node server that writes files, `http://127.0.0.1:4322`, no dependency beyond sharp). Code in `scripts/admin/` and `admin/`; slug, hash and meta helpers in `scripts/lib/`. Decisions: exact SHA-256 duplicate check (computed on demand, never stored); `inbox/` is committed; commit is on by default, push is off by default; "mine" fills author `Alvaro` and source `original`; only `memes/<slug>` (and the consumed inbox file) is ever staged; the Library tab edits an existing meme's metadata (slug and image never change) or deletes its folder, with the same commit/push options; the server only answers to its own `127.0.0.1`/`localhost` Host and Origin. Drag and drop an image or process the `inbox/`, auto-generate the slug and thumbnail, metadata form with tag autocomplete, save writes one folder, optional commit and push. It deserves as much care as the public site.

## Public site
The header carries a byline, "by Alvaro", next to the title: a link to https://www.linkedin.com/in/alcosta1/ (new tab, `noopener noreferrer`), styled like an author credit on the cards (monospace, muted) with a quiet underline. Name and URL are constants at the top of `src/pages/index.astro`.
Masonry album (CSS columns; each card keeps its image's own aspect ratio, nothing cropped; thumbnail size comes from `index.json`) with filters (category, language), clickable tag pills (up to 3 per card plus a Topics row of the most used tags; one tag filter at a time, kept in the URL as `?tag=`) and client-side search (Fuse.js). The search bar has one clear control, a small monospaced CLEAR chip shown only while there is text (the browser's own cross is hidden; padded to finger size on phones); it clears the query only, the empty state's button resets search and filters. Each card has three buttons: Copy (PNG to the clipboard, visible feedback; animated GIFs copy their link), Download (the untouched original, named `<slug>.<ext>`) and Info (metadata dialog). Clicking the image opens it large, except on small screens (width up to 640px, `src/scripts/screen.js` and the matching CSS rule) where it copies like the Copy button, since a zoomed frame adds nothing there. On computers (fine pointer that can hover) the search box is focused on load; touch devices are not, so the on-screen keyboard stays closed. Keyboard (Tab + arrows; page arrow-scrolling is never hijacked): `/` focuses the search box (already focused on load on computers). Each card is `ul.grid > li.card > article.card-focus` (a named article, `aria-labelledby` the caption). Only the current card and its own buttons/links are Tab stops (roving tabindex), so Tab goes search, filters, topics, current card, then leaves the grid. Arrow keys, pressed on a card or any control inside it, move to the nearest card by position (Home/End jump, Enter or Space opens the large view, arrow up from the first row returns to search). The focused card gets a `#ff5722` 2px ring (drawn on the `li`, eased in). Focus moves glide via `src/scripts/motion.js` (scroll only when needed, only as far as needed, instant under `prefers-reduced-motion`); dialogs fade in unless motion is reduced. Monospace (JetBrains Mono, Fira Code, then system mono; no web font is loaded) is used only for tag counts, keyboard hints and source attributions, plus the terminal-style search box. Originals are published under `generated/<slug>/original.<ext>` at build time, never committed. Must work on desktop and mobile.

## Roadmap
1. Walking skeleton: 5 sample memes, build script, bare grid with click-to-copy. Test the clipboard on desktop Chrome, Safari and a phone first, it is the biggest risk.
2. Filters and search.
3. Admin page.
4. Deployment into alcosta.ch/meme.
5. Later: count every click-to-copy as the popularity KPI (small Cloudflare Worker with KV or D1 keyed by slug, "Popular" sort). Counts never go into git.

## Decisions
Architecture decisions are recorded in `docs/adr/` (one numbered file each). Add one when a choice changes how the project works.

## Working style
- Stack is chosen in plan mode before coding. Keep it boring and light, no heavy framework.
- Small tasks, commit after each working step, run the build script as the check.
- Postponed for now: Roberto Ferraro's illustrations (written permission) and the report-or-remove contact line. Neither is on the site; revisit before any public launch.
