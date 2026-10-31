import { readdir, readFile, writeFile, mkdir, rm, cp, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findOriginal, validateMeta } from './lib/validate.mjs';
import { ensureDerived } from './lib/derived.mjs';

const ROOT = process.env.MEMENTO_ROOT ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MEMES_DIR = path.join(ROOT, 'memes');
const OUT_DIR = path.join(ROOT, 'public', 'generated');
const checkOnly = process.argv.includes('--check');

function fail(problems) {
  console.error('\nContent validation failed:\n');
  for (const { slug, errors } of problems) {
    for (const e of errors) console.error(`  memes/${slug}: ${e}`);
  }
  console.error('');
  process.exit(1);
}

const entries = existsSync(MEMES_DIR) ? await readdir(MEMES_DIR, { withFileTypes: true }) : [];
const slugs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

const problems = [];
const loaded = [];

for (const slug of slugs) {
  const dir = path.join(MEMES_DIR, slug);
  const metaPath = path.join(dir, 'meta.json');
  if (!existsSync(metaPath)) {
    problems.push({ slug, errors: ['missing meta.json'] });
    continue;
  }
  let meta;
  try {
    meta = JSON.parse(await readFile(metaPath, 'utf8'));
  } catch (err) {
    problems.push({ slug, errors: [`meta.json is not valid JSON: ${err.message}`] });
    continue;
  }
  const original = await findOriginal(dir);
  const errors = validateMeta(slug, meta, original);
  if (errors.length) problems.push({ slug, errors });
  else loaded.push({ slug, dir, meta, original });
}

if (problems.length) fail(problems);

if (checkOnly) {
  console.log(`OK: ${loaded.length} memes valid.`);
  process.exit(0);
}

// public/generated is rebuilt from scratch: the derived images committed in memes/<slug>/generated
// (made by the admin, or here when missing or stale) plus each untouched original.
await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(OUT_DIR, { recursive: true });

const index = [];
for (const { slug, dir, meta, original } of loaded) {
  const outDir = path.join(OUT_DIR, slug);
  const genDir = path.join(dir, 'generated');
  const { animated, width, height, previewWidth, previewHeight } = await ensureDerived(path.join(dir, original), genDir);

  // The original is published for the download button, and doubles as the animated GIF's
  // "copy link" target and large view, so GIFs are not stored twice.
  const ext = path.extname(original).toLowerCase();
  await cp(genDir, outDir, { recursive: true });
  await copyFile(path.join(dir, original), path.join(outDir, `original${ext}`));

  index.push({
    slug,
    caption: meta.caption,
    category: meta.category ?? null,
    language: meta.language ?? null,
    tags: meta.tags ?? [],
    source: meta.source,
    author: meta.author,
    description: meta.description ?? '',
    mine: meta.mine ?? false,
    animated,
    thumb: `generated/${slug}/thumb.webp`,
    thumbWidth: width,
    thumbHeight: height,
    preview: `generated/${slug}/preview.jpg`,
    previewWidth,
    previewHeight,
    original: `generated/${slug}/original${ext}`,
    download: `${slug}${ext}`,
    // Large view and clipboard source: stills use the optimized versions, GIFs keep their animation.
    full: animated ? `generated/${slug}/original${ext}` : `generated/${slug}/full.webp`,
    copy: animated ? `generated/${slug}/original${ext}` : `generated/${slug}/copy.png`,
  });
  console.log(`  ${slug}${animated ? ' (animated)' : ''}`);
}

await writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2));
console.log(`Built ${index.length} memes -> public/generated/index.json`);
