import type { Note } from '../notes/note';
import type { NotesState, NotesStore } from '../notes/notesStore';
import { parseNotes } from './parseNotes';

export const LOCAL_COPY_KEY = 'sticky-notes:local-copy';

export type LocalCopyStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface Timers {
  readonly setTimeout: (callback: () => void, ms: number) => number;
  readonly clearTimeout: (id: number) => void;
}

export const SAVE_DELAY_MS = 300;

interface LocalCopyV1 {
  readonly v: 1;
  readonly notes: readonly Note[];
}

/** A copy that can't be read or trusted is discarded: the app starts empty rather than crashing. */
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
  return (
    typeof copy === 'object' && copy !== null && 'v' in copy && copy.v === 1 && 'notes' in copy
  );
}

export interface LocalCopySaving {
  readonly flush: () => void;
}

/** Writes the whole Board once the Notes have been still for `SAVE_DELAY_MS`. */
export function saveLocalCopy(
  store: NotesStore,
  { storage, timers }: { storage: LocalCopyStorage; timers: Timers },
): LocalCopySaving {
  let scheduled: number | null = null;

  function flush() {
    if (scheduled === null) return;
    timers.clearTimeout(scheduled);
    scheduled = null;
    write(storage, store.getState());
  }

  store.subscribe(() => {
    if (scheduled !== null) timers.clearTimeout(scheduled);
    scheduled = timers.setTimeout(flush, SAVE_DELAY_MS);
  });

  return { flush };
}

function write(storage: LocalCopyStorage, { notes, ids }: NotesState) {
  const copy: LocalCopyV1 = { v: 1, notes: ids.flatMap((id) => notes[id] ?? []) };
  try {
    storage.setItem(LOCAL_COPY_KEY, JSON.stringify(copy));
  } catch {
    // Quota exceeded or storage blocked: nothing to do but keep working in memory.
  }
}
