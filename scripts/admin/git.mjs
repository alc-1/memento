import { execFile } from 'node:child_process';

function git(root, args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, { cwd: root }, (err, stdout, stderr) => {
      if (err) reject(new Error((stderr || stdout || err.message).trim()));
      else resolve(stdout.trim());
    });
  });
}

/**
 * Commits exactly `paths`, nothing else: paths are named explicitly, never `git add -A`, so
 * unrelated work is not swept in. Deleted paths are staged too.
 * Never throws: the files are already written, so a git problem is reported, not fatal.
 * `committed` stays false (with no error) when the paths hold no change.
 */
export async function commitPaths(root, { message, paths, push }) {
  const result = { committed: false, pushed: false, error: null };
  try {
    await git(root, ['add', '--all', '--', ...paths]);
    if (!(await git(root, ['diff', '--cached', '--name-only', '--', ...paths]))) return result;
    await git(root, ['commit', '-m', message, '--', ...paths]);
    result.committed = true;

    if (push) {
      await git(root, ['push']);
      result.pushed = true;
    }
  } catch (err) {
    result.error = err.message;
  }
  return result;
}

/** A new meme, plus the inbox file it consumed if that was tracked. */
export async function commitMeme(root, { slug, inboxFile, push }) {
  const paths = [`memes/${slug}`];
  const inboxPath = `inbox/${inboxFile}`;
  try {
    if (await git(root, ['ls-files', '--', inboxPath])) paths.push(inboxPath);
  } catch {
    // Not a repo: commitPaths reports the real error.
  }
  return commitPaths(root, { message: `Add meme: ${slug}`, paths, push });
}
