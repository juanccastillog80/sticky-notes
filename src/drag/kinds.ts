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

export interface DragContext {
  /** Client coordinates. */
  readonly trash: Rect | null;
  /** Client coordinates, scroll included. */
  readonly boardOrigin: Point;
  readonly board: Size;
}

export type DragSave = Pick<NotesActions, 'move' | 'resize' | 'deleteNote'>;

/** `commit` saves a rect computed as `preview` shows it, so they agree by construction. */
export interface DragKind<From extends Rect> {
  preview: (from: From, delta: Point, ctx: DragContext) => Rect;
  commit: (from: From, delta: Point, ctx: DragContext, save: DragSave) => void;
  /** Only for a kind that can delete. */
  overTrash?: (from: From, delta: Point, ctx: DragContext) => boolean;
}

function moved(from: Rect, delta: Point, { board }: DragContext): Rect {
  return toCommittedRect({ ...from, x: from.x + delta.x, y: from.y + delta.y }, board);
}

/**
 * The Note's rect, not the pointer, decides. The highlight and the release both ask
 * this, so the highlight always predicts what a release does.
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

export const resizeKinds = Object.fromEntries(
  RESIZE_HANDLES.map((handle) => [handle, resizeKind(handle)]),
) as Record<ResizeHandle, DragKind<Note>>;
