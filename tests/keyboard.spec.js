import { test, expect } from '@playwright/test';

// Content-driven: expectations come from index.json, so they hold whatever is in memes/.
let index;

test.beforeAll(async ({ request }) => {
  index = await (await request.get('/meme/generated/index.json')).json();
});

const ready = (page) => expect(page.locator('body')).toHaveAttribute('data-search', 'ready');
const focusedSlug = (page) => page.evaluate(() => document.activeElement?.closest?.('.card')?.dataset?.slug ?? null);
const RING = 'rgb(255, 87, 34)';
const rectOf = (page, slug) =>
  page.locator(`.card[data-slug="${slug}"]`).evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { left: r.left, right: r.right, top: r.top + scrollY, bottom: r.bottom + scrollY };
  });

test.describe('arrow-key navigation', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard navigation is a desktop feature');

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/meme/');
    await ready(page);
  });

  test('the cards are a single tab stop', async ({ page }) => {
    await expect(page.locator('.card-focus[tabindex="0"]')).toHaveCount(1);
    await expect(page.locator('.card-focus[tabindex="-1"]')).toHaveCount(index.length - 1);
  });

  test('arrow down from the search box focuses a card, with a sharp 2px ring', async ({ page }) => {
    await page.keyboard.press('/');
    await page.keyboard.press('ArrowDown');
    const slug = await focusedSlug(page);
    expect(slug).not.toBeNull();

    // The ring eases in (colour and offset transition), so wait for it to settle.
    const ring = () => page.locator(`.card[data-slug="${slug}"]`).evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor, offset: s.outlineOffset };
    });
    await expect.poll(ring).toEqual({ style: 'solid', width: '2px', color: RING, offset: '2px' });
  });

  test('arrows move across and down the columns, and only one card has the ring', async ({ page }) => {
    await page.keyboard.press('/');
    await page.keyboard.press('ArrowDown');
    const start = await focusedSlug(page);
    const a = await rectOf(page, start);

    await page.keyboard.press('ArrowRight');
    const right = await focusedSlug(page);
    expect(right).not.toBe(start);
    expect((await rectOf(page, right)).left, 'moved to the next column').toBeGreaterThan(a.right - 2);

    await page.keyboard.press('ArrowLeft');
    expect(await focusedSlug(page)).toBe(start);

    await page.keyboard.press('ArrowDown');
    const below = await focusedSlug(page);
    expect(below).not.toBe(start);
    const b = await rectOf(page, below);
    expect(b.top, 'moved down inside the same column').toBeGreaterThanOrEqual(a.bottom - 2);
    expect(Math.abs(b.left - a.left)).toBeLessThan(2);

    await page.keyboard.press('ArrowUp');
    expect(await focusedSlug(page)).toBe(start);

    const rings = () => page.locator('.card').evaluateAll((cards, color) =>
      cards.filter((c) => getComputedStyle(c).outlineColor === color).length, RING);
    await expect.poll(rings).toBe(1);
  });

  test('arrow up from the first row returns to the search box; Home and End jump to the ends', async ({ page }) => {
    await page.keyboard.press('/');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await expect(page.locator('#q')).toBeFocused();

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('End');
    expect(await focusedSlug(page)).toBe(index[index.length - 1].slug);
    await page.keyboard.press('Home');
    expect(await focusedSlug(page)).toBe(index[0].slug);
  });

  test('Enter opens the large view of the focused card, Escape gives focus back', async ({ page }) => {
    await page.keyboard.press('/');
    await page.keyboard.press('ArrowDown');
    const slug = await focusedSlug(page);
    const meme = index.find((m) => m.slug === slug);

    await page.keyboard.press('Enter');
    await expect(page.locator('#viewer')).toBeVisible();
    await expect(page.locator('#viewer')).toContainText(meme.caption);
    await page.keyboard.press('Escape');
    await expect(page.locator('#viewer')).toBeHidden();
  });

  test('arrows pressed on a control inside a card move like they do from the card', async ({ page }) => {
    await page.keyboard.press('/');
    await page.keyboard.press('ArrowDown');
    const start = await focusedSlug(page);

    await page.keyboard.press('ArrowRight');
    const neighbour = await focusedSlug(page);
    await page.keyboard.press('ArrowLeft');
    expect(await focusedSlug(page)).toBe(start);

    // Tab onto a control inside the card (the picture button), then use the arrow.
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.matches('button.view'))).toBe(true);
    await page.keyboard.press('ArrowRight');
    expect(await focusedSlug(page)).toBe(neighbour);

    // Same from the Copy button.
    await page.keyboard.press('ArrowLeft');
    await page.locator(`.card[data-slug="${start}"] button.copy`).focus();
    await page.keyboard.press('ArrowRight');
    expect(await focusedSlug(page)).toBe(neighbour);
  });

  test('filtering keeps exactly one card reachable with Tab', async ({ page }) => {
    const counts = new Map();
    for (const m of index) for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    const tag = [...counts].find(([, n]) => n < index.length)?.[0];
    test.skip(!tag, 'every meme shares every tag right now');

    await page.keyboard.press('ArrowDown'); // page scroll, not a card: nothing focused yet
    await page.locator(`.topics button.tag[data-tag="${tag}"]`).click();
    await expect(page.locator('.card:not([hidden]) > .card-focus[tabindex="0"]')).toHaveCount(1);
    await expect(page.locator('.card[hidden] > .card-focus[tabindex="0"]')).toHaveCount(0);
    // Its controls follow the same rule: only the current card's are tabbable.
    const tabbable = await page.locator('.card').evaluateAll((cards) =>
      cards.filter((c) => [...c.querySelectorAll('button, a[href]')].some((el) => el.tabIndex >= 0)).length);
    expect(tabbable).toBe(1);
  });

  test('a mouse click does not draw the keyboard ring', async ({ page }) => {
    const card = page.locator('.card').first();
    await card.locator('.caption').click();
    await page.waitForTimeout(300); // longer than the ring's ease-in
    const color = await card.evaluate((el) => getComputedStyle(el).outlineColor);
    expect(color).toBe('rgba(0, 0, 0, 0)');
  });
});

