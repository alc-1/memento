import { test, expect } from '@playwright/test';

// Content-driven: expectations come from index.json, so they hold whatever is in memes/.
let index;

test.beforeAll(async ({ request }) => {
  index = await (await request.get('/meme/generated/index.json')).json();
});

const ready = (page) => expect(page.locator('body')).toHaveAttribute('data-search', 'ready');
const visibleSlugs = (page) =>
  page.locator('.card:not([hidden])').evaluateAll((els) => els.map((e) => e.dataset.slug).sort());
const withTag = (tag) => index.filter((m) => m.tags.includes(tag)).map((m) => m.slug).sort();

// A tag worth clicking: used by at least one meme but not by all of them, so filtering visibly narrows.
const pickTag = () => {
  const counts = new Map();
  for (const m of index) for (const t of m.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].find(([, n]) => n < index.length)?.[0];
};

test.beforeEach(async ({ page }) => {
  await page.goto('/meme/');
  await ready(page);
});

test('cards show up to three tag pills, written as hashtags', async ({ page }) => {
  for (const m of index.filter((x) => x.tags.length)) {
    const pills = page.locator(`.card[data-slug="${m.slug}"] button.tag`);
    await expect(pills).toHaveCount(Math.min(3, m.tags.length));
    await expect(pills.first()).toHaveText(`#${m.tags[0]}`);
  }
});

test('the topics row lists the most used tags with their counts', async ({ page }) => {
  const topics = page.locator('.topics button.tag');
  expect(await topics.count()).toBeGreaterThan(0);
  const first = topics.first();
  const tag = await first.getAttribute('data-tag');
  await expect(first).toContainText(`#${tag}`);
  await expect(first.locator('.count')).toHaveText(String(withTag(tag).length));
});

test('clicking a card pill filters the grid to that tag and marks it active', async ({ page }) => {
  const tag = pickTag();
  test.skip(!tag, 'every meme shares every tag right now');
  const source = index.find((m) => m.tags.slice(0, 3).includes(tag));
  await page.locator(`.card[data-slug="${source.slug}"] button.tag[data-tag="${tag}"]`).click();

  expect(await visibleSlugs(page)).toEqual(withTag(tag));
  await expect(page.locator('#status')).toContainText(`#${tag}`);
  await expect(page).toHaveURL(new RegExp(`[?&]tag=${encodeURIComponent(tag)}`));
  for (const pill of await page.locator(`button.tag[data-tag="${tag}"]`).all()) {
    await expect(pill).toHaveAttribute('aria-pressed', 'true');
  }
});

test('clicking the active tag again clears the filter', async ({ page }) => {
  const tag = pickTag();
  test.skip(!tag, 'every meme shares every tag right now');
  const topic = page.locator(`.topics button.tag[data-tag="${tag}"]`);
  test.skip((await topic.count()) === 0, 'tag is not in the topics row');

  await topic.click();
  expect((await visibleSlugs(page)).length).toBeLessThan(index.length);
  await topic.click();
  expect(await visibleSlugs(page)).toHaveLength(index.length);
  await expect(page).not.toHaveURL(/tag=/);
});

test('the tag filter combines with search and the clear button resets it', async ({ page }) => {
  const tag = pickTag();
  test.skip(!tag, 'every meme shares every tag right now');
  const outside = index.find((m) => !m.tags.includes(tag));

  await page.locator(`button.tag[data-tag="${tag}"]`).first().click();
  await page.locator('#q').fill(outside.caption);
  // The searched meme lacks the tag, so it must stay hidden.
  await expect(page.locator(`.card[data-slug="${outside.slug}"]`)).toBeHidden();

  await page.locator('#q').fill('zzzzqqqq');
  await expect(page.locator('#none')).toBeVisible();
  await page.locator('#clear').click();
  expect(await visibleSlugs(page)).toHaveLength(index.length);
  await expect(page.locator('button.tag[aria-pressed="true"]')).toHaveCount(0);
});

test('a tag in the URL is applied on load', async ({ page }) => {
  const tag = pickTag();
  test.skip(!tag, 'every meme shares every tag right now');
  await page.goto(`/meme/?tag=${encodeURIComponent(tag)}`);
  await ready(page);
  expect(await visibleSlugs(page)).toEqual(withTag(tag));
  await expect(page.locator(`button.tag[data-tag="${tag}"]`).first()).toHaveAttribute('aria-pressed', 'true');
});

test('a tag pill does not trigger copy, download or the large view', async ({ page }) => {
  const m = index.find((x) => x.tags.length);
  await page.locator(`.card[data-slug="${m.slug}"] button.tag`).first().click();
  await expect(page.locator('#viewer')).toBeHidden();
  await expect(page.locator('#info-dialog')).toBeHidden();
  await expect(page.locator('.badge:not(:empty)')).toHaveCount(0);
});
