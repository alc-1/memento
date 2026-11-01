# Ideas

Backlog of possible next developments, not commitments. Move an idea into `CLAUDE.md` (and an ADR
in `docs/adr/` if it changes how the project works) when it is picked up, and delete it here once shipped.

Current content, for scale: 50 memes, categories `work` (38), `gaming` (7), `misc` (5), languages FR and EN (25 each).

## Look and feel

- **Icons for categories.** One small icon per category on the filter chips (and on the info dialog), in the same stroke style as the card buttons. Needs a fallback icon for categories without one.
- **Icons for languages.** A flag-free mark per language (a two-letter badge, or a speech-bubble glyph), since a flag stands for a country, not a language.
- **Category "universes".** Selecting a category retints the site (accent colour, glow, maybe a subtle background) so Work, Gaming and Misc each feel like their own place. Colours defined per category as CSS variables, checked for the 4.5:1 contrast the style tests already enforce, light and dark. Respect `prefers-reduced-motion` for the transition.
- **Logo.** A mark for Memento, usable as favicon, header logo and share image. The site has no favicon today.
- **Footer.** Links to the repository and to the social profiles (LinkedIn already sits in the byline), plus the report-or-remove contact line that is postponed in `CLAUDE.md`.
- **About page.** What Memento is, why it exists (the caption in `CLAUDE.md`), who makes it, how to suggest a meme or ask for one to be removed. Linked from the footer.

## Sharing

- **A proper preview for every shareable page.** Today only `/meme/m/<slug>/` has Open Graph tags and a dedicated `preview.jpg`. The album (`/meme/`), a filtered view (`?tag=`, `?category=`) and the future About page need their own title, description and an image (the logo, or a collage of recent memes). Add a test that every built HTML page has `og:title`, `og:description` and a reachable `og:image`.
- **Copy button on the meme page.** The `/meme/m/<slug>/` page only displays the meme; it should also copy it, download it and link to the album.
- **Real-world preview check.** After deployment, verify previews in WhatsApp, Slack and iMessage, and note the Facebook Sharing Debugger step in the deployment docs.
- **Web App manifest / "install" on phones.** Makes the album one tap away from the home screen, which fits the "one click away" promise.

## Content and discovery

- **Date added.** Record when each meme joined the site, as an `added` field in `meta.json` (ISO date) set by the admin on save, with a one-off backfill for the existing memes from git history. Never edited afterwards, so a caption fix does not make an old meme look new.
- **Newest first by default.** Order the album by `added`, most recent first, so a returning visitor sees fresh content at the top. Optionally flag memes added since the visitor's last visit (a small "new" mark, last-visit date kept in `localStorage`).
- **Sort options.** A sort control next to the filters: Recent (default), Popular, Random, and later A-Z by caption or category. Kept in the URL like `?tag=` (e.g. `?sort=popular`). Random reshuffles on each load, and the choice must not fight the roving-tabindex keyboard navigation.
- **Popular sort.** Count every click-to-copy (small Cloudflare Worker with KV or D1 keyed by slug); counts never go into git. Already on the roadmap as step 5. Needed before the Popular option above can ship.
- **Random meme.** A "surprise me" button or `/meme/random`.
- **Related memes.** On the meme page, a few others sharing tags or category.
- **Tag hygiene in the admin.** Suggest merging near-duplicate tags (`dev`/`devs`/`developer`), show tag counts while typing, and warn about tags used once.
- **Category and language management.** A small list in the admin of existing values so a typo does not create a new category.
- **Near-duplicate detection.** The SHA-256 check only catches identical files; a perceptual hash would catch the same meme re-saved or resized.
- **Bulk import from `inbox/`.** Process several inbox images in one pass, with the previous meme's category and language preselected.
- **Caption language hints.** Mark FR/EN on the card itself so a mixed album is easy to scan.

## Quality and reach

- **Accessibility pass.** Alt text is the caption today; a longer optional `description` for image-heavy memes (text inside the picture) would help screen readers. Audit contrast per category universe.
- **Offline use.** A service worker caching thumbnails and recently copied memes, so the album works on a plane.
- **Internationalised interface.** UI labels in FR as well as EN, chosen from the browser language.
- **Per-meme `generated/` size watch.** The repo grows about 0.5 MB per meme (ADR 0002 and 0004); add a check that warns when the repo passes a chosen size.
- **Dark/light toggle.** The site follows the system theme; an explicit switch would let people override it.

## Postponed (from `CLAUDE.md`)

- Roberto Ferraro's illustrations, once written permission is in hand.
- The report-or-remove contact line, before any public launch.
- Making the repository public, which depends on the rights status of found memes.