test.describe('monospace is reserved for counts, keyboard hints and source attributions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/meme/');
    await ready(page);
  });

  const family = (locator) => locator.first().evaluate((el) => getComputedStyle(el).fontFamily);
  const MONO = /JetBrains Mono.*Fira Code.*monospace/;

  test('tag counts, the keycap and the author attribution use the mono stack', async ({ page }) => {
    expect(await family(page.locator('.topics .tag .count'))).toMatch(MONO);
    expect(await family(page.locator('.shortcut'))).toMatch(MONO);
    const credited = index.find((m) => m.author.trim().toLowerCase() !== 'unknown');
    test.skip(!credited, 'every author is Unknown right now');
    expect(await family(page.locator(`.card[data-slug="${credited.slug}"] .credit`))).toMatch(MONO);
  });

  test('the Source row in the info dialog is monospace', async ({ page }) => {
    await page.locator('.card button.info').first().click();
    expect(await family(page.locator('#info-dialog dd.source'))).toMatch(MONO);
  });

  test('everything else keeps the regular font', async ({ page }) => {
    for (const selector of ['.caption', '.card .tag', '#info-title', 'header p', '.act']) {
      expect(await family(page.locator(selector)), selector).not.toMatch(/JetBrains|Fira Code/);
    }
  });

  test('the shortcut hint is a keycap element', async ({ page }) => {
    await expect(page.locator('kbd.shortcut')).toHaveText('/');
    await expect(page.locator('#q')).toHaveAttribute('aria-keyshortcuts', '/');
  });
});

test.describe('tab stops and card semantics', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard navigation is a desktop feature');

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/meme/');
    await ready(page);
  });

  test('only the current card and its own controls are tabbable', async ({ page }) => {
    const owners = () =>
      page.locator('.card').evaluateAll((cards) =>
        cards
          .filter((c) => [...c.querySelectorAll('button, a[href]')].some((el) => el.tabIndex >= 0))
          .map((c) => c.dataset.slug));

    const first = await owners();
    expect(first).toHaveLength(1);
    const controls = await page.locator(`.card[data-slug="${first[0]}"] :is(button, a[href])`).count();
    const tabbableInside = await page.locator(`.card[data-slug="${first[0]}"] :is(button, a[href])`)
      .evaluateAll((els) => els.filter((el) => el.tabIndex >= 0).length);
    expect(tabbableInside).toBe(controls);

    // The roving stop follows focus.
    await page.keyboard.press('/');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowRight');
    const moved = await focusedSlug(page);
    expect(await owners()).toEqual([moved]);
  });

  test('Tab walks through the current card, then leaves the grid', async ({ page }) => {
    await page.keyboard.press('/');
    await page.keyboard.press('ArrowDown');
    const slug = await focusedSlug(page);
    const controls = await page.locator(`.card[data-slug="${slug}"] :is(button, a[href])`).count();

    for (let i = 0; i < controls; i++) {
      await page.keyboard.press('Tab');
      expect(await focusedSlug(page), `control ${i + 1} belongs to the card`).toBe(slug);
    }
    await page.keyboard.press('Tab');
    expect(await page.evaluate(() => document.activeElement.closest('.grid'))).toBeNull();

    // And back in with Shift+Tab, to the same card's last control.
    await page.keyboard.press('Shift+Tab');
    expect(await focusedSlug(page)).toBe(slug);
  });

  test('the grid is a real list of articles, each named by its caption', async ({ page }) => {
    expect(await page.locator('ul.grid > :not(li)').count()).toBe(0);
    await expect(page.locator('ul.grid > li.card')).toHaveCount(index.length);
    await expect(page.getByRole('article')).toHaveCount(index.length);

    for (const m of index) {
      const card = page.locator(`.card[data-slug="${m.slug}"]`);
      await expect(card.locator(':scope > article.card-focus')).toHaveCount(1);
      await expect(card).not.toHaveAttribute('tabindex', /.*/);
      await expect(card).not.toHaveAttribute('aria-label', /.*/);
      const labelled = await card.locator('article').evaluate((el) =>
        document.getElementById(el.getAttribute('aria-labelledby'))?.textContent);
      expect(labelled, `${m.slug} is named by its caption`).toBe(m.caption);
    }
    // The accessibility tree agrees: an article whose name is the caption.
    await expect(page.getByRole('article', { name: index[0].caption, exact: true })).toHaveCount(1);
  });
});

