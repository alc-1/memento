import { test, expect } from '@playwright/test';

// Content-driven: expectations come from index.json, so they hold whatever is in memes/.
let index;

test.beforeAll(async ({ request }) => {
  index = await (await request.get('/meme/generated/index.json')).json();
});

test.beforeEach(async ({ page }) => {
  await page.goto('/meme/');
  // Lazy images only get their final box once loaded; scroll through so every card is settled.
  for (const img of await page.locator('.card img').all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});

test('every image is shown whole: displayed ratio matches the image ratio', async ({ page }) => {
  const boxes = await page.locator('.card .view img').evaluateAll((imgs) =>
    imgs.map((img) => {
      const r = img.getBoundingClientRect();
      return {
        slug: img.closest('.card').dataset.slug,
        shown: r.width / r.height,
        natural: img.naturalWidth / img.naturalHeight,
        fit: getComputedStyle(img).objectFit,
      };
    }),
  );
  for (const b of boxes) {
    expect(Math.abs(b.shown - b.natural) / b.natural, `${b.slug} is not stretched or cropped`).toBeLessThan(0.02);
    expect(b.fit).not.toBe('cover');
  }
});

test('the width and height attributes match the real thumbnail, so no layout shift', async ({ page }) => {
  for (const m of index) {
    const img = page.locator(`.card[data-slug="${m.slug}"] .view img`);
    await expect(img).toHaveAttribute('width', String(m.thumbWidth));
    await expect(img).toHaveAttribute('height', String(m.thumbHeight));
    const natural = await img.evaluate((el) => [el.naturalWidth, el.naturalHeight]);
    expect(natural, `${m.slug} dimensions in index.json`).toEqual([m.thumbWidth, m.thumbHeight]);
  }
});

test('cards keep their own height and never overlap', async ({ page }) => {
  const rects = await page.locator('.card').evaluateAll((cards) =>
    cards.map((c) => {
      const r = c.getBoundingClientRect();
      return { slug: c.dataset.slug, left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY };
    }),
  );
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i];
      const b = rects[j];
      const overlap = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
      expect(overlap, `${a.slug} and ${b.slug} overlap`).toBe(false);
    }
  }
  // Masonry, not equal-height rows: with different image ratios the card heights differ.
  const heights = new Set(rects.map((r) => Math.round(r.bottom - r.top)));
  expect(heights.size).toBeGreaterThan(1);
});

test('action buttons get a clearly different hover state', async ({ page }) => {
  const button = page.locator('.card button.act.info').first();
  await button.scrollIntoViewIfNeeded();
  const read = () =>
    button.evaluate((el) => {
      const s = getComputedStyle(el);
      return { bg: s.backgroundColor, border: s.borderTopColor, shadow: s.boxShadow, transform: s.transform };
    });

  const before = await read();
  await button.hover();
  await expect.poll(async () => (await read()).bg).not.toBe(before.bg);
  const after = await read();
  expect(after.border).not.toBe(before.border);
  expect(before.shadow).toBe('none');
  expect(after.shadow).not.toBe('none');
  // Elevation: lifts up unless the visitor prefers reduced motion (the tests run with the default).
  expect(after.transform).not.toBe('none');
});

test('keyboard focus on an action button is clearly visible', async ({ page }) => {
  const button = page.locator('.card button.act.copy').first();
  await button.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(button).toBeFocused();
  const outline = await button.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});
