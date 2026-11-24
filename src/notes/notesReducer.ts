import { toCommittedRect, type Point, type Rect } from '../geometry';
import { createStore, type Store } from '../store/createStore';
import type { Note, NoteId } from './note';

export interface NotesState {
  readonly notes: Readonly<Record<NoteId, Note>>;
  /** Creation order, which is also DOM order. The Stacking order is each Note's `z`. */
  readonly ids: readonly NoteId[];
  readonly topZ: number;
}

export type NoteAction =
  | { readonly type: 'create'; readonly note: Omit<Note, 'z'> }
  | { readonly type: 'move'; readonly id: NoteId; readonly x: number; readonly y: number }
  | ({ readonly type: 'resize'; readonly id: NoteId } & Rect)
  | { readonly type: 'raise'; readonly id: NoteId }
  | { readonly type: 'setText'; readonly id: NoteId; readonly text: string }
  | { readonly type: 'load'; readonly notes: readonly Note[] };

const EMPTY_NOTES: NotesState = { notes: {}, ids: [], topZ: 0 };

/**
 * An unchanged Note, unchanged `ids` and a no-op all keep their reference. That
 * is what lets a change re-render only the Notes it touched.
 */
export function notesReducer(state: NotesState, action: NoteAction): NotesState {
  switch (action.type) {
    case 'create':
      return create(state, action.note);
    case 'move':
      return move(state, action.id, action);
    case 'resize':
      return resize(state, action.id, action);
    case 'raise':
      return raise(state, action.id);
    case 'setText':
      return setText(state, action.id, action.text);
    case 'load':
      return load(state, action.notes);
    default:
      return assertNever(action);
  }
}

function create(state: NotesState, note: Omit<Note, 'z'>): NotesState {
  if (state.notes[note.id]) return state;
  const z = state.topZ + 1;
  return {
    notes: { ...state.notes, [note.id]: { ...note, ...toCommittedRect(note), z } },
    ids: [...state.ids, note.id],
    topZ: z,
  };
}

function move(state: NotesState, id: NoteId, to: Point): NotesState {
  const note = state.notes[id];
  if (!note) return state;
  const { x, y } = toCommittedRect({ ...note, x: to.x, y: to.y });
  if (x === note.x && y === note.y) return state;
  return withNote(state, { ...note, x, y });
}

function resize(state: NotesState, id: NoteId, to: Rect): NotesState {
  const note = state.notes[id];
  if (!note) return state;
  const { x, y, width, height } = toCommittedRect(to);
  if (x === note.x && y === note.y && width === note.width && height === note.height) return state;
  return withNote(state, { ...note, x, y, width, height });
}

/** Sets `z = ++topZ`. A Note already alone at the front stays as it is. */
function raise(state: NotesState, id: NoteId): NotesState {
  const note = state.notes[id];
  if (!note) return state;
  const alreadyInFront =
    note.z === state.topZ &&
    state.ids.every((other) => other === id || state.notes[other]?.z !== note.z);
  if (alreadyInFront) return state;
  const z = state.topZ + 1;
  return { ...withNote(state, { ...note, z }), topZ: z };
}

/** Keeps the text exactly as typed, whitespace and line breaks included. */
function setText(state: NotesState, id: NoteId, text: string): NotesState {
  const note = state.notes[id];
  if (!note || note.text === text) return state;
  return withNote(state, { ...note, text });
}

/** Replaces one Note. `ids` and every other Note keep their reference. */
function withNote(state: NotesState, note: Note): NotesState {
  return { ...state, notes: { ...state.notes, [note.id]: note } };
}

function load(state: NotesState, incoming: readonly Note[]): NotesState {
  // A Map, so an id that arrives twice is listed once.
  const byId = new Map<NoteId, Note>();
  for (const raw of incoming) {
    const note = { ...raw, ...toCommittedRect(raw) };
    const current = state.notes[note.id];
    byId.set(note.id, current && sameNote(current, note) ? current : note);
  }

  const loadedIds = [...byId.keys()];
  const sameIds =
    loadedIds.length === state.ids.length && loadedIds.every((id, i) => id === state.ids[i]);
  if (sameIds && loadedIds.every((id) => byId.get(id) === state.notes[id])) return state;

  return {
    notes: Object.fromEntries(byId),
    ids: sameIds ? state.ids : loadedIds,
    topZ: Math.max(0, ...Array.from(byId.values(), (note) => note.z)),
  };
}

function sameNote(a: Note, b: Note): boolean {
  return (Object.keys(b) as (keyof Note)[]).every((key) => a[key] === b[key]);
}

/** Stops compiling when an action has no case. */
function assertNever(action: never): never {
  throw new Error(`Unknown action: ${JSON.stringify(action)}`);
}

export type NotesStore = Store<NotesState, NoteAction>;

export function createNotesStore(): NotesStore {
  return createStore(notesReducer, EMPTY_NOTES);
}
