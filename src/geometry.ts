export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Point, Size {}

export const MIN_NOTE_SIZE = { width: 140, height: 100 } as const satisfies Size;

/** `max` wins over `min` when they cross. */
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * Keeps the whole rect inside `board`, at a legal Note size. Fractions are kept. On a
 * Board smaller than a Note, the Note keeps the minimum size, at the Board's top-left.
 */
export function clampToBoard(rect: Rect, board: Size): Rect {
  const width = clamp(rect.width, MIN_NOTE_SIZE.width, Math.max(board.width, MIN_NOTE_SIZE.width));
  const height = clamp(
    rect.height,
    MIN_NOTE_SIZE.height,
    Math.max(board.height, MIN_NOTE_SIZE.height),
  );
  return {
    x: clamp(rect.x, 0, Math.max(board.width - width, 0)),
    y: clamp(rect.y, 0, Math.max(board.height - height, 0)),
    width,
    height,
  };
}

/**
 * The rect a Drag or a new Note saves: whole pixels, inside the Board's current size.
 * `board` must be whole pixels too.
 */
export function toCommittedRect({ x, y, width, height }: Rect, board: Size): Rect {
  // Round first: the bounds are whole pixels, so clamping can't bring a fraction back.
  return clampToBoard(rounded({ x, y, width, height }), board);
}

/**
 * The rect the Notes store keeps, whatever the window: whole pixels, at least the
 * minimum size, at no negative position. No far edge: the Board grows to hold every
 * Note, so a stored position is never pulled back (ADR 0003).
 */
export function toStoredRect(rect: Rect): Rect {
  const { x, y, width, height } = rounded(rect);
  return {
    x: Math.max(x, 0),
    y: Math.max(y, 0),
    width: Math.max(width, MIN_NOTE_SIZE.width),
    height: Math.max(height, MIN_NOTE_SIZE.height),
  };
}

function rounded({ x, y, width, height }: Rect): Rect {
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

/** How far the Notes reach: their furthest right and bottom edges. The Board is at least this big. */
export function notesExtent(notes: Iterable<Rect>): Size {
  let width = 0;
  let height = 0;
  for (const note of notes) {
    width = Math.max(width, note.x + note.width);
    height = Math.max(height, note.y + note.height);
  }
  return { width, height };
}

/** The edges a resize moves: one side, or two for a corner. */
export type Edges = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * `from` with the named edges moved by `delta`, as it will be stored. Each moving edge
 * stops at `MIN_NOTE_SIZE` from the opposite edge and at the edge of `board`
 * (unless that would make the Note smaller than the minimum); the opposite edge never moves. The delta is rounded first, so the result is whole pixels.
 */
export function resizeRect(from: Rect, delta: Point, edges: Edges, board: Size): Rect {
  const dx = Math.round(delta.x);
  const dy = Math.round(delta.y);
  const right = from.x + from.width;
  const bottom = from.y + from.height;
  let { x, y, width, height } = from;
  if (edges.includes('e'))
    width = clamp(
      from.width + dx,
      MIN_NOTE_SIZE.width,
      Math.max(board.width - x, MIN_NOTE_SIZE.width),
    );
  if (edges.includes('w')) {
    x = clamp(from.x + dx, 0, right - MIN_NOTE_SIZE.width);
    width = right - x;
  }
  if (edges.includes('s')) {
    height = clamp(
      from.height + dy,
      MIN_NOTE_SIZE.height,
      Math.max(board.height - y, MIN_NOTE_SIZE.height),
    );
  }
  if (edges.includes('n')) {
    y = clamp(from.y + dy, 0, bottom - MIN_NOTE_SIZE.height);
    height = bottom - y;
  }
  return { x, y, width, height };
}

/** Whether `point` is inside `rect`, edges included. */
export function contains(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

/** Whether the rects overlap (axis-aligned boxes), touching edges included, as in `contains`. */
export function intersects(a: Rect, b: Rect): boolean {
  return (
    a.x <= b.x + b.width && b.x <= a.x + a.width && a.y <= b.y + b.height && b.y <= a.y + a.height
  );
}

/** A client point in Board coordinates. `boardRect` already reflects scrolling. */
export function toBoardPoint(client: Point, boardRect: Point): Point {
  return { x: client.x - boardRect.x, y: client.y - boardRect.y };
}

/** A `size` rect centred on a point (the pointer, for a double-click), as it will be stored. */
export function placeCentredAt({ x, y }: Point, { width, height }: Size, board: Size): Rect {
  return toCommittedRect({ x: x - width / 2, y: y - height / 2, width, height }, board);
}

const CASCADE_STEP = 24;

/**
 * Centred in the part of the Board that `view` (the scroll container's offset
 * and client size) shows, or at the first free spot of the cascade from there.
 */
export function placeInVisibleBoard(
  view: Rect,
  size: Size,
  taken: readonly Point[],
  board: Size,
): Rect {
  // `view` can reach past the Board, over the backdrop.
  const right = Math.min(view.x + view.width, board.width);
  const bottom = Math.min(view.y + view.height, board.height);
  const centred = placeCentredAt(
    { x: (view.x + right) / 2, y: (view.y + bottom) / 2 },
    size,
    board,
  );
  const visible = { x: view.x, y: view.y, width: right - view.x, height: bottom - view.y };
  const corner = lastSpotIn(visible, size, board);

  for (const spot of cascadeSpots(centred, view, corner, board)) {
    if (!taken.some((point) => samePoint(point, spot))) return spot;
  }
  // Every spot is taken, so stack in the corner.
  return corner;
}

/** The furthest spot fully in view. Along a side too short for the Note, the furthest on the Board. */
function lastSpotIn(visible: Rect, { width, height }: Size, board: Size): Rect {
  return toCommittedRect(
    {
      width,
      height,
      x: visible.width < width ? board.width : visible.x + visible.width - width,
      y: visible.height < height ? board.height : visible.y + visible.height - height,
    },
    board,
  );
}

/** The spots to try, in order: from the centre, then jumping back to the top of `view`. */
function* cascadeSpots(centred: Rect, view: Point, corner: Point, board: Size): Generator<Rect> {
  yield* stepsToCorner(centred, corner);

  for (let x = Math.round(view.x); x <= corner.x; x += CASCADE_STEP) {
    yield* stepsToCorner(toCommittedRect({ ...centred, x, y: view.y }, board), corner);
  }
}

/** `start`, then (24, 24) steps until `corner`, along an edge once it reaches one. */
function* stepsToCorner(start: Rect, corner: Point): Generator<Rect> {
  let spot = start;
  for (;;) {
    yield spot;
    const next = {
      ...spot,
      x: Math.min(spot.x + CASCADE_STEP, corner.x),
      y: Math.min(spot.y + CASCADE_STEP, corner.y),
    };
    if (samePoint(next, spot)) return;
    spot = next;
  }
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}
