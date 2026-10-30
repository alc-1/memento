import { slugify, uniqueSlug } from './lib/slug.mjs';

const $ = (id) => document.getElementById(id);
const els = {
  editor: $('editor'), empty: $('empty'), queue: $('queue'), inboxCount: $('inbox-count'),
  preview: $('preview'), form: $('form'), caption: $('caption'), slug: $('slug'),
  slugPreview: $('slug-preview'), slugEdit: $('slug-edit'), category: $('category'),
  language: $('language'), chips: $('chips'), tagInput: $('tag-input'), suggestions: $('tag-suggestions'),
  mine: $('mine'), source: $('source'), author: $('author'), description: $('description'),
  error: $('error'), save: $('save'), dup: $('dup'), dupSlug: $('dup-slug'), dupImg: $('dup-img'),
  dupAllow: $('dup-allow'), toast: $('toast'), drop: $('drop'),
};

const MINE_AUTHOR = 'Alvaro';
const MINE_SOURCE = 'original';
const REMEMBERED = ['category', 'language', 'source', 'author'];

let state = { inbox: [], slugs: [], tags: [] };
let current = null; // inbox file name being edited
let tags = [];

// Per-viewer convenience only: the form still works if storage is unavailable.
const remember = {
  get(key) { try { return localStorage.getItem(`memento-admin:${key}`) ?? ''; } catch { return ''; } },
  set(key, value) { try { localStorage.setItem(`memento-admin:${key}`, value); } catch { /* ignore */ } },
};

async function api(path, options) {
  const res = await fetch(path, options);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status, body });
  return body;
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.hidden = false;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (els.toast.hidden = true), 2500);
}

function fillDatalist(id, items) {
  $(id).replaceChildren(...items.map(({ value }) => Object.assign(document.createElement('option'), { value })));
}

async function refresh(select) {
  state = await api('/api/state');
  fillDatalist('categories', state.categories);
  fillDatalist('languages', state.languages);
  fillDatalist('sources', state.sources);
  fillDatalist('authors', state.authors);
  fillDatalist('tag-list', state.tags);
  renderQueue();
  const names = state.inbox.map((f) => f.name);
  const next = names.includes(select) ? select : names.includes(current) ? current : names[0] ?? null;
  openFile(next);
}

function renderQueue() {
  els.inboxCount.textContent = state.inbox.length ? `(${state.inbox.length})` : '';
  els.queue.replaceChildren(...state.inbox.map((file) => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-current', String(file.name === current));
    const img = Object.assign(document.createElement('img'), { src: `/api/inbox/${encodeURIComponent(file.name)}`, alt: '' });
    const name = Object.assign(document.createElement('span'), { className: 'name', textContent: file.name });
    button.append(img, name);
    if (file.duplicateOf) button.append(Object.assign(document.createElement('span'), { className: 'badge', textContent: 'dup' }));
    button.addEventListener('click', () => openFile(file.name));
    li.append(button);
    return li;
  }));
}

function openFile(name) {
  current = name;
  els.editor.hidden = !name;
  els.empty.hidden = !!name;
  for (const b of els.queue.querySelectorAll('button')) {
    b.setAttribute('aria-current', String(b.querySelector('.name')?.textContent === name));
  }
  if (!name) return;

  const file = state.inbox.find((f) => f.name === name);
  els.preview.src = `/api/inbox/${encodeURIComponent(name)}`;
  els.form.reset();
  els.slug.hidden = true;
  els.slugEdit.hidden = false;
  els.error.hidden = true;
  tags = [];
  renderTags();
  for (const key of REMEMBERED) els[key].value = remember.get(key);

  els.dup.hidden = !file.duplicateOf;
  els.dupAllow.checked = false;
  if (file.duplicateOf) {
    els.dupSlug.textContent = file.duplicateOf;
    els.dupImg.src = `/api/meme/${encodeURIComponent(file.duplicateOf)}`;
  }
  updateSlug();
  els.caption.focus();
}

function currentSlug() {
  return els.slug.hidden ? uniqueSlug(slugify(els.caption.value), state.slugs) : els.slug.value;
}

function updateSlug() {
  if (els.slug.hidden) els.slugPreview.textContent = currentSlug();
}

function renderTags() {
  els.chips.querySelectorAll('.chip').forEach((c) => c.remove());
  for (const tag of tags) {
    const chip = Object.assign(document.createElement('span'), { className: 'chip', textContent: tag });
    const remove = Object.assign(document.createElement('button'), { type: 'button', textContent: '×' });
    remove.setAttribute('aria-label', `Remove tag ${tag}`);
    remove.addEventListener('click', () => { tags = tags.filter((t) => t !== tag); renderTags(); });
    chip.append(remove);
    els.chips.insertBefore(chip, els.tagInput);
  }
  const typed = els.tagInput.value.trim().toLowerCase();
  const suggestions = state.tags.filter(({ value }) => !tags.includes(value) && value.includes(typed)).slice(0, 8);
  els.suggestions.replaceChildren(...suggestions.map(({ value, count }) => {
    const li = document.createElement('li');
    const b = Object.assign(document.createElement('button'), { type: 'button', textContent: `${value} · ${count}` });
    b.addEventListener('click', () => { addTag(value); els.tagInput.focus(); });
    li.append(b);
    return li;
  }));
}

