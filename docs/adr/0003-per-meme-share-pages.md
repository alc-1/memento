# 0003. A static page per meme behind the Share button

Date: 2026-10-31
Status: accepted

## Context
Memes are mostly passed around in chats. Sending the album URL does not point at one meme, and
chat apps show a generic preview for it. A Share button needs a link that identifies one meme.

## Decision
- Each meme gets a static page at `/meme/m/<slug>/` (`src/pages/m/[slug].astro`, built from `index.json`). Clean URL: no extension, the slug is the permanent ID.
- The page carries Open Graph and Twitter tags (title = caption, image = the clipboard PNG, or the GIF itself for animated memes) so WhatsApp, Slack and iMessage show the picture.
- Previews need absolute URLs, so `astro.config.mjs` sets `site` from the `SITE` env variable, default `https://meme.alcosta.ch`.
- The Share button (fourth card button) opens the system share sheet on touch devices (`navigator.share`, no fine pointer) and copies the link on computers, with a "Link copied" badge. Closing the sheet is not an error; any other share failure falls back to the clipboard.
- Rejected: `?meme=<slug>` on the album (simpler, but previews would show nothing about the meme).

## Consequences
- One extra small HTML page per meme in the build (about 1 KB each); build time is unaffected.
- Link previews only work once the site is public; the repo and site are private for now.
- The page shows the picture, caption, author and source, and links back to the album; it has no copy button yet.
