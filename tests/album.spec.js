import { test, expect } from '@playwright/test';

const SAMPLE_COUNT = 5;

test.beforeEach(async ({ page }) => {
  await page.goto('/meme/');
});

test('renders one card per meme with caption and attribution', async ({ page }) => {
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(SAMPLE_COUNT);
  for (const card of await cards.all()) {
    await expect(card.locator('.caption')).not.toBeEmpty();
    await expect(card.locator('.credit')).toHaveText(/^by .+/);
  }
});

test('all thumbnails load', async ({ page }) => {
  const imgs = page.locator('.card img');
  await expect(imgs).toHaveCount(SAMPLE_COUNT);
  for (const img of await imgs.all()) {
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  }
});

test('every asset URL lives under the /meme/ base path', async ({ page }) => {
  const urls = await page.locator('[src], [data-copy]').evaluateAll((els) =>
    els.map((el) => el.getAttribute('src') ?? el.getAttribute('data-copy')),
  );
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) expect(url).toMatch(/^\/meme\//);
});

test('index.json is served under the base path', async ({ request }) => {
  const res = await request.get('/meme/generated/index.json');
  expect(res.ok()).toBe(true);
  const index = await res.json();
  expect(index).toHaveLength(SAMPLE_COUNT);
  for (const m of index) {
    expect(m.source).toBeTruthy();
    expect(m.author).toBeTruthy();
  }
});

test('clicking a still meme copies a PNG to the clipboard', async ({ page }) => {
  const button = page.locator('button.copy[data-animated="false"]').first();
  await button.click();
  await expect(button.locator('.badge')).toHaveText('Copied!');

  const type = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    const blob = await item.getType('image/png');
    return { types: item.types, size: blob.size };
  });
  expect(type.types).toContain('image/png');
  expect(type.size).toBeGreaterThan(0);
});

test('clicking an animated GIF copies its link instead', async ({ page }) => {
  const button = page.locator('button.copy[data-animated="true"]');
  await expect(button).toHaveCount(1);
  await button.click();
  await expect(button.locator('.badge')).toHaveText('Link copied');

  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(/\/meme\/generated\/loading-gif\/animated\.gif$/);
});

test('shows an error badge when the copy asset is missing', async ({ page }) => {
  await page.route('**/copy.png', (route) => route.fulfill({ status: 404 }));
  const button = page.locator('button.copy[data-animated="false"]').first();
  await button.click();
  await expect(button.locator('.badge')).toHaveText('Copy failed');
});

test('page has no horizontal scroll', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
