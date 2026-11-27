import type { Point, Size } from '../geometry';
import type { DragController, PointerSignal } from '../drag/controller';
import { moveKind, resizeKinds, type ResizeHandle } from '../drag/kinds';
import type { NoteId } from '../notes/note';
import type { Stores } from '../StoresContext';

/** Longer than most systems' double-click interval. */
export const DOUBLE_CLICK_MS = 500;

/**
 * What the pointer went down on (see Press target in `GLOSSARY.md`), or `outside` the
 * Board altogether, such as the top bar or the Undo toast.
 */
export type PressTarget =
  | { readonly on: 'body' | 'grip'; readonly id: NoteId }
  | { readonly on: 'handle'; readonly id: NoteId; readonly handle: ResizeHandle }
  | { readonly on: 'delete'; readonly id: NoteId }
  | { readonly on: 'board' }
  | { readonly on: 'outside' };

/** The parts of a `pointerdown` the Press decides on. */
export interface Pointer extends PointerSignal {
  readonly isPrimary: boolean;
  readonly button: number;
  /** Inside text being typed in (the textarea), where the caret and selection must be left alone. */
  readonly inText?: boolean;
}

/**
 * What the DOM side does with the `pointerdown` itself:
 * - `drag`: a Drag session started. Prevent its default (no focus change, no text
 *   selection, no native drag) and capture the pointer on the pressed Note.
 * - `prevent`: prevent its default only. The ×, which must leave focus where it is, and
 *   presses swallowed after a × was deleted by a mouse click.
 * - `none`: leave it alone.
 */
export type PressOutcome = 'drag' | 'prevent' | 'none';

export interface Press {
  /** The pointer went down on `target`, anywhere on the page. */
  readonly pointerDown: (target: PressTarget, pointer: Pointer) => PressOutcome;
  /**
   * A Click (a Press released inside the Dead zone) on the Note last pressed, from the
   * Drag controller. `caret` is the text offset under the pointer, or `null` for the end.
   */
  readonly clicked: (caret: number | null) => void;
  /** Focus arrived on Note `id` or inside it. `keyboard`: it shows a focus ring (`:focus-visible`). */
  readonly focused: (
    id: NoteId,
    how: { readonly keyboard: boolean; readonly inText: boolean },
  ) => void;
  /** A click on Note `id`'s ×. `mouse`: not Enter or Space, so maybe half a double-click. */
  readonly deleteButtonClicked: (id: NoteId, how: { readonly mouse: boolean }) => void;
  /** The browser's double-click on empty Board, at `point` on the Board, whose size is `board`. */
  readonly doubleClickedBoard: (point: Point, board: Size) => void;
  /** Stops following the Notes store and cancels a running Drag. For unmount. */
  readonly dispose: () => void;
}

/**
 * Everything that happens when the pointer goes down, in one place, so a new Press
 * target can't skip a rule:
 * - a Press (a Note's body, Grip strip or Resize handle, left button) Raises the Note at
 *   once, then goes to the Drag controller, which makes it a Drag or a Click. Inside
 *   text it only Raises. A Click starts Editing with the caret where it landed.
 * - a press anywhere on the Board but the edited Note ends Editing, the × included.
 *   The × is not a Press: no Raise, no Drag.
 * - keyboard focus arriving on a Note Raises it and ends Editing elsewhere, like a Press.
 * - a double-click on empty Board creates a Note, but only if both presses were on
 *   empty Board: one on a Note or outside the Board creates nothing.
 * - after a mouse click on a × deleted its Note, presses on any Press target of a Note,
 *   and mouse clicks on a ×, are ignored for `DOUBLE_CLICK_MS`, so the second half of
 *   a double-click can't land on the Note that was under the ×.
 * - a Note deleted while it is held (from the keyboard) ends its Drag at once, saving
 *   nothing, so Undo brings it back where it was.
 *
 * `now` is in milliseconds, as `performance.now()`.
 */
export function createPress(
  { notes, ui }: Stores,
  drag: DragController,
  now: () => number = () => performance.now(),
): Press {
  /** The Note whose Press is with the Drag controller, for its Click. */
  let pressedId: NoteId | null = null;
  /** Whether each of the last two presses landed on empty Board. */
  let previousOnBoard = false;
  let lastOnBoard = false;
  /** Presses on Notes before this time are ignored. */
  let ignoreUntil = -Infinity;

  const ignoring = () => now() < ignoreUntil;

  const unsubscribe = notes.subscribe((state) => {
    if (pressedId !== null && !state.notes[pressedId]) {
      pressedId = null;
      drag.dispose();
    }
  });

  return {
    pointerDown(target, pointer) {
      previousOnBoard = lastOnBoard;
      lastOnBoard = target.on === 'board';
      if (target.on === 'outside') return 'none';
      if (target.on === 'board') {
        ui.getState().pressed(null);
        return 'none';
      }
      if (ignoring()) return 'prevent';
      // Any button, the × included: pressing anywhere else ends Editing.
      ui.getState().pressed(target.id);
      if (target.on === 'delete') return 'prevent';
      // Only the primary pointer's left button is a Press.
      if (!pointer.isPrimary || pointer.button !== 0) return 'none';
      const note = notes.getState().notes[target.id];
      if (!note) return 'none';
      notes.getState().raise(target.id);
      // In text, the caret and selection are the browser's: no Drag, no Click.
      if (pointer.inText) return 'none';
      pressedId = target.id;
      drag.press(pointer, target.on === 'handle' ? resizeKinds[target.handle] : moveKind, note);
      return 'drag';
    },

    clicked(caret) {
      const id = pressedId;
      pressedId = null;
      if (id !== null) ui.getState().startEditing(id, caret);
    },

    focused(id, { keyboard, inText }) {
      // The textarea is focused only by Editing, which a Press or Enter already Raised.
      if (inText) return;
      // As a press on this Note, so the focus ring and the Editing outline are never on two Notes.
      ui.getState().pressed(id);
      // A right-button press focuses the Note too, and must not Raise.
      if (keyboard) notes.getState().raise(id);
    },

    deleteButtonClicked(id, { mouse }) {
      // Only a mouse click can be the second half of a double-click.
      if (mouse && ignoring()) return;
      notes.getState().deleteNote(id);
      if (mouse) ignoreUntil = now() + DOUBLE_CLICK_MS;
    },

    doubleClickedBoard(point, board) {
      if (previousOnBoard && lastOnBoard) notes.getState().createNoteAt(point, board);
    },

    dispose() {
      unsubscribe();
      drag.dispose();
    },
  };
}
