import { test, expect } from '@playwright/test';

// Content-driven: expectations come from index.json, so they hold whatever is in memes/.
let index;

test.beforeAll(async ({ request }) => {
  index = await (await request.get('/meme/generated/index.json')).json();
});

const ready = (page) => expect(page.locator('body')).toHaveAttribute('data-search', 'ready');
const focusedSlug = (page) => page.evaluate(() => document.activeElement?.dataset?.slug ?? null);
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
    await expect(page.locator('.card[tabindex="0"]')).toHaveCount(1);
    await expect(page.locator('.card[tabindex="-1"]')).toHaveCount(index.length - 1);
  });

  test('arrow down from the search box focuses a card, with a sharp 2px ring', async ({ page }) => {
    await page.keyboard.press('/');
    await page.keyboard.press('ArrowDown');
    const slug = await focusedSlug(page);
    expect(slug).not.toBeNull();

    const ring = await page.locator(`.card[data-slug="${slug}"]`).evaluate((el) => {
      const s = getComputedStyle(el);
      return { style: s.outlineStyle, width: s.outlineWidth, color: s.outlineColor, offset: s.outlineOffset };
    });
    expect(ring).toEqual({ style: 'solid', width: '2px', color: 'rgb(255, 87, 34)', offset: '2px' });
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

    const rings = await page.locator('.card').evaluateAll((cards) =>
      cards.filter((c) => getComputedStyle(c).outlineStyle === 'solid').length);
    expect(rings).toBe(1);
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

  test('Tab still reaches the buttons inside a focused card, and arrows do not hijack them', async ({ page }) => {
    await page.keyboard.press('/');
    await page.keyboard.press('ArrowDown');
    const slug = await focusedSlug(page);
    await page.keyboard.press('Tab'); // the picture button
    await page.keyboard.press('Tab'); // first tag pill (or the copy button)
    const inside = await page.evaluate(() => document.activeElement.closest('.card')?.dataset.slug);
    expect(inside).toBe(slug);

    await page.locator(`.card[data-slug="${slug}"] button.copy`).focus();
    await page.keyboard.press('ArrowRight');
    expect(await page.evaluate(() => document.activeElement.classList.contains('copy'))).toBe(true);
  });

  test('filtering keeps exactly one card reachable with Tab', async ({ page }) => {
    const counts = new Map();
    for (const m of index) for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    const tag = [...counts].find(([, n]) => n < index.length)?.[0];
    test.skip(!tag, 'every meme shares every tag right now');

    await page.keyboard.press('ArrowDown'); // page scroll, not a card: nothing focused yet
    await page.locator(`.topics button.tag[data-tag="${tag}"]`).click();
    await expect(page.locator('.card:not([hidden])[tabindex="0"]')).toHaveCount(1);
    await expect(page.locator('.card[hidden][tabindex="0"]')).toHaveCount(0);
  });

  test('a mouse click does not draw the keyboard ring', async ({ page }) => {
    const card = page.locator('.card').first();
    await card.locator('.caption').click();
    const style = await card.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(style).toBe('none');
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
