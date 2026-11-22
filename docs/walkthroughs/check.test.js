import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const CHECK = join(import.meta.dirname, 'check.js');
const DIR = 'docs/walkthroughs';
const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

let repo;

function git(...args) {
  const identity = ['-c', 'user.name=Test', '-c', 'user.email=test@localhost'];
  return execFileSync('git', [...identity, ...args], { cwd: repo, env, encoding: 'utf8' });
}

function write(path, text) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
}

function commitAll() {
  git('add', '-A');
  git('commit', '-qm', 'change');
}

function addWalkthrough(name = '0007-example', overrides = {}) {
  const spec = {
    title: 'Example',
    files: [{ path: 'a.ts' }],
    flow: [],
    scenarios: [{ name: 'Main', steps: [{ title: 'Run', run: [{ file: 'a.ts', from: 'two' }] }] }],
    notes: [],
    ...overrides,
  };
  write(`${DIR}/${name}.json`, JSON.stringify(spec));
  execFileSync(process.execPath, [`${DIR}/build.js`, `${DIR}/${name}.json`], { cwd: repo, env });
  commitAll();
}

const check = (...args) =>
  spawnSync(process.execPath, [CHECK, ...args], { cwd: repo, env, encoding: 'utf8' });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'walkthrough-check-'));
  git('init', '-q', '-b', 'main');
  write('package.json', '{ "type": "module" }\n');
  write('a.ts', 'one\n\n\n\nlast\n');
  write(`${DIR}/0001-merged.json`, '{}\n');
  write(`${DIR}/0001-merged.html`, 'merged page\n');
  for (const file of ['build.js', 'template.html']) {
    copyFileSync(join(import.meta.dirname, file), join(repo, DIR, file));
  }
  commitAll();
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  git('switch', '-qc', 'feature');
  write('a.ts', 'one\ntwo\n\n\nlast\n');
  commitAll();
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('walkthrough CI check', { timeout: 20_000 }, () => {
  it('passes a PR with a current walkthrough', () => {
    addWalkthrough();

    expect(check().status).toBe(0);
  });

  it('fails a PR without a walkthrough', () => {
    const result = check();

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('found 0');
  });

  it('fails when code changed after the walkthrough was built', () => {
    addWalkthrough();
    write('a.ts', 'one\ntwo\nthree\n\nlast\n');
    commitAll();

    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('out of date');
  });

  it('fails when a newly changed file is not explained', () => {
    addWalkthrough();
    write('b.ts', 'extra\n');
    commitAll();

    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('b.ts changed');
  });

  it('fails when the spec is committed without its page', () => {
    addWalkthrough();
    git('rm', '-q', `${DIR}/0007-example.html`);
    commitAll();

    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('out of date');
  });

  it('fails a PR with two walkthroughs', () => {
    addWalkthrough();
    addWalkthrough('0008-second');

    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('found 2');
  });

  it.each(['base', 'head'])('fails a walkthrough that pins its %s', (key) => {
    addWalkthrough('0007-example', { [key]: key === 'base' ? 'main' : 'HEAD' });

    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('must not pin');
  });

  it.each([
    ['edits', () => write(`${DIR}/0001-merged.html`, 'rewritten\n')],
    ['deletes', () => git('rm', '-q', `${DIR}/0001-merged.html`)],
  ])('fails a PR that %s a merged walkthrough', (_, change) => {
    addWalkthrough();
    change();
    commitAll();

    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('0001-merged.html');
  });

  it('fails a numbered file that would escape the builder', () => {
    addWalkthrough();
    write(`${DIR}/0007-hidden.js`, 'hidden\n');
    commitAll();

    const result = check();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('0007-hidden.js');
  });

  it('checks the branch tip, not the merge commit that CI checks out', () => {
    addWalkthrough();
    const tip = git('rev-parse', 'HEAD').trim();
    git('switch', '-q', 'main');
    // main moves the PR's lines, and gains another PR's walkthrough
    write('a.ts', 'one\n\n\n\nlast\nfrom main\n');
    write(`${DIR}/0002-other.json`, '{}\n');
    commitAll();
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('merge', '-q', '--no-edit', 'feature');

    expect(check(tip).status).toBe(0);
  });

  it('leaves no worktree behind', () => {
    addWalkthrough();

    expect(check().status).toBe(0);
    expect(git('worktree', 'list').trim().split('\n')).toHaveLength(1);
  });
});
