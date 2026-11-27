# The Board is kept in a Local copy in localStorage

**Status:** accepted, built ([#9](https://github.com/juanccastillog80/sticky-notes/issues/9)).

## Decision

On startup, `main.tsx` reads the Local copy from localStorage synchronously and loads it before the first render, so a reload shows the Board at once, with no flash of an empty Board. Every change to the Notes is written back over the whole collection, 300 ms after the last change, and on `pagehide` Editing is ended, which saves its Draft text, before a scheduled write is flushed, so closing the tab while typing loses nothing.

- It is stored as `{ v: 1, notes: Note[] }` under `sticky-notes:local-copy`. The `v` lets a later format be told apart from this one.
- `parseNotes` (`src/persistence/parseNotes.ts`) is the hand-written guard for Notes from outside the app. A copy that isn't JSON, isn't version 1 or holds one invalid Note is discarded whole, with a `console.warn`, and the app starts empty. A failed `setItem` (quota exceeded, storage blocked) is ignored, and the Board keeps working in memory.
- Storage and timers are passed in, so the debounce and flush are unit-tested without a browser. Only `main.tsx` wires the Local copy in, and `renderApp` in the browser tests leaves it out.

## Considered Options

- **Zustand's `persist` middleware.** Not chosen because the copy's format, its guard and the flush on `pagehide` are the parts worth controlling.
- **Saving each change at once, with no debounce.** Rejected because each save serialises the whole Board. Typing no longer changes the Notes on every keystroke (its Draft text is saved once, when Editing ends), but changes still arrive together, such as one Note's text saved as a new Note is created, and the debounce writes them once.
- **Saving to a REST API (bonus V).** Out of scope; not built.

## Consequences

- Syncing several tabs is not handled. Across tabs, the last write to the Local copy wins.
- Notes live only in this browser. Clearing site data clears the Board.
