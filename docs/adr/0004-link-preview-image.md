# 0004. A dedicated preview image for shared links

Date: 2026-10-31
Status: accepted

## Context
Shared meme pages (ADR 0003) carry Open Graph tags. WhatsApp and similar apps drop the preview
image when it is heavy (about 300 KB), and `copy.png` was over that for 20 of 50 memes. Animated
GIFs and transparent PNGs are poor preview images too.

## Decision
- Each meme gets `generated/preview.jpg`: first frame, fitted inside 800x800, flattened on white (padded at the sides to at least 320 px wide for very tall memes), mozjpeg, with the quality lowered step by step until it is under 250 KB.
- `og:image` and `twitter:image` use it, with `og:image:type`, `width`, `height` and `alt`. Its size is stored in `stamp.json` and `index.json`.
- `RECIPE` went to 3, so every meme regenerated once and the new files are committed (ADR 0002).

## Consequences
- Previews work for every meme, GIFs included (as a still); the largest preview is about 135 KB.
- About 0.1 MB more per meme in the repo.
- Previews only appear once the site is public over HTTPS and crawlers are not blocked. WhatsApp caches a URL's preview for days; the Facebook Sharing Debugger can force a refresh.
