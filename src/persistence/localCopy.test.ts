import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { makeNote, testId } from '../../test/factories';
import type { Note } from '../notes/note';
import { createStores } from '../StoresContext';
import { LOCAL_COPY_KEY, readLocalCopy, saveLocalCopy } from './localCopy';

function fakeStorage(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  };
}

/** Timers that only fire when the test moves the clock on. */
function fakeTimers() {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { at: number; callback: () => void }>();
  return {
    setTimeout: (callback: () => void, ms: number) => {
      pending.set(nextId, { at: now + ms, callback });
      return nextId++;
    },
    clearTimeout: (id: number) => {
      pending.delete(id);
    },
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...pending]) {
        if (timer.at > now) continue;
        pending.delete(id);
        timer.callback();
      }
    },
  };
}

const a = makeNote({ id: testId('a'), text: 'first', z: 2 });
const b = makeNote({ id: testId('b'), x: 600, colour: 'blue', z: 1 });

let warn: MockInstance<typeof console.warn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => {
  warn.mockRestore();
});

describe('readLocalCopy', () => {
  it('returns the saved Notes in their saved order', () => {
    const storage = fakeStorage({
      [LOCAL_COPY_KEY]: JSON.stringify({ v: 1, notes: [a, b], unsaved: [] }),
    });

    expect(readLocalCopy(storage)).toEqual([a, b]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('starts empty, without a warning, when nothing is saved yet', () => {
    expect(readLocalCopy(fakeStorage())).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it.each([
    ['is not JSON', '{"v":1,'],
    ['is not an object', '[]'],
    ['is null', 'null'],
    ['has no version', JSON.stringify({ notes: [a], unsaved: [] })],
    ['has another version', JSON.stringify({ v: 2, notes: [a], unsaved: [] })],
    ['has no Notes', JSON.stringify({ v: 1, unsaved: [] })],
    ['holds an invalid Note', JSON.stringify({ v: 1, notes: [a, { ...b, colour: 'red' }] })],
  ])('discards a copy that %s, with a warning', (_, raw) => {
    expect(readLocalCopy(fakeStorage({ [LOCAL_COPY_KEY]: raw }))).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });

  it('starts empty, with a warning, when storage cannot be read', () => {
    const storage = {
      ...fakeStorage(),
      getItem: () => {
        throw new DOMException('Access denied', 'SecurityError');
      },
    };

    expect(readLocalCopy(storage)).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
  });
});

describe('saveLocalCopy', () => {
  /** `storage` records each write; `failWrites` makes `setItem` throw, as a full storage does. */
  function setup(...notes: Note[]) {
    const { notes: store } = createStores();
    store.getState().load(notes);
    const storage = fakeStorage();
    const timers = fakeTimers();
    const writes: unknown[] = [];
    const io = { failWrites: false };
    const recording = {
      ...storage,
      setItem: (key: string, value: string) => {
        if (io.failWrites) throw new DOMException('Quota exceeded', 'QuotaExceededError');
        writes.push(JSON.parse(value));
        storage.setItem(key, value);
      },
    };
    const saving = saveLocalCopy(store, { storage: recording, timers });
    return { store, storage, timers, writes, saving, io };
  }

  it('saves once, 300 ms after the last of several changes', () => {
    const { store, timers, writes } = setup(a, b);

    store.getState().move(a.id, 300, 200);
    timers.advance(200);
    store.getState().setText(b.id, 'second');
    timers.advance(299);
    expect(writes).toEqual([]);

    timers.advance(1);
    expect(writes).toEqual([
      {
        v: 1,
        notes: [
          { ...a, x: 300, y: 200 },
          { ...b, text: 'second' },
        ],
        unsaved: [],
      },
    ]);
  });

  it('writes a scheduled save at once when flushed, and only once', () => {
    const { store, timers, writes, saving } = setup(a);

    store.getState().setColour(a.id, 'green');
    saving.flush();
    expect(writes).toEqual([{ v: 1, notes: [{ ...a, colour: 'green' }], unsaved: [] }]);

    timers.advance(300);
    saving.flush();
    expect(writes).toHaveLength(1);
  });

  it('writes nothing when flushed with no save scheduled', () => {
    const { saving, writes } = setup(a);

    saving.flush();

    expect(writes).toEqual([]);
  });

  it('writes nothing for actions that change no Note', () => {
    const { store, timers, writes } = setup(a, b);

    store.getState().move(a.id, a.x, a.y);
    store.getState().raise(a.id); // already alone at the front
    store.getState().pickColour('purple'); // no Note is being edited
    timers.advance(300);

    expect(writes).toEqual([]);
  });

  it('keeps saving after a write fails', () => {
    const { store, timers, storage, io } = setup(a);

    io.failWrites = true;
    store.getState().setText(a.id, 'lost');
    expect(() => {
      timers.advance(300);
    }).not.toThrow();

    io.failWrites = false;
    store.getState().setText(a.id, 'kept');
    timers.advance(300);
    expect(readLocalCopy(storage)).toEqual([{ ...a, text: 'kept' }]);
  });

  it('saves a Board that loads back identical, deletes and Stacking order included', () => {
    const { store, timers, storage } = setup(a, b);
    store.getState().deleteNote(a.id);
    store.getState().createNote({ x: 40, y: 50, width: 160, height: 120 });
    store.getState().raise(b.id);
    timers.advance(300);

    const { notes: reloaded } = createStores();
    reloaded.getState().load(readLocalCopy(storage));

    const { notes, ids, topZ } = store.getState();
    expect(reloaded.getState()).toMatchObject({ notes, ids, topZ });
  });
});
