import { BOARD_SIZE, MIN_NOTE_SIZE, toCommittedRect, type Point, type Rect } from '../geometry';
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
export const RESIZE_HANDLES = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
export type ResizeHandle = (typeof RESIZE_HANDLES)[number];

/**
 * The rect a resize shows, which is exactly the rect it saves. Each moving edge
 * stops at `MIN_NOTE_SIZE` from the opposite edge and at the Board's edge; the
 * opposite edge never moves. The delta is rounded first, so the result is whole pixels.
 */
function resized(from: Rect, delta: Point, handle: ResizeHandle): Rect {
  const dx = Math.round(delta.x);
  const dy = Math.round(delta.y);
  const right = from.x + from.width;
  const bottom = from.y + from.height;
  let { x, y, width, height } = from;
  if (handle.includes('e'))
    width = clamp(from.width + dx, MIN_NOTE_SIZE.width, BOARD_SIZE.width - x);
  if (handle.includes('w')) {
    x = clamp(from.x + dx, 0, right - MIN_NOTE_SIZE.width);
    width = right - x;
  }
  if (handle.includes('s')) {
    height = clamp(from.height + dy, MIN_NOTE_SIZE.height, BOARD_SIZE.height - y);
  }
  if (handle.includes('n')) {
    y = clamp(from.y + dy, 0, bottom - MIN_NOTE_SIZE.height);
    height = bottom - y;
  }
  return { x, y, width, height };
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

function resizeKind(handle: ResizeHandle): DragKind<Note> {
  return {
    preview: (from, delta) => resized(from, delta, handle),
    commit(from, delta) {
      return { type: 'resize', id: from.id, ...resized(from, delta, handle) };
    },
  };
}

/** One kind per handle, built once. */
export const resizeKinds = Object.fromEntries(
  RESIZE_HANDLES.map((handle) => [handle, resizeKind(handle)]),
) as Record<ResizeHandle, DragKind<Note>>;
