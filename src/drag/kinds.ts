import { resizeRect, toCommittedRect, type Edges, type Point, type Rect } from '../geometry';
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

/** The 8 resize handles, named by the edges they move. */
export const RESIZE_HANDLES = [
  'n',
  's',
  'e',
  'w',
  'ne',
  'nw',
  'se',
  'sw',
] as const satisfies readonly Edges[];
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

function resizeKind(handle: ResizeHandle): DragKind<Note> {
  return {
    preview: (from, delta) => resizeRect(from, delta, handle),
    commit(from, delta) {
      return { type: 'resize', id: from.id, ...resizeRect(from, delta, handle) };
    },
  };
}

/** One kind per handle, built once. */
export const resizeKinds = Object.fromEntries(
  RESIZE_HANDLES.map((handle) => [handle, resizeKind(handle)]),
) as Record<ResizeHandle, DragKind<Note>>;
