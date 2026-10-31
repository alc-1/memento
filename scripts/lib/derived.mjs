import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { hashBytes } from './hash.mjs';
import { generateImages } from './images.mjs';

// Bump when the sizes or encoder settings in images.mjs change, so every meme regenerates.
const RECIPE = 3;

/**
 * Makes `genDir` (memes/<slug>/generated, committed) hold thumb.webp, full.webp, preview.jpg and, for
 * stills, copy.png, unless its stamp says they already match the original. Returns { animated, width, height, previewWidth, previewHeight }.
 * The stamp is written last, so an interrupted run is simply redone.
 */
export async function ensureDerived(srcPath, genDir) {
  const hash = hashBytes(await readFile(srcPath));
  const stampPath = path.join(genDir, 'stamp.json');

  if (existsSync(stampPath)) {
    try {
      const stamp = JSON.parse(await readFile(stampPath, 'utf8'));
      if (stamp.recipe === RECIPE && stamp.hash === hash) {
        const { animated, width, height, previewWidth, previewHeight } = stamp;
        return { animated, width, height, previewWidth, previewHeight };
      }
    } catch {
      // Unreadable stamp: regenerate.
    }
  }

  await rm(genDir, { recursive: true, force: true });
  await mkdir(genDir, { recursive: true });
  const info = await generateImages(srcPath, genDir);
  await writeFile(stampPath, JSON.stringify({ recipe: RECIPE, hash, ...info }));
  return info;
}
