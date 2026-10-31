import { test, expect } from '@playwright/test';

let index;

test.beforeAll(async ({ request }) => {
  index = await (await request.get('/meme/generated/index.json')).json();
});

const card = (page, slug) => page.locator(`.card[data-slug="${slug}"]`);

test('on a computer, Share copies the meme page link', async ({ page, baseURL, isMobile }) => {
  test.skip(isMobile, 'touch devices open the share sheet instead');
  const m = index[0];
  await page.goto('/meme/');
  const button = card(page, m.slug).locator('button.share');
  await button.click();
  await expect(button.locator('.badge')).toHaveText('Link copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}/meme/m/${m.slug}/`);
});

test('on a touch device, Share opens the system share sheet', async ({ page, baseURL, isMobile }) => {
  test.skip(!isMobile, 'computers copy the link instead');
  const m = index[0];
  await page.addInitScript(() => {
    window.__shared = [];
    navigator.share = (data) => { window.__shared.push(data); return Promise.resolve(); };
  });
  await page.goto('/meme/');
  await card(page, m.slug).locator('button.share').click();
  expect(await page.evaluate(() => window.__shared)).toEqual([{ title: m.caption, url: `${baseURL}/meme/m/${m.slug}/` }]);
});

test('closing the share sheet is not an error', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'computers copy the link instead');
  await page.addInitScript(() => {
    navigator.share = () => Promise.reject(new DOMException('closed', 'AbortError'));
  });
  await page.goto('/meme/');
  const button = page.locator('.card button.share').first();
  await button.click();
  await expect(button.locator('.badge')).toHaveText('');
});

test('every meme has its own page with link-preview tags', async ({ request }) => {
  for (const m of index) {
    const res = await request.get(`/meme/m/${m.slug}/`);
    expect(res.status(), m.slug).toBe(200);
    const html = await res.text();
    expect(html).toMatch(/<meta property="og:title" content="[^"]+"/);
    const image = html.match(/<meta property="og:image" content="([^"]+)"/)[1];
    expect(image).toMatch(/^https?:\/\/[^/]+\/meme\/generated\//);
    expect((await request.get(new URL(image).pathname)).status(), `${m.slug} preview image`).toBe(200);
    expect(html).toContain('href="/meme/"');
  }
});

test('an unknown meme page is a 404', async ({ request }) => {
  expect((await request.get('/meme/m/no-such-meme/')).status()).toBe(404);
});
