import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createAdminServer } from '../scripts/admin/server.mjs';

let server, base, root;

test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'memento-ui-'));
  server = createAdminServer({ root });
  base = `http://127.0.0.1:${await server.listenLocal(0)}`;
});

test.afterAll(() => new Promise((resolve) => server.close(resolve)));

test('add an image, fill the form, save: folder and meta.json are written', async ({ page }) => {
  const buffer = await sharp({ create: { width: 30, height: 30, channels: 3, background: 'orange' } }).png().toBuffer();

  await page.goto(`${base}/`);
  await expect(page.locator('#empty')).toBeVisible();

  await page.locator('#picker').setInputFiles({ name: 'lundi.png', mimeType: 'image/png', buffer });
  await expect(page.locator('#editor')).toBeVisible();

  await page.locator('#caption').fill('Réunion inutile');
  await expect(page.locator('#slug-preview')).toHaveText('reunion-inutile');

  await page.locator('#tag-input').fill('bureau');
  await page.locator('#tag-input').press('Enter');
  await page.locator('#tag-input').fill('café,');
  await expect(page.locator('.chip')).toHaveCount(2);

  // Missing author/source is refused before any request.
  await page.locator('#save').click();
  await expect(page.locator('#error')).toContainText('source');

  await page.locator('#mine').check();
  await expect(page.locator('#author')).toHaveValue('Alvaro');
  await page.locator('#language').fill('fr');
  await page.keyboard.press('Control+Enter');

  await expect(page.locator('#toast')).toContainText('memes/reunion-inutile');
  await expect(page.locator('#empty')).toBeVisible();

  const dir = path.join(root, 'memes', 'reunion-inutile');
  expect((await readdir(dir)).sort()).toEqual(['meta.json', 'original.png']);
  expect(JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8'))).toEqual({
    caption: 'Réunion inutile', language: 'FR', tags: ['bureau', 'café'],
    source: 'original', author: 'Alvaro', mine: true,
  });

  await page.locator('#check').click();
  await expect(page.locator('#check-result')).toContainText('OK: 1');
});