function addTag(raw) {
  const tag = raw.trim().toLowerCase();
  if (tag && !tags.includes(tag)) tags.push(tag);
  els.tagInput.value = '';
  renderTags();
}

els.tagInput.addEventListener('input', () => {
  if (els.tagInput.value.includes(',')) {
    els.tagInput.value.split(',').forEach(addTag);
  } else {
    renderTags();
  }
});
els.tagInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && els.tagInput.value.trim()) { e.preventDefault(); addTag(els.tagInput.value); }
  if (e.key === 'Backspace' && !els.tagInput.value && tags.length) { tags.pop(); renderTags(); }
});

els.caption.addEventListener('input', updateSlug);
els.slugEdit.addEventListener('click', () => {
  els.slug.value = currentSlug();
  els.slug.hidden = false;
  els.slugEdit.hidden = true;
  els.slug.focus();
});
els.mine.addEventListener('change', () => {
  if (els.mine.checked) {
    els.author.value = MINE_AUTHOR;
    els.source.value = MINE_SOURCE;
  }
});

function formData() {
  if (els.tagInput.value.trim()) addTag(els.tagInput.value);
  return {
    caption: els.caption.value, category: els.category.value, language: els.language.value,
    tags, source: els.source.value, author: els.author.value,
    description: els.description.value, mine: els.mine.checked,
  };
}

function markInvalid(fields) {
  for (const key of ['caption', 'source', 'author']) els[key].classList.toggle('invalid', fields.includes(key));
}

async function saveCurrent() {
  if (!current || els.save.disabled) return;
  const meta = formData();
  const missing = ['caption', 'source', 'author'].filter((k) => !meta[k].trim());
  markInvalid(missing);
  if (missing.length) {
    els.error.textContent = `Required: ${missing.join(', ')}`;
    els.error.hidden = false;
    els[missing[0]].focus();
    return;
  }
  els.error.hidden = true;
  els.save.disabled = true;
  try {
    const body = { inboxFile: current, meta, allowDuplicate: els.dupAllow.checked };
    if (!els.slug.hidden) body.slug = els.slug.value;
    const { slug } = await api('/api/memes', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    for (const key of REMEMBERED) remember.set(key, els[key].value);
    toast(`Saved memes/${slug}`);
    current = null;
    await refresh();
  } catch (err) {
    els.error.textContent = err.message;
    els.error.hidden = false;
  } finally {
    els.save.disabled = false;
  }
}

els.form.addEventListener('submit', (e) => { e.preventDefault(); saveCurrent(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); saveCurrent(); }
});

$('skip').addEventListener('click', () => {
  const names = state.inbox.map((f) => f.name);
  if (names.length > 1) openFile(names[(names.indexOf(current) + 1) % names.length]);
});

$('discard').addEventListener('click', async () => {
  if (!current || !confirm(`Delete ${current} from the inbox?`)) return;
  try {
    await api(`/api/inbox/${encodeURIComponent(current)}`, { method: 'DELETE' });
    current = null;
    await refresh();
  } catch (err) {
    els.error.textContent = err.message;
    els.error.hidden = false;
  }
});

$('check').addEventListener('click', async () => {
  const out = $('check-result');
  out.className = '';
  out.textContent = 'Checking...';
  try {
    const result = await api('/api/check', { method: 'POST' });
    out.className = result.ok ? 'ok' : 'fail';
    out.textContent = result.ok ? `OK: ${result.count} memes valid` : result.errors.join(' | ');
  } catch (err) {
    out.className = 'fail';
    out.textContent = err.message;
  }
});

// ---- Intake: drop, paste, picker --------------------------------------------------------------

async function upload(files) {
  const images = [...files].filter((f) => f.type.startsWith('image/'));
  if (!images.length) return toast('No image found');
  let first = null;
  for (const file of images) {
    try {
      const res = await api('/api/inbox', { method: 'POST', headers: { 'X-Filename': encodeURIComponent(file.name || 'pasted') }, body: file });
      first ??= res.name;
    } catch (err) {
      toast(`${file.name}: ${err.message}`);
    }
  }
  if (first) await refresh(first);
}

let dragDepth = 0;
addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; els.drop.hidden = false; });
addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; els.drop.hidden = true; } });
addEventListener('dragover', (e) => e.preventDefault());
addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  els.drop.hidden = true;
  upload(e.dataTransfer.files);
});
addEventListener('paste', (e) => {
  if (e.clipboardData.files.length) { e.preventDefault(); upload(e.clipboardData.files); }
});
$('picker').addEventListener('change', (e) => { upload(e.target.files); e.target.value = ''; });

refresh().catch((err) => toast(err.message));
