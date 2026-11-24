import { describe, expect, it } from 'vitest';
import { makeNote, makeState, testId } from '../../test/factories';
import type { Rect } from '../geometry';
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

describe('resize', () => {
  const resize = (state: NotesState, to: Rect, id = a.id) =>
    notesReducer(state, { type: 'resize', id, ...to });

  it('sets the position and size together', () => {
    const next = resize(makeState(a, b), { x: 80, y: 90, width: 300, height: 200 });

    expect(next.notes[a.id]).toEqual({ ...a, x: 80, y: 90, width: 300, height: 200 });
  });

  it('keeps a Note at least the minimum size and inside the Board', () => {
    const next = resize(makeState(a), { x: 1900, y: 10, width: 5, height: 5 });

    expect(next.notes[a.id]).toMatchObject({ x: 1780, y: 10, width: 140, height: 100 });
  });

  it('keeps ids and the other Notes by reference', () => {
    const state = makeState(a, b);
    const next = resize(state, { x: 80, y: 90, width: 300, height: 200 });

    expect(next.ids).toBe(state.ids);
    expect(next.notes[b.id]).toBe(b);
  });

  it('returns the same state when the rect does not change, or the Note is missing', () => {
    const state = makeState(a);

    expect(resize(state, a)).toBe(state);
    expect(resize(state, { ...a, width: a.width + 0.3 })).toBe(state);
    expect(resize(state, a, testId('gone'))).toBe(state);
  });
});

describe('move', () => {
  const move = (state: NotesState, x: number, y: number, id = a.id) =>
    notesReducer(state, { type: 'move', id, x, y });

  it('moves the Note to the new position, keeping its size', () => {
    const next = move(makeState(a, b), 300, 250);

    expect(next.notes[a.id]).toEqual({ ...a, x: 300, y: 250 });
  });

  it('stops the Note at the Board edges', () => {
    const next = move(makeState(a), 5000, -40);

    expect(next.notes[a.id]).toMatchObject({ x: 1920 - a.width, y: 0 });
  });

  it('rounds to whole pixels', () => {
    expect(move(makeState(a), 10.4, 20.6).notes[a.id]).toMatchObject({ x: 10, y: 21 });
  });

  it('keeps ids and the other Notes by reference', () => {
    const state = makeState(a, b);
    const next = move(state, 300, 250);

    expect(next.ids).toBe(state.ids);
    expect(next.notes[b.id]).toBe(b);
  });

  it('returns the same state when the position does not change', () => {
    const state = makeState(a);

    expect(move(state, a.x, a.y)).toBe(state);
    expect(move(state, a.x + 0.2, a.y - 0.3)).toBe(state);
  });

  it('returns the same state for a missing Note', () => {
    const state = makeState(a);

    expect(move(state, 1, 1, testId('gone'))).toBe(state);
  });
});

describe('raise', () => {
  const raise = (state: NotesState, id: Note['id']) => notesReducer(state, { type: 'raise', id });

  it('brings the Note to the front with z = ++topZ', () => {
    const next = raise(makeState(a, b), a.id);

    expect(next.notes[a.id]).toEqual({ ...a, z: 3 });
    expect(next.topZ).toBe(3);
  });

  it('never changes DOM order, and keeps the other Notes by reference', () => {
    const state = makeState(a, b);
    const next = raise(state, a.id);

    expect(next.ids).toBe(state.ids);
    expect(next.notes[b.id]).toBe(b);
  });

  it('returns the same state when the Note is already alone at the front', () => {
    const state = makeState(a, b);

    expect(raise(state, b.id)).toBe(state);
  });

  it('raises a Note that shares the front with another', () => {
    const tied = makeNote({ id: testId('c'), z: 2 });

    expect(raise(makeState(a, b, tied), b.id).notes[b.id]?.z).toBe(3);
  });

  it('returns the same state for a missing Note', () => {
    const state = makeState(a);

    expect(raise(state, testId('gone'))).toBe(state);
  });
});

describe('setText', () => {
  it('keeps the text exactly as typed, line breaks included', () => {
    const next = notesReducer(makeState(a, b), { type: 'setText', id: a.id, text: ' one\n\ntwo ' });

    expect(next.notes[a.id]).toEqual({ ...a, text: ' one\n\ntwo ' });
  });

  it('keeps ids and the other Notes by reference', () => {
    const state = makeState(a, b);
    const next = notesReducer(state, { type: 'setText', id: a.id, text: 'hi' });

    expect(next.ids).toBe(state.ids);
    expect(next.notes[b.id]).toBe(b);
  });

  it('returns the same state when the text does not change, or the Note is missing', () => {
    const state = makeState(a, b);

    expect(notesReducer(state, { type: 'setText', id: a.id, text: a.text })).toBe(state);
    expect(notesReducer(state, { type: 'setText', id: testId('gone'), text: 'x' })).toBe(state);
  });
});

describe('delete', () => {
  it('removes the Note, keeping the other Notes by reference', () => {
    const state = makeState(a, b);
    const next = notesReducer(state, { type: 'delete', id: a.id });

    expect(next.ids).toEqual(['b']);
    expect(next.notes[a.id]).toBeUndefined();
    expect(next.notes[b.id]).toBe(b);
  });

  it('returns the same state when the Note is missing', () => {
    const state = makeState(a);

    expect(notesReducer(state, { type: 'delete', id: testId('gone') })).toBe(state);
  });
});

describe('restore', () => {
  it('brings a deleted Note back with the same id, rect, text, colour and z', () => {
    const deleted = notesReducer(makeState(a, b), { type: 'delete', id: a.id });
    const next = notesReducer(deleted, { type: 'restore', note: a });

    expect(next.notes[a.id]).toBe(a);
    expect(next.ids).toEqual(['b', 'a']);
    expect(next.notes[b.id]).toBe(b);
    expect(next.topZ).toBe(2);
  });

  it('raises topZ when the restored Note was in front', () => {
    const front = makeNote({ id: testId('front'), z: 9 });

    expect(notesReducer(makeState(a), { type: 'restore', note: front }).topZ).toBe(9);
  });

  it('returns the same state when the id is already on the Board', () => {
    const state = makeState(a);

    expect(notesReducer(state, { type: 'restore', note: a })).toBe(state);
  });
});
