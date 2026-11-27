# Local-first persistence over an MSW-mocked REST API

**Status:** the Local copy is built ([#9](https://github.com/juanccastillog80/sticky-notes/issues/9)). Saving to the REST API is **proposed, not built**. The app makes one `GET /notes` at startup and ignores the answer. Nothing is sent to the server, and there are no Unsaved changes, retries or queues. The sections below say which parts are built.

## Built: the Local copy

On startup, `main.tsx` reads the Local copy from localStorage synchronously and loads it before the first render, so a reload shows the Board at once, with no flash of an empty Board. Every change to the Notes is written back over the whole collection, 300 ms after the last change, and a scheduled write is flushed on `pagehide`, so closing the tab right after typing loses nothing.

- It is stored as `{ v: 1, notes: Note[], unsaved: [] }` under `sticky-notes:local-copy`. `unsaved` is always empty for now. It is there for the proposed server saving, so the format won't need a new version when that lands.
- `parseNotes` (`src/persistence/parseNotes.ts`) is the hand-written guard for Notes from outside the app. A copy that isn't JSON, isn't version 1 or holds one invalid Note is discarded whole, with a `console.warn`, and the app starts empty. A failed `setItem` (quota exceeded, storage blocked) is ignored, and the Board keeps working in memory.
- Storage and timers are passed in, so the debounce and flush are unit-tested without a browser. Only `main.tsx` wires the Local copy in, and `renderApp` in the browser tests leaves it out.

## Proposed: the REST API as the record

The REST API would be the record. After `GET /notes`, the server's Notes would replace the local ones, except Notes with an Unsaved change, where the local version wins. Saves would be optimistic and never rolled back. A failed save would be retried with backoff and stay an Unsaved change, which survives a reload because its id is in `unsaved`. The REST API would be mocked with MSW, which intercepts real `fetch` calls, so the client would be a real HTTP client and every request would show up in DevTools. What exists today is the browser worker (`src/mocks/`) and one handler, for `GET /notes`, which answers `[]`. There is no HTTP client and no MSW setup in Vitest.

## Considered Options

- **REST only receives writes and is never read; localStorage is what startup loads from.** Rejected because REST then does nothing the user can see, and "why have it?" has no good answer.
- **The mocked REST stores its data in the same localStorage the app reads.** Rejected because it merges the two bonuses (localStorage, REST) into one, and the two copies can never disagree, so failure and recovery can't be shown.
- **The server always wins at startup.** Rejected because a reload would silently lose any change whose save failed or was still waiting.
- **Roll back an optimistic change when its save fails.** Rejected because every change is already validated on the client, so a 5xx or network failure is temporary, never a rejection, and snapping a Note back would throw away work.
- **A hand-written in-process `NotesApi` fake instead of MSW.** Rejected because it makes no network requests, so nothing shows in DevTools, and the client code would not be what a real backend uses.
- **Zustand's `persist` middleware for the Local copy.** Not chosen because the copy's format, its guard and the flush on `pagehide` are the parts worth controlling, and the proposed `unsaved` ids live outside the store's state.

## Consequences

- Built: MSW is a runtime dependency that ships to users. `mockServiceWorker.js` must be served under the Vite base path, and the app awaits `worker.start()` before its first request. The worker is loaded as its own chunk, after the first render.
- Built: syncing several tabs is not handled. Across tabs, the last write to the Local copy wins.
- Proposed: persistence would keep a per-Note queue (one request in flight, latest version wins, deletes ordered behind PUTs) and store the unsaved ids in the Local copy, so they can be pushed again after a reload.
- Proposed: only a 4xx would be treated as a rejection. It is a client bug, so it would be logged and not retried. Real server-side rules would add a rollback path there.
- Proposed: replacing the mock with a real backend would mean deleting `src/mocks/` and changing the base URL, leaving `src/persistence/` untouched.
