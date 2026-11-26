import { describe, expect, it } from 'vitest';
import { makeNote } from '../../test/factories';
import { recordingSave, type Call } from '../../test/recordCalls';
import type { Point } from '../geometry';
import type { Note } from '../notes/note';
import { moveKind, resizeKinds, type DragContext, type DragKind } from './kinds';

const note = makeNote({ x: 100, y: 100, width: 220, height: 170 });
const ctx: DragContext = { trash: null, boardOrigin: { x: 0, y: 0 } };

/** What `kind.commit` saved at release, as `[action, ...args]` calls. */
function saved(kind: DragKind<Note>, from: Note, delta: Point, ctx: DragContext): Call[] {
  const calls: Call[] = [];
  kind.commit(
    from,
    delta,
    ctx,
    recordingSave((call) => {
      calls.push(call);
    }),
  );
  return calls;
}

describe('moveKind and the Trash zone', () => {
  // Client coordinates, as measured on screen.
  const trash = { x: 900, y: 600, width: 104, height: 104 };
  /** The Board's top-left on screen: below a 56 px top bar, unless a test says otherwise. */
  const at = (boardOrigin: Point = { x: 0, y: 56 }): DragContext => ({ trash, boardOrigin });

  /** Whether the zone is highlighted now, and what a release now saves: they must agree. */
  function release(from: Note, delta: Point, ctx: DragContext) {
    return {
      over: moveKind.overTrash?.(from, delta, ctx),
      saved: saved(moveKind, from, delta, ctx),
    };
  }

  it('a Note moved onto the zone is highlighted over it, and a release deletes it', () => {
    // From client (100, 156) to (850, 606): its top-left corner is over the zone.
    expect(release(note, { x: 750, y: 450 }, at())).toEqual({
      over: true,
      saved: [['deleteNote', note.id]],
    });
  });

  it('a large Note held by its far edge deletes when it overlaps the zone, wherever the pointer is', () => {
    // Client (700, 506) to (1100, 806): across the zone. Its left edge, where it was
    // grabbed, is 200 px left of the zone; the pointer isn't part of the decision.
    const big = makeNote({ x: 700, y: 450, width: 400, height: 300 });

    expect(release(big, { x: 0, y: 0 }, at())).toEqual({
      over: true,
      saved: [['deleteNote', big.id]],
    });
  });

  it('a Note next to the zone, 1 px from it, is moved, not deleted', () => {
    // Client right edge at 899, the zone's left edge at 900.
    const beside = makeNote({ x: 579, y: 494, width: 220, height: 170 });

    expect(release(beside, { x: 100, y: 50 }, at())).toEqual({
      over: false,
      saved: [['move', beside.id, 679, 544]],
    });
  });

  it('a Note touching the zone edge counts as over it', () => {
    // Client right edge at exactly 900.
    const touching = makeNote({ x: 680, y: 544, width: 220, height: 170 });

    expect(release(touching, { x: 0, y: 0 }, at())).toEqual({
      over: true,
      saved: [['deleteNote', touching.id]],
    });
  });

  it("the Note's Board rect is placed on screen by the Board's origin", () => {
    // Board y 400 to 570: above the zone at a Board origin of 0, across it at 56.
    const n = makeNote({ x: 700, y: 400, width: 220, height: 170 });

    expect(release(n, { x: 0, y: 0 }, at({ x: 0, y: 0 })).over).toBe(false);
    expect(release(n, { x: 0, y: 0 }, at({ x: 0, y: 56 })).over).toBe(true);
  });

  it('the Preview rect, clamped to the Board, is what counts, not where the delta alone would put it', () => {
    // The delta would take the Note to client y 1856, past the zone. Clamped at the
    // Board's bottom (y 910 to 1080), it sits on screen at 966 to 1136: still below it.
    // With the Board scrolled up 400 px (origin y -344), the clamped Note is at 566 to
    // 736 on screen, across the zone.
    const n = makeNote({ x: 800, y: 100, width: 220, height: 170 });
    const delta = { x: 0, y: 1700 };

    expect(release(n, delta, at()).over).toBe(false);
    expect(release(n, delta, at({ x: 0, y: -344 }))).toEqual({
      over: true,
      saved: [['deleteNote', n.id]],
    });
  });

  it('with no Trash zone on screen, a move is only a move', () => {
    const big = makeNote({ x: 700, y: 450, width: 400, height: 300 });

    expect(release(big, { x: 0, y: 0 }, { trash: null, boardOrigin: { x: 0, y: 56 } })).toEqual({
      over: false,
      saved: [['move', big.id, 700, 450]],
    });
  });

  it('a resize never deletes, even with the Note across the zone', () => {
    expect(resizeKinds.se.overTrash).toBeUndefined();
    const calls = saved(resizeKinds.se, note, { x: 10, y: 10 }, at({ x: 800, y: 500 }));
    expect(calls.map(([name]) => name)).toEqual(['resize']);
  });
});

describe('resizeKinds', () => {
  it('previews the rect it commits', () => {
    const delta = { x: -30, y: 20 };
    const shown = resizeKinds.nw.preview(note, delta, ctx);

    expect(saved(resizeKinds.nw, note, delta, ctx)).toEqual([['resize', note.id, shown]]);
  });

  it('commits a resize to exactly the last Preview', () => {
    expect(saved(resizeKinds.nw, note, { x: -30, y: 20 }, ctx)).toEqual([
      ['resize', note.id, { x: 70, y: 120, width: 250, height: 150 }],
    ]);
  });
});
