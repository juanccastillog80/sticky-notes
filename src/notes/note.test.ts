import { describe, expect, it } from 'vitest';
import { newNoteId, parseNoteId } from './note';

describe('parseNoteId', () => {
  it('accepts an id made by newNoteId', () => {
    const id = newNoteId();
    expect(parseNoteId(id)).toBe(id);
  });

  it.each([undefined, null, 7, {}, ''])('rejects %j', (raw) => {
    expect(parseNoteId(raw)).toBeNull();
  });
});
