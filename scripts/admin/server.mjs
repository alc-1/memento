import http from 'node:http';
import { execFile } from 'node:child_process';
import { readdir, readFile, writeFile, mkdir, mkdtemp, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { findOriginal, validateMeta, SLUG_RE } from '../lib/validate.mjs';
import { slugify, uniqueSlug } from '../lib/slug.mjs';
import { hashBytes, indexOriginals } from '../lib/hash.mjs';
import { buildMeta, writeMeta } from '../lib/meta.mjs';
import { commitMeme } from './git.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ADMIN_DIR = path.join(REPO_ROOT, 'admin');
const MAX_UPLOAD = 30 * 1024 * 1024;
const MAX_JSON = 1024 * 1024;
const FORMAT_EXT = { png: 'png', jpeg: 'jpg', webp: 'webp', gif: 'gif' };
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

async function readBody(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'request body too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  try {
    return JSON.parse((await readBody(req, MAX_JSON)).toString('utf8'));
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw new HttpError(400, 'invalid JSON body');
  }
}

/** Letters, digits, dot, dash, underscore only; no directory part. */
function safeName(name) {
  const base = path.basename(String(name ?? '')).replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '');
  return base || 'image';
}

function countBy(values) {
  const counts = new Map();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([value, count]) => ({ value, count }));
}

