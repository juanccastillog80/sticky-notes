# Cross-browser checklist

Each row is a user story from the spec (issue #1), for the features that are built. Two things sign it off:

1. **Automated tests, on every PR.** The browser tests in the "Tests" column run in Chromium and Firefox on Linux, in Chrome, Edge and Firefox on Windows, and in Chrome and Firefox on macOS (`.github/workflows/`). None are skipped or retried. A row whose column says "none" has no automated test.
2. **A scripted pass over the live app.** [`docs/checklist/run.mjs`](checklist/run.mjs) drives https://juanccastillog80.github.io/sticky-notes/ with Playwright's mouse and keyboard, the way a person would, at 1024×768 and, where the row is about window size, at 1920×1080. It reads each result off the DOM. Rows about how something looks were also checked on its screenshots. Last run on 2026-11-27, on macOS: Chrome 158 and Firefox 159. It was **not run by hand**, and **not run in Edge**, which isn't installed on that machine. Edge is covered by the automated tests only. To rerun it: `node docs/checklist/run.mjs chrome|firefox|msedge`.

Test files: `App`, `board`, `colours`, `delete`, `drag`, `editing`, `keyboard` and `trash` stand for `src/<name>.browser.test.tsx`.

| #     | Check                                                                      | Tests                    | Chrome  | Firefox     | Edge       |
| ----- | -------------------------------------------------------------------------- | ------------------------ | ------- | ----------- | ---------- |
| 1, 4  | Board edges are clear; a calm backdrop strip past the right and bottom     | none                     | ✓       | ✓           | not run    |
| 2     | Empty Board: no scrollbars at 1024×768 or on a large monitor               | `board`                  | ✓       | ✓           | tests only |
| 2     | Growing the window grows the Board at once                                 | `board`                  | ✓       | ✓           | tests only |
| 3     | Shrinking the window never moves a Note; the Board scrolls to it           | `board`                  | ✓       | ✓           | tests only |
| 3     | With Notes past the window, the Board scrolls; the toolbar stays put       | `App`                    | ✓       | ✓           | tests only |
| 5–7   | Dot grid, empty-Board hint, opens scrolled to the top-left                 | `App` (hint only)        | ✓       | ✓           | tests only |
| 8     | Double-click empty Board creates a Note centred on the pointer             | `App`                    | ✓       | ✓           | tests only |
| 9–11  | S/M/L only pick the size; the next double-click uses it                    | `App`                    | ✓       | ✓           | tests only |
| 12    | A new Note opens in Editing, ready to type                                 | `editing`                | ✓       | ✓           | tests only |
| 14–15 | A Note near the edge is pushed inside; double-click on a Note does nothing | `App`                    | ✓       | ✓           | tests only |
| 16–18 | Drag from anywhere on the Note; a click inside the Dead zone doesn't move  | `drag`                   | ✓       | ✓           | tests only |
| 19–20 | Stops at the visible Board edge; drops exactly where it's shown            | `drag`, `board`          | ✓       | ✓           | tests only |
| 21    | Wheel-scroll mid-drag keeps the Note under the pointer                     | `drag`                   | ✓       | ✓           | tests only |
| 22    | Escape mid-drag puts the Note back                                         | `drag`                   | ✓       | ✓           | tests only |
| 24–25 | Deeper shadow while dragging; no text selection or native image drag       | `drag` (shadow only)     | ✓       | ✓           | tests only |
| 26    | Releasing outside the window ends the drag where it was                    | none                     | ✓ (F1)  | not checked | not run    |
| 27–29 | Resize from all 8 edges and corners; correct cursors; `se` tick shown      | `drag`                   | ✓ (F2)  | ✓ (F2)      | tests only |
| 30–31 | Stops at 140×100 with the opposite edge fixed; stops at the Board's edge   | `drag`, `board`          | ✓       | ✓           | tests only |
| 32–33 | Text reflows live and never distorts                                       | none                     | ✓       | ✓           | not run    |
| 45    | A click on an idle Note starts Editing, caret where clicked                | `editing`                | ✓       | ✓           | tests only |
| 46    | Drag-select, double-click a word, normal text shortcuts while Editing      | `editing` (drag-select)  | ✓       | ✓           | tests only |
| 47–48 | Grip strip moves the edited Note, keeps focus and caret; text never jumps  | `editing`                | ✓       | ✓           | tests only |
| 49–51 | Accent outline and darker strip; one Note at most; Escape or a press ends  | `editing`, `colours`     | ✓       | ✓           | tests only |
| 52    | Text kept exactly as typed, line breaks included                           | `editing`                | ✓       | ✓           | tests only |
| 53    | Pressing a Note Raises it at once, for the whole Drag                      | `drag`                   | ✓       | ✓           | tests only |
| 34–36 | Note overlapping zone deletes, pointer anywhere; pinned; beside it: moved  | `trash`                  | ✓       | ✓           | tests only |
| 37–39 | Zone hints during a move, red with Note dimmed when over; resize: never    | `trash`                  | ✓       | ✓           | tests only |
| 40–42 | "Note deleted" toast with Undo after a drop; Undo restores it exactly      | `trash`, `delete`        | ✓       | ✓           | tests only |
| #33   | Tab: Note, ×, next Note; dashed ring and Raise; Enter, Escape, Delete      | `keyboard`               | ✓       | ✓           | tests only |

"Tests only" means Edge ran that row's automated tests in CI on Windows, but not the scripted pass. "Not run" means nothing covered the row in Edge.

## Safari (keyboard only)

Not checked: Safari isn't in the brief, and Playwright's WebKit isn't Safari. Safari's Tab skips buttons by default, so the toolbar and every × are passed over while Notes are still reached. To check by hand, turn on Safari → Settings → Advanced → "Press Tab to highlight each item on a webpage" (or use Option+Tab), then:

- [ ] Tab reaches the toolbar buttons, the colour swatches, each Note and its ×
- [ ] A Note focused with Tab shows the dashed ring and is Raised
- [ ] Escape while Editing leaves the dashed ring on that Note, and it is Raised
- [ ] Delete on a focused Note moves the ring to the next Note

## Findings

- **F1. Row 26 is only partly checked.** Playwright can't move a real pointer out of the window. In Chrome the script releases at a point left of the window, and the Note ends at the Board's left edge, with the Drag over. In Firefox, Playwright reports any pointer outside the window as (0, −85), which no real mouse does, so the row wasn't checked there.
- **F2. The × covers most of the `ne` corner handle.** By design (`Note.module.css`): only a strip about 2 px wide at the very corner still resizes from `ne`. Resizing from the other 3 corners and 4 edges is unaffected.
- No row failed in Chrome or Firefox.
