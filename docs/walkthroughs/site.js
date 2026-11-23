// Puts the walkthroughs and design prototypes on the Pages site, each with an index.
//   node docs/walkthroughs/site.js <site dir>
// writes <site dir>/walkthroughs/ and <site dir>/prototypes/.
// Only numbered walkthroughs are copied, so the template never ships as one.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const escape = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** A list page; `entries` are `{ name, title, tag? }`, shown in the order given. */
export function indexPage(heading, intro, entries) {
  const items = entries
    .map(
      ({ name, title, tag }) =>
        `      <li><a href="${escape(name)}.html">${escape(title)}</a>` +
        `${tag ? ` <span>${escape(tag)}</span>` : ''}</li>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(heading)}</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { max-width: 40rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
      li { margin: 0.4rem 0; }
      span { opacity: 0.6; }
    </style>
  </head>
  <body>
    <h1>${escape(heading)}</h1>
    <p>${escape(intro)}</p>
    <ul>
${items}
    </ul>
  </body>
</html>
`;
}

/** Copies the pages in `dir` that match `pattern` to `out`, and returns their names. */
function copyPages(dir, out, pattern) {
  const names = readdirSync(dir)
    .filter((f) => pattern.test(f))
    .map((f) => f.slice(0, -'.html'.length));
  mkdirSync(out, { recursive: true });
  for (const name of names) copyFileSync(join(dir, `${name}.html`), join(out, `${name}.html`));
  return names;
}

/**
 * Highest issue first, because names start with the zero-padded issue number;
 * `0000` pages (no issue) come last, in reverse name order. Titles come from the specs.
 */
export function buildWalkthroughs(dir, out) {
  const entries = copyPages(dir, out, /^\d{4}-.+\.html$/)
    .sort((a, b) => b.localeCompare(a))
    .map((name) => {
      const { title, issue } = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
      return { name, title, tag: issue ? `#${issue}` : undefined };
    });
  writeFileSync(
    join(out, 'index.html'),
    indexPage(
      'Walkthroughs',
      'One per merged PR: by issue, newest first, then PRs without an issue.',
      entries,
    ),
  );
  return entries.length;
}

/** Alphabetical; titles come from each page's `<title>`, falling back to the file name. */
export function buildPrototypes(dir, out) {
  const entries = copyPages(dir, out, /\.html$/)
    .sort()
    .map((name) => {
      const title = readFileSync(join(dir, `${name}.html`), 'utf8').match(
        /<title>([^<]*)<\/title>/,
      )?.[1];
      return { name, title: title?.trim() || name };
    });
  writeFileSync(
    join(out, 'index.html'),
    indexPage(
      'Design prototypes',
      'Throwaway pages, each built to settle one design question. Frozen when the decision was made, so details may differ from the app.',
      entries,
    ),
  );
  return entries.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const site = process.argv[2];
  if (!site) {
    console.error('Usage: node docs/walkthroughs/site.js <site dir>');
    process.exit(1);
  }
  const docs = fileURLToPath(new URL('..', import.meta.url));
  const walkthroughs = buildWalkthroughs(join(docs, 'walkthroughs'), join(site, 'walkthroughs'));
  const prototypes = buildPrototypes(join(docs, 'prototypes'), join(site, 'prototypes'));
  console.log(`${walkthroughs} walkthroughs and ${prototypes} prototypes written to ${site}`);
}
