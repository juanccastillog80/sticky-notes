# PR walkthroughs

Every PR includes an interactive walkthrough, so that the owner understands what the code does before merging it. The model is `docs/prototypes/gesture-engine-code-preview.html`: who does what, then a step-through of which lines run for each event. The difference is that a walkthrough shows the PR's real code.

[`docs/walkthroughs/0002-walking-skeleton.json`](../walkthroughs/0002-walking-skeleton.json) is a worked example.

## Before opening a PR

1. Commit the code. The page is built from `HEAD`, compared with the merge base with `origin/main`.
2. Write `docs/walkthroughs/<issue, 4 digits>-<slug>.json` (fields below). Use `0000` when there is no issue.
3. Build it with `node docs/walkthroughs/build.js <spec>`. Fix what it reports.
4. Open the HTML in a browser and click through every step. The builder proves that highlighted lines exist, not that the explanation is true.
5. Commit the spec and the HTML, in the same PR.
6. Add the section below to the PR body, whichever body format is in use.

After any later push to the PR, including review fixes and rebases, re-read the steps, rebuild, and confirm with `--check`. Once merged, a walkthrough is frozen: don't rebuild it.

## PR body section

GitHub doesn't render HTML files, so give a command that opens the page without switching branches:

````markdown
## Walkthrough

`docs/walkthroughs/<name>.html`: <the scenarios, in one line>

```sh
git fetch origin <branch> && git show FETCH_HEAD:docs/walkthroughs/<name>.html > /tmp/<name>.html && open /tmp/<name>.html
```
````

## Spec fields

- `issue`, `title`, `lede`: the issue number (leave it out if there is none), the feature, and what to understand from this PR.
- `files`: the files worth reading, including unchanged ones that a scenario passes through. Each has:
  - `path`
  - `question`: the one question it answers ("When does each thing happen?").
  - `summary`: one sentence.
  - `owns`, `never`, `tested`: the responsibilities table.
- `flow`: chains of paths, drawn as rows of arrows. An arrow means "then calls" at runtime.
- `scenarios`: each has a `name` and `steps`. A step has `title`, `explain` and `run`, a list of `{ "file", "from", "to" }`:
  - `from` is text found on exactly one line.
  - `to` is optional text on that line or a later one, and ends the highlight.
  - The first entry's file is the one that opens.
- `notes`: `{ "title", "detail" }` for decisions and their strongest counter-argument, departures from the spec, and surprises.
- `omitted`: `{ "path": "reason" }` for every other changed file.
- `base`, `head`: only for documenting commits that are already merged.

Text fields support `` `code` `` and `**bold**`.

## What makes it useful

- A step is an event ("pointerup over the Trash zone"), not a file or a function.
- Explain why the lines run in that order and what would break otherwise. Don't paraphrase the syntax.
- Cover the main path, the case where nothing should happen, and a failure or cancellation. Show how the tests prove the behaviour.
- Highlight only lines that run in that step.
- Check runtime claims by running the code. If a claim wasn't run, say so in the step.
- If explaining the code exposes a bug or a false comment, put it in `notes` and tell the owner.
- For a PR with no runtime code (docs, config), use one short scenario about what now behaves differently.
- Use the words in `GLOSSARY.md`. The repo is public, so nothing from git-ignored files goes in.
