import { describe, expect, it } from 'vitest';
import { makeNote, testId } from '../../test/factories';
import { parseNotes } from './parseNotes';

describe('parseNotes', () => {
  it('accepts a list of Notes, keeping their order', () => {
    const a = makeNote({ id: testId('a'), text: 'Buy milk\n', colour: 'pink', z: 3 });
    const b = makeNote({ id: testId('b'), x: 500, y: 40, width: 300, height: 230, z: 1 });

    expect(parseNotes(JSON.parse(JSON.stringify([a, b])))).toEqual([a, b]);
  });

  it('accepts an empty list', () => {
    expect(parseNotes([])).toEqual([]);
  });

  it('drops fields a Note does not have', () => {
    const note = makeNote();

    expect(parseNotes([{ ...note, selected: true }])).toEqual([note]);
  });

  it.each([undefined, null, 'notes', 7, { 0: makeNote() }])(
    'rejects %j, which is not a list',
    (raw) => {
      expect(parseNotes(raw)).toBeNull();
    },
  );

  it.each([null, 'note', 7, []])('rejects the list when an item is %j', (item) => {
    expect(parseNotes([makeNote(), item])).toBeNull();
  });

  const field = (overrides: Record<string, unknown>) => [{ ...makeNote(), ...overrides }];

  it.each([
    ['a missing id', { id: undefined }],
    ['an empty id', { id: '' }],
    ['a numeric id', { id: 7 }],
    ['a missing x', { x: undefined }],
    ['a string y', { y: '100' }],
    ['a null width', { width: null }],
    ['an infinite height', { height: Infinity }],
    ['a NaN z', { z: NaN }],
    ['a missing text', { text: undefined }],
    ['a numeric text', { text: 42 }],
    ['an unknown colour', { colour: 'red' }],
    ['a missing colour', { colour: undefined }],
  ])('rejects the list when a Note has %s', (_, overrides) => {
    expect(parseNotes([makeNote({ id: testId('ok') }), ...field(overrides)])).toBeNull();
  });
});
