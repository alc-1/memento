# 0001. Generate optimized images when a meme is added, not at every build

Date: 2026-10-31
Status: superseded by 0002 (the cache is now committed, so CI is no longer cold)

## Context
`npm run build` regenerated the thumbnail, WebP and clipboard PNG of every meme on each run
(about 50 s for 50 memes), which slowed the edit-and-look feedback loop. The hard rule remains
that derived files are never committed (repo size, originals are the only source of truth).

## Decision
- The derived files live in `public/generated/<slug>/`, which stays git-ignored, and act as a cache.
- The admin page generates them when it saves a new meme (`scripts/lib/derived.mjs`) and removes them when a meme is deleted.
- The build calls the same helper for every meme. It skips a meme whose `stamp.json` matches the SHA-256 of the original and the current recipe version, and drops folders of memes that no longer exist.
- `RECIPE` in `derived.mjs` is bumped whenever sizes or encoder settings in `images.mjs` change, forcing a full regeneration.
- `index.json` is still rewritten on every build (cheap), so metadata edits need no image work.

## Consequences
- A warm build takes about 3 s instead of about 50 s.
- A cold checkout (CI, fresh clone, memes added by hand) still generates everything once; the build stays the safety net, so nothing can be missing.
- Nothing derived is committed, so the hard rules in `CLAUDE.md` are unchanged.
- Rejected: committing the derived files (bloats git history, can drift from the originals).
