import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  clampToBoard,
  intersects,
  notesExtent,
  placeCentredAt,
  resizeRect,
  toBoardPoint,
  toCommittedRect,
  toStoredRect,
  type Edges,
  type Rect,
} from './geometry';

const rect = (x: number, y: number, width = 220, height = 170): Rect => ({ x, y, width, height });
/** The Board's size in most tests: a large window. */
const board = { width: 1920, height: 1080 };
/** The Board an empty 1024×768 window shows: less the 48 px top bar and the 24 px backdrop. */
const fittedBoard = { width: 1000, height: 696 };

describe('clampToBoard', () => {
  it('leaves a rect that is inside the Board as it is', () => {
    expect(clampToBoard(rect(300, 200), board)).toEqual(rect(300, 200));
  });

  it('pushes a rect past the top-left fully inside', () => {
    expect(clampToBoard(rect(-50, -1), board)).toEqual(rect(0, 0));
  });

  it('pushes a rect past the bottom-right fully inside', () => {
    expect(clampToBoard(rect(1900, 1079), board)).toEqual(rect(1700, 910));
  });

  it('grows a rect to the minimum Note size', () => {
    expect(clampToBoard(rect(10, 10, 5, 99), board)).toEqual(rect(10, 10, 140, 100));
  });

  it('shrinks a rect larger than the Board to the Board', () => {
    expect(clampToBoard(rect(10, 10, 5000, 5000), board)).toEqual(rect(0, 0, 1920, 1080));
  });

  it('uses the Board size it is given', () => {
    expect(clampToBoard(rect(900, 600), fittedBoard)).toEqual(rect(780, 526));
  });

  it('keeps a Note at the minimum size in the top-left of a Board smaller than a Note', () => {
    const tiny = { width: 100, height: 50 };

    expect(clampToBoard(rect(30, 20, 220, 170), tiny)).toEqual(rect(0, 0, 140, 100));
  });

  describe('for any rect', () => {
    const length = fc.double({ min: -5000, max: 5000, noNaN: true });
    const anyRect = fc.record({ x: length, y: length, width: length, height: length });

    it('ends inside the Board', () => {
      fc.assert(
        fc.property(anyRect, (input) => {
          const { x, y, width, height } = clampToBoard(input, board);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x + width).toBeLessThanOrEqual(1920);
          expect(y + height).toBeLessThanOrEqual(1080);
        }),
      );
    });

    it('is at least the minimum Note size', () => {
      fc.assert(
        fc.property(anyRect, (input) => {
          const { width, height } = clampToBoard(input, board);
          expect(width).toBeGreaterThanOrEqual(140);
          expect(height).toBeGreaterThanOrEqual(100);
        }),
      );
    });

    it('is unchanged by clamping again', () => {
      fc.assert(
        fc.property(anyRect, (input) => {
          const once = clampToBoard(input, board);
          expect(clampToBoard(once, board)).toEqual(once);
        }),
      );
    });
  });
});

describe('toCommittedRect', () => {
  it('rounds, then keeps the rect inside the Board it is given', () => {
    const small = { width: 600, height: 400 };

    expect(toCommittedRect(rect(500.4, 10.6), small)).toEqual(rect(380, 11));
  });

  it('gives a minimum-size Note at the top-left on a Board smaller than a Note', () => {
    expect(toCommittedRect(rect(10, 10), { width: 0, height: 0 })).toEqual(rect(0, 0, 140, 100));
  });
});

describe('toStoredRect', () => {
  it('never pulls a Note back from past any Board edge', () => {
    expect(toStoredRect(rect(5000, 3000))).toEqual(rect(5000, 3000));
  });

  it('keeps the Note off negative coordinates, at the minimum size, in whole pixels', () => {
    expect(toStoredRect(rect(-10, 20.6, 5.2, 300.4))).toEqual(rect(0, 21, 140, 300));
  });
});

describe('notesExtent', () => {
  it('is nothing for no Notes', () => {
    expect(notesExtent([])).toEqual({ width: 0, height: 0 });
  });

  it('reaches the furthest right and the furthest bottom edges, which may be different Notes', () => {
    const right = rect(1200, 100, 300, 170); // right edge 1500
    const low = rect(100, 900, 220, 250); // bottom edge 1150

    expect(notesExtent([right, low, rect(0, 0)])).toEqual({ width: 1500, height: 1150 });
  });
});

describe('intersects', () => {
  const zone = rect(900, 600, 104, 104);

  it('is true when the rects overlap', () => {
    expect(intersects(rect(800, 500), zone)).toBe(true);
  });

  it('counts touching edges as overlap, as contains counts its edges', () => {
    expect(intersects(rect(680, 600), zone)).toBe(true); // right edge on the zone's left
    expect(intersects(rect(1004, 704), zone)).toBe(true); // top-left on the zone's bottom-right
  });

  it('is true when one is inside the other, either way round', () => {
    const big = rect(850, 550, 400, 300);
    expect(intersects(big, zone)).toBe(true);
    expect(intersects(zone, big)).toBe(true);
  });

  it.each([
    ['left', rect(679, 600)],
    ['right', rect(1005, 600)],
    ['above', rect(900, 429)],
    ['below', rect(900, 705)],
  ])('is false when apart on one axis: %s of it', (_, other) => {
    expect(intersects(other, zone)).toBe(false);
    expect(intersects(zone, other)).toBe(false);
  });
});

describe('toBoardPoint', () => {
  it('counts from the top-left of a Board below the top bar', () => {
    expect(toBoardPoint({ x: 400, y: 300 }, { x: 0, y: 48 })).toEqual({ x: 400, y: 252 });
  });

  it('includes scrolling, which moves the Board rect off-screen', () => {
    expect(toBoardPoint({ x: 400, y: 300 }, { x: -500, y: -152 })).toEqual({ x: 900, y: 452 });
  });
});

