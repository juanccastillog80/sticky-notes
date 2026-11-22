// The CI gate: a change to main must bring one current walkthrough of itself.
//   node docs/walkthroughs/check.js [commit, default HEAD]
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' });

function fail(message) {
  console.error(`Walkthrough check failed: ${message}\nSee docs/agents/pr-walkthrough.md.`);
  process.exit(1);
}

const head = git('rev-parse', '--verify', `${process.argv[2] ?? 'HEAD'}^{commit}`).trim();
const base = git('merge-base', 'origin/main', head).trim();
const diff = (filter) =>
  git('diff', '--no-renames', '--name-only', '-z', `--diff-filter=${filter}`, base, head)
    .split('\0')
    // build.js leaves numbered paths out of its diff, so all of them are vetted here.
    .filter((path) => /^docs\/walkthroughs\/\d/.test(path));

const added = diff('A');
const specs = added.filter((path) => /^docs\/walkthroughs\/\d{4}-[\w-]+\.json$/.test(path));
if (specs.length !== 1) {
  fail(`expected one new docs/walkthroughs/NNNN-slug.json, found ${specs.length}`);
}

const [spec] = specs;
const frozen = diff('a'); // lower case: everything except additions
if (frozen.length) fail(`merged walkthroughs are frozen, but this changes ${frozen.join(', ')}`);

const page = spec.replace(/\.json$/, '.html');
const strays = added.filter((path) => path !== spec && path !== page);
if (strays.length) fail(`not part of this walkthrough: ${strays.join(', ')}`);

const { base: pinnedBase, head: pinnedHead } = JSON.parse(git('show', `${head}:${spec}`));
if (pinnedBase || pinnedHead) fail(`${spec} must not pin "base" or "head"`);

// CI checks out the PR merged into main, where line numbers can differ. The page
// is built from the branch tip, so it's checked in a clean worktree of that tip.
const temp = mkdtempSync(join(tmpdir(), 'walkthrough-tip-'));
const tree = join(temp, 'tree');
git('worktree', 'add', '--quiet', '--detach', tree, head);
try {
  const result = spawnSync(process.execPath, ['docs/walkthroughs/build.js', spec, '--check'], {
    cwd: tree,
    encoding: 'utf8',
  });
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.status ?? 1;
} finally {
  git('worktree', 'remove', '--force', tree);
  rmSync(temp, { recursive: true, force: true });
}
