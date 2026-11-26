import { createStore, type StoreApi } from 'zustand/vanilla';
import { toCommittedRect, type Point, type Rect } from '../geometry';
import type { UiStore } from '../ui/uiStore';
import { newNoteId, type Note, type NoteColour, type NoteId } from './note';

export interface NotesState {
  readonly notes: Readonly<Record<NoteId, Note>>;
  /** Creation order, which is also DOM order. The Stacking order is each Note's `z`. */
  readonly ids: readonly NoteId[];
  readonly topZ: number;
}

const EMPTY_NOTES: NotesState = { notes: {}, ids: [], topZ: 0 };

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

function setColour(state: NotesState, id: NoteId, colour: NoteColour): NotesState {
  const note = state.notes[id];
  if (!note || note.colour === colour) return state;
  return withNote(state, { ...note, colour });
}

/** `topZ` stays, so a Note restored by Undo keeps its place in the Stacking order. */
function withoutNote(state: NotesState, id: NoteId): NotesState {
  if (!state.notes[id]) return state;
  const ids = state.ids.filter((other) => other !== id);
  const notes = Object.fromEntries(
    Object.entries(state.notes).filter(([other]) => other !== id),
  ) as NotesState['notes'];
  return { ...state, notes, ids };
}

/** Brings a deleted Note back exactly as it was, `z` included. It is listed last. */
function restore(state: NotesState, note: Note): NotesState {
  if (state.notes[note.id]) return state;
  return {
    notes: { ...state.notes, [note.id]: note },
    ids: [...state.ids, note.id],
    topZ: Math.max(state.topZ, note.z),
  };
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

/**
 * The pure state transitions behind the Notes store's actions. An unchanged Note,
 * unchanged `ids` and a no-op all keep their reference. That is what lets a change
 * re-render only the Notes it touched.
 */
export const transitions = {
  create,
  move,
  resize,
  raise,
  setText,
  setColour,
  delete: withoutNote,
  restore,
  load,
};

export interface NotesActions {
  /** Replaces every Note, as a load from storage does. */
  readonly load: (notes: readonly Note[]) => void;
  /** A new empty Note in the Current colour, which opens straight into Editing. */
  readonly createNote: (rect: Rect) => void;
  readonly move: (id: NoteId, x: number, y: number) => void;
  readonly resize: (id: NoteId, rect: Rect) => void;
  readonly raise: (id: NoteId) => void;
  readonly setText: (id: NoteId, text: string) => void;
  /** Only the Note's colour. `recolour` is what the user does. */
  readonly setColour: (id: NoteId, colour: NoteColour) => void;
  /** Recolouring a Note also makes its colour the Current colour, for the next Note. */
  readonly recolour: (id: NoteId, colour: NoteColour) => void;
  /** A swatch: recolours the Note being edited, or with none, sets only the Current colour. */
  readonly pickColour: (colour: NoteColour) => void;
  /** Records the Note for Undo and ends its Editing first, so no phantom Editing is left. */
  readonly deleteNote: (id: NoteId) => void;
  /** Brings back the last deleted Note exactly as it was, and hides the Undo toast. */
  readonly undoDelete: () => void;
}

export type NotesStore = StoreApi<NotesState & NotesActions>;

/**
 * The Notes, and the actions that change them. The UI store is passed in for the
 * rules that span both stores (Undo, Editing, the Current colour); it never needs
 * the Notes store back.
 */
export function createNotesStore(ui: UiStore): NotesStore {
  // Each action `set`s a pure transition. One that returns the state it was given
  // leaves the reference the same, and Zustand notifies nobody.
  return createStore<NotesState & NotesActions>()((set, get) => {
    function recolour(id: NoteId, colour: NoteColour) {
      if (!get().notes[id]) return;
      set((state) => setColour(state, id, colour));
      ui.getState().setCurrentColour(colour);
    }

    return {
      ...EMPTY_NOTES,
      load: (notes) => {
        set((state) => load(state, notes));
      },
      createNote: ({ x, y, width, height }) => {
        const id = newNoteId();
        const colour = ui.getState().currentColour;
        set((state) => create(state, { id, x, y, width, height, text: '', colour }));
        ui.getState().startEditing(id);
      },
      move: (id, x, y) => {
        set((state) => move(state, id, { x, y }));
      },
      resize: (id, rect) => {
        set((state) => resize(state, id, rect));
      },
      raise: (id) => {
        set((state) => raise(state, id));
      },
      setText: (id, text) => {
        set((state) => setText(state, id, text));
      },
      setColour: (id, colour) => {
        set((state) => setColour(state, id, colour));
      },
      recolour,
      pickColour: (colour) => {
        const { editingId } = ui.getState();
        if (editingId) recolour(editingId, colour);
        else ui.getState().setCurrentColour(colour);
      },
      deleteNote: (id) => {
        const note = get().notes[id];
        if (!note) return;
        if (ui.getState().editingId === id) ui.getState().stopEditing();
        ui.getState().showUndo(note);
        set((state) => withoutNote(state, id));
      },
      undoDelete: () => {
        const note = ui.getState().lastDeleted;
        if (!note) return;
        set((state) => restore(state, note));
        ui.getState().hideUndo();
      },
    };
  });
}
