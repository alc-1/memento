import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { findOriginal } from './validate.mjs';

export function hashBytes(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/** Maps sha256 -> slug for every original under `memesDir`. Computed on demand, never stored. */
export async function indexOriginals(memesDir) {
  const index = new Map();
  if (!existsSync(memesDir)) return index;
  const entries = await readdir(memesDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = path.join(memesDir, entry.name);
    const original = await findOriginal(dir);
    if (!original) continue;
    index.set(hashBytes(await readFile(path.join(dir, original))), entry.name);
  }
  return index;
}
