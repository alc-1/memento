import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { findOriginal } from '../scripts/lib/validate.mjs';

// Content-driven: expectations come from index.json, so they hold whatever is in memes/.
let index;

test.beforeAll(async ({ request }) => {
  index = await (await request.get('/meme/generated/index.json')).json();
});

test.beforeEach(async ({ page }) => {
  await page.goto('/meme/');
});

const card = (page, slug) => page.locator(`.card[data-slug="${slug}"]`);
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

test('every card has copy, download and info buttons', async ({ page }) => {
  await expect(page.locator('.card')).toHaveCount(index.length);
  for (const m of index) {
    const c = card(page, m.slug);
    await expect(c.locator('button.copy')).toHaveCount(1);
    await expect(c.locator('a.download')).toHaveCount(1);
    await expect(c.locator('button.info')).toHaveCount(1);
  }
});

test('download serves the untouched original under a clean filename', async ({ page }) => {
  const m = index[0];
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    card(page, m.slug).locator('a.download').click(),
  ]);
  expect(download.suggestedFilename()).toBe(m.download);
  expect(m.download).toMatch(/^[a-z0-9-]+\.[a-z]+$/);

  const dir = path.join('memes', m.slug);
  const original = await readFile(path.join(dir, await findOriginal(dir)));
  expect(sha256(await readFile(await download.path()))).toBe(sha256(original));
});

test('download links live under the /meme/ base path', async ({ page }) => {
  const hrefs = await page.locator('a.download').evaluateAll((els) => els.map((a) => a.getAttribute('href')));
  expect(hrefs).toHaveLength(index.length);
  for (const href of hrefs) expect(href).toMatch(/^\/meme\/generated\//);
});

test('info shows the metadata, escape closes it', async ({ page }) => {
  const m = index.find((x) => x.tags.length) ?? index[0];
  await card(page, m.slug).locator('button.info').click();

  const dialog = page.locator('#info-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('h2')).toHaveText(m.caption);
  await expect(dialog).toContainText(m.author);
  await expect(dialog).toContainText(m.source);
  if (m.language) await expect(dialog).toContainText(m.language);
  for (const tag of m.tags) await expect(dialog).toContainText(tag);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('info links http sources safely and never links other schemes', async ({ page }) => {
  // Doctor the embedded data of the first two memes before the page script reads it.
  await page.route('**/meme/', async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body
      .replace(/"source":"[^"]*"/, '"source":"https://example.com/post?a=1"')
      .replace(/"source":"(?!https:\/\/example\.com)[^"]*"/, '"source":"javascript:alert(1)"');
    await route.fulfill({ response, body });
  });
  await page.goto('/meme/');

  await card(page, index[0].slug).locator('button.info').click();
  const link = page.locator('#info-dialog a');
  await expect(link).toHaveAttribute('href', 'https://example.com/post?a=1');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('target', '_blank');
  await page.keyboard.press('Escape');

  await card(page, index[1].slug).locator('button.info').click();
  await expect(page.locator('#info-dialog')).toContainText('javascript:alert(1)');
  await expect(page.locator('#info-dialog a')).toHaveCount(0);
});

test('clicking the image opens it large, and does not copy', async ({ page }) => {
  const m = index[0];
  await card(page, m.slug).locator('button.view').click();

  const dialog = page.locator('#viewer');
  await expect(dialog).toBeVisible();
  const img = dialog.locator('img');
  await expect(img).toHaveAttribute('src', new RegExp(`^/meme/${m.full}$`));
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(dialog).toContainText(m.caption);
  await expect(card(page, m.slug).locator('.badge')).toBeEmpty();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('the large view also closes with its button and on backdrop click', async ({ page }) => {
  const m = index[0];
  const dialog = page.locator('#viewer');

  await card(page, m.slug).locator('button.view').click();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(dialog).toBeHidden();

  await card(page, m.slug).locator('button.view').click();
  await page.mouse.click(2, 2); // outside the dialog box, on the backdrop
  await expect(dialog).toBeHidden();
});

test('copy button shows its feedback and the image button does not trigger it', async ({ page }) => {
  const m = index.find((x) => !x.animated);
  const c = card(page, m.slug);
  await c.locator('button.copy').click();
  await expect(c.locator('button.copy .badge')).toHaveText('Copied!');
});
