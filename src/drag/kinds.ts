import { toCommittedRect, type Point, type Rect } from '../geometry';
import type { Note } from '../notes/note';
import type { NoteAction } from '../notes/notesReducer';

/** What a Drag kind may read besides its own rect and the Board delta. */
export interface DragContext {
  /** The pointer, in client coordinates. */
  readonly pointer: Point;
}

/**
 * What a Drag does: what it shows while it runs and what it saves at release.
 * Pure, so `preview` and `commit` agree by construction.
 */
export interface DragKind<From extends Rect> {
  preview: (from: From, delta: Point, ctx: DragContext) => Rect;
  commit: (from: From, delta: Point, ctx: DragContext) => NoteAction | null;
}

/** The rect a move shows, which is exactly the rect it saves. */
function moved(from: Rect, delta: Point): Rect {
  return toCommittedRect({ ...from, x: from.x + delta.x, y: from.y + delta.y });
}

export const moveKind: DragKind<Note> = {
  preview: moved,
  commit(from, delta) {
    const { x, y } = moved(from, delta);
    return { type: 'move', id: from.id, x, y };
  },
};
