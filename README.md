# Sticky Notes

A single-page desktop app for placing, arranging and resizing sticky notes on a board. It is written in React and TypeScript, with no component libraries.

**Live app:** https://juanccastillog80.github.io/sticky-notes/ (deployed from `main` on every merge)

## What it does

| Feature                                              | Status                                                                                              |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1. Create a note of a given size at a given position | Done: double-click empty Board (default size, centred on the pointer), or the S/M/L toolbar buttons |
| 2. Change note size by dragging                      | Done: any of the 4 edges or 4 corners, with a minimum size, stopping at the Board's edges           |
| 3. Move a note by dragging                           | Done: a Dead zone before the drag starts, wheel-scroll while dragging, Escape cancels               |
| 4. Remove a note on a trash zone                     | Done: drop a Note with the pointer on the bottom-right Trash zone, or click its ×; both offer Undo  |
| Bonus I: edit note text                              | Done: click a Note to type, caret where you clicked; a new Note opens ready to type                 |
| Bonus II: bring to front                             | Done: pressing a Note Raises it                                                                     |

The words used here and in the code (Board, Note, Drag, Drag kind, Preview, Dead zone, Raise…) are defined in [`GLOSSARY.md`](GLOSSARY.md).

### Not included

The brief asks for 3 of the 4 features; all 4 are built. The bonuses are being added one at a time, to the same standard, since they make the UI better.

- **Colours, localStorage and REST saving (bonuses III, IV, V)** are not built yet. The persistence design is recorded in [ADR 0002](docs/adr/0002-local-first-persistence-msw.md). The groundwork is in place: an MSW service worker intercepts real `fetch` calls on the deployed site, and the app sends one `GET /notes` at startup. It doesn't save anything yet, so notes are lost on reload. The planned `?fail=&latency=` URL parameters for demoing failed and slow saves belong to that work and don't exist yet.

## Setup

Requires Node 26 (see `.nvmrc`).

```sh
npm ci
npx playwright install chromium firefox   # for the browser tests
npm run dev                                # http://localhost:5173/sticky-notes/
```

| Script                 | What it does                                                                  |
| ---------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`          | Vite dev server                                                               |
| `npm run build`        | Typecheck, then production build into `dist/`                                 |
| `npm run preview`      | Serve the production build                                                    |
| `npm run typecheck`    | `tsc -b`                                                                      |
| `npm run lint`         | ESLint and Prettier check                                                     |
| `npm test`             | All tests: unit (Node) and browser (Chromium and Firefox, through Playwright) |
| `npm run test:unit`    | Unit tests only, including type-level tests                                   |
| `npm run test:browser` | Browser tests only. `BROWSERS=chrome,msedge,firefox` picks the browsers       |
| `npm run coverage`     | Unit coverage, with a 90% gate on the pure core                               |

CI runs every check on each PR, and runs the browser tests again in Chrome, Edge and Firefox on Windows and in Chrome and Firefox on macOS. A merge to `main` deploys to GitHub Pages.

## Architecture

**One Drag lifecycle, written once and specialised by pure Drag kinds.** Moving and resizing share everything except what they show and what they save. A Drag goes through three phases. _Mount_: `useDrag` creates one controller per Note. _Session_: a Press Raises the Note and attaches the listeners (inside text it only Raises), the Dead zone decides whether it is a Click or a Drag, moves and scrolls update the Preview, and release or cancel ends it. _Unmount_: a running Drag is cancelled. The decisions live in `createDragController` (`src/drag/controller.ts`), which never touches the DOM. It talks to the DOM through two narrow interfaces, one for each direction. Controller → DOM is `DragIO`: read scroll, attach listeners, release capture, write the Preview, dispatch, report a Click. DOM → controller is `DragHandlers`: move, up, cancel, scroll, key. `useDrag` passes the real DOM; the unit tests pass a recording fake. A Drag kind (`src/drag/kinds.ts`) is pure functions over the same geometry: `press` (the Raise), `preview` and `commit`, so what you release is exactly what you saw. Resize was added as a second kind without changing the controller, which shows the seam is in the right place. The Preview is written straight to the Note's style during the Drag, so after the Raise React renders nothing until release, when one action is dispatched.

**Committed state lives in small stores read through selectors, so a change re-renders only the Notes it touched.** `createStore` (`src/store/createStore.ts`) is a pure reducer behind `useSyncExternalStore`, with separate stores for notes and UI state. The reducer keeps every unchanged Note and the `ids` array at the same reference, and a no-op returns the same state and notifies nobody. The Board subscribes to `ids`, and each Note subscribes to `notes[id]`. Moving one Note re-renders that Note only, never the Board or its neighbours. Geometry such as clamping to the Board, the minimum size and resize maths is pure (`src/geometry.ts`) and is shared by the reducer and the Drag kinds. The pure core is unit-tested, with property-based tests for the geometry, and held to the coverage gate. Components are tested in real browsers.

**The Board has a fixed size and scrolls; persistence will be local-first.** The Board is a fixed 1920×1080 surface scrolling under the toolbar ([ADR 0001](docs/adr/0001-fixed-scrolling-board.md)). A Note's stored position can therefore never become invalid when the window shrinks, and a Drag adds the scroll delta so the Note stays under the pointer while the wheel scrolls. `main.tsx` is the composition root. It builds the stores, renders, and only then starts the MSW worker, loaded as a separate chunk so the first paint never waits on the network. The planned persistence ([ADR 0002](docs/adr/0002-local-first-persistence-msw.md)) follows changes in state rather than living inside the UI. The Local copy shows first, and a real HTTP client talks to a mocked backend that can be deleted (`src/mocks/`) without touching the client.

Each merged PR has an interactive code walkthrough, listed at https://juanccastillog80.github.io/sticky-notes/walkthroughs/. The engine is explained in [move notes](https://juanccastillog80.github.io/sticky-notes/walkthroughs/0004-move-notes.html) and [resize notes](https://juanccastillog80.github.io/sticky-notes/walkthroughs/0005-resize-notes.html).

## Known limits

- Notes are kept in memory only: a reload starts from an empty Board (see "Not included").
- Once persistence exists, syncing several tabs won't be handled: across tabs, the last save wins.
- Browser tests run in Chromium and Firefox on every PR, and also in Chrome and Edge on real Windows and macOS runners. None are skipped or retried. Any Firefox flakiness found will be recorded here rather than silenced.
- Desktop pointer input only. Touch and pen aren't targeted, per the brief.

## Cross-browser sign-off

Manual pass at 1024×768 and on a large monitor, in the latest Chrome, Edge and Firefox: see [`docs/cross-browser-checklist.md`](docs/cross-browser-checklist.md).
