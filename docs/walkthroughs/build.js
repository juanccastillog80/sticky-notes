// Builds a PR walkthrough from a spec plus the real code in git.
//   node docs/walkthroughs/build.js docs/walkthroughs/<name>.json [--check]
// The authoring guide is docs/agents/pr-walkthrough.md.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

// Only the numbered walkthroughs are left out of the diff: a page can't contain
// itself. The builder and the template are reviewed like any other code.
const EXCLUDE = ':(top,exclude,glob)docs/walkthroughs/[0-9]*';

const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

function fail(problems) {
  console.error(`Walkthrough not built:\n- ${problems.join('\n- ')}`);
  process.exit(1);
}

/** The 0-based lines that the diff adds or changes in `path`. */
function addedLines(base, head, path) {
  const diff = git(
    'diff',
    '--no-ext-diff',
    '--no-renames',
    '-U0',
    base,
    head,
    '--',
    `:(top)${path}`,
  );
  return [...diff.matchAll(/^@@ -\S+ \+(\d+)(?:,(\d+))? @@/gm)].flatMap(([, start, count = '1']) =>
    Array.from({ length: Number(count) }, (_, i) => Number(start) - 1 + i),
  );
}

/** Turns `{ file, from, to? }` into line numbers, so a step can't point at code that isn't there. */
function locate({ file, from, to }, files, where, problems) {
  const lines = files.get(file)?.lines;
  if (!lines) {
    problems.push(`${where}: "${file}" is not listed in "files"`);
    return null;
  }
  const starts = lines.flatMap((line, i) => (line.includes(from) ? [i] : []));
  if (starts.length !== 1) {
    problems.push(`${where}: "${from}" matches ${starts.length} lines in ${file}, expected 1`);
    return null;
  }
  const start = starts[0];
  const end = to ? lines.findIndex((line, i) => i >= start && line.includes(to)) : start;
  if (end < 0) {
    problems.push(`${where}: no "${to}" after "${from}" in ${file}`);
    return null;
  }
  return { file, start, end };
}

const args = process.argv.slice(2);
const specPath = args.find((arg) => arg.endsWith('.json'));
if (!specPath) fail(['usage: node docs/walkthroughs/build.js <spec.json> [--check]']);

if (!/^\d{4}-[\w-]+\.json$/.test(basename(specPath))) {
  fail(['name the spec <issue, 4 digits>-<slug>.json, with 0000 when there is no issue']);
}
const spec = JSON.parse(readFileSync(specPath, 'utf8'));
const problems = [];

// Without a pinned head, the page describes HEAD, so HEAD must contain all the code.
if (!spec.head && git('status', '--porcelain', '-uall', '--', ':/', EXCLUDE).trim()) {
  fail(['commit or stash changes first: the page is built from HEAD']);
}

const head = spec.head ?? 'HEAD';
const base = spec.base ?? git('merge-base', 'origin/main', head).trim();
const changed = git('diff', '--no-renames', '--name-only', '-z', base, head, '--', ':/', EXCLUDE)
  .split('\0')
  .filter(Boolean);
if (!changed.length) fail([`nothing changed between ${base} and ${head}`]);

const omitted = spec.omitted ?? {};
const atHead = new Set(git('ls-tree', '-r', '-z', '--name-only', '--full-tree', head).split('\0'));
const files = new Map();

for (const file of spec.files) {
  if (!atHead.has(file.path)) {
    problems.push(`${file.path} doesn't exist at ${head}`);
    continue;
  }
  const lines = git('show', `${head}:${file.path}`).replace(/\n$/, '').split('\n');
  files.set(file.path, { ...file, lines, added: addedLines(base, head, file.path) });
}

for (const path of changed) {
  if (!files.has(path) && !omitted[path]) {
    problems.push(`${path} changed: add it to "files", or to "omitted" with a reason`);
  }
}

const visited = new Set();
const scenarios = spec.scenarios.map((scenario) => ({
  ...scenario,
  steps: scenario.steps.map((step) => ({
    ...step,
    run: step.run.flatMap((range) => {
      visited.add(range.file);
      return locate(range, files, `${scenario.name} / ${step.title}`, problems) ?? [];
    }),
  })),
}));

for (const path of files.keys()) {
  if (!visited.has(path)) problems.push(`${path} is shown, but no step explains it`);
}
for (const path of spec.flow.flat()) {
  if (!files.has(path)) problems.push(`flow: "${path}" is not listed in "files"`);
}
if (problems.length) fail(problems);

const page = { ...spec, files: [...files.values()], omitted, scenarios };
// `<` is escaped so that code containing </script> can't end the script tag.
const data = JSON.stringify(page).replaceAll('<', '\\u003c');
const html = readFileSync(new URL('template.html', import.meta.url), 'utf8').replace(
  '/*DATA*/ null',
  () => data,
);

const outPath = specPath.replace(/\.json$/, '.html');
if (args.includes('--check')) {
  if (!existsSync(outPath) || readFileSync(outPath, 'utf8') !== html) {
    fail([`${outPath} is out of date: build it again`]);
  }
  process.stdout.write(`${outPath} is up to date\n`);
} else {
  writeFileSync(outPath, html);
  process.stdout.write(`${outPath}: ${changed.length} changed files accounted for\n`);
}
