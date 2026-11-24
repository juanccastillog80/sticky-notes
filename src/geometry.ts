export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Point, Size {}

/** Fixed, so a stored position can never become invalid (ADR 0001). */
export const BOARD_SIZE = { width: 1920, height: 1080 } as const satisfies Size;
export const MIN_NOTE_SIZE = { width: 140, height: 100 } as const satisfies Size;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** Keeps the whole rect inside the Board, at a legal Note size. Fractions are kept. */
export function clampToBoard(rect: Rect): Rect {
  const width = clamp(rect.width, MIN_NOTE_SIZE.width, BOARD_SIZE.width);
  const height = clamp(rect.height, MIN_NOTE_SIZE.height, BOARD_SIZE.height);
  return {
    x: clamp(rect.x, 0, BOARD_SIZE.width - width),
    y: clamp(rect.y, 0, BOARD_SIZE.height - height),
    width,
    height,
  };
}

/** The rect that is stored: whole pixels, inside the Board. */
export function toCommittedRect({ x, y, width, height }: Rect): Rect {
  // Round first: the bounds are whole pixels, so clamping can't bring a fraction back.
  return clampToBoard({
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  });
}

/** The edges a resize moves: one side, or two for a corner. */
export type Edges = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * `from` with the named edges moved by `delta`, as it will be stored. Each moving edge
 * stops at `MIN_NOTE_SIZE` from the opposite edge and at the Board's edge; the
 * opposite edge never moves. The delta is rounded first, so the result is whole pixels.
 */
export function resizeRect(from: Rect, delta: Point, edges: Edges): Rect {
  const dx = Math.round(delta.x);
  const dy = Math.round(delta.y);
  const right = from.x + from.width;
  const bottom = from.y + from.height;
  let { x, y, width, height } = from;
  if (edges.includes('e'))
    width = clamp(from.width + dx, MIN_NOTE_SIZE.width, BOARD_SIZE.width - x);
  if (edges.includes('w')) {
    x = clamp(from.x + dx, 0, right - MIN_NOTE_SIZE.width);
    width = right - x;
  }
  if (edges.includes('s')) {
    height = clamp(from.height + dy, MIN_NOTE_SIZE.height, BOARD_SIZE.height - y);
  }
  if (edges.includes('n')) {
    y = clamp(from.y + dy, 0, bottom - MIN_NOTE_SIZE.height);
    height = bottom - y;
  }
  return { x, y, width, height };
}

/** A client point in Board coordinates. `boardRect` already reflects scrolling. */
export function toBoardPoint(client: Point, boardRect: Point): Point {
  return { x: client.x - boardRect.x, y: client.y - boardRect.y };
}

/** A `size` rect centred on a point (the pointer, for a double-click), as it will be stored. */
export function placeCentredAt({ x, y }: Point, { width, height }: Size): Rect {
  return toCommittedRect({ x: x - width / 2, y: y - height / 2, width, height });
}

const CASCADE_STEP = 24;

/**
 * Centred in the part of the Board that `view` (the scroll container's offset
 * and client size) shows, or at the first free spot of the cascade from there.
 */
export function placeInVisibleBoard(view: Rect, size: Size, taken: readonly Point[]): Rect {
  // `view` can reach past the Board, over the backdrop.
  const right = Math.min(view.x + view.width, BOARD_SIZE.width);
  const bottom = Math.min(view.y + view.height, BOARD_SIZE.height);
  const centred = placeCentredAt({ x: (view.x + right) / 2, y: (view.y + bottom) / 2 }, size);
  const visible = { x: view.x, y: view.y, width: right - view.x, height: bottom - view.y };
  const corner = lastSpotIn(visible, size);

  for (const spot of cascadeSpots(centred, view, corner)) {
    if (!taken.some((point) => samePoint(point, spot))) return spot;
  }
  // Every spot is taken, so stack in the corner.
  return corner;
}

/** The furthest spot fully in view. Along a side too short for the Note, the furthest on the Board. */
function lastSpotIn(visible: Rect, { width, height }: Size): Rect {
  return toCommittedRect({
    width,
    height,
    x: visible.width < width ? BOARD_SIZE.width : visible.x + visible.width - width,
    y: visible.height < height ? BOARD_SIZE.height : visible.y + visible.height - height,
  });
}

/** The spots to try, in order: from the centre, then jumping back to the top of `view`. */
function* cascadeSpots(centred: Rect, view: Point, corner: Point): Generator<Rect> {
  yield* stepsToCorner(centred, corner);

  for (let x = Math.round(view.x); x <= corner.x; x += CASCADE_STEP) {
    yield* stepsToCorner(toCommittedRect({ ...centred, x, y: view.y }), corner);
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
