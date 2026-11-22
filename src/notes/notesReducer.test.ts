import { describe, expect, it } from 'vitest';
import { makeNote, makeState, testId } from '../../test/factories';
import type { Note } from './note';
import { createNotesStore, notesReducer, type NotesState } from './notesReducer';

const a = makeNote({ id: testId('a'), z: 1 });
const b = makeNote({ id: testId('b'), x: 500, z: 2 });

describe('create', () => {
  const create = (state: NotesState, overrides: Partial<Note> = {}) => {
    const { id, x, y, width, height, text, colour } = makeNote({ id: testId('new'), ...overrides });
    return notesReducer(state, {
      type: 'create',
      note: { id, x, y, width, height, text, colour },
    });
  };

  it('adds the Note last, at the front of the Stacking order', () => {
    const next = create(makeState(a, b));

    expect(next.ids).toEqual(['a', 'b', 'new']);
    expect(next.notes[testId('new')]).toEqual(makeNote({ id: testId('new'), z: 3 }));
    expect(next.topZ).toBe(3);
  });

  it('pushes a Note past the edge fully inside the Board', () => {
    const next = create(makeState(), { x: 1900, y: -20 });

    expect(next.notes[testId('new')]).toMatchObject({ x: 1700, y: 0 });
  });

  it('rounds to whole pixels', () => {
    const next = create(makeState(), { x: 10.4, y: 20.6, width: 200.5, height: 150.2 });

    expect(next.notes[testId('new')]).toMatchObject({ x: 10, y: 21, width: 201, height: 150 });
  });

  it('stays inside the Board when rounding the size up', () => {
    const next = create(makeState(), { x: 1699.5, width: 220.5 });

    expect(next.notes[testId('new')]).toMatchObject({ x: 1699, width: 221 });
  });

  it('keeps the other Notes by reference', () => {
    const next = create(makeState(a, b));

    expect(next.notes[a.id]).toBe(a);
    expect(next.notes[b.id]).toBe(b);
  });

  it('returns the same state when the id is already on the Board', () => {
    const state = makeState(a);

    expect(create(state, { id: a.id, x: 700 })).toBe(state);
  });
});

describe('load', () => {
  const load = (state: NotesState, ...notes: Note[]) =>
    notesReducer(state, { type: 'load', notes });

  it('replaces the Notes, keeping their order and Stacking order', () => {
    const c = makeNote({ id: testId('c'), z: 9 });
    const next = load(makeState(a), c, b);

    expect(next).toEqual({ notes: { c, b }, ids: ['c', 'b'], topZ: 9 });
  });

  it('empties the Board', () => {
    expect(load(makeState(a, b))).toEqual(makeState());
  });

  it('commits each rect inside the Board in whole pixels', () => {
    const next = load(makeState(), { ...a, x: 5000, y: 20.6 });

    expect(next.notes[a.id]).toMatchObject({ x: 1700, y: 21 });
  });

  it('lists an id that arrives twice once', () => {
    expect(load(makeState(), a, { ...a, text: 'later' }).ids).toEqual(['a']);
  });

  it('keeps an unchanged Note, and unchanged ids, by reference', () => {
    const state = makeState(a, b);
    const next = load(state, { ...a }, { ...b, text: 'changed' });

    expect(next.notes[a.id]).toBe(a);
    expect(next.notes[b.id]?.text).toBe('changed');
    expect(next.ids).toBe(state.ids);
  });

  it('keeps an unchanged Note by reference when another is added', () => {
    expect(load(makeState(a), { ...a }, b).notes[a.id]).toBe(a);
  });

  it('follows a change of order alone', () => {
    expect(load(makeState(a, b), b, a).ids).toEqual(['b', 'a']);
  });

  it('returns the same state when nothing changes', () => {
    const state = makeState(a, b);

    expect(load(state, { ...a }, { ...b })).toBe(state);
  });

  it('returns the same state when an empty Board loads nothing', () => {
    const state = makeState();

    expect(load(state)).toBe(state);
  });
});

describe('the Notes store', () => {
  it('tells subscribers about a change, but not about a no-op', () => {
    const store = createNotesStore();
    let calls = 0;
    store.subscribe(() => (calls += 1));

    store.dispatch({ type: 'load', notes: [a] });
    store.dispatch({ type: 'load', notes: [a] });

    expect(calls).toBe(1);
  });

  it('stops telling a listener that unsubscribed', () => {
    const store = createNotesStore();
    let calls = 0;
    store.subscribe(() => (calls += 1))();

    store.dispatch({ type: 'load', notes: [a] });

    expect(calls).toBe(0);
  });
});
