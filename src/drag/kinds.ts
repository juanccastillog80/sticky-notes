import {
  intersects,
  resizeRect,
  toCommittedRect,
  type Edges,
  type Point,
  type Rect,
  type Size,
} from '../geometry';
import type { Note } from '../notes/note';
import type { NotesActions } from '../notes/notesStore';

/** What a Drag kind may read besides its own rect and the Board delta. */
export interface DragContext {
  /** The Trash zone's rect in client coordinates, measured at press, or `null` if it isn't on screen. */
  readonly trash: Rect | null;
  /** The Board's top-left in client coordinates now: where it was at press, less the scroll since. */
  readonly boardOrigin: Point;
  /** The Board's size, measured at press: a Drag keeps the Note inside it. */
  readonly board: Size;
}

/** The Notes store's actions a Drag saves through. A drop on the Trash zone is a `deleteNote`, for Undo. */
export type DragSave = Pick<NotesActions, 'move' | 'resize' | 'deleteNote'>;

/**
 * What a Drag does: what it shows while it runs and what it saves at release.
 * `preview` is pure, and `commit` saves a rect computed the same way, so they agree
 * by construction. The Raise is the Press's, not the kind's (`src/press/`).
 */
export interface DragKind<From extends Rect> {
  preview: (from: From, delta: Point, ctx: DragContext) => Rect;
  commit: (from: From, delta: Point, ctx: DragContext, save: DragSave) => void;
  /** Only for a kind that can delete: whether a release now would drop the Note on the Trash zone. */
  overTrash?: (from: From, delta: Point, ctx: DragContext) => boolean;
}

/** The rect a move shows, which is exactly the rect it saves. */
function moved(from: Rect, delta: Point, { board }: DragContext): Rect {
  return toCommittedRect({ ...from, x: from.x + delta.x, y: from.y + delta.y }, board);
}

/**
 * The Note's Preview rect, placed on screen, overlaps the zone, touching edges included.
 * It is the Note that is dropped, so the pointer doesn't matter: a large Note held by its
 * far edge is deleted as soon as any part of it reaches the zone. The highlight and the
 * release both ask this, so the highlight always predicts what a release does.
 */
function noteOverTrash(from: Rect, delta: Point, ctx: DragContext): boolean {
  const { trash, boardOrigin } = ctx;
  if (trash === null) return false;
  const shown = moved(from, delta, ctx);
  return intersects({ ...shown, x: shown.x + boardOrigin.x, y: shown.y + boardOrigin.y }, trash);
}

export const moveKind: DragKind<Note> = {
  preview: moved,
  overTrash: noteOverTrash,
  commit(from, delta, ctx, save) {
    if (noteOverTrash(from, delta, ctx)) {
      save.deleteNote(from.id);
      return;
    }
    const { x, y } = moved(from, delta, ctx);
    save.move(from.id, x, y);
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
    preview: (from, delta, { board }) => resizeRect(from, delta, handle, board),
    commit(from, delta, { board }, save) {
      save.resize(from.id, resizeRect(from, delta, handle, board));
    },
  };
}

/** One kind per handle, built once. */
export const resizeKinds = Object.fromEntries(
  RESIZE_HANDLES.map((handle) => [handle, resizeKind(handle)]),
) as Record<ResizeHandle, DragKind<Note>>;
