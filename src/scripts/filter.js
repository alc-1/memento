import Fuse from 'fuse.js';
import { focusSmooth, scrollToSmooth } from './motion.js';
import { hasFinePointer } from './screen.js';

const grid = document.querySelector('.grid');
const cards = new Map([...grid.children].map((li) => [li.dataset.slug, li]));
const originalOrder = [...grid.children];
const input = document.getElementById('q');
const status = document.getElementById('status');
const none = document.getElementById('none');
const groups = [...document.querySelectorAll('.chips')];

const state = { q: '', category: '', language: '', tag: '' };
let memes = [];
let fuse = null;

function readUrl() {
  const params = new URLSearchParams(location.search);
  state.q = params.get('q') ?? '';
  state.category = params.get('category') ?? '';
  state.language = params.get('lang') ?? '';
  state.tag = params.get('tag') ?? '';
}

function writeUrl() {
  const params = new URLSearchParams();
  if (state.q) params.set('q', state.q);
  if (state.category) params.set('category', state.category);
  if (state.language) params.set('lang', state.language);
  if (state.tag) params.set('tag', state.tag);
  const query = params.toString();
  history.replaceState(null, '', location.pathname + (query ? `?${query}` : '') + location.hash);
}

function syncControls() {
  input.value = state.q;
  for (const group of groups) {
    const value = state[group.dataset.facet];
    for (const b of group.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset.value === value));
  }
  for (const b of document.querySelectorAll('button.tag')) b.setAttribute('aria-pressed', String(b.dataset.tag === state.tag));
}

function apply() {
  const q = state.q.trim();
  // With a query, results come back best match first; without one, the original order returns.
  let matches = q && fuse ? fuse.search(q).map((r) => r.item) : memes;
  matches = matches.filter(
    (m) =>
      (!state.category || m.category === state.category) &&
      (!state.language || m.language === state.language) &&
      (!state.tag || m.tags.includes(state.tag)),
  );
  const shown = new Set(matches.map((m) => m.slug));

  for (const [slug, card] of cards) card.hidden = !shown.has(slug);
  grid.append(...(q ? matches.map((m) => cards.get(m.slug)) : originalOrder));

  const filtering = q || state.category || state.language || state.tag;
  status.textContent = filtering ? `${state.tag ? `#${state.tag} · ` : ''}${matches.length} of ${memes.length} memes` : '';
  none.hidden = matches.length > 0;
  writeUrl();
}

input.addEventListener('input', () => { state.q = input.value; apply(); });

for (const group of groups) {
  group.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    state[group.dataset.facet] = button.dataset.value;
    syncControls();
    apply();
  });
}

// Tag pills (on cards and in the topics row) toggle one tag filter; clicking the active tag clears it.
document.addEventListener('click', (event) => {
  const pill = event.target.closest('button.tag');
  if (!pill) return;
  state.tag = state.tag === pill.dataset.tag ? '' : pill.dataset.tag;
  syncControls();
  apply();
  if (state.tag && document.querySelector('.controls').getBoundingClientRect().top < 0) {
    scrollToSmooth(document.querySelector('.controls'));
  }
});

// The CLEAR chip empties the search box only (filters and tags are cleared by the button in the empty state).
document.getElementById('clear-search').addEventListener('click', () => {
  state.q = '';
  input.value = '';
  apply();
  input.focus();
});

// The whole bar is a click target for the field: the "$" prompt and the padding focus it too.
document.querySelector('.search').addEventListener('click', (event) => {
  if (!event.target.closest('button')) input.focus();
});

document.getElementById('clear').addEventListener('click', () => {
  Object.assign(state, { q: '', category: '', language: '', tag: '' });
  syncControls();
  apply();
  focusSmooth(input);
});

document.addEventListener('keydown', (event) => {
  const typing = event.target.closest('input, textarea, select, [contenteditable]');
  if (event.key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    focusSmooth(input);
    input.select();
  }
  if (event.key === 'Escape' && event.target === input && input.value) {
    input.value = '';
    state.q = '';
    apply();
  }
});

// The index is the same file the build already publishes. Cards stay visible and copyable until it loads.
const base = import.meta.env.BASE_URL;
readUrl();
syncControls();
// On a computer the search box is where everything starts, so it has focus from the first moment.
// Not on touch devices: it would open the on-screen keyboard over the album.
if (hasFinePointer()) input.focus({ preventScroll: true });
try {
  memes = await (await fetch(`${base}generated/index.json`)).json();
  fuse = new Fuse(memes, {
    keys: [
      { name: 'caption', weight: 3 },
      { name: 'tags', weight: 2 },
      { name: 'author', weight: 1 },
      { name: 'description', weight: 1 },
    ],
    ignoreDiacritics: true,
    ignoreLocation: true,
    threshold: 0.3,
  });
  apply();
  document.body.dataset.search = 'ready';
} catch (err) {
  console.error('Search unavailable', err);
  status.textContent = 'Search is unavailable right now.';
}
