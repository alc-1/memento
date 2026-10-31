// Keyboard navigation across the masonry grid.
//
// Each card is an <article class="card-focus"> inside its <li class="card">. Only the current card
// is a Tab stop, together with its own buttons and links (roving tabindex): Tab goes search, filters,
// topics, the current card and its controls, then leaves the grid. Arrow keys, pressed on a card or
// on any control inside it, move to the nearest card in that direction (Home and End jump to the
// ends, arrow up from the first row returns to the search box). Enter or Space on a focused card
// opens the large view. Focus changes glide instead of jumping (see motion.js).

import { focusSmooth } from './motion.js';

const grid = document.querySelector('.grid');
const search = document.getElementById('q');

const visibleCards = () => [...grid.children].filter((card) => !card.hidden);
const focusTarget = (card) => card.querySelector(':scope > .card-focus');

let currentCard = null;

/** Exactly one visible card (and its controls) is reachable with Tab: the given one, else the current one, else the first. */
function syncRoving(preferred) {
  const visible = visibleCards();
  currentCard =
    preferred && !preferred.hidden ? preferred : currentCard && !currentCard.hidden ? currentCard : visible[0] ?? null;

  for (const card of grid.children) {
    const tabIndex = card === currentCard ? 0 : -1;
    focusTarget(card).tabIndex = tabIndex;
    for (const control of card.querySelectorAll('button, a[href]')) control.tabIndex = tabIndex;
  }
}

/** Nearest card in the arrow's direction. Columns are different heights, so "next" is decided by geometry. */
function neighbor(card, key) {
  const r = card.getBoundingClientRect();
  const cy = (r.top + r.bottom) / 2;
  let best = null;
  let bestScore = Infinity;

  for (const other of visibleCards()) {
    if (other === card) continue;
    const o = other.getBoundingClientRect();
    const oy = (o.top + o.bottom) / 2;
    const sameColumn = o.left < r.right - 1 && o.right > r.left + 1;
    let score = null;

    if (key === 'ArrowDown' && sameColumn && o.top >= r.bottom - 1) score = o.top - r.bottom;
    else if (key === 'ArrowUp' && sameColumn && o.bottom <= r.top + 1) score = r.top - o.bottom;
    else if (key === 'ArrowRight' && o.left >= r.right - 1) score = (o.left - r.right) * 4 + Math.abs(oy - cy);
    else if (key === 'ArrowLeft' && o.right <= r.left + 1) score = (r.left - o.right) * 4 + Math.abs(oy - cy);

    if (score !== null && score < bestScore) {
      best = other;
      bestScore = score;
    }
  }
  return best;
}

const focusCard = (card) => focusSmooth(focusTarget(card));

grid.addEventListener('focusin', (event) => {
  const card = event.target.closest('.card');
  if (card) syncRoving(card);
});

// Filtering hides and reorders cards: keep the tab stop on a card that is still there.
new MutationObserver(() => syncRoving()).observe(grid, {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['hidden'],
});
syncRoving();

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  const target = event.target;

  // From the search box, arrow down drops into the grid.
  if (target === search && event.key === 'ArrowDown') {
    const first = currentCard && !currentCard.hidden ? currentCard : visibleCards()[0];
    if (first) {
      event.preventDefault();
      focusCard(first);
    }
    return;
  }

  // Only react when focus is already on a card or on a control inside one (never in dialogs or fields).
  const onCard = target.classList?.contains('card-focus');
  if (!onCard && !target.matches?.('button, a[href]')) return;
  const card = target.closest('.card');
  if (!card || !grid.contains(card)) return;

  if (event.key.startsWith('Arrow')) {
    const next = neighbor(card, event.key);
    if (next) {
      event.preventDefault();
      focusCard(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusSmooth(search);
    }
  } else if (event.key === 'Home' || event.key === 'End') {
    const cards = visibleCards();
    event.preventDefault();
    focusCard(event.key === 'Home' ? cards[0] : cards[cards.length - 1]);
  } else if (onCard && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    card.querySelector('button.view').click();
  }
});
