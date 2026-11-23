# Design prototypes

Throwaway, self-contained HTML pages built to settle one design question each before any app code existed. Open one in a browser: no build, no dependencies. `main` also publishes them at <https://juanccastillog80.github.io/sticky-notes/prototypes/>. The decisions they led to are in the [spec](https://github.com/juanccastillog80/sticky-notes/issues/1) and in [`docs/adr/`](../adr/).

| Prototype | Question it answered |
|---|---|
| [board-extent](board-extent-prototype.html) | Should the Board follow the window size or be a fixed size that scrolls, and where does the Trash zone sit? ([ADR 0001](../adr/0001-fixed-scrolling-board.md)) |
| [board-scroll-container](board-scroll-container-prototype.html) | Why the Board scrolls in its own container below the toolbar, and how a Drag compensates for scrolling. |
| [board-rounding](board-rounding-prototype.html) | Whole pixels on commit: what rounding changes, and what it doesn't. |
| [gesture-primitive](gesture-primitive-prototype.html) | One shared Drag lifecycle with pure kinds, or a separate hook per drag? (Written when the term was "Gesture".) |
| [gesture-engine-code-preview](gesture-engine-code-preview.html) | A step-through of the drag engine's files (then called the gesture engine): controller, kinds, hook and geometry. |
| [note-interaction](note-interaction-prototype.html) | Grip and Editing model, resize handles, minimum size, Trash zone hit rule, and Undo. |
| [visual-design](visual-design-prototype.html) | Note colours, Board surface, toolbar, Trash zone and typography. |

They are frozen at the moment each decision was made, so details may differ from the final code. For example, the code preview still uses a provisional minimum Note size.
