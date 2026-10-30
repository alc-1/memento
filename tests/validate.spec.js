import { test, expect } from '@playwright/test';
import { validateMeta } from '../scripts/lib/validate.mjs';

const valid = { caption: 'Hello', source: 'somewhere', author: 'someone' };

test('accepts a complete meme', () => {
  expect(validateMeta('chaton-lundi', valid, 'original.png')).toEqual([]);
});

test('rejects a folder without its image', () => {
  expect(validateMeta('chaton-lundi', valid, null)).toEqual([expect.stringContaining('missing original')]);
});

for (const field of ['caption', 'source', 'author']) {
  test(`rejects a missing or blank ${field}`, () => {
    for (const value of [undefined, '', '   ']) {
      const errors = validateMeta('chaton-lundi', { ...valid, [field]: value }, 'original.png');
      expect(errors).toEqual([expect.stringContaining(`"${field}"`)]);
    }
  });
}

for (const slug of ['Chaton-Lundi', 'chaton_lundi', 'chaton lundi', 'chatôn', '-chaton', 'chaton--lundi']) {
  test(`rejects slug "${slug}"`, () => {
    const errors = validateMeta(slug, valid, 'original.png');
    expect(errors).toEqual([expect.stringContaining('kebab-case')]);
  });
}

test('rejects badly typed tags and mine', () => {
  const errors = validateMeta('a', { ...valid, tags: 'x', mine: 'yes' }, 'original.png');
  expect(errors).toHaveLength(2);
});
