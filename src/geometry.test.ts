import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  clampToBoard,
  placeCentredAt,
  placeInVisibleBoard,
  toBoardPoint,
  type Rect,
} from './geometry';

const rect = (x: number, y: number, width = 220, height = 170): Rect => ({ x, y, width, height });

describe('clampToBoard', () => {
  it('leaves a rect that is inside the Board as it is', () => {
    expect(clampToBoard(rect(300, 200))).toEqual(rect(300, 200));
  });

  it('pushes a rect past the top-left fully inside', () => {
    expect(clampToBoard(rect(-50, -1))).toEqual(rect(0, 0));
  });

  it('pushes a rect past the bottom-right fully inside', () => {
    expect(clampToBoard(rect(1900, 1079))).toEqual(rect(1700, 910));
  });

  it('grows a rect to the minimum Note size', () => {
    expect(clampToBoard(rect(10, 10, 5, 99))).toEqual(rect(10, 10, 140, 100));
  });

  it('shrinks a rect larger than the Board to the Board', () => {
    expect(clampToBoard(rect(10, 10, 5000, 5000))).toEqual(rect(0, 0, 1920, 1080));
  });

  describe('for any rect', () => {
    const length = fc.double({ min: -5000, max: 5000, noNaN: true });
    const anyRect = fc.record({ x: length, y: length, width: length, height: length });

    it('ends inside the Board', () => {
      fc.assert(
        fc.property(anyRect, (input) => {
          const { x, y, width, height } = clampToBoard(input);
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
          const { width, height } = clampToBoard(input);
          expect(width).toBeGreaterThanOrEqual(140);
          expect(height).toBeGreaterThanOrEqual(100);
        }),
      );
    });

    it('is unchanged by clamping again', () => {
      fc.assert(
        fc.property(anyRect, (input) => {
          const once = clampToBoard(input);
          expect(clampToBoard(once)).toEqual(once);
        }),
      );
    });
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
    expect(placeCentredAt({ x: 400, y: 300 }, size)).toEqual(rect(290, 215));
  });

  it('pushes a Note by the top-left fully inside the Board', () => {
    expect(placeCentredAt({ x: 5, y: 9 }, size)).toEqual(rect(0, 0));
  });

  it('pushes a Note by the bottom-right fully inside the Board', () => {
    expect(placeCentredAt({ x: 1915, y: 1075 }, size)).toEqual(rect(1700, 910));
  });

  it('rounds to whole pixels', () => {
    expect(placeCentredAt({ x: 400.4, y: 300.7 }, size)).toEqual(rect(290, 216));
  });
});

