# Cross-browser checklist

Run on the live app in the latest Chrome, Edge and Firefox, once with the window at 1024×768 and once on a large monitor. The numbers are the user stories in the spec (issue #1); only the stories for built features are listed. Record anything that differs under "Findings". It is either fixed or moved to "Known limits" in the README.

| #     | Check                                                                      | Chrome | Edge | Firefox |
| ----- | -------------------------------------------------------------------------- | ------ | ---- | ------- |
| 1, 4  | Board edges are clear; calm backdrop beyond them on a large monitor        |        |      |         |
| 2     | At 1024×768 the Board scrolls inside the window; the toolbar stays put     |        |      |         |
| 3     | Shrinking the window never moves a Note                                    |        |      |         |
| 5–7   | Dot grid, empty-Board hint, opens scrolled to the top-left                 |        |      |         |
| 8     | Double-click empty Board creates a Note centred on the pointer             |        |      |         |
| 9–11  | S/M/L create in the visible middle, with a cascade when repeated           |        |      |         |
| 12    | A new Note opens in Editing, ready to type                                 |        |      |         |
| 14–15 | A Note near the edge is pushed inside; double-click on a Note does nothing |        |      |         |
| 16–18 | Drag from anywhere on the Note; a click inside the Dead zone doesn't move  |        |      |         |
| 19–20 | Stops at the Board's edges; drops exactly where it's shown                 |        |      |         |
| 21    | Wheel-scroll mid-drag keeps the Note under the pointer                     |        |      |         |
| 22    | Escape mid-drag puts the Note back                                         |        |      |         |
| 24–25 | Deeper shadow while dragging; no text selection or native image drag       |        |      |         |
| 26    | Releasing outside the window ends the drag where it was                    |        |      |         |
| 27–29 | Resize from all 8 edges and corners; correct cursors; `se` tick shown      |        |      |         |
| 30–31 | Stops at 140×100 with the opposite edge fixed; stops at the Board's edges  |        |      |         |
| 32–33 | Text reflows live and never distorts                                       |        |      |         |
| 45    | A click on an idle Note starts Editing, caret where clicked                |        |      |         |
| 46    | Drag-select, double-click a word, normal text shortcuts while Editing      |        |      |         |
| 47–48 | Grip strip moves the edited Note, keeps focus and caret; text never jumps  |        |      |         |
| 49–51 | Accent outline and darker strip; one Note at most; Escape or a press ends  |        |      |         |
| 52    | Text kept exactly as typed, line breaks included                           |        |      |         |
| 53    | Pressing a Note Raises it at once, for the whole Drag                      |        |      |         |
| 34–36 | Note overlapping zone deletes, pointer anywhere; pinned; beside it: moved  |        |      |         |
| 37–39 | Zone hints during a move, red with Note dimmed when over; resize: never    |        |      |         |
| 40–42 | "Note deleted" toast with Undo after a drop; Undo restores it exactly      |        |      |         |
| #33   | Tab: Note, ×, next Note; dashed ring and Raise; Enter, Escape, Delete      |        |      |         |

## Safari (keyboard only)

Safari's Tab skips buttons by default, so the toolbar and every × are passed over while Notes are still reached. Turn on Safari → Settings → Advanced → "Press Tab to highlight each item on a webpage" (or use Option+Tab), then check:

- [ ] Tab reaches the toolbar buttons, the colour swatches, each Note and its ×
- [ ] A Note focused with Tab shows the dashed ring and is Raised
- [ ] Escape while Editing leaves the dashed ring on that Note, and it is Raised
- [ ] Delete on a focused Note moves the ring to the next Note

## Findings

None recorded yet.
