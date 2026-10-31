import { test, expect } from '@playwright/test';

// Content-driven: expectations come from index.json, so they hold whatever is in memes/.
let index;

test.beforeAll(async ({ request }) => {
  index = await (await request.get('/meme/generated/index.json')).json();
});

const ready = (page) => expect(page.locator('body')).toHaveAttribute('data-search', 'ready');
const visibleCards = (page) => page.locator('.card:not([hidden])');

/** WCAG contrast ratio of two [r, g, b] colours. */
const contrast = ([a, b]) => {
  const lum = (rgb) => {
    const [r, g, bl] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const rgbOf = (css) => css.match(/rgba?\(([^)]+)\)/)[1].split(/[ ,/]+/).filter(Boolean).slice(0, 3).map(Number);

test.beforeEach(async ({ page }) => {
  await page.goto('/meme/');
  await ready(page);
});

test.describe('CLEAR chip', () => {
  test('it only exists while the box has text', async ({ page }) => {
    const chip = page.locator('.clear-chip');
    await expect(chip).toBeHidden();
    await page.locator('#q').fill('git');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveText('CLEAR');
    await page.locator('#q').fill('');
    await expect(chip).toBeHidden();
  });

  test('clicking it empties the search, brings every meme back and returns focus to the box', async ({ page }) => {
    await page.locator('#q').fill('zzzzqqqq');
    await expect(visibleCards(page)).toHaveCount(0);

    await page.locator('.clear-chip').click();
    await expect(page.locator('#q')).toHaveValue('');
    await expect(visibleCards(page)).toHaveCount(index.length);
    await expect(page.locator('#q')).toBeFocused();
    await expect(page).not.toHaveURL(/[?&]q=/);
    await expect(page.locator('.clear-chip')).toBeHidden();
  });

  test('it clears the search only: an active tag filter stays', async ({ page }) => {
    const counts = new Map();
    for (const m of index) for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    const tag = [...counts].find(([, n]) => n < index.length)?.[0];
    test.skip(!tag, 'every meme shares every tag right now');

    await page.locator(`.topics button.tag[data-tag="${tag}"]`).click();
    await page.locator('#q').fill('zzzzqqqq');
    await page.locator('.clear-chip').click();
    await expect(page).toHaveURL(new RegExp(`tag=${encodeURIComponent(tag)}`));
    await expect(page.locator(`.topics button.tag[data-tag="${tag}"]`)).toHaveAttribute('aria-pressed', 'true');
  });

  test('it works from the keyboard: Tab to it, Enter clears', async ({ page, isMobile }) => {
    test.skip(isMobile, 'keyboard flow');
    await page.locator('#q').fill('git');
    await page.keyboard.press('Tab');
    await expect(page.locator('.clear-chip')).toBeFocused();
    const ring = await page.locator('.clear-chip').evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(ring).toBe('solid');
    await page.keyboard.press('Enter');
    await expect(page.locator('#q')).toHaveValue('');
  });

  test('it is a subtle monospaced chip', async ({ page }) => {
    await page.locator('#q').fill('git');
    const s = await page.locator('.clear-chip').evaluate((el) => {
      const c = getComputedStyle(el);
      return {
        family: c.fontFamily, size: parseFloat(c.fontSize), weight: Number(c.fontWeight),
        bg: c.backgroundColor, border: c.borderTopStyle, radius: parseFloat(c.borderTopLeftRadius), color: c.color,
        bar: getComputedStyle(document.querySelector('.search')).backgroundColor,
      };
    });
    expect(s.family).toMatch(/JetBrains Mono.*Fira Code.*monospace/);
    expect(s.size).toBeLessThan(13); // small, not a button competing with the input
    expect(s.bg).toBe('rgba(0, 0, 0, 0)');
    expect(s.border).toBe('solid');
    expect(s.radius).toBeLessThan(10); // a chip, not a pill or a circle
    expect(contrast([rgbOf(s.color), rgbOf(s.bar)])).toBeGreaterThanOrEqual(4.5);
  });

  test('it is easy to hit on a phone: its tappable area is finger size', async ({ page, isMobile }) => {
    await page.locator('#q').fill('git');
    const chip = page.locator('.clear-chip');
    const { visible, tappable } = await chip.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const after = getComputedStyle(el, '::after');
      // The ::after layer extends the hit area by its negative insets on every side.
      const grow = (v) => Math.abs(parseFloat(v));
      return {
        visible: { w: r.width, h: r.height },
        tappable: { w: r.width + grow(after.left) * 2, h: r.height + grow(after.top) * 2 },
      };
    });
    expect(visible.h).toBeGreaterThanOrEqual(28);
    expect(tappable.h, 'at least 44px tall to tap').toBeGreaterThanOrEqual(43);
    expect(tappable.w).toBeGreaterThanOrEqual(44);

    if (isMobile) {
      await chip.tap();
      await expect(page.locator('#q')).toHaveValue('');
    }
  });

  test("the browser's own tiny cross is turned off, so there is exactly one clear control", async ({ page }) => {
    // Chromium does not report styles for its internal pseudo-element, so look the rule up in the stylesheet.
    const rule = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        for (const r of sheet.cssRules) {
          if (r.selectorText?.includes('::-webkit-search-cancel-button')) return r.style.getPropertyValue('appearance') || r.style.getPropertyValue('-webkit-appearance');
        }
      }
      return null;
    });
    expect(rule).toBe('none');
  });

  test('hover gets an accent border and a tint', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch');
    await page.locator('#q').fill('git');
    const chip = page.locator('.clear-chip');
    const read = () => chip.evaluate((el) => {
      const s = getComputedStyle(el);
      return { border: s.borderTopColor, bg: s.backgroundColor, color: s.color };
    });
    const rest = await read();
    await chip.hover();
    await expect.poll(async () => (await read()).border).not.toBe(rest.border);
    await expect.poll(async () => (await read()).bg).not.toBe(rest.bg);
  });

  test('the key-cap hint steps aside while the chip is shown', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no key cap on touch');
    await page.locator('#q').fill('git');
    await expect(page.locator('.shortcut')).toBeHidden();
    await page.locator('#q').fill('');
    await page.locator('h1').click();
    await expect(page.locator('.shortcut')).toBeVisible();
  });

  test('the field has one accessible name, without the chip text mixed in', async ({ page }) => {
    await expect(page.getByRole('searchbox', { name: 'Search memes', exact: true })).toHaveCount(1);
    await page.locator('#q').fill('git');
    await expect(page.getByRole('button', { name: 'Clear search', exact: true })).toBeVisible();
  });

  test('clicking the prompt or the padding of the bar still focuses the field', async ({ page, isMobile }) => {
    test.skip(isMobile, 'desktop focus behaviour');
    await page.locator('h1').click();
    await expect(page.locator('#q')).not.toBeFocused();
    await page.locator('.search .prompt').click();
    await expect(page.locator('#q')).toBeFocused();
  });
});

