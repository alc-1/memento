import { test, expect } from '@playwright/test';

// Content-driven: expectations come from index.json, so they hold whatever is in memes/.
let index;

test.beforeAll(async ({ request }) => {
  index = await (await request.get('/meme/generated/index.json')).json();
});

const ready = (page) => expect(page.locator('body')).toHaveAttribute('data-search', 'ready');

/** WCAG contrast ratio of two CSS rgb()/rgba() strings, computed in the page. */
const contrastScript = ([fg, bg]) => {
  const parse = (c) => {
    const m = c.match(/rgba?\(([^)]+)\)/)[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return m.slice(0, 3);
  };
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [a, b] = [lum(parse(fg)), lum(parse(bg))].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

for (const scheme of ['dark', 'light']) {
  test.describe(`${scheme} theme`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/meme/');
      await ready(page);
    });

    test('secondary text stays easy to read on the card', async ({ page }) => {
      const m = index.find((x) => x.author.trim().toLowerCase() !== 'unknown') ?? index[0];
      const card = page.locator(`.card[data-slug="${m.slug}"]`);
      const styles = await card.evaluate((el) => {
        const credit = el.querySelector('.credit') ?? el.querySelector('.caption');
        return [getComputedStyle(credit).color, getComputedStyle(el).backgroundColor];
      });
      const ratio = await page.evaluate(contrastScript, styles);
      expect(ratio, `credit ${styles[0]} on card ${styles[1]}`).toBeGreaterThanOrEqual(6.5);
    });

    test('the active language chip is a solid brand fill with readable text', async ({ page }) => {
      const group = page.locator('[data-facet="language"]');
      test.skip((await group.count()) === 0, 'language filter is hidden when there is a single language');
      const active = group.locator('button[aria-pressed="true"]');
      // A specific chip (not "whichever is inactive"), so the locator stays put after the click.
      const inactive = group.locator('button:not([data-value=""])').first();
      await expect(inactive).toHaveAttribute('aria-pressed', 'false');

      const read = (l) => l.evaluate((el) => {
        const s = getComputedStyle(el);
        return { bg: s.backgroundColor, color: s.color, weight: Number(s.fontWeight), border: s.borderTopColor, shadow: s.boxShadow };
      });
      const on = await read(active);
      const off = await read(inactive);

      expect(off.bg).toBe('rgba(0, 0, 0, 0)'); // inactive chips are outlines only
      expect(on.bg).not.toBe(off.bg);
      expect(on.weight).toBeGreaterThanOrEqual(700);
      expect(on.shadow).not.toBe('none');
      expect(await page.evaluate(contrastScript, [on.color, on.bg])).toBeGreaterThanOrEqual(4.5);

      await inactive.click();
      await expect(inactive).toHaveAttribute('aria-pressed', 'true');
      await expect.poll(async () => (await read(inactive)).bg).toBe(on.bg); // after the colour transition
    });

    test('card footer: the picture, the text and the pill have room to breathe', async ({ page }) => {
      const m = index.find((x) => x.tags.length) ?? index[0];
      const card = page.locator(`.card[data-slug="${m.slug}"]`);
      await card.locator('img').scrollIntoViewIfNeeded();
      const g = await card.evaluate((el) => {
        const box = (sel) => el.querySelector(sel).getBoundingClientRect();
        const image = box('.view');
        const caption = box('.caption');
        const pill = box('.actions');
        const c = el.getBoundingClientRect();
        const buttons = [...el.querySelectorAll('.act')].map((b) => b.getBoundingClientRect());
        const pillStyle = getComputedStyle(el.querySelector('.actions'));
        return {
          imageToText: caption.top - image.bottom,
          imageToPill: pill.top - image.bottom,
          pillToBottom: c.bottom - pill.bottom,
          pillToRight: c.right - pill.right,
          buttonInset: Math.min(...buttons.map((b) => Math.min(b.top - pill.top, pill.bottom - b.bottom, b.left - pill.left, pill.right - b.right))),
          radius: parseFloat(pillStyle.borderTopLeftRadius),
          pillBg: pillStyle.backgroundColor,
          cardBg: getComputedStyle(el).backgroundColor,
        };
      });
      expect(g.imageToText).toBeGreaterThanOrEqual(14);
      expect(g.imageToPill).toBeGreaterThanOrEqual(24);
      expect(g.pillToBottom).toBeGreaterThanOrEqual(14);
      expect(g.pillToRight).toBeGreaterThanOrEqual(14);
      expect(g.buttonInset, 'buttons sit inside the pill, not against its edge').toBeGreaterThanOrEqual(4);
      expect(g.radius).toBeGreaterThan(20); // a real pill
      expect(g.pillBg, 'the pill is a raised surface').not.toBe(g.cardBg);
    });

    test('hovering a card lifts it with a border highlight and a soft glow', async ({ page }) => {
      const card = page.locator('.card').first();
      await card.scrollIntoViewIfNeeded();
      const read = () => card.evaluate((el) => {
        const s = getComputedStyle(el);
        return { border: s.borderTopColor, shadow: s.boxShadow };
      });
      await page.mouse.move(0, 0);
      const before = await read();
      await card.locator('.view').hover();
      await expect.poll(async () => (await read()).border).not.toBe(before.border);
      const after = await read();
      expect(after.shadow).not.toBe(before.shadow);
      // The glow is a large, blurred shadow, not just a hairline.
      expect(after.shadow).toMatch(/\d{2,}px/);
    });
  });
}

test.describe('terminal-style search', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/meme/');
    await ready(page);
  });

  test('has a prompt, a monospace input and a key-cap shortcut', async ({ page, isMobile }) => {
    await expect(page.locator('.search .prompt')).toHaveText('$');
    expect(await page.locator('#q').evaluate((el) => getComputedStyle(el).fontFamily)).toMatch(/mono|Menlo|Consolas/i);
    // Touch devices have no keyboard, so the hint is hidden there.
    if (isMobile) await expect(page.locator('.shortcut')).toBeHidden();
    else await expect(page.locator('.shortcut')).toBeVisible();
    await expect(page.locator('.shortcut')).toHaveText('/');
  });

  test('the shortcut hint fades while typing, and the box shows a focus ring', async ({ page, isMobile }) => {
    test.skip(isMobile, 'no shortcut hint on touch devices');
    const hint = page.locator('.shortcut');
    await expect(page.locator('#q')).toBeFocused(); // autofocused on desktop, so the hint starts hidden
    await expect(hint).toHaveCSS('opacity', '0');

    await page.locator('h1').click(); // click away: the keycap shows again
    await expect(page.locator('#q')).not.toBeFocused();
    await expect(hint).toHaveCSS('opacity', '1');

    await page.keyboard.press('/');
    await expect(page.locator('#q')).toBeFocused();
    await expect(hint).toHaveCSS('opacity', '0');
    const ring = await page.locator('.search').evaluate((el) => getComputedStyle(el).boxShadow);
    expect(ring).not.toBe('none');

    await page.keyboard.type('git');
    await page.locator('#q').blur();
    await expect(hint).toHaveCSS('opacity', '0'); // still hidden: the box has a value
  });
});
