import { test, expect } from '@playwright/test';

const ready = (page) => expect(page.locator('body')).toHaveAttribute('data-search', 'ready');

test('on a computer the search box has focus as soon as the page loads', async ({ page, isMobile }) => {
  test.skip(isMobile, 'touch devices do not autofocus');
  await page.goto('/meme/');
  await ready(page);
  await expect(page.locator('#q')).toBeFocused();
  await expect(page.locator('.search')).toHaveCSS('border-top-color', 'rgb(228, 87, 46)'); // focus ring colour
});

test('typing works immediately, with no click or slash', async ({ page, isMobile }) => {
  test.skip(isMobile, 'touch devices do not autofocus');
  await page.goto('/meme/');
  await ready(page);
  const caption = await page.locator('.card .caption').first().innerText();
  await page.keyboard.type(caption);
  await expect(page.locator('#q')).toHaveValue(caption);
  await expect(page.locator('.card:not([hidden])').first().locator('.caption')).toHaveText(caption);
});

test('the page does not scroll when the box takes focus', async ({ page, isMobile }) => {
  test.skip(isMobile, 'touch devices do not autofocus');
  await page.goto('/meme/');
  await ready(page);
  expect(await page.evaluate(() => scrollY)).toBe(0);
});

test('a query in the URL is kept and the box is focused', async ({ page, isMobile }) => {
  test.skip(isMobile, 'touch devices do not autofocus');
  await page.goto('/meme/?q=zzzzqqqq');
  await ready(page);
  await expect(page.locator('#q')).toBeFocused();
  await expect(page.locator('#q')).toHaveValue('zzzzqqqq');
});

test('arrow down goes straight from the autofocused box to the first card', async ({ page, isMobile }) => {
  test.skip(isMobile, 'touch devices do not autofocus');
  await page.goto('/meme/');
  await ready(page);
  await page.keyboard.press('ArrowDown');
  expect(await page.evaluate(() => document.activeElement.closest('.card') !== null)).toBe(true);
});

test('on a phone nothing is focused on load, so the on-screen keyboard stays closed', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'desktop autofocuses');
  await page.goto('/meme/');
  await ready(page);
  await expect(page.locator('#q')).not.toBeFocused();
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
});

test('a narrow desktop window still autofocuses (the rule is about the input device, not the width)', async ({ page, isMobile }) => {
  test.skip(isMobile, 'touch devices do not autofocus');
  await page.setViewportSize({ width: 500, height: 800 });
  await page.goto('/meme/');
  await ready(page);
  await expect(page.locator('#q')).toBeFocused();
});
