# Local-first persistence over an MSW-mocked REST API

On startup the Board is shown from the Local copy in localStorage, synchronously and before the first paint. The REST API is the record: after `GET /notes`, the server's Notes replace the local ones, except Notes with an Unsaved change, where the local version wins. Saves are optimistic and never rolled back. A failed save is retried with backoff and stays an Unsaved change, which survives a reload. The REST API is mocked with MSW, which intercepts real `fetch` calls in the browser (including the GitHub Pages deployment) and in Vitest, so the client is a real HTTP client and every request shows up in DevTools.

## Considered Options

- **REST only receives writes and is never read; localStorage is what startup loads from.** Rejected because REST then does nothing the user can see, and "why have it?" has no good answer.
- **The mocked REST stores its data in the same localStorage the app reads.** Rejected because it merges the two bonuses (localStorage, REST) into one, and the two copies can never disagree, so failure and recovery can't be shown.
- **The server always wins at startup.** Rejected because a reload would silently lose any change whose save failed or was still waiting.
- **Roll back an optimistic change when its save fails.** Rejected because every change is already validated on the client, so a 5xx or network failure is temporary, never a rejection, and snapping a Note back would throw away work.
- **A hand-written in-process `NotesApi` fake instead of MSW.** Rejected because it makes no network requests, so nothing shows in DevTools, and the client code would not be what a real backend uses.

## Consequences

- MSW is a runtime dependency that ships to users. `mockServiceWorker.js` must be served under the Vite base path, and the app awaits `worker.start()` before its first request.
- Persistence keeps a per-Note queue (one request in flight, latest version wins, deletes ordered behind PUTs) and stores the unsaved ids in the Local copy, so they can be pushed again after a reload.
- Only a 4xx is treated as a rejection: it is a client bug, so it is logged and not retried. Real server-side rules would add a rollback path there.
- Replacing the mock with a real backend means deleting `src/mocks/` and changing the base URL. `src/persistence/` is untouched.
- Syncing several tabs is not handled: across tabs, the last save wins.
