import { isKnownAuthor } from './author.js';
import { copyFromButton } from './copy.js';
import { isSmallScreen, onScreenSizeChange } from './screen.js';

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

function row(label, value, className = '') {
  if (value === null || value === undefined || value === '') return [];
  const dd = document.createElement('dd');
  dd.className = className;
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
  viewerCaption.textContent = isKnownAuthor(meme.author) ? `${meme.caption} · by ${meme.author}` : meme.caption;
  viewer.showModal();
}

function openInfo(meme) {
  infoTitle.textContent = meme.caption;
  infoList.replaceChildren(
    ...row('Author', isKnownAuthor(meme.author) ? meme.author : ''),
    ...row('Source', sourceValue(meme.source), 'source'),
    ...row('Category', meme.category),
    ...row('Language', meme.language),
    ...row('Tags', meme.tags.join(', ')),
    ...row('Description', meme.description),
    ...row('Mine', meme.mine ? 'Yes, an original creation' : ''),
    ...row('Type', meme.animated ? 'Animated GIF' : ''),
  );
  infoDialog.showModal();
}

/**
 * On a small screen a zoomed frame adds nothing, so tapping the picture copies it, like the Copy
 * button. The label tells assistive technology which of the two the picture does right now.
 */
function syncPictureAction() {
  const copies = isSmallScreen();
  for (const button of document.querySelectorAll('button.view')) {
    const card = button.closest('.card');
    const meme = memes.get(card.dataset.slug);
    if (copies) {
      button.setAttribute('aria-label', `${meme.animated ? 'Copy link to' : 'Copy meme'}: ${meme.caption}`);
      button.removeAttribute('aria-haspopup');
    } else {
      button.setAttribute('aria-label', `View larger: ${meme.caption}`);
      button.setAttribute('aria-haspopup', 'dialog');
    }
  }
}
syncPictureAction();
onScreenSizeChange(syncPictureAction);

document.addEventListener('click', (event) => {
  const card = event.target.closest('.card');
  if (!card) return;
  const meme = memes.get(card.dataset.slug);
  if (event.target.closest('button.view')) {
    if (isSmallScreen()) copyFromButton(card.querySelector('button.copy'));
    else openViewer(meme);
  } else if (event.target.closest('button.info')) openInfo(meme);
});

// Clicking the backdrop (the dialog element itself, outside its content) closes it.
for (const dialog of [viewer, infoDialog]) {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}
viewer.addEventListener('close', () => viewerImg.removeAttribute('src'));
