import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildPrototypes, buildWalkthroughs } from './site.js';

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'site-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function walkthrough(name, spec) {
  writeFileSync(join(dir, `${name}.html`), `<p>${name}</p>`);
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(spec));
}

const links = (index) => [...index.matchAll(/href="([^"]+)"/g)].map(([, href]) => href);

describe('buildWalkthroughs', () => {
  it('copies numbered pages and lists them newest first', () => {
    walkthrough('0000-tooling', { title: 'Tooling' });
    walkthrough('0003-create', { title: 'Create', issue: 3 });
    walkthrough('0004-move', { title: 'Move <fast>', issue: 4 });
    const out = join(dir, 'out');

    expect(buildWalkthroughs(dir, out)).toBe(3);

    const index = readFileSync(join(out, 'index.html'), 'utf8');
    expect(links(index)).toEqual(['0004-move.html', '0003-create.html', '0000-tooling.html']);
    expect(index).toContain('Move &lt;fast&gt;</a> <span>#4');
    expect(index).toContain('Tooling</a></li>');
    expect(readFileSync(join(out, '0004-move.html'), 'utf8')).toBe('<p>0004-move</p>');
  });

  it('leaves out files that are not numbered walkthroughs', () => {
    writeFileSync(join(dir, 'template.html'), '<p>template</p>');
    writeFileSync(join(dir, 'build.js'), '');
    walkthrough('0002-skeleton', { title: 'Skeleton', issue: 2 });
    const out = join(dir, 'out');

    buildWalkthroughs(dir, out);

    expect(readdirSync(out).sort()).toEqual(['0002-skeleton.html', 'index.html']);
  });
});

describe('buildPrototypes', () => {
  it('copies every page and lists them by name, titled from <title>', () => {
    writeFileSync(join(dir, 'visual.html'), '<title> Visual design </title>');
    writeFileSync(join(dir, 'board.html'), '<p>no title</p>');
    writeFileSync(join(dir, 'README.md'), '# Prototypes');
    const out = join(dir, 'out');

    expect(buildPrototypes(dir, out)).toBe(2);

    const index = readFileSync(join(out, 'index.html'), 'utf8');
    expect(links(index)).toEqual(['board.html', 'visual.html']);
    expect(index).toContain('>board</a>');
    expect(index).toContain('>Visual design</a>');
    expect(readdirSync(out).sort()).toEqual(['board.html', 'index.html', 'visual.html']);
  });
});