test.describe('smooth, minimal motion', () => {
  test.skip(({ isMobile }) => isMobile, 'keyboard navigation is a desktop feature');

  // Samples scrollY on every animation frame for a while, returns the distinct values in order.
  const sampleScroll = (page, ms) =>
    page.evaluate(
      (duration) =>
        new Promise((resolve) => {
          const seen = [];
          const start = performance.now();
          const tick = () => {
            if (seen[seen.length - 1] !== scrollY) seen.push(scrollY);
            if (performance.now() - start < duration) requestAnimationFrame(tick);
            else resolve(seen);
          };
          tick();
        }),
      ms,
    );

  const inView = (page, slug) =>
    page.locator(`.card[data-slug="${slug}"]`).evaluate((el) => {
      const r = el.getBoundingClientRect();
      return r.top >= 0 && r.bottom <= innerHeight;
    });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/meme/');
    await ready(page);
    await page.keyboard.press('/');
    await page.keyboard.press('ArrowDown');
  });

  test('a long move glides: scrollY passes through many intermediate values', async ({ page }) => {
    const sampling = sampleScroll(page, 1500);
    await page.keyboard.press('End');
    const seen = await sampling;
    const end = seen[seen.length - 1];
    expect(end, 'it did scroll').toBeGreaterThan(seen[0] + 200);
    const between = seen.filter((y) => y > seen[0] && y < end);
    expect(between.length, `frames between start and end: ${between.length}`).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]); // no overshoot
    expect(await inView(page, index[index.length - 1].slug)).toBe(true);
  });

  test('with reduced motion the same move is instant, but still minimal', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const sampling = sampleScroll(page, 800);
    await page.keyboard.press('End');
    const seen = await sampling;
    expect(seen.filter((y) => y > seen[0] && y < seen[seen.length - 1]).length).toBeLessThanOrEqual(1);
    expect(await inView(page, index[index.length - 1].slug)).toBe(true);
  });

  test('moving to a card that is already in view does not scroll at all', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1400 }); // tall enough for the first row
    await page.evaluate(() => scrollTo(0, 0));
    const before = await page.evaluate(() => scrollY);
    await page.keyboard.press('ArrowRight');
    const seen = await sampleScroll(page, 500);
    expect(seen).toEqual([before]);
  });

  test('the focus ring eases in: it is not a sudden change of colour', async ({ page }) => {
    await page.keyboard.press('ArrowRight');
    const slug = await focusedSlug(page);
    const read = () => page.locator(`.card[data-slug="${slug}"]`).evaluate((el) => getComputedStyle(el).outlineColor);
    expect(await page.locator(`.card[data-slug="${slug}"]`).evaluate((el) => getComputedStyle(el).transitionProperty))
      .toContain('outline-color');
    await expect.poll(read).toBe(RING);
  });

  test('dialogs fade in unless motion is reduced', async ({ page }) => {
    await page.locator('.card button.info').first().click();
    const name = () => page.locator('#info-dialog').evaluate((el) => getComputedStyle(el).animationName);
    expect(await name()).toBe('dialog-in');
    await page.keyboard.press('Escape');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.card button.info').first().click();
    expect(await name()).toBe('none');
  });
});
