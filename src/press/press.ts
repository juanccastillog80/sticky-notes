import type { Point, Size } from '../geometry';
import type { DragController, PointerSignal } from '../drag/controller';
import { moveKind, resizeKinds, type ResizeHandle } from '../drag/kinds';
import type { NoteId } from '../notes/note';
import type { Stores } from '../StoresContext';

/** Longer than most systems' double-click interval. */
export const DOUBLE_CLICK_MS = 500;

export type PressTarget =
  | { readonly on: 'body' | 'grip'; readonly id: NoteId }
  | { readonly on: 'handle'; readonly id: NoteId; readonly handle: ResizeHandle }
  | { readonly on: 'delete'; readonly id: NoteId }
  | { readonly on: 'board' }
  | { readonly on: 'outside' };

export interface Pointer extends PointerSignal {
  readonly isPrimary: boolean;
  readonly button: number;
  /** In the textarea, where the caret and selection are the browser's. */
  readonly inText?: boolean;
}

/** `drag`: prevent the default and capture the pointer. `prevent`: prevent the default only. */
export type PressOutcome = 'drag' | 'prevent' | 'none';

export interface Press {
  readonly pointerDown: (target: PressTarget, pointer: Pointer) => PressOutcome;
  /** From the Drag controller. `caret` is a text offset, or `null` for the end. */
  readonly clicked: (caret: number | null) => void;
  readonly focused: (
    id: NoteId,
    how: { readonly keyboard: boolean; readonly inText: boolean },
  ) => void;
  /** `mouse`: not Enter or Space, so maybe half a double-click. */
  readonly deleteButtonClicked: (id: NoteId, how: { readonly mouse: boolean }) => void;
  readonly doubleClickedBoard: (point: Point, board: Size) => void;
  readonly dispose: () => void;
}

/**
 * Every rule for the pointer going down, in one place, so a new Press target can't
 * skip one. The less obvious ones:
 * - a double-click creates a Note only if both presses were on empty Board.
 * - after a mouse click on a × deletes its Note, presses on Notes are ignored for
 *   `DOUBLE_CLICK_MS`, so a double-click's second half can't hit the Note under the ×.
 * - a Note deleted while held (from the keyboard) cancels its Drag, so Undo brings it
 *   back where it was.
 */
export function createPress(
  { notes, ui }: Stores,
  drag: DragController,
  now: () => number = () => performance.now(),
): Press {
  let pressedId: NoteId | null = null;
  let previousOnBoard = false;
  let lastOnBoard = false;
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
      // Any button, the × included.
      ui.getState().pressed(target.id);
      if (target.on === 'delete') return 'prevent';
      if (!pointer.isPrimary || pointer.button !== 0) return 'none';
      const note = notes.getState().notes[target.id];
      if (!note) return 'none';
      notes.getState().raise(target.id);
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
      if (inText) return;
      // So the focus ring and the Editing outline are never on two Notes.
      ui.getState().pressed(id);
      // A right-button press focuses the Note too, and must not Raise.
      if (keyboard) notes.getState().raise(id);
    },

    deleteButtonClicked(id, { mouse }) {
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
