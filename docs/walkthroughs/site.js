// Puts the merged walkthroughs on the Pages site, with an index that lists them.
//   node docs/walkthroughs/site.js <out dir>
// Only numbered pages are copied, so the template never ships as a walkthrough.
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const escape = (text) =>
  text.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Highest issue first; `0000` pages (no issue) come last, in reverse name order. */
export function indexPage(walkthroughs) {
  const sorted = [...walkthroughs].sort((a, b) => b.name.localeCompare(a.name));
  const items = sorted
    .map(
      ({ name, title, issue }) =>
        `      <li><a href="${escape(name)}.html">${escape(title)}</a>` +
        `${issue ? ` <span>#${issue}</span>` : ''}</li>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Walkthroughs</title>
    <style>
      :root { color-scheme: light dark; font-family: system-ui, sans-serif; }
      body { max-width: 40rem; margin: 3rem auto; padding: 0 1rem; line-height: 1.6; }
      li { margin: 0.4rem 0; }
      span { opacity: 0.6; }
    </style>
  </head>
  <body>
    <h1>Walkthroughs</h1>
    <p>One per merged PR: by issue, newest first, then PRs without an issue.</p>
    <ul>
${items}
    </ul>
  </body>
</html>
`;
}

export function buildSite(dir, out) {
  const names = readdirSync(dir)
    .filter((f) => /^\d{4}-.+\.html$/.test(f))
    .map((f) => f.slice(0, -'.html'.length));
  mkdirSync(out, { recursive: true });
  const walkthroughs = names.map((name) => {
    copyFileSync(join(dir, `${name}.html`), join(out, `${name}.html`));
    const { title, issue } = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
    return { name, title, issue };
  });
  writeFileSync(join(out, 'index.html'), indexPage(walkthroughs));
  return walkthroughs.length;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = process.argv[2];
  if (!out) {
    console.error('Usage: node docs/walkthroughs/site.js <out dir>');
    process.exit(1);
  }
  const count = buildSite(fileURLToPath(new URL('.', import.meta.url)), out);
  console.log(`${count} walkthroughs written to ${out}`);
}