test.describe('prompt alignment', () => {
  test('the "$" sits close to the text and on the same line', async ({ page }) => {
    await page.locator('#q').fill('git');
    const g = await page.evaluate(() => {
      const prompt = document.querySelector('.search .prompt').getBoundingClientRect();
      const input = document.querySelector('#q');
      const box = input.getBoundingClientRect();
      const bar = document.querySelector('.search').getBoundingClientRect();
      const padLeft = parseFloat(getComputedStyle(input).paddingLeft);
      return {
        gap: box.left + padLeft - prompt.right,
        promptMid: (prompt.top + prompt.bottom) / 2,
        inputMid: (box.top + box.bottom) / 2,
        leftInset: prompt.left - bar.left,
      };
    });
    expect(g.gap, 'no excess space between "$" and the typed text').toBeLessThanOrEqual(8);
    expect(g.gap).toBeGreaterThanOrEqual(2);
    expect(Math.abs(g.promptMid - g.inputMid), 'same vertical centre').toBeLessThanOrEqual(1.5);
    expect(g.leftInset, 'the prompt is not jammed against the border').toBeGreaterThanOrEqual(10);
    expect(g.leftInset).toBeLessThanOrEqual(18);
  });

  test('the prompt and the typed text use the same monospaced font and size', async ({ page }) => {
    const [p, i] = await page.evaluate(() =>
      ['.search .prompt', '#q'].map((sel) => {
        const s = getComputedStyle(document.querySelector(sel));
        return { family: s.fontFamily, size: s.fontSize };
      }));
    expect(p).toEqual(i);
  });
});

