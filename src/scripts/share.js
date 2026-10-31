import { flash } from './copy.js';
import { hasFinePointer } from './screen.js';

/** Touch devices get the system share sheet; computers get the link on the clipboard. */
async function share(button) {
  const url = new URL(button.dataset.share, location.href).href;
  const title = button.closest('.card').querySelector('.caption').textContent;

  if (!hasFinePointer() && navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return; // the person closed the sheet
      // Anything else: fall through to the clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    flash(button, 'Link copied', true);
  } catch (err) {
    console.error('Share failed', err);
    flash(button, 'Copy failed', false);
  }
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('button.share');
  if (button) share(button);
});
