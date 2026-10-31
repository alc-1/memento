import { test, expect } from '@playwright/test';

const LINKEDIN = 'https://www.linkedin.com/in/alcosta1/';

test.beforeEach(async ({ page }) => {
  await page.goto('/meme/');
});

test('"by Alvaro" links to the LinkedIn profile, safely, in a new tab', async ({ page }) => {
  const link = page.locator('header a.byline');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveText('by Alvaro');
  await expect(link).toHaveAttribute('href', LINKEDIN);
  await expect(link).toHaveAttribute('target', '_blank');
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
});

test('the accessible name contains the visible text and says where it goes', async ({ page }) => {
  const name = await page.locator('header a.byline').getAttribute('aria-label');
  expect(name).toContain('by Alvaro'); // WCAG 2.5.3: the visible label is part of the name
  expect(name).toMatch(/LinkedIn/);
  expect(name).toMatch(/new tab/);
  await expect(page.getByRole('link', { name: /by Alvaro/ })).toHaveCount(1);
});

test('the page title stays a clean heading, the byline is not part of it', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Memento');
});

test('it sits right next to the title, on the same line, with a small gap', async ({ page, isMobile }) => {
  test.skip(isMobile, 'on a phone the byline may wrap under the title; covered below');
  const { h1, link } = await page.evaluate(() => {
    const box = (sel) => document.querySelector(sel).getBoundingClientRect().toJSON();
    return { h1: box('header h1'), link: box('header a.byline') };
  });
  expect(link.left, 'to the right of the title').toBeGreaterThanOrEqual(h1.right);
  expect(link.left - h1.right, 'close to the title').toBeLessThan(40);
  // Same line: the byline's box sits inside the title's vertical extent.
  expect(link.top).toBeGreaterThanOrEqual(h1.top);
  expect(link.bottom).toBeLessThanOrEqual(h1.bottom + 1);
});

test('it is aligned on the text baseline of the title', async ({ page, isMobile }) => {
  test.skip(isMobile, 'baseline comparison is for the one-line layout');
  const baselines = await page.evaluate(() => {
    const baseline = (el) => {
      const probe = document.createElement('span');
      probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
      el.append(probe);
      const y = probe.getBoundingClientRect().bottom;
      probe.remove();
      return y;
    };
    return [baseline(document.querySelector('header h1')), baseline(document.querySelector('header a.byline'))];
  });
  expect(Math.abs(baselines[0] - baselines[1])).toBeLessThan(2);
});

test('it is styled exactly like an author credit on the cards', async ({ page }) => {
  const read = (selector) =>
    page.locator(selector).first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { family: s.fontFamily, size: s.fontSize, color: s.color, weight: s.fontWeight };
    });
  const credit = await read('.card .credit');
  const byline = await read('header a.byline');
  expect(byline).toEqual(credit);
  expect(byline.family).toMatch(/JetBrains Mono.*Fira Code.*monospace/);
});

test('it is a visible link: underlined, with hover and keyboard focus states', async ({ page }) => {
  const link = page.locator('header a.byline');
  const read = () => link.evaluate((el) => {
    const s = getComputedStyle(el);
    return { line: s.textDecorationLine, lineColor: s.textDecorationColor, color: s.color, outline: s.outlineStyle };
  });

  const rest = await read();
  expect(rest.line).toContain('underline');

  await link.hover();
  await expect.poll(async () => (await read()).lineColor).not.toBe(rest.lineColor);
  await expect.poll(async () => (await read()).color).not.toBe(rest.color);

  await page.mouse.move(0, 0);
  await link.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(link).toBeFocused();
  expect((await read()).outline).toBe('solid');
});

test('it does not break the header on a phone: no overflow, still fully visible', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(page.locator('header a.byline')).toBeInViewport();
});

test('the link target is reachable: clicking opens LinkedIn in a new tab without leaving the album', async ({ page, context }) => {
  // The real site is not contacted: the popup request is answered locally.
  await context.route('https://www.linkedin.com/**', (route) => route.fulfill({ status: 200, body: 'linkedin' }));
  const [popup] = await Promise.all([context.waitForEvent('page'), page.locator('header a.byline').click()]);
  await popup.waitForLoadState();
  expect(popup.url()).toBe(LINKEDIN);
  expect(page.url()).toContain('/meme/');
  expect(await popup.evaluate(() => window.opener)).toBeNull(); // noopener
});