test.describe('byline weight', () => {
  for (const scheme of ['dark', 'light']) {
    test(`${scheme}: subtle margin, reduced opacity, still readable`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/meme/');
      const s = await page.locator('header .byline').evaluate((el) => {
        const c = getComputedStyle(el);
        return { margin: parseFloat(c.marginRight), opacity: Number(c.opacity), color: c.color, bg: getComputedStyle(document.body).backgroundColor };
      });
      expect(s.margin).toBeGreaterThan(0);
      expect(s.margin).toBeLessThanOrEqual(12);
      expect(s.opacity).toBe(scheme === 'dark' ? 0.8 : 0.9);

      // What the eye sees: the colour blended with the page by the opacity.
      const fg = rgbOf(s.color);
      const bg = rgbOf(s.bg);
      const seen = fg.map((v, k) => v * s.opacity + bg[k] * (1 - s.opacity));
      expect(contrast([seen, bg])).toBeGreaterThanOrEqual(4.5);
    });
  }

  test('the title stays the dominant element: larger, bolder and at full opacity', async ({ page }) => {
    const [h, b] = await page.evaluate(() =>
      ['header h1', 'header .byline'].map((sel) => {
        const s = getComputedStyle(document.querySelector(sel));
        return { size: parseFloat(s.fontSize), opacity: Number(s.opacity) };
      }));
    expect(h.size).toBeGreaterThan(b.size * 2);
    expect(h.opacity).toBe(1);
    expect(b.opacity).toBeLessThan(1);
  });

  test('hovering brings it back to full opacity', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch');
    await page.locator('header .byline').hover();
    await expect.poll(() => page.locator('header .byline').evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  });
});

test.describe('empty state', () => {
  const empty = async (page) => {
    await page.locator('#q').fill('zzzzqqqqxxxx');
    await expect(page.locator('#none')).toBeVisible();
  };

  test('the message and the button share one row, vertically centred on each other', async ({ page }) => {
    // Wide enough for one row whatever the system font is (Linux CI falls back to wider fonts than Windows/macOS).
    await page.setViewportSize({ width: 640, height: 800 });
    await empty(page);
    const g = await page.evaluate(() => {
      const mid = (sel) => {
        const r = document.querySelector(sel).getBoundingClientRect();
        return { mid: (r.top + r.bottom) / 2, top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      return { text: mid('#none span'), button: mid('#clear') };
    });
    expect(Math.abs(g.text.mid - g.button.mid), 'centres line up').toBeLessThanOrEqual(1);
    expect(g.button.left, 'button to the right of the text').toBeGreaterThan(g.text.right);
    expect(g.button.left - g.text.right, 'close to the text').toBeLessThan(30);
  });

  test('on a narrow phone it wraps onto two lines without breaking out of the screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 });
    await empty(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator('#clear')).toBeInViewport();
  });

  test('the button turns to inverted, high-contrast colours on hover', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no hover on touch');
    for (const scheme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme: scheme });
      await page.reload();
      await ready(page);
      await empty(page);
      const button = page.locator('#clear');
      const read = () => button.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, color: s.color };
      });
      const rest = await read();
      await button.hover();
      await expect.poll(async () => (await read()).bg).not.toBe(rest.bg);
      await page.waitForTimeout(250); // let the colour transition finish
      const hover = await read();
      expect(contrast([rgbOf(hover.color), rgbOf(hover.bg)]), `${scheme} hover contrast`).toBeGreaterThanOrEqual(7);
    }
  });

  test('the button still resets search and filters', async ({ page }) => {
    await empty(page);
    await page.locator('#clear').click();
    await expect(visibleCards(page)).toHaveCount(index.length);
    await expect(page.locator('#q')).toHaveValue('');
  });
});
