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
 * and client size) shows, stepping down-right past Notes at that exact spot.
 * From the Board's corner the steps wrap to the top-left of what is visible,
 * each wrap starting a step further right.
 */
export function placeInVisibleBoard(view: Rect, size: Size, taken: readonly Point[]): Rect {
  // `view` can reach past the Board, over the backdrop.
  const right = Math.min(view.x + view.width, BOARD_SIZE.width);
  const bottom = Math.min(view.y + view.height, BOARD_SIZE.height);
  let spot = placeCentredAt({ x: (view.x + right) / 2, y: (view.y + bottom) / 2 }, size);
  let wrapX = view.x;

  while (taken.some((point) => samePoint(point, spot))) {
    const next = clampToBoard({ ...spot, x: spot.x + CASCADE_STEP, y: spot.y + CASCADE_STEP });
    if (!samePoint(next, spot)) {
      spot = next;
    } else if (wrapX <= BOARD_SIZE.width - size.width) {
      spot = toCommittedRect({ ...size, x: wrapX, y: view.y });
      wrapX += CASCADE_STEP;
    } else {
      // Every spot is taken. Without this the loop would never end.
      break;
    }
  }
  return spot;
}

function samePoint(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}
