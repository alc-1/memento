const memes = new Map(JSON.parse(document.getElementById('memes-data').textContent).map((m) => [m.slug, m]));
const base = import.meta.env.BASE_URL;

const viewer = document.getElementById('viewer');
const viewerImg = document.getElementById('viewer-img');
const viewerCaption = document.getElementById('viewer-caption');
const infoDialog = document.getElementById('info-dialog');
const infoTitle = document.getElementById('info-title');
const infoList = document.getElementById('info-list');

function text(tag, content) {
  return Object.assign(document.createElement(tag), { textContent: content });
}

function row(label, value) {
  if (value === null || value === undefined || value === '') return [];
  const dd = document.createElement('dd');
  dd.append(value); // a string or a link element
  return [text('dt', label), dd];
}

/** Sources are free text; only real http(s) URLs become links. */
function sourceValue(source) {
  if (!/^https?:\/\/\S+$/i.test(source)) return source;
  const a = text('a', source);
  a.href = source;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

function openViewer(meme) {
  viewerImg.src = `${base}${meme.full}`;
  viewerImg.alt = meme.caption;
  viewerCaption.textContent = `${meme.caption} · by ${meme.author}`;
  viewer.showModal();
}

function openInfo(meme) {
  infoTitle.textContent = meme.caption;
  infoList.replaceChildren(
    ...row('Author', meme.author),
    ...row('Source', sourceValue(meme.source)),
    ...row('Category', meme.category),
    ...row('Language', meme.language),
    ...row('Tags', meme.tags.join(', ')),
    ...row('Description', meme.description),
    ...row('Mine', meme.mine ? 'Yes, an original creation' : ''),
    ...row('Type', meme.animated ? 'Animated GIF' : ''),
  );
  infoDialog.showModal();
}

document.addEventListener('click', (event) => {
  const card = event.target.closest('.card');
  if (!card) return;
  const meme = memes.get(card.dataset.slug);
  if (event.target.closest('button.view')) openViewer(meme);
  else if (event.target.closest('button.info')) openInfo(meme);
});

// Clicking the backdrop (the dialog element itself, outside its content) closes it.
for (const dialog of [viewer, infoDialog]) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
viewer.addEventListener('close', () => viewerImg.removeAttribute('src'));
