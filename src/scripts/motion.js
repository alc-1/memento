// Gentle, minimal scrolling for keyboard-driven focus changes.
// focus() on its own scrolls instantly, which reads as a jump (and can cause motion sickness).
// These helpers scroll only when the target is not already comfortably in view, only as far as
// needed, and glide unless the visitor asked for reduced motion.

const MARGIN = 24;

const behavior = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/** Scroll just enough to bring `el` into view with a small margin. Nothing if it is already there. */
export function revealSmooth(el) {
  const rect = el.getBoundingClientRect();
  const height = innerHeight;
  let delta = 0;

  if (rect.height > height - 2 * MARGIN) {
    // Taller than the screen: line its top up, unless the top is already near the edge.
    if (rect.top < 0 || rect.top > 2 * MARGIN) delta = rect.top - MARGIN;
  } else if (rect.top < MARGIN) {
    delta = rect.top - MARGIN;
  } else if (rect.bottom > height - MARGIN) {
    delta = rect.bottom - (height - MARGIN);
  }
  if (delta) scrollBy({ top: delta, behavior: behavior() });
}

/** Move focus without the browser's instant jump, then glide the target into view. */
export function focusSmooth(el) {
  el.focus({ preventScroll: true });
  revealSmooth(el.closest('.card') ?? el);
}

/** Glide so that `el` sits near the top of the screen. */
export function scrollToSmooth(el) {
  scrollBy({ top: el.getBoundingClientRect().top - MARGIN, behavior: behavior() });
}
