// Keyboard navigation across the masonry grid.
// The cards form one tab stop (roving tabindex); arrow keys move between them by position,
// Enter or Space opens the large view, and arrow up from the first row returns to the search box.

const grid = document.querySelector('.grid');
const search = document.getElementById('q');

const visibleCards = () => [...grid.children].filter((card) => !card.hidden);

/** Exactly one visible card is reachable with Tab: the given one, else the current one, else the first. */
function syncRoving(preferred) {
  const visible = visibleCards();
  const current = preferred && !preferred.hidden ? preferred : visible.find((c) => c.tabIndex === 0) ?? visible[0];
  for (const card of grid.children) card.tabIndex = card === current ? 0 : -1;
}

/** Nearest card in the arrow's direction. Columns are different heights, so "next" is decided by geometry. */
function neighbor(card, key) {
  const r = card.getBoundingClientRect();
  const cx = (r.left + r.right) / 2;
  const cy = (r.top + r.bottom) / 2;
  let best = null;
  let bestScore = Infinity;

  for (const other of visibleCards()) {
    if (other === card) continue;
    const o = other.getBoundingClientRect();
    const ox = (o.left + o.right) / 2;
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

function focusCard(card) {
  card.focus();
}

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
    const first = visibleCards().find((c) => c.tabIndex === 0) ?? visibleCards()[0];
    if (first) {
      event.preventDefault();
      focusCard(first);
    }
    return;
  }

  // Only react on the card itself or its picture button, never inside the action buttons or dialogs.
  const onCard = target.classList?.contains('card');
  if (!onCard && !target.matches?.('button.view')) return;
  const card = target.closest('.card');
  if (!card || !grid.contains(card)) return;

  if (event.key.startsWith('Arrow')) {
    const next = neighbor(card, event.key);
    if (next) {
      event.preventDefault();
      focusCard(next);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      search.focus();
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
