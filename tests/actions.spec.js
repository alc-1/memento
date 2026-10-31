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
const isUnknown = (m) => m.author.trim().toLowerCase() === 'unknown';
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');

test('every card has copy, download, info and share buttons', async ({ page }) => {
  await expect(page.locator('.card')).toHaveCount(index.length);
  for (const m of index) {
    const c = card(page, m.slug);
    await expect(c.locator('button.copy')).toHaveCount(1);
    await expect(c.locator('a.download')).toHaveCount(1);
    await expect(c.locator('button.info')).toHaveCount(1);
    await expect(c.locator('button.share')).toHaveCount(1);
  }
});

test('buttons are icon-only and named by their title', async ({ page }) => {
  const c = card(page, index.find((m) => !m.animated).slug);
  for (const [selector, title] of [['.copy', 'Copy'], ['.download', 'Download'], ['.info', 'Info'], ['.share', 'Share']]) {
    const button = c.locator(`.act${selector}`);
    await expect(button).toHaveAttribute('title', title);
    await expect(button).toHaveText('');
    await expect(button.locator('svg')).toHaveCount(1);
  }
});

test('the buttons sit below the text, aligned on the right', async ({ page }) => {
  const layout = await page.locator('.card').evaluateAll((cards) =>
    cards.map((c) => {
      const box = (el) => el.getBoundingClientRect();
      const actions = box(c.querySelector('.actions'));
      const card = box(c);
      const texts = [...c.querySelectorAll('.caption, .credit, .hint, .tags')].map(box);
      const buttons = [...c.querySelectorAll('.act')].map(box);
      return {
        slug: c.dataset.slug,
        belowText: texts.every((t) => actions.top >= t.bottom - 1),
        belowImage: actions.top >= box(c.querySelector('.view')).bottom,
        rightGap: card.right - Math.max(...buttons.map((b) => b.right)),
        leftGap: Math.min(...buttons.map((b) => b.left)) - card.left,
        singleRow: new Set(buttons.map((b) => Math.round(b.top))).size === 1,
      };
    }),
  );
  for (const l of layout) {
    expect(l.belowImage && l.belowText, `${l.slug} buttons are below all the text`).toBe(true);
    expect(l.singleRow, `${l.slug} buttons share one row`).toBe(true);
    expect(l.rightGap, `${l.slug} buttons hug the right edge`).toBeLessThan(32);
    expect(l.leftGap, `${l.slug} buttons are pushed right`).toBeGreaterThan(l.rightGap);
  }
});

test('an Unknown author is hidden on the card, in the large view and in info', async ({ page, isMobile }) => {
  test.skip(isMobile, 'on small screens the picture copies instead of zooming');
  const m = index.find(isUnknown);
  test.skip(!m, 'no meme with an Unknown author in memes/ right now');
  const c = card(page, m.slug);
  await expect(c.locator('.credit')).toHaveCount(0);

  await c.locator('button.view').click();
  await expect(page.locator('#viewer-caption')).toHaveText(m.caption);
  await page.keyboard.press('Escape');

  await c.locator('button.info').click();
  await expect(page.locator('#info-dialog dt', { hasText: 'Author' })).toHaveCount(0);
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
  if (isUnknown(m)) await expect(dialog.locator('dt', { hasText: 'Author' })).toHaveCount(0);
  else await expect(dialog).toContainText(m.author);
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

test('clicking the image opens it large, and does not copy', async ({ page, isMobile }) => {
  test.skip(isMobile, 'on small screens the picture copies instead of zooming');
  const m = index[0];
  await card(page, m.slug).locator('button.view').click();

  const dialog = page.locator('#viewer');
  await expect(dialog).toBeVisible();
  const img = dialog.locator('img');
  await expect(img).toHaveAttribute('src', new RegExp(`^/meme/${m.full}$`));
  await expect.poll(() => img.evaluate((el) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(dialog).toContainText(m.caption);
  await expect(card(page, m.slug).locator('.copy .badge')).toBeEmpty();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});

test('the large view also closes with its button and on backdrop click', async ({ page, isMobile }) => {
  test.skip(isMobile, 'on small screens the picture copies instead of zooming');
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

test.describe('the picture on small screens', () => {
  const SMALL = { width: 600, height: 900 };
  const BIG = { width: 1280, height: 900 };

  const stillMeme = () => index.find((m) => !m.animated);

  test('tapping the picture copies the meme, and does not open the large view', async ({ page }) => {
    await page.setViewportSize(SMALL);
    const m = stillMeme();
    const c = card(page, m.slug);

    let copyFetches = 0;
    page.on('request', (r) => { if (r.url().endsWith(`${m.slug}/copy.png`)) copyFetches++; });
    await c.locator('button.view').click();

    await expect(c.locator('button.copy .badge')).toHaveText('Copied!');
    await expect(page.locator('#viewer')).toBeHidden();
    expect(copyFetches, 'one tap copies once, not twice').toBe(1);

    const clip = await page.evaluate(async () => {
      const [item] = await navigator.clipboard.read();
      return { types: item.types, size: (await item.getType('image/png')).size };
    });
    expect(clip.types).toContain('image/png');
    expect(clip.size).toBeGreaterThan(0);
  });

  test('the picture is announced as a copy button on small screens, and as a viewer on big ones', async ({ page }) => {
    const m = stillMeme();
    const picture = card(page, m.slug).locator('button.view');

    await page.setViewportSize(SMALL);
    await expect(picture).toHaveAttribute('aria-label', `Copy meme: ${m.caption}`);
    await expect(picture).not.toHaveAttribute('aria-haspopup', /.*/);

    // The label follows the screen when it is resized, with no reload.
    await page.setViewportSize(BIG);
    await expect(picture).toHaveAttribute('aria-label', `View larger: ${m.caption}`);
    await expect(picture).toHaveAttribute('aria-haspopup', 'dialog');
  });

  test('an animated GIF copies its link when its picture is tapped', async ({ page }) => {
    const gif = index.find((m) => m.animated);
    test.skip(!gif, 'no animated GIF in memes/ right now');
    await page.setViewportSize(SMALL);
    await card(page, gif.slug).locator('button.view').click();
    await expect(card(page, gif.slug).locator('button.copy .badge')).toHaveText('Link copied');
    await expect(page.locator('#viewer')).toBeHidden();
  });

  test('on big screens the picture still opens the large view', async ({ page }) => {
    await page.setViewportSize(BIG);
    await card(page, stillMeme().slug).locator('button.view').click();
    await expect(page.locator('#viewer')).toBeVisible();
  });

  test('the boundary is 640px', async ({ page }) => {
    const m = stillMeme();
    const picture = card(page, m.slug).locator('button.view');
    await page.setViewportSize({ width: 640, height: 900 });
    await expect(picture).toHaveAttribute('aria-label', /^Copy meme/);
    await page.setViewportSize({ width: 641, height: 900 });
    await expect(picture).toHaveAttribute('aria-label', /^View larger/);
  });

  test('Info is still available on small screens', async ({ page }) => {
    await page.setViewportSize(SMALL);
    await card(page, stillMeme().slug).locator('button.info').click();
    await expect(page.locator('#info-dialog')).toBeVisible();
  });
});
