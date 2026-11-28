import { createStore, type StoreApi } from 'zustand/vanilla';
import {
  keepClearOf,
  placeCentredAt,
  toStoredRect,
  type Point,
  type Rect,
  type Size,
} from '../geometry';
import { endedEditing } from '../ui/editing';
import type { UiStore } from '../ui/uiStore';
import { NOTE_SIZE_PRESETS, newNoteId, type Note, type NoteColour, type NoteId } from './note';

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
    notes: { ...state.notes, [note.id]: { ...note, ...toStoredRect(note), z } },
    ids: [...state.ids, note.id],
    topZ: z,
  };
}

function move(state: NotesState, id: NoteId, to: Point): NotesState {
  const note = state.notes[id];
  if (!note) return state;
  const { x, y } = toStoredRect({ ...note, x: to.x, y: to.y });
  if (x === note.x && y === note.y) return state;
  return withNote(state, { ...note, x, y });
}

function resize(state: NotesState, id: NoteId, to: Rect): NotesState {
  const note = state.notes[id];
  if (!note) return state;
  const { x, y, width, height } = toStoredRect(to);
  if (x === note.x && y === note.y && width === note.width && height === note.height) return state;
  return withNote(state, { ...note, x, y, width, height });
}

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

function restore(state: NotesState, note: Note): NotesState {
  if (state.notes[note.id]) return state;
  return {
    notes: { ...state.notes, [note.id]: note },
    ids: [...state.ids, note.id],
    topZ: Math.max(state.topZ, note.z),
  };
}

function withNote(state: NotesState, note: Note): NotesState {
  return { ...state, notes: { ...state.notes, [note.id]: note } };
}

function load(state: NotesState, incoming: readonly Note[]): NotesState {
  const byId = new Map<NoteId, Note>();
  for (const raw of incoming) {
    const note = { ...raw, ...toStoredRect(raw) };
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
 * Pure. An unchanged Note, unchanged `ids` and a no-op all keep their reference, so a
 * change re-renders only the Notes it touched.
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
  readonly load: (notes: readonly Note[]) => void;
  /**
   * In the Current colour and size, centred on `point`, straight into Editing. Moved
   * up or left if it would overlap `trash`, the Trash zone in Board coordinates.
   */
  readonly createNoteAt: (point: Point, board: Size, trash: Rect | null) => void;
  readonly move: (id: NoteId, x: number, y: number) => void;
  readonly resize: (id: NoteId, rect: Rect) => void;
  readonly raise: (id: NoteId) => void;
  readonly setText: (id: NoteId, text: string) => void;
  readonly setColour: (id: NoteId, colour: NoteColour) => void;
  /** Also makes it the Current colour. */
  readonly recolour: (id: NoteId, colour: NoteColour) => void;
  /** Recolours the edited Note, or with none, sets only the Current colour. */
  readonly pickColour: (colour: NoteColour) => void;
  readonly deleteNote: (id: NoteId) => void;
  readonly undoDelete: () => void;
}

export type NotesStore = StoreApi<NotesState & NotesActions>;

/** The UI store is passed in for the rules that span both; it never needs this one back. */
export function createNotesStore(ui: UiStore): NotesStore {
  const store = createStore<NotesState & NotesActions>()((set, get) => {
    function recolour(id: NoteId, colour: NoteColour) {
      if (!get().notes[id]) return;
      set((state) => setColour(state, id, colour));
      ui.getState().setCurrentColour(colour);
    }

    function createNote({ x, y, width, height }: Rect) {
      const id = newNoteId();
      const colour = ui.getState().currentColour;
      set((state) => create(state, { id, x, y, width, height, text: '', colour }));
      ui.getState().startEditing(id);
    }

    return {
      ...EMPTY_NOTES,
      load: (notes) => {
        set((state) => load(state, notes));
      },
      createNoteAt: (point, board, trash) => {
        const size = NOTE_SIZE_PRESETS[ui.getState().currentSize];
        createNote(keepClearOf(placeCentredAt(point, size, board), trash));
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
        // Ending Editing saves its Draft text, so the Undo snapshot is read after it.
        ui.getState().deleted(id);
        const note = get().notes[id];
        if (!note) return;
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

  // However Editing ends, its Draft text is saved synchronously, before the action
  // that ended it carries on (a delete's Undo snapshot, `pagehide`'s flush).
  ui.subscribe((after, before) => {
    const id = endedEditing(before, after);
    if (id === null) return;
    const text = ui.getState().readDraft(id);
    if (text !== null) store.getState().setText(id, text);
  });

  return store;
}
