import sharp from 'sharp';

const THUMB_WIDTH = 400;
const FULL_WIDTH = 1200;
const PREVIEW_SIZE = 800;
const PREVIEW_MIN_WIDTH = 320;
const PREVIEW_MAX_BYTES = 250 * 1024;

/** Generates thumb.webp, full.webp, preview.jpg and (for stills) copy.png. Returns { animated, width, height } (thumbnail size). */
export async function generateImages(srcPath, outDir) {
  const meta = await sharp(srcPath, { animated: true }).metadata();
  const animated = (meta.pages ?? 1) > 1;

  // First frame only for the thumbnail and the stills.
  const still = () => sharp(srcPath).rotate();

  // toFile reports the output size; re-opening thumb.webp left it locked on Windows, blocking deletion.
  const thumb = await still()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toFile(`${outDir}/thumb.webp`);

  await still()
    .resize({ width: FULL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(`${outDir}/full.webp`);

  // The Clipboard API reliably copies PNG only; animated GIFs get a copy-link fallback instead.
  if (!animated) {
    await still()
      .resize({ width: FULL_WIDTH, withoutEnlargement: true })
      .png({ compressionLevel: 9, palette: true, quality: 80, effort: 10 })
      .toFile(`${outDir}/copy.png`);
  }

  // Link previews (WhatsApp and friends) drop images over ~300 KB, so this one gets a hard budget.
  // JPEG for every meme, GIFs included: previews are never animated.
  const { data: fittedBuffer, info: fitted } = await still()
    .resize({ width: PREVIEW_SIZE, height: PREVIEW_SIZE, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer({ resolveWithObject: true });
  let preview;
  for (const quality of [80, 70, 60, 50, 40]) {
    // Very tall memes would come out narrower than the ~300 px previews need: pad the sides with white.
    const padding = Math.max(0, Math.ceil((PREVIEW_MIN_WIDTH - fitted.width) / 2));
    preview = await sharp(fittedBuffer)
      .extend({ left: padding, right: padding, background: '#ffffff' })
      .jpeg({ quality, mozjpeg: true })
      .toFile(`${outDir}/preview.jpg`);
    if (preview.size <= PREVIEW_MAX_BYTES) break;
  }

  return {
    animated, width: thumb.width, height: thumb.height,
    previewWidth: preview.width, previewHeight: preview.height,
  };
}
