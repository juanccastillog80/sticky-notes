# Fixed-size scrolling Board with a window-pinned Trash zone

The Board has a fixed size of 1920×1080 CSS px and sits inside its own scroll container below the toolbar. It does not follow the window size. The Trash zone is pinned to the corner of the visible area, so it never scrolls. With fixed bounds, a Note's stored position can never become invalid: shrinking the window only puts Notes off-screen, never past the Board edge, so nothing is clamped or rewritten on resize. Pinning the Trash zone keeps it always visible, and its on-screen rectangle stays stable during a Gesture.

## Considered Options

- **Window-sized Board with a 1024×768 floor.** No scrolling and the simplest maths. Rejected because shrinking the window pushes stored Notes past the Board edge, which then forces a choice between clamping only on screen and rewriting saved data.
- **Fixed Board with the Trash zone in the Board's own corner.** Rejected because the Trash zone sits off-screen on most windows, and scrolling during a Gesture moves it out from under the rectangle measured at press time.
- **Unbounded pan/zoom canvas.** Rejected because scale enters every conversion, and "clamp to the Board" stops meaning anything.

## Consequences

- A Gesture must compensate for container scroll so the dragged Note stays under the pointer: the Board delta is the client delta plus the scroll delta since the press.
- A Note created from the toolbar is placed in the visible part of the Board, not at a fixed Board position.
- The Trash zone renders above Notes and can cover part of the Board. Scrolling always uncovers whatever is under it.