describe('placeCentredAt', () => {
  const size = { width: 220, height: 170 };

  it('centres the Note on the pointer', () => {
    expect(placeCentredAt({ x: 400, y: 300 }, size, board)).toEqual(rect(290, 215));
  });

  it('pushes a Note by the top-left fully inside the Board', () => {
    expect(placeCentredAt({ x: 5, y: 9 }, size, board)).toEqual(rect(0, 0));
  });

  it('pushes a Note by the bottom-right fully inside the Board', () => {
    expect(placeCentredAt({ x: 1915, y: 1075 }, size, board)).toEqual(rect(1700, 910));
  });

  it('pushes it inside the Board it is given', () => {
    expect(placeCentredAt({ x: 995, y: 690 }, size, fittedBoard)).toEqual(rect(780, 526));
  });

  it('rounds to whole pixels', () => {
    expect(placeCentredAt({ x: 400.4, y: 300.7 }, size, board)).toEqual(rect(290, 216));
  });
});

// x 100..320, y 100..270.
const from = rect(100, 100, 220, 170);
const resize = (edges: Edges, dx: number, dy: number) =>
  resizeRect(from, { x: dx, y: dy }, edges, board);

describe('resizeRect', () => {
  it('se grows the width and height, keeping the top-left', () => {
    expect(resize('se', 30, 20)).toEqual({ x: 100, y: 100, width: 250, height: 190 });
  });

  it('nw moves the top-left, keeping the bottom-right', () => {
    expect(resize('nw', -30, 20)).toEqual({ x: 70, y: 120, width: 250, height: 150 });
  });

  it('e ignores vertical movement', () => {
    expect(resize('e', 30, 50)).toEqual({ x: 100, y: 100, width: 250, height: 170 });
  });

  it('n ignores horizontal movement', () => {
    expect(resize('n', 50, -30)).toEqual({ x: 100, y: 70, width: 220, height: 200 });
  });

  it('se stops shrinking at the minimum Note size', () => {
    expect(resize('se', -500, -500)).toEqual({ x: 100, y: 100, width: 140, height: 100 });
  });

  it('w stops shrinking at the minimum size with the right edge in place', () => {
    expect(resize('w', 500, 0)).toEqual({ x: 180, y: 100, width: 140, height: 170 });
  });

  it('nw stops growing at the Board edges', () => {
    expect(resize('nw', -500, -500)).toEqual({ x: 0, y: 0, width: 320, height: 270 });
  });

  it('se stops growing at the Board edges', () => {
    expect(resize('se', 5000, 5000)).toEqual({ x: 100, y: 100, width: 1820, height: 980 });
  });

  it('stops growing at the edges of the Board it is given', () => {
    const small = { width: 600, height: 400 };

    expect(resizeRect(from, { x: 5000, y: 5000 }, 'se', small)).toEqual(rect(100, 100, 500, 300));
  });

  it('keeps the minimum size on a Board smaller than a Note', () => {
    const tiny = { width: 100, height: 50 };

    expect(resizeRect(rect(0, 0, 140, 100), { x: 40, y: 40 }, 'se', tiny)).toEqual(
      rect(0, 0, 140, 100),
    );
  });

  it('rounds to whole pixels', () => {
    expect(resize('sw', -10.4, 10.6)).toEqual({ x: 90, y: 100, width: 230, height: 181 });
  });

  describe('for any committed rect, edges and delta', () => {
    const anyRect = fc
      .record({
        width: fc.integer({ min: 140, max: 1920 }),
        height: fc.integer({ min: 100, max: 1080 }),
      })
      .chain(({ width, height }) =>
        fc.record({
          x: fc.integer({ min: 0, max: 1920 - width }),
          y: fc.integer({ min: 0, max: 1080 - height }),
          width: fc.constant(width),
          height: fc.constant(height),
        }),
      );
    const anyEdges = fc.constantFrom<Edges>('n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw');
    const length = fc.double({ min: -5000, max: 5000, noNaN: true });
    const anyDelta = fc.record({ x: length, y: length });

    it('stays inside the Board, at least the minimum size, in whole pixels', () => {
      fc.assert(
        fc.property(anyRect, anyEdges, anyDelta, (from, edges, delta) => {
          const { x, y, width, height } = resizeRect(from, delta, edges, board);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(y).toBeGreaterThanOrEqual(0);
          expect(x + width).toBeLessThanOrEqual(1920);
          expect(y + height).toBeLessThanOrEqual(1080);
          expect(width).toBeGreaterThanOrEqual(140);
          expect(height).toBeGreaterThanOrEqual(100);
          expect([x, y, width, height].every(Number.isInteger)).toBe(true);
        }),
      );
    });

    it('never moves the opposite edges', () => {
      fc.assert(
        fc.property(anyRect, anyEdges, anyDelta, (from, edges, delta) => {
          const to = resizeRect(from, delta, edges, board);
          if (!edges.includes('w')) expect(to.x).toBe(from.x);
          if (!edges.includes('e')) expect(to.x + to.width).toBe(from.x + from.width);
          if (!edges.includes('n')) expect(to.y).toBe(from.y);
          if (!edges.includes('s')) expect(to.y + to.height).toBe(from.y + from.height);
        }),
      );
    });

    it('is idempotent: resizing the result by the same edges with no delta changes nothing', () => {
      fc.assert(
        fc.property(anyRect, anyEdges, anyDelta, (from, edges, delta) => {
          const once = resizeRect(from, delta, edges, board);
          const again = resizeRect(once, { x: 0, y: 0 }, edges, board);
          expect(again).toEqual(once);
        }),
      );
    });
  });
});
