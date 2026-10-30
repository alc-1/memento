function flash(button, text, ok) {
  const badge = button.querySelector('.badge');
  badge.textContent = text;
  badge.dataset.state = ok ? 'ok' : 'error';
  clearTimeout(button._timer);
  button._timer = setTimeout(() => {
    badge.textContent = '';
    delete badge.dataset.state;
  }, 1800);
}

async function copyImage(url) {
  // Safari only allows clipboard writes inside the click gesture, so the ClipboardItem
  // is built synchronously with a promise for the blob instead of awaiting the fetch first.
  const blob = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.blob();
  });
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

async function copyLink(url) {
  await navigator.clipboard.writeText(new URL(url, location.href).href);
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button.copy');
  if (!button) return;
  const url = button.dataset.copy;
  const animated = button.dataset.animated === 'true';
  try {
    if (animated) {
      await copyLink(url);
      flash(button, 'Link copied', true);
    } else {
      await copyImage(url);
      flash(button, 'Copied!', true);
    }
  } catch (err) {
    console.error('Copy failed', err);
    flash(button, 'Copy failed', false);
  }
});
