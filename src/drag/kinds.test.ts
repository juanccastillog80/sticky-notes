import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { makeNote } from '../../test/factories';
import { RESIZE_HANDLES, resizeKinds, type ResizeHandle } from './kinds';

// x 100..320, y 100..270.
const note = makeNote({ x: 100, y: 100, width: 220, height: 170 });
const ctx = { pointer: { x: 0, y: 0 } };
const preview = (handle: ResizeHandle, dx: number, dy: number) =>
  resizeKinds[handle].preview(note, { x: dx, y: dy }, ctx);

describe('resizeKinds', () => {
  it('se grows the width and height, keeping the top-left', () => {
    expect(preview('se', 30, 20)).toEqual({ x: 100, y: 100, width: 250, height: 190 });
  });

  it('nw moves the top-left, keeping the bottom-right', () => {
    expect(preview('nw', -30, 20)).toEqual({ x: 70, y: 120, width: 250, height: 150 });
  });

  it('e ignores vertical movement', () => {
    expect(preview('e', 30, 50)).toEqual({ x: 100, y: 100, width: 250, height: 170 });
  });

  it('n ignores horizontal movement', () => {
    expect(preview('n', 50, -30)).toEqual({ x: 100, y: 70, width: 220, height: 200 });
  });

  it('se stops shrinking at the minimum Note size', () => {
    expect(preview('se', -500, -500)).toEqual({ x: 100, y: 100, width: 140, height: 100 });
  });

  it('w stops shrinking at the minimum size with the right edge in place', () => {
    expect(preview('w', 500, 0)).toEqual({ x: 180, y: 100, width: 140, height: 170 });
  });

  it('nw stops growing at the Board edges', () => {
    expect(preview('nw', -500, -500)).toEqual({ x: 0, y: 0, width: 320, height: 270 });
  });

  it('se stops growing at the Board edges', () => {
    expect(preview('se', 5000, 5000)).toEqual({ x: 100, y: 100, width: 1820, height: 980 });
  });

  it('rounds to whole pixels', () => {
    expect(preview('sw', -10.4, 10.6)).toEqual({ x: 90, y: 100, width: 230, height: 181 });
  });

  it('commits a resize to exactly the last Preview', () => {
    expect(resizeKinds.nw.commit(note, { x: -30, y: 20 }, ctx)).toEqual({
      type: 'resize',
      id: note.id,
      x: 70,
      y: 120,
      width: 250,
      height: 150,
    });
  });

  describe('for any committed Note, handle and delta', () => {
    const anyNote = fc
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
      )
      .map((rect) => makeNote(rect));
    const anyHandle = fc.constantFrom(...RESIZE_HANDLES);
    const length = fc.double({ min: -5000, max: 5000, noNaN: true });
    const anyDelta = fc.record({ x: length, y: length });

    it('stays inside the Board, at least the minimum size, in whole pixels', () => {
      fc.assert(
        fc.property(anyNote, anyHandle, anyDelta, (from, handle, delta) => {
          const { x, y, width, height } = resizeKinds[handle].preview(from, delta, ctx);
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
        fc.property(anyNote, anyHandle, anyDelta, (from, handle, delta) => {
          const to = resizeKinds[handle].preview(from, delta, ctx);
          if (!handle.includes('w')) expect(to.x).toBe(from.x);
          if (!handle.includes('e')) expect(to.x + to.width).toBe(from.x + from.width);
          if (!handle.includes('n')) expect(to.y).toBe(from.y);
          if (!handle.includes('s')) expect(to.y + to.height).toBe(from.y + from.height);
        }),
      );
    });

    it('is idempotent: resizing the result by the same handle with no delta changes nothing', () => {
      fc.assert(
        fc.property(anyNote, anyHandle, anyDelta, (from, handle, delta) => {
          const once = resizeKinds[handle].preview(from, delta, ctx);
          const again = resizeKinds[handle].preview({ ...from, ...once }, { x: 0, y: 0 }, ctx);
          expect(again).toEqual(once);
        }),
      );
    });
  });
});
