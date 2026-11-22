import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const BUILD = join(import.meta.dirname, 'build.js');
const SPEC = 'docs/walkthroughs/0007-example.json';
const PAGE = 'docs/walkthroughs/0007-example.html';
// The developer's git config (signing, hooks) must not leak into the test repos.
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

function commit(path, text) {
  write(path, text);
  git('add', path);
  git('commit', '-qm', `change ${path}`);
}

function makeSpec(overrides) {
  return {
    title: 'Example',
    files: [{ path: 'a.ts' }],
    flow: [['a.ts']],
    scenarios: [{ name: 'Main', steps: [{ title: 'Run', run: [{ file: 'a.ts', from: 'two' }] }] }],
    notes: [],
    ...overrides,
  };
}

function build(spec = makeSpec(), { path = SPEC, flags = [], cwd = '.' } = {}) {
  write(path, JSON.stringify(spec));
  return spawnSync(process.execPath, [BUILD, join(repo, path), ...flags], {
    cwd: join(repo, cwd),
    env,
    encoding: 'utf8',
  });
}

const pageData = () =>
  JSON.parse(/const DATA = (.*);\n/.exec(readFileSync(join(repo, PAGE), 'utf8'))[1]);

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'walkthrough-'));
  git('init', '-q');
  commit('a.ts', 'one\n');
  git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  commit('a.ts', 'one\ntwo\n');
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

describe('walkthrough builder', { timeout: 20_000 }, () => {
  it('shows the committed code, the changed lines and the lines each step runs', () => {
    expect(build().status).toBe(0);

    const page = pageData();
    expect(page.files[0]).toMatchObject({ lines: ['one', 'two'], added: [1] });
    expect(page.scenarios[0].steps[0].run).toEqual([{ file: 'a.ts', start: 1, end: 1 }]);
  });

  it('works from a subfolder', () => {
    mkdirSync(join(repo, 'sub'));

    expect(build(makeSpec(), { cwd: 'sub' }).status).toBe(0);
    expect(pageData().files[0].added).toEqual([1]);
  });

  it('refuses uncommitted code', () => {
    write('a.ts', 'one\ntwo\nthree\n');

    expect(build().stderr).toContain('commit or stash changes first');
  });

  it('refuses a changed file that is neither shown nor omitted', () => {
    commit('b.ts', 'extra\n');

    expect(build().stderr).toContain('b.ts changed');
    expect(build(makeSpec({ omitted: { 'b.ts': 'Not relevant.' } })).status).toBe(0);
  });

  it('counts the builder and template as changes, but not the numbered walkthroughs', () => {
    commit('docs/walkthroughs/0003-other.html', 'page\n');
    commit('docs/walkthroughs/template.html', 'layout\n');

    const { stderr } = build();
    expect(stderr).toContain('template.html changed');
    expect(stderr).not.toContain('0003-other');
  });

  it.each([
    ['no line', 'missing', 0],
    ['several lines', 'o', 2],
  ])('refuses a step that points at %s', (_, from, count) => {
    const scenarios = [{ name: 'Main', steps: [{ title: 'Run', run: [{ file: 'a.ts', from }] }] }];

    expect(build(makeSpec({ scenarios })).stderr).toContain(`matches ${count} lines`);
  });

  it('refuses a file that no step explains', () => {
    expect(build(makeSpec({ scenarios: [] })).stderr).toContain('no step explains it');
  });

  it('refuses a spec without a four-digit prefix', () => {
    const result = build(makeSpec(), { path: 'docs/walkthroughs/example.json' });

    expect(result.stderr).toContain('name the spec');
  });

  it('stays up to date when the page is committed, and goes stale when the code changes', () => {
    build();
    git('add', 'docs');
    git('commit', '-qm', 'walkthrough');
    expect(build(makeSpec(), { flags: ['--check'] }).status).toBe(0);

    commit('a.ts', 'one\ntwo\nthree\n');
    expect(build(makeSpec(), { flags: ['--check'] }).stderr).toContain('out of date');
  });

  it('keeps code from closing the script tag or expanding replacement patterns', () => {
    const code = "two '</script>' $& $'";
    commit('a.ts', `one\n${code}\n`);

    expect(build().status).toBe(0);
    expect(readFileSync(join(repo, PAGE), 'utf8').match(/<\/script>/g)).toHaveLength(1);
    expect(pageData().files[0].lines[1]).toBe(code);
  });
});
