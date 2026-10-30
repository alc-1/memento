import { test, expect } from '@playwright/test';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { slugify, uniqueSlug } from '../scripts/lib/slug.mjs';
import { hashBytes, indexOriginals } from '../scripts/lib/hash.mjs';
import { buildMeta } from '../scripts/lib/meta.mjs';
import { SLUG_RE } from '../scripts/lib/validate.mjs';

const cases = [
  ['Chaton du lundi', 'chaton-du-lundi'],
  ['Réunion inutile à 17h !', 'reunion-inutile-a-17h'],
  ['  --Hello__World--  ', 'hello-world'],
  ['Ça va être génial', 'ca-va-etre-genial'],
  ['🔥🔥🔥', 'meme'],
  ['', 'meme'],
  [undefined, 'meme'],
];
for (const [input, expected] of cases) {
  test(`slugify(${JSON.stringify(input)}) -> ${expected}`, () => {
    expect(slugify(input)).toBe(expected);
  });
}

test('slugify caps length on a word boundary and stays valid', () => {
  const slug = slugify('this is a very long caption that keeps going well past the fifty character limit');
  expect(slug.length).toBeLessThanOrEqual(50);
  expect(slug).toMatch(SLUG_RE);
  expect(slug).toBe('this-is-a-very-long-caption-that-keeps-going-well');
});

test('uniqueSlug appends -2, -3 on collision', () => {
  expect(uniqueSlug('a', new Set())).toBe('a');
  expect(uniqueSlug('a', new Set(['a']))).toBe('a-2');
  expect(uniqueSlug('a', ['a', 'a-2'])).toBe('a-3');
});

test('indexOriginals finds duplicates by content, ignoring folders without image', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'memento-'));
  await mkdir(path.join(dir, 'one'));
  await mkdir(path.join(dir, 'empty'));
  await writeFile(path.join(dir, 'one', 'original.png'), 'bytes');
  const index = await indexOriginals(dir);
  expect(index.get(hashBytes(Buffer.from('bytes')))).toBe('one');
  expect(index.size).toBe(1);
});

test('buildMeta has stable key order and drops empty optionals', () => {
  const meta = buildMeta({
    mine: true, author: ' Alvaro ', source: 'original', tags: ['a', ' a ', '', 'b'],
    language: 'fr', caption: ' Hi ', category: '',
  });
  expect(Object.keys(meta)).toEqual(['caption', 'language', 'tags', 'source', 'author', 'mine']);
  expect(meta).toMatchObject({ caption: 'Hi', language: 'FR', tags: ['a', 'b'], author: 'Alvaro' });
});
