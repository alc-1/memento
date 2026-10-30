import { test, expect } from '@playwright/test';
import { mkdtemp, readFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import http from 'node:http';
import path from 'node:path';
import sharp from 'sharp';
import { createAdminServer } from '../scripts/admin/server.mjs';

test.describe.configure({ mode: 'serial' });

let server, base, root, port;

const png = (color) =>
  sharp({ create: { width: 20, height: 20, channels: 3, background: color } }).png().toBuffer();

const upload = (buffer, filename = 'cat.png') =>
  fetch(`${base}/api/inbox`, { method: 'POST', headers: { 'X-Filename': encodeURIComponent(filename) }, body: buffer });

const save = (body) =>
  fetch(`${base}/api/memes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const form = { caption: 'Chaton du lundi', source: 'somewhere', author: 'someone', tags: ['chat'] };

test.beforeAll(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'memento-admin-'));
  server = createAdminServer({ root });
  port = await server.listenLocal(0);
  base = `http://127.0.0.1:${port}`;
});

test.afterAll(() => new Promise((resolve) => server.close(resolve)));

test('serves the admin page', async () => {
  const res = await fetch(`${base}/`);
  expect(res.status).toBe(200);
  expect(res.headers.get('content-type')).toContain('text/html');
});

test('rejects non-images and unsupported content', async () => {
  const res = await upload(Buffer.from('not an image'));
  expect(res.status).toBe(415);
});

test('saves an inbox image as a valid meme folder', async () => {
  const up = await (await upload(await png('red'))).json();
  expect(up).toMatchObject({ name: 'cat.png', duplicateOf: null });

  const res = await save({ inboxFile: up.name, meta: form });
  expect(res.status).toBe(200);
  expect((await res.json()).slug).toBe('chaton-du-lundi');

  const dir = path.join(root, 'memes', 'chaton-du-lundi');
  expect((await readdir(dir)).sort()).toEqual(['meta.json', 'original.png']);
  const meta = JSON.parse(await readFile(path.join(dir, 'meta.json'), 'utf8'));
  expect(meta).toMatchObject({ caption: 'Chaton du lundi', tags: ['chat'], mine: false });
  expect(existsSync(path.join(root, 'inbox', 'cat.png'))).toBe(false);
  expect((await readdir(root)).filter((f) => f.startsWith('.admin-tmp-'))).toEqual([]);
});

test('flags an identical image as duplicate and blocks saving it', async () => {
  const up = await (await upload(await png('red'), 'again.png')).json();
  expect(up.duplicateOf).toBe('chaton-du-lundi');

  const res = await save({ inboxFile: up.name, meta: form });
  expect(res.status).toBe(409);
  expect((await res.json()).duplicateOf).toBe('chaton-du-lundi');
});

test('allowDuplicate saves with a -2 slug on caption collision', async () => {
  const res = await save({ inboxFile: 'again.png', meta: form, allowDuplicate: true });
  expect((await res.json()).slug).toBe('chaton-du-lundi-2');
});

test('rejects a meme without author and keeps the inbox file', async () => {
  const up = await (await upload(await png('blue'), 'blue.png')).json();
  const res = await save({ inboxFile: up.name, meta: { ...form, author: '' } });
  expect(res.status).toBe(422);
  expect((await res.json()).error).toContain('author');
  expect(existsSync(path.join(root, 'inbox', 'blue.png'))).toBe(true);
  expect(existsSync(path.join(root, 'memes', 'chaton-du-lundi-3'))).toBe(false);
});

test('rejects an invalid explicit slug', async () => {
  const res = await save({ inboxFile: 'blue.png', meta: form, slug: '../evil' });
  expect(res.status).toBe(400);
});

test('state lists inbox, tag vocabulary and recent values', async () => {
  const state = await (await fetch(`${base}/api/state`)).json();
  expect(state.inbox.map((f) => f.name)).toEqual(['blue.png']);
  expect(state.tags[0]).toEqual({ value: 'chat', count: 2 });
  expect(state.authors[0].value).toBe('someone');
});

test('path traversal in the inbox route and in uploads is neutralised', async () => {
  expect((await fetch(`${base}/api/inbox/${encodeURIComponent('../memes/chaton-du-lundi/meta.json')}`)).status).toBe(404);
  const up = await (await upload(await png('green'), '../../escape.png')).json();
  expect(up.name).toBe('escape.png');
  expect(existsSync(path.join(root, 'escape.png'))).toBe(false);
  expect((await fetch(`${base}/..%2f..%2fpackage.json`)).status).toBe(404);
});

test('rejects a foreign Origin', async () => {
  const res = await fetch(`${base}/api/state`, { headers: { Origin: 'https://evil.example' } });
  expect(res.status).toBe(403);
});

test('rejects a foreign Host header (DNS rebinding)', async () => {
  const status = await new Promise((resolve, reject) => {
    http
      .get({ host: '127.0.0.1', port, path: '/api/state', headers: { Host: 'evil.example' } }, (res) => {
        res.resume();
        resolve(res.statusCode);
      })
      .on('error', reject);
  });
  expect(status).toBe(403);
});
