const MAX_LENGTH = 50;

/** Lowercase ASCII kebab-case slug from a caption. Falls back to "meme" when nothing usable remains. */
export function slugify(caption) {
  let slug = String(caption ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (slug.length > MAX_LENGTH) {
    // Cut on a word boundary when one exists past the halfway point.
    const cut = slug.slice(0, MAX_LENGTH);
    const boundary = cut.lastIndexOf('-');
    slug = (boundary > MAX_LENGTH / 2 ? cut.slice(0, boundary) : cut).replace(/-+$/, '');
  }
  return slug || 'meme';
}

/** Returns `base`, or `base-2`, `base-3`... the first one not in `existing` (a Set or array). */
export function uniqueSlug(base, existing) {
  const taken = new Set(existing);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}
