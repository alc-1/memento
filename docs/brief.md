# Memento — Project Brief

Oct 28, 2026 · @Alvaro

**There is always a time for memes. Yet we don't find them when we need them. They are now one-click away.**

## The pain point

Corporate chats lack fun. Exchanges stay formal and flat, and the good memes that could lighten them are scattered across the web, hard to find and slow to reuse in the moment.

When a meme would fit, the friction of searching, saving and re-uploading kills the impulse. The joke never gets sent.

## The wish

Bring quality memes closer, so lighter exchanges happen at work and outside it.

**Memento** is a personal, curated portfolio of memes and illustrations, shown as an album at alcosta.ch/meme. One click copies a meme, ready to paste into any chat.

The value is in two things: the quality of the content, and how little effort it takes to use.

**Name:** **Meme**nto, a mix of meme, memento and moment, with the meme part highlighted. It is a reminder that there is a time for memes.

## What visitors get

- **An album:** memes and illustrations displayed as a visual grid.
- **One-click copy:** every meme has a Copy button that puts the image on the clipboard, ready to paste. Animated GIFs copy their link instead, since browsers only copy still images reliably.
- **Download and info:** a Download button gives the original file, an Info button shows the metadata (author, source, category, language, tags, description).
- **Large view:** clicking a meme opens it full size.
- **Filters and search:** filter by category and language, search by tag or caption.
- **Fast loading:** images are compressed and served as thumbnails in the grid.

## Content and author rights

Every meme carries metadata, so the album stays searchable and properly credited.

| Field | Purpose |
| --- | --- |
| id (slug) | Permanent identifier, generated from the caption, never renamed |
| caption | Display text, editable at any time |
| category | Main filter |
| language | Filter (FR, EN, ...) |
| tags | Search and filters |
| source | Where it was found (mandatory) |
| author | Who made it (mandatory), shown on the card |
| description | Context for the meme |
| mine | Flag separating Alvaro's own creations from found memes |

Illustrations will mostly be work by Roberto Ferraro. Author rights need care: ask him for written permission to use his work on the site, credit him on each card with a link, and add a contact line to report or remove any content.

## Technical approach

A static site, with everything stored in git. No backend, and free hosting such as Cloudflare Pages.

- **Originals and their generated images in git:** thumbnails, WebP versions and clipboard-ready PNGs are generated once, when a meme is added, and committed in `memes/<slug>/generated/`, so CI time does not grow with the album (see `docs/adr/0002-commit-generated-images.md`; originally generated at every build).
- **One folder per meme, image and meta.json side by side:** readable diffs, no orphans, no edit conflicts. A build script reads every meta.json, fails if a folder lacks its image, and merges them into a single index.json that the site loads.
- **Click to copy:** the browser Clipboard API reliably copies PNG only, so a PNG version is built for every meme.
- **Search:** client-side, for example with Fuse.js. Plenty fast for a few hundred memes.
- **Escape hatch:** if the repo passes about 1 GB or animated GIFs pile up, move the images to Cloudflare R2. The JSON stays in git and only the paths change.

```
memes/
  chaton-lundi/
    original.png
    meta.json
inbox/   (untagged images for the admin page)
build output (not committed):
  thumbs/, copy-ready PNGs, index.json
```

The repo stays private at first, since rights on found memes are uncertain, and only the build output is published.

## Admin workflow and naming

Adding a meme must take 30 seconds, otherwise the site never gets fed. A local admin page, started with `npm run admin`, handles it.

1. Drag and drop an image, or dump it in an `inbox/` folder to process later.
2. The page generates the slug, the thumbnail and a metadata form with tag autocomplete.
3. Save writes the image and its JSON file, then optionally commits and pushes, which triggers the deploy.

**Naming rules**

- Alvaro never types a name. The folder name is generated from the caption: lowercase, ASCII, kebab-case, no accents (`chaton-lundi/`).
- On a collision, append `-2`.
- The slug is the permanent ID naming the folder and the URL. To change what visitors read, edit the caption field instead.
- A content hash computed at import can catch duplicates.

## Roadmap and decisions

1. **Viewer:** grid, filters, search, click to copy.
2. **Admin page:** drag and drop, metadata form, save and push. It deserves as much care as the public side.
3. **Content:** seed the album with a first batch, with source and author filled in for each meme.
4. **Rights (postponed):** get Roberto Ferraro's written permission, then add the report-or-remove contact line. Set aside for now, to revisit before any public launch.
5. **Later, popularity ranking:** count every click-to-copy as the KPI, using a small Cloudflare Worker with KV or D1 keyed by slug, and add a "Popular" sort. Counts stay out of git, with no accounts or cookies. A simple like button can come as a second signal.

**Decisions**

- Final name: Memento. Alternatives considered: Mememe, Me's memes, Mes memes, Same Same, Meme Machine.
- Repo: private at first, given the uncertain rights on found memes.
- URL: alcosta.ch/meme, with no accent in the path so links stay clean when shared.
