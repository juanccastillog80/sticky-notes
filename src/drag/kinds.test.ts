import { describe, expect, it } from 'vitest';
import { makeNote } from '../../test/factories';
import { resizeKinds } from './kinds';

const note = makeNote({ x: 100, y: 100, width: 220, height: 170 });
const ctx = { pointer: { x: 0, y: 0 } };

describe('resizeKinds', () => {
  it('previews the rect it commits', () => {
    const delta = { x: -30, y: 20 };
    const shown = resizeKinds.nw.preview(note, delta, ctx);

    expect(resizeKinds.nw.commit(note, delta, ctx)).toEqual({
      type: 'resize',
      id: note.id,
      ...shown,
    });
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
});
