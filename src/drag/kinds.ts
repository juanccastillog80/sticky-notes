import { resizeRect, toCommittedRect, type Edges, type Point, type Rect } from '../geometry';
import type { Note } from '../notes/note';
import type { NoteAction } from '../notes/notesReducer';

/** What a Drag kind may read besides its own rect and the Board delta. */
export interface DragContext {
  /** The pointer, in client coordinates. */
  readonly pointer: Point;
  /** The Trash zone's rect in client coordinates, measured at press, or `null` if it isn't on screen. */
  readonly trash: Rect | null;
}

/**
 * What a Drag does: what it shows while it runs and what it saves at release.
 * Pure, so `preview` and `commit` agree by construction.
 */
export interface DragKind<From extends Rect> {
  /** What a Press saves at once, before it is known to be a Drag or a Click. */
  press?: (from: From) => NoteAction | null;
  preview: (from: From, delta: Point, ctx: DragContext) => Rect;
  commit: (from: From, delta: Point, ctx: DragContext) => NoteAction | null;
  /** Only for a kind that can delete: whether a release now would drop the Note on the Trash zone. */
  overTrash?: (ctx: DragContext) => boolean;
}

/** The rect a move shows, which is exactly the rect it saves. */
function moved(from: Rect, delta: Point): Rect {
  return toCommittedRect({ ...from, x: from.x + delta.x, y: from.y + delta.y });
}

/** A Press Raises its Note at once, whatever it turns into, so a dragged Note never slides under others. */
const raise = (from: Note): NoteAction => ({ type: 'raise', id: from.id });

/**
 * The pointer itself must be inside the zone, edges included: a large Note that only
 * brushes the zone is moved, not deleted.
 */
function pointerInTrash({ pointer, trash }: DragContext): boolean {
  return (
    trash !== null &&
    pointer.x >= trash.x &&
    pointer.x <= trash.x + trash.width &&
    pointer.y >= trash.y &&
    pointer.y <= trash.y + trash.height
  );
}

export const moveKind: DragKind<Note> = {
  press: raise,
  preview: moved,
  overTrash: pointerInTrash,
  commit(from, delta, ctx) {
    if (pointerInTrash(ctx)) return { type: 'delete', id: from.id };
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
    press: raise,
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
