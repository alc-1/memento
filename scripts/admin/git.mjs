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
 * Commits one new meme (and the inbox file it consumed, if that was tracked), nothing else:
 * paths are named explicitly, never `git add -A`, so unrelated work is not swept in.
 * Never throws: the meme is already saved, so a git problem is reported, not fatal.
 */
export async function commitMeme(root, { slug, inboxFile, push }) {
  const result = { committed: false, pushed: false, error: null };
  try {
    const paths = [`memes/${slug}`];
    const inboxPath = `inbox/${inboxFile}`;
    if (await git(root, ['ls-files', '--', inboxPath])) paths.push(inboxPath);

    await git(root, ['add', '--all', '--', ...paths]);
    await git(root, ['commit', '-m', `Add meme: ${slug}`, '--', ...paths]);
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
