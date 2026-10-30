import { readdir } from 'node:fs/promises';

export const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const IMAGE_EXTS = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
const REQUIRED = ['caption', 'source', 'author'];

/** Finds `original.<ext>` in a meme folder, or null. */
export async function findOriginal(dir) {
  const files = await readdir(dir);
  return files.find((f) => IMAGE_EXTS.some((e) => f.toLowerCase() === `original.${e}`)) ?? null;
}

/** Returns a list of human-readable problems; empty means valid. */
export function validateMeta(slug, meta, originalFile) {
  const errors = [];
  if (!SLUG_RE.test(slug)) errors.push(`folder name "${slug}" is not lowercase ASCII kebab-case`);
  if (!originalFile) errors.push('missing original.(png|jpg|jpeg|webp|gif)');
  for (const field of REQUIRED) {
    if (typeof meta[field] !== 'string' || meta[field].trim() === '') {
      errors.push(`missing mandatory field "${field}"`);
    }
  }
  if (meta.tags !== undefined && !Array.isArray(meta.tags)) errors.push('"tags" must be an array');
  if (meta.mine !== undefined && typeof meta.mine !== 'boolean') errors.push('"mine" must be a boolean');
  return errors;
}
