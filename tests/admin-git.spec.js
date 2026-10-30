import { test, expect } from '@playwright/test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { createAdminServer } from '../scripts/admin/server.mjs';

// The tests share one repo and build on each other's commits.
test.describe.configure({ mode: 'serial' });

let server, base, root;
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();

const upload = async (color, filename) => {
  const body = await sharp({ create: { width: 10, height: 10, channels: 3, background: color } }).png().toBuffer();
  const res = await fetch(`${base}/api/inbox`, { method: 'POST', headers: { 'X-Filename': filename }, body });
  return (await res.json()).name;
};

const save = (inboxFile, git) =>
  fetch(`${base}/api/memes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inboxFile, meta: { caption: 'Hello there', source: 's', author: 'a' }, git }),
  }).then((r) => r.json());

test.beforeAll(async () => {
  // Fixed identity so the test works on machines (and CI) without a git config.
  Object.assign(process.env, {
    GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com',
    GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com',
  });
  root = await mkdtemp(path.join(tmpdir(), 'memento-git-'));
  git('init', '-q');
  await writeFile(path.join(root, 'README.md'), 'x');
  git('add', 'README.md');
  git('commit', '-q', '-m', 'init');
  server = createAdminServer({ root });
  base = `http://127.0.0.1:${await server.listenLocal(0)}`;
});

test.afterAll(() => new Promise((resolve) => server.close(resolve)));

test('commit contains only the new meme, not unrelated work', async () => {
  await writeFile(path.join(root, 'unrelated.txt'), 'wip');
  git('add', 'unrelated.txt');

  const name = await upload('red', 'a.png');
  const res = await save(name, { commit: true });
  expect(res.git).toMatchObject({ committed: true, pushed: false, error: null });

  expect(git('log', '-1', '--format=%s')).toBe('Add meme: hello-there');
  expect(git('show', '--name-only', '--format=', 'HEAD').split('\n').sort()).toEqual([
    'memes/hello-there/meta.json',
    'memes/hello-there/original.png',
  ]);
  expect(git('diff', '--cached', '--name-only')).toBe('unrelated.txt');
});

test('a push with no remote is reported, and the meme stays saved and committed', async () => {
  const name = await upload('blue', 'b.png');
  const res = await save(name, { commit: true, push: true });
  expect(res.slug).toBe('hello-there-2');
  expect(res.git.committed).toBe(true);
  expect(res.git.pushed).toBe(false);
  expect(res.git.error).toBeTruthy();
});

test('without the git option nothing is committed', async () => {
  const before = git('rev-parse', 'HEAD');
  const res = await save(await upload('green', 'c.png'));
  expect(res.git).toBeUndefined();
  expect(git('rev-parse', 'HEAD')).toBe(before);
});

test('a committed inbox file is removed in the same commit', async () => {
  const name = await upload('yellow', 'd.png');
  git('add', `inbox/${name}`);
  git('commit', '-q', '-m', 'inbox file', '--', `inbox/${name}`);
  await save(name, { commit: true });
  // Git reports the move into memes/ as a rename; either way the inbox path leaves the tree.
  expect(git('show', '--name-status', '--format=', 'HEAD')).toMatch(new RegExp(`^(D|R100)\\tinbox/${name}`, 'm'));
  expect(git('ls-files', 'inbox')).toBe('');
});

const send = (method, slug, body) =>
  fetch(`${base}/api/memes/${slug}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

const meta = { caption: 'Hello there', source: 's', author: 'a' };

test('editing commits only that meme meta.json', async () => {
  await writeFile(path.join(root, 'unrelated2.txt'), 'wip');
  git('add', 'unrelated2.txt');

  const res = await send('PUT', 'hello-there', { meta: { ...meta, tags: ['new'] }, git: { commit: true } });
  expect(res.git).toMatchObject({ committed: true, error: null });
  expect(git('log', '-1', '--format=%s')).toBe('Update meme: hello-there');
  expect(git('show', '--name-only', '--format=', 'HEAD')).toBe('memes/hello-there/meta.json');
  expect(git('diff', '--cached', '--name-only')).toContain('unrelated2.txt');
});

test('saving without any change makes no empty commit', async () => {
  const before = git('rev-parse', 'HEAD');
  const res = await send('PUT', 'hello-there', { meta: { ...meta, tags: ['new'] }, git: { commit: true } });
  expect(res.git).toEqual({ committed: false, pushed: false, error: null });
  expect(git('rev-parse', 'HEAD')).toBe(before);
});

test('deleting commits the removal of the folder', async () => {
  const res = await send('DELETE', 'hello-there-2', { git: { commit: true } });
  expect(res.git.committed).toBe(true);
  expect(git('log', '-1', '--format=%s')).toBe('Remove meme: hello-there-2');
  expect(git('show', '--name-status', '--format=', 'HEAD')).toMatch(/^D\tmemes\/hello-there-2\/original\.png$/m);
  expect(git('ls-files', 'memes/hello-there-2')).toBe('');
});
