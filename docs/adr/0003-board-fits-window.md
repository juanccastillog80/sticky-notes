# The Board fits the window and grows with its Notes

**Status:** accepted, built ([#40](https://github.com/juanccastillog80/sticky-notes/issues/40)). Supersedes [ADR 0001](0001-fixed-scrolling-board.md).

## Context

ADR 0001 fixed the Board at 1920×1080, so a stored position could never become invalid. The cost showed up in review: at 1024×768, and on ordinary laptops, the Board had scrollbars before a single Note existed.

## Decision

The Board's size is the larger of two things: **the visible area** (the scroll container less the backdrop strip past the Board's right and bottom edges) and **the Notes' extent** (the furthest right and the furthest bottom Note edges, `notesExtent` in `src/geometry.ts`).

- **No scrollbars until a Note needs them.** An empty Board, or one whose Notes fit, is exactly the visible area.
- **A stored position is never rewritten.** If the window shrinks below where Notes sit, the Board stays as big as the Notes and scrolls to them. The Notes store keeps only the rules that don't depend on the window (`toStoredRect`: whole pixels, at least 140×100, no negative position). Loading the Local copy clamps nothing to the window. This keeps the property ADR 0001 was protecting.
- **Moves and resizes are clamped to the Board's current size**, measured once at press (`DragIO.boardSize`). A Note can't be dragged off into empty space, so the Board grows only when the window does, never because of a Drag. Double-click and the S/M/L buttons place a new Note inside the same measured size.
- **The geometry takes the Board size as a parameter.** `clampToBoard`, `toCommittedRect`, `resizeRect`, `placeCentredAt` and `placeInVisibleBoard` no longer read a constant. On a Board smaller than a Note, a Note keeps the minimum size at the Board's top-left.
- **CSS sets the size, not a `ResizeObserver`.** The Board gets the Notes' extent as its inline `width`/`height` and `min-width: 100%; min-height: 100%` of the scroll container. Layout applies the larger of the two on the same frame as a window resize, with no measure-then-render round trip, and with no fractional-pixel overflow that could add a scrollbar. The issue proposed watching the scroll container with a `ResizeObserver`. It isn't needed: nothing in JavaScript has to know the visible size except at press, and `measureBoardSize` (`src/BoardDomContext.ts`) reads the rendered Board then, rounded down to whole pixels.
- **The Trash zone stays pinned to the window**, 14 px inside the visible Board's bottom-right corner, as in ADR 0001. The Board is never smaller than the window, so the zone is always over the Board.

## Considered Options

- **Window-sized Board, clamped on screen only.** Rejected for the same reason as in ADR 0001: a Note past the edge either becomes unreachable or forces rewriting saved data.
- **Board grows during a Drag (drag past the edge to extend it).** Rejected: the Board would grow with every careless drag, and a Note could be lost far out in empty space. Growth comes only from the window, or from Notes already stored further out.
- **Keep the fixed 1920×1080 Board.** Rejected after review: scrollbars on an empty Board at common window sizes.

## Consequences

- A Drag measures the Board's size once at press. A window resized mid-drag doesn't change what that Drag allows.
- Shrinking the window can leave Notes past the visible area. The Board then scrolls to them, as the fixed Board did.
- The empty-Board hint is centred on the Board by CSS alone, with no Board size to read.
- Tests that need a Board larger than the window load a Note in the far corner (`farCornerNote` in `test/factories.ts`), which makes the Board grow to hold it.
