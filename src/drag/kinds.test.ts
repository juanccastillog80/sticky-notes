import { describe, expect, it } from 'vitest';
import { makeNote } from '../../test/factories';
import { recordingSave, type Call } from '../../test/recordCalls';
import type { Point } from '../geometry';
import type { Note } from '../notes/note';
import { moveKind, resizeKinds, type DragContext, type DragKind } from './kinds';

const note = makeNote({ x: 100, y: 100, width: 220, height: 170 });
const ctx = { pointer: { x: 0, y: 0 }, trash: null };

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

  it('a release with the pointer inside the Trash zone deletes the Note', () => {
    const pointer = { x: 950, y: 650 };

    expect(moveKind.overTrash?.({ pointer, trash })).toBe(true);
    expect(saved(moveKind, note, { x: 700, y: 400 }, { pointer, trash })).toEqual([
      ['deleteNote', note.id],
    ]);
  });

  it('the zone edges count as inside', () => {
    expect(moveKind.overTrash?.({ pointer: { x: 900, y: 704 }, trash })).toBe(true);
  });

  it('a large Note brushing the zone, with the pointer outside it, is moved, not deleted', () => {
    // The Note's rect reaches into the zone; the pointer is 1 px left of it.
    const pointer = { x: 899, y: 650 };
    const big = makeNote({ x: 700, y: 500, width: 400, height: 300 });

    expect(moveKind.overTrash?.({ pointer, trash })).toBe(false);
    expect(saved(moveKind, big, { x: 0, y: 0 }, { pointer, trash })).toEqual([
      ['move', big.id, big.x, big.y],
    ]);
  });

  it('with no Trash zone on screen, a move is only a move', () => {
    expect(moveKind.overTrash?.({ pointer: { x: 950, y: 650 }, trash: null })).toBe(false);
  });

  it('a resize never deletes, even released over the zone', () => {
    expect(resizeKinds.se.overTrash).toBeUndefined();
    const pointer = { x: 950, y: 650 };
    const calls = saved(resizeKinds.se, note, { x: 10, y: 10 }, { pointer, trash });
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