describe('placeInVisibleBoard', () => {
  const size = { width: 220, height: 170 };
  const view = { x: 0, y: 0, width: 1024, height: 720 };
  // Centred at (1676, 886), one step from the corner.
  const nearCorner = { x: 1652, y: 862, width: 268, height: 218 };

  it('centres the Note in the visible part of the Board', () => {
    expect(placeInVisibleBoard(view, size, [])).toEqual(rect(402, 275));
  });

  it('follows the scroll', () => {
    expect(placeInVisibleBoard({ ...view, x: 500, y: 200 }, size, [])).toEqual(rect(902, 475));
  });

  it('ignores the backdrop when the window is larger than the Board', () => {
    const largeView = { x: 0, y: 0, width: 2560, height: 1400 };

    expect(placeInVisibleBoard(largeView, size, [])).toEqual(rect(850, 455));
  });

  it('ignores the backdrop past the edge when scrolled to the end', () => {
    const endView = { x: 920, y: 400, width: 1024, height: 704 };

    expect(placeInVisibleBoard(endView, size, [])).toEqual(rect(1310, 655));
  });

  it('pushes a Note fully inside the Board when little of it is visible', () => {
    const cornerView = { x: 1800, y: 1000, width: 300, height: 300 };

    expect(placeInVisibleBoard(cornerView, size, [])).toEqual(rect(1700, 910));
  });

  it('cascades by (24, 24) while a Note sits at that exact spot', () => {
    const taken = [rect(402, 275), rect(426, 299)];

    expect(placeInVisibleBoard(view, size, taken)).toEqual(rect(450, 323));
  });

  it('takes the first free spot of the cascade', () => {
    const taken = [rect(402, 275), rect(450, 323)];

    expect(placeInVisibleBoard(view, size, taken)).toEqual(rect(426, 299));
  });

  it('does not cascade for a Note that is only nearby', () => {
    expect(placeInVisibleBoard(view, size, [rect(403, 275)])).toEqual(rect(402, 275));
  });

  it('cascades along an edge it has reached', () => {
    const rightView = { x: 1700, y: 0, width: 220, height: 720 };

    expect(placeInVisibleBoard(rightView, size, [rect(1700, 275)])).toEqual(rect(1700, 299));
  });

  it('jumps back from the corner to the top-left of the visible Board', () => {
    const taken = [rect(1676, 886), rect(1700, 910)];

    expect(placeInVisibleBoard(nearCorner, size, taken)).toEqual(rect(1652, 862));
  });

  it('starts each further jump back a step to the right', () => {
    const taken = [rect(1676, 886), rect(1700, 910), rect(1652, 862)];

    expect(placeInVisibleBoard(nearCorner, size, taken)).toEqual(rect(1676, 862));
  });

  it('never stacks 100 Notes when scrolled to the end', () => {
    const endView = { x: 920, y: 400, width: 1024, height: 704 };
    const taken: Rect[] = [];
    for (let press = 0; press < 100; press++) taken.push(placeInVisibleBoard(endView, size, taken));

    expect(new Set(taken.map(({ x, y }) => `${String(x)},${String(y)}`)).size).toBe(100);
    // Jumping back must not take a Note out of view, either.
    expect(Math.min(...taken.map(({ x }) => x))).toBeGreaterThanOrEqual(920);
    expect(Math.min(...taken.map(({ y }) => y))).toBeGreaterThanOrEqual(400);
  });

  it('stacks in the corner only when every spot of the cascade is taken', () => {
    const taken = [
      rect(1676, 886),
      rect(1700, 910),
      rect(1652, 862),
      rect(1676, 862),
      rect(1700, 886),
      rect(1700, 862),
    ];

    expect(placeInVisibleBoard(nearCorner, size, taken)).toEqual(rect(1700, 910));
  });

  it('jumps back at the edge of the visible Board, before the Board ends', () => {
    const smallView = { x: 100, y: 100, width: 268, height: 218 };
    const taken = [rect(124, 124), rect(148, 148)];

    expect(placeInVisibleBoard(smallView, size, taken)).toEqual(rect(100, 100));
  });

  it('keeps 100 Notes in view when scrolled to the top-left', () => {
    const taken: Rect[] = [];
    for (let press = 0; press < 100; press++) taken.push(placeInVisibleBoard(view, size, taken));

    expect(new Set(taken.map(({ x, y }) => `${String(x)},${String(y)}`)).size).toBe(100);
    expect(Math.max(...taken.map(({ x, width }) => x + width))).toBeLessThanOrEqual(1024);
    expect(Math.max(...taken.map(({ y, height }) => y + height))).toBeLessThanOrEqual(720);
  });

  it('stacks in the visible corner when every visible spot is taken', () => {
    const exactView = { x: 100, y: 100, width: 220, height: 170 };

    expect(placeInVisibleBoard(exactView, size, [rect(100, 100)])).toEqual(rect(100, 100));
  });

  it('still cascades when the window is smaller than the Note', () => {
    const tinyView = { x: 100, y: 100, width: 200, height: 150 };

    expect(placeInVisibleBoard(tinyView, size, [rect(90, 90)])).toEqual(rect(114, 114));
  });

  it('stops in the corner when there is no room to jump back', () => {
    const cornerView = { x: 1700, y: 910, width: 220, height: 170 };

    expect(placeInVisibleBoard(cornerView, size, [rect(1700, 910)])).toEqual(rect(1700, 910));
  });
});
