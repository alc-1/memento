import { writeFile } from 'node:fs/promises';

/** Fixed key order keeps diffs clean. Empty optional fields are dropped. */
export function buildMeta(form) {
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const tags = [...new Set((Array.isArray(form.tags) ? form.tags : []).map(str).filter(Boolean))];
  const meta = { caption: str(form.caption) };
  if (str(form.category)) meta.category = str(form.category);
  if (str(form.language)) meta.language = str(form.language).toUpperCase();
  meta.tags = tags;
  meta.source = str(form.source);
  meta.author = str(form.author);
  if (str(form.description)) meta.description = str(form.description);
  meta.mine = form.mine === true;
  return meta;
}

export async function writeMeta(file, meta) {
  await writeFile(file, JSON.stringify(meta, null, 2) + '\n');
}
