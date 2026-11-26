import type { Note } from '../notes/note';
import type { NotesState, NotesStore } from '../notes/notesStore';
import { parseNotes } from './parseNotes';

/** Where the Local copy lives in localStorage. */
export const LOCAL_COPY_KEY = 'sticky-notes:cache';

/** The part of `Storage` the Local copy uses, so tests can pass a fake. */
export type LocalCopyStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** The timers the save waits on, so tests can move the clock themselves. */
export interface Timers {
  readonly setTimeout: (callback: () => void, ms: number) => number;
  readonly clearTimeout: (id: number) => void;
}

/** How long the Board must be still before it is saved. */
export const SAVE_DELAY_MS = 300;

/**
 * What is stored. `unsaved` is the ids of Notes with an Unsaved change; it stays
 * empty until saving to a server exists (ADR 0002).
 */
interface LocalCopyV1 {
  readonly v: 1;
  readonly notes: readonly Note[];
  readonly unsaved: readonly string[];
}

/**
 * The Notes in the Local copy, read synchronously so they are on the Board
 * before the first paint. A copy that can't be read or trusted is discarded
 * with a warning: the app starts empty rather than crashing, and the next
 * save overwrites it.
 */
export function readLocalCopy(storage: LocalCopyStorage): Note[] {
  let raw: string | null;
  let copy: unknown;
  try {
    raw = storage.getItem(LOCAL_COPY_KEY);
    if (raw === null) return [];
    copy = JSON.parse(raw);
  } catch (error) {
    console.warn('Discarding the Local copy: it could not be read.', error);
    return [];
  }

  const notes = isVersion1(copy) ? parseNotes(copy.notes) : null;
  if (!notes) {
    console.warn('Discarding the Local copy: it is not a valid version 1 copy.', raw);
    return [];
  }
  return notes;
}

function isVersion1(copy: unknown): copy is { v: 1; notes: unknown } {
  return typeof copy === 'object' && copy !== null && 'v' in copy && copy.v === 1;
}

export interface LocalCopySaving {
  /** Writes a pending save now, as the page is hidden or closed. */
  readonly flush: () => void;
}

/**
 * Follows the Notes store and writes the whole Board to the Local copy, once the
 * Notes have been still for `SAVE_DELAY_MS`. A write that fails (a full or
 * blocked storage) is ignored: the Board stays as it is in memory.
 */
export function saveLocalCopy(
  store: NotesStore,
  { storage, timers }: { storage: LocalCopyStorage; timers: Timers },
): LocalCopySaving {
  let pending: number | null = null;

  function flush() {
    if (pending === null) return;
    timers.clearTimeout(pending);
    pending = null;
    write(storage, store.getState());
  }

  // Zustand notifies only when an action returns a new state, so a no-op
  // (a move to the same place, a raise of the front Note) never saves.
  store.subscribe(() => {
    if (pending !== null) timers.clearTimeout(pending);
    pending = timers.setTimeout(flush, SAVE_DELAY_MS);
  });

  return { flush };
}

function write(storage: LocalCopyStorage, { notes, ids }: NotesState) {
  const copy: LocalCopyV1 = { v: 1, notes: ids.flatMap((id) => notes[id] ?? []), unsaved: [] };
  try {
    storage.setItem(LOCAL_COPY_KEY, JSON.stringify(copy));
  } catch {
    // Quota exceeded or storage blocked: nothing to do but keep working in memory.
  }
}
