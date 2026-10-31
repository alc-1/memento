import sharp from 'sharp';

const THUMB_WIDTH = 400;
const FULL_WIDTH = 1200;

/** Generates thumb.webp, full.webp and (for stills) copy.png. Returns { animated, width, height } (thumbnail size). */
export async function generateImages(srcPath, outDir) {
  const meta = await sharp(srcPath, { animated: true }).metadata();
  const animated = (meta.pages ?? 1) > 1;

  // First frame only for the thumbnail and the stills.
  const still = () => sharp(srcPath).rotate();

  await still()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 75 })
    .toFile(`${outDir}/thumb.webp`);

  const thumb = await sharp(`${outDir}/thumb.webp`).metadata();

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

  return { animated, width: thumb.width, height: thumb.height };
}
