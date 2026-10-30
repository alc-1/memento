import { test, expect } from '@playwright/test';

// The tests follow the real content: whatever is in memes/ is what the album must show.
let index;

test.beforeAll(async ({ request }) => {
  index = await (await request.get('/meme/generated/index.json')).json();
});

test.beforeEach(async ({ page }) => {
  await page.goto('/meme/');
});

test('renders one card per meme with caption and attribution', async ({ page }) => {
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(index.length);
  for (const card of await cards.all()) {
    await expect(card.locator('.caption')).not.toBeEmpty();
    await expect(card.locator('.credit')).toHaveText(/^by .+/);
  }
});

test('all thumbnails load', async ({ page }) => {
  const imgs = page.locator('.card img');
  await expect(imgs).toHaveCount(index.length);
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
  expect(index.length).toBeGreaterThan(0);
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
  const animated = index.filter((m) => m.animated);
  test.skip(!animated.length, 'no animated GIF in memes/ right now');
  const button = page.locator('button.copy[data-animated="true"]').first();
  await button.click();
  await expect(button.locator('.badge')).toHaveText('Link copied');

  const text = await page.evaluate(() => navigator.clipboard.readText());
  expect(text).toMatch(new RegExp(`/meme/generated/${animated[0].slug}/animated\\.gif$`));
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
