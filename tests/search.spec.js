import { test, expect } from '@playwright/test';

// Content-driven: expectations come from index.json, so they hold whatever is in memes/.
let index;

test.beforeAll(async ({ request }) => {
  index = await (await request.get('/meme/generated/index.json')).json();
});

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const visibleCards = (page) => page.locator('.card:not([hidden])');
const ready = (page) => expect(page.locator('body')).toHaveAttribute('data-search', 'ready');

test.beforeEach(async ({ page }) => {
  await page.goto('/meme/');
  await ready(page);
});

test('typing a caption finds that meme first', async ({ page }) => {
  const target = index[index.length - 1];
  await page.locator('#q').fill(target.caption);
  await expect(visibleCards(page).first().locator('.caption')).toHaveText(target.caption);
  await expect(page.locator('#status')).toContainText(`of ${index.length} memes`);
});

test('search ignores accents', async ({ page }) => {
  const accented = index.find((m) => strip(m.caption) !== m.caption);
  test.skip(!accented, 'no accented caption in memes/ right now');
  await page.locator('#q').fill(strip(accented.caption));
  await expect(visibleCards(page).first().locator('.caption')).toHaveText(accented.caption);
});

test('search matches tags', async ({ page }) => {
  const withTag = index.find((m) => m.tags.length);
  test.skip(!withTag, 'no tags in memes/ right now');
  const tag = withTag.tags[0];
  await page.locator('#q').fill(tag);
  const expected = index.filter((m) => m.tags.includes(tag)).map((m) => m.slug);
  const shown = await visibleCards(page).evaluateAll((els) => els.map((e) => e.dataset.slug));
  for (const slug of expected) expect(shown).toContain(slug);
});

test('a query with no match shows the empty state, clear restores everything', async ({ page }) => {
  await page.locator('#q').fill('zzzzqqqqxxxx');
  await expect(visibleCards(page)).toHaveCount(0);
  await expect(page.locator('#none')).toBeVisible();

  await page.locator('#clear').click();
  await expect(visibleCards(page)).toHaveCount(index.length);
  await expect(page.locator('#none')).toBeHidden();
  await expect(page.locator('#q')).toHaveValue('');
});

test('clearing the query restores the original order', async ({ page }) => {
  const before = await page.locator('.card').evaluateAll((els) => els.map((e) => e.dataset.slug));
  await page.locator('#q').fill(index[index.length - 1].caption);
  await page.locator('#q').fill('');
  const after = await page.locator('.card').evaluateAll((els) => els.map((e) => e.dataset.slug));
  expect(after).toEqual(before);
});

test('filter chips exist only for facets with several values', async ({ page }) => {
  const multi = ['category', 'language'].filter((k) => new Set(index.map((m) => m[k]).filter(Boolean)).size > 1);
  await expect(page.locator('.chips')).toHaveCount(multi.length);
});

test('language filter narrows the grid and combines with search', async ({ page }) => {
  const languages = [...new Set(index.map((m) => m.language).filter(Boolean))];
  test.skip(languages.length < 2, 'needs two languages in memes/');
  const lang = languages[0];
  const chip = page.locator('[data-facet="language"] button', { hasText: new RegExp(`^${lang}$`) });

  await chip.click();
  await expect(chip).toHaveAttribute('aria-pressed', 'true');
  const inLang = index.filter((m) => m.language === lang);
  await expect(visibleCards(page)).toHaveCount(inLang.length);

  // Search for a meme of another language: the filter must still hide it.
  const other = index.find((m) => m.language !== lang);
  await page.locator('#q').fill(other.caption);
  await expect(visibleCards(page).locator('.caption').filter({ hasText: other.caption })).toHaveCount(0);

  await page.locator('[data-facet="language"] button[data-value=""]').click();
  await page.locator('#q').fill('');
  await expect(visibleCards(page)).toHaveCount(index.length);
});

test('state lives in the URL and is restored on load', async ({ page }) => {
  const target = index[0];
  await page.locator('#q').fill(target.caption);
  await expect(page).toHaveURL(/[?&]q=/);

  await page.reload();
  await ready(page);
  await expect(page.locator('#q')).toHaveValue(target.caption);
  await expect(visibleCards(page).first().locator('.caption')).toHaveText(target.caption);
});

test('slash focuses the search box, escape clears it', async ({ page }) => {
  await page.locator('h1').click(); // the box is autofocused on desktop; leave it first
  await expect(page.locator('#q')).not.toBeFocused();
  await page.keyboard.press('/');
  await expect(page.locator('#q')).toBeFocused();
  await page.keyboard.type('zzzz');
  await expect(visibleCards(page)).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(visibleCards(page)).toHaveCount(index.length);
});

test('copy still works on a filtered grid', async ({ page }) => {
  const still = index.find((m) => !m.animated);
  await page.locator('#q').fill(still.caption);
  const button = visibleCards(page).first().locator('button.copy');
  await button.click();
  await expect(button.locator('.badge')).toHaveText('Copied!');
});