export function createAdminServer({ root = process.env.MEMENTO_ROOT ?? REPO_ROOT } = {}) {
  const memesDir = path.join(root, 'memes');
  const inboxDir = path.join(root, 'inbox');
  let port = 0;

  const send = (res, status, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(type.startsWith('application/json') ? JSON.stringify(body) : body);
  };

  /** Rejects foreign pages (CSRF) and rebinding tricks: only our own host:port may talk to us. */
  function checkOrigin(req) {
    const allowed = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
    if (!allowed.has(req.headers.host ?? '')) throw new HttpError(403, 'forbidden host');
    const origin = req.headers.origin;
    if (origin && !allowed.has(origin.replace(/^https?:\/\//, ''))) throw new HttpError(403, 'forbidden origin');
  }

  async function loadMetas() {
    const metas = [];
    if (!existsSync(memesDir)) return metas;
    for (const entry of await readdir(memesDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      try {
        metas.push({ slug: entry.name, ...JSON.parse(await readFile(path.join(memesDir, entry.name, 'meta.json'), 'utf8')) });
      } catch {
        // The build script reports broken folders; the admin just skips them.
      }
    }
    return metas;
  }

  async function listInbox() {
    if (!existsSync(inboxDir)) return [];
    const originals = await indexOriginals(memesDir);
    const files = [];
    for (const name of (await readdir(inboxDir)).sort()) {
      const ext = path.extname(name).slice(1).toLowerCase();
      if (!Object.values(FORMAT_EXT).includes(ext) && ext !== 'jpeg') continue;
      const hash = hashBytes(await readFile(path.join(inboxDir, name)));
      files.push({ name, hash, duplicateOf: originals.get(hash) ?? null });
    }
    return files;
  }

  async function inboxPath(name) {
    // Only names that really sit in the inbox are accepted, which rules out any path trick.
    if (!existsSync(inboxDir) || !(await readdir(inboxDir)).includes(name)) throw new HttpError(404, 'not in inbox');
    return path.join(inboxDir, name);
  }

  const routes = {
    async 'GET /api/state'() {
      const metas = await loadMetas();
      return {
        inbox: await listInbox(),
        slugs: metas.map((m) => m.slug),
        tags: countBy(metas.flatMap((m) => m.tags ?? [])),
        categories: countBy(metas.map((m) => m.category).filter(Boolean)),
        languages: countBy(metas.map((m) => m.language).filter(Boolean)),
        authors: countBy(metas.map((m) => m.author).filter(Boolean)),
        sources: countBy(metas.map((m) => m.source).filter(Boolean)),
      };
    },

    async 'POST /api/inbox'(req) {
      const buffer = await readBody(req, MAX_UPLOAD);
      let format;
      try {
        format = (await sharp(buffer).metadata()).format;
      } catch {
        throw new HttpError(415, 'not a readable image');
      }
      const ext = FORMAT_EXT[format];
      if (!ext) throw new HttpError(415, `unsupported image format "${format}"`);

      const stem = path.parse(safeName(decodeURIComponent(req.headers['x-filename'] ?? 'image'))).name || 'image';
      await mkdir(inboxDir, { recursive: true });
      const existing = new Set(await readdir(inboxDir));
      let name = `${stem}.${ext}`;
      for (let n = 2; existing.has(name); n++) name = `${stem}-${n}.${ext}`;
      await writeFile(path.join(inboxDir, name), buffer);

      const hash = hashBytes(buffer);
      const duplicateOf = (await indexOriginals(memesDir)).get(hash) ?? null;
      return { name, hash, duplicateOf };
    },

    /** Runs the same validation as `npm run check`, against this server's root. */
    async 'POST /api/check'() {
      const script = path.join(REPO_ROOT, 'scripts', 'build-content.mjs');
      return new Promise((resolve) => {
        execFile(process.execPath, [script, '--check'], { env: { ...process.env, MEMENTO_ROOT: root } }, (err, stdout, stderr) => {
          if (!err) return resolve({ ok: true, count: Number(stdout.match(/OK: (\d+)/)?.[1] ?? 0) });
          const errors = stderr.split('\n').map((l) => l.trim()).filter((l) => l.startsWith('memes/'));
          resolve({ ok: false, errors: errors.length ? errors : [stderr.trim() || err.message] });
        });
      });
    },

    async 'POST /api/memes'(req) {
      const body = await readJson(req);
      const source = await inboxPath(String(body.inboxFile ?? ''));
      const bytes = await readFile(source);

      const duplicateOf = (await indexOriginals(memesDir)).get(hashBytes(bytes));
      if (duplicateOf && body.allowDuplicate !== true) {
        throw new HttpError(409, `identical to existing meme "${duplicateOf}"`, { duplicateOf });
      }

      const meta = buildMeta(body.meta ?? {});
      let base = typeof body.slug === 'string' && body.slug ? body.slug : slugify(meta.caption);
      if (!SLUG_RE.test(base)) throw new HttpError(400, `invalid slug "${base}"`);
      const taken = existsSync(memesDir) ? await readdir(memesDir) : [];
      const slug = uniqueSlug(base, taken);

      const ext = path.extname(source).slice(1).toLowerCase().replace('jpeg', 'jpg');
      const errors = validateMeta(slug, meta, `original.${ext}`);
      if (errors.length) throw new HttpError(422, errors.join('; '), { errors });

      // Build in a scratch folder outside memes/, then rename: no half-written meme on failure.
      const scratch = await mkdtemp(path.join(root, '.admin-tmp-'));
      try {
        await writeFile(path.join(scratch, `original.${ext}`), bytes);
        await writeMeta(path.join(scratch, 'meta.json'), meta);
        await mkdir(memesDir, { recursive: true });
        await rename(scratch, path.join(memesDir, slug));
      } catch (err) {
        await rm(scratch, { recursive: true, force: true });
        throw err;
      }
      await rm(source);

      const result = { slug, meta };
      if (body.git?.commit) {
        result.git = await commitMeme(root, { slug, inboxFile: body.inboxFile, push: body.git.push === true });
      }
      return result;
    },
  };

  async function serveStatic(res, rel) {
    // The browser reuses the server's slug rules, so the live preview can never drift from the real slug.
    const file = rel === '/lib/slug.mjs'
      ? path.join(REPO_ROOT, 'scripts', 'lib', 'slug.mjs')
      : path.normalize(path.join(ADMIN_DIR, rel === '/' ? 'index.html' : rel));
    if (!(file.startsWith(ADMIN_DIR + path.sep) || rel === '/lib/slug.mjs') || !existsSync(file)) {
      throw new HttpError(404, 'not found');
    }
    send(res, 200, await readFile(file), MIME[path.extname(file)] ?? 'application/octet-stream');
  }

  async function serveImage(res, kind, name) {
    let file;
    if (kind === 'inbox') {
      file = await inboxPath(name);
    } else {
      if (!SLUG_RE.test(name)) throw new HttpError(404, 'not found');
      const dir = path.join(memesDir, name);
      const original = existsSync(dir) ? await findOriginal(dir) : null;
      if (!original) throw new HttpError(404, 'not found');
      file = path.join(dir, original);
    }
    send(res, 200, await readFile(file), MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream');
  }

  const server = http.createServer(async (req, res) => {
    try {
      checkOrigin(req);
      const url = new URL(req.url, 'http://localhost');
      const image = url.pathname.match(/^\/api\/(inbox|meme)\/([^/]+)$/);
      if (req.method === 'GET' && image) return await serveImage(res, image[1], decodeURIComponent(image[2]));
      if (req.method === 'DELETE' && image?.[1] === 'inbox') {
        await rm(await inboxPath(decodeURIComponent(image[2])));
        return send(res, 200, { ok: true });
      }
      const route = routes[`${req.method} ${url.pathname}`];
      if (route) return send(res, 200, await route(req));
      if (req.method === 'GET' && !url.pathname.startsWith('/api/')) return await serveStatic(res, url.pathname);
      throw new HttpError(404, 'not found');
    } catch (err) {
      if (err instanceof HttpError) return send(res, err.status, { error: err.message, ...err.extra });
      console.error(err);
      send(res, 500, { error: 'internal error' });
    }
  });

  /** Listens on 127.0.0.1 only. Pass 0 for a random port (tests). */
  server.listenLocal = (wantedPort) =>
    new Promise((resolve) => {
      server.listen(wantedPort, '127.0.0.1', () => {
        port = server.address().port;
        resolve(port);
      });
    });

  return server;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const server = createAdminServer();
  const port = await server.listenLocal(Number(process.env.PORT ?? 4322));
  console.log(`Memento admin: http://127.0.0.1:${port}/`);
}
