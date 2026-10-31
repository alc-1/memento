# 0002. Commit the generated images with each meme

Date: 2026-10-31
Status: accepted (supersedes 0001)

## Context
0001 moved image generation to the admin and kept the results in a git-ignored cache. That fixed
the local feedback loop, but CI and any fresh clone start with an empty cache and still convert
every meme: about 1 s per meme, so CI time grows with the album.

## Decision
- Each meme folder holds `generated/` with `thumb.webp`, `full.webp`, `copy.png` (stills only) and `stamp.json`, committed next to `original.*` and `meta.json`.
- The admin writes it when a meme is saved and commits it with the meme (the commit already stages the whole `memes/<slug>` folder).
- The build generates only when `generated/` is missing or `stamp.json` no longer matches the SHA-256 of the original or the recipe version (`RECIPE` in `scripts/lib/derived.mjs`). Hashing is milliseconds per meme. A stale folder is regenerated locally; commit it with the meme.
- The build copies `generated/` plus the original into `public/generated/<slug>/`, and writes `index.json`. Both stay git-ignored.
- `.gitattributes` marks `memes/*/generated/*` as binary so line-ending conversion never touches them.

## Consequences
- CI and clean clones convert nothing: build time no longer depends on the number of memes.
- The repo grows by roughly 0.2-0.5 MB per meme (about 26 MB for the first 50 including originals), and binary history cannot be shrunk later without rewriting it. Accepted on purpose: more files in the repo over slower CI.
- Changing sizes or encoder settings means bumping `RECIPE` and committing every regenerated folder in one commit.
- Replaces the rule "only originals and meta.json are committed".
