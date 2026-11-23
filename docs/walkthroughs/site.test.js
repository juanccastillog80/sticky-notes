import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildSite } from './site.js';

let dir;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'site-'));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function walkthrough(name, spec) {
  writeFileSync(join(dir, `${name}.html`), `<p>${name}</p>`);
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(spec));
}

describe('buildSite', () => {
  it('copies numbered pages and lists them newest first', () => {
    walkthrough('0000-tooling', { title: 'Tooling' });
    walkthrough('0003-create', { title: 'Create', issue: 3 });
    walkthrough('0004-move', { title: 'Move <fast>', issue: 4 });
    const out = join(dir, 'out');

    expect(buildSite(dir, out)).toBe(3);

    const index = readFileSync(join(out, 'index.html'), 'utf8');
    const links = [...index.matchAll(/href="([^"]+)"/g)].map(([, href]) => href);
    expect(links).toEqual(['0004-move.html', '0003-create.html', '0000-tooling.html']);
    expect(index).toContain('Move &lt;fast&gt;</a> <span>#4</span>');
    expect(index).not.toContain('#undefined');
    expect(readFileSync(join(out, '0004-move.html'), 'utf8')).toBe('<p>0004-move</p>');
  });

  it('leaves out the template and other files', () => {
    writeFileSync(join(dir, 'template.html'), '<p>template</p>');
    writeFileSync(join(dir, 'build.js'), '');
    walkthrough('0002-skeleton', { title: 'Skeleton', issue: 2 });
    const out = join(dir, 'out');

    buildSite(dir, out);

    expect(readdirSync(out).sort()).toEqual(['0002-skeleton.html', 'index.html']);
  });
});
