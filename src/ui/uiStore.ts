import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Note, NoteColour, NoteId, NoteSize } from '../notes/note';
import * as editing from './editing';

export interface UiState extends editing.EditingState {
  readonly currentColour: NoteColour;
  readonly currentSize: NoteSize;
  /** What Undo would bring back. */
  readonly lastDeleted: Note | null;
}

export interface UiActions {
  // Editing: callers report what happened, and `./editing` decides whether it ends.
  readonly startEditing: (id: NoteId, caret?: number | null) => void;
  /** The editor lends how to read its Draft text; returns how to take it back. */
  readonly holdDraft: (id: NoteId, read: () => string) => () => void;
  readonly readDraft: (id: NoteId) => string | null;
  readonly pressed: (target: NoteId | null) => void;
  readonly escaped: () => void;
  readonly deleted: (id: NoteId) => void;
  readonly pageHidden: () => void;
  readonly showUndo: (note: Note) => void;
  readonly hideUndo: () => void;
  readonly setCurrentColour: (colour: NoteColour) => void;
  readonly setCurrentSize: (size: NoteSize) => void;
}

export type UiStore = StoreApi<UiState & UiActions>;

const INITIAL_UI: UiState = {
  ...editing.NOT_EDITING,
  currentColour: 'yellow',
  currentSize: 'medium',
  lastDeleted: null,
};

/** An action that changes nothing keeps the state reference, and notifies nobody. */
export function createUiStore(initial: Partial<UiState> = {}): UiStore {
  // Outside the state, so lending it notifies nobody.
  let draft: { readonly id: NoteId; readonly read: () => string } | null = null;
  return createStore<UiState & UiActions>()((set, get) => {
    function setField<K extends keyof UiState>(key: K, value: UiState[K]) {
      set((state) => (Object.is(state[key], value) ? state : { [key]: value }));
    }
    return {
      ...INITIAL_UI,
      ...initial,
      startEditing: (id, caret = null) => {
        set((state) => editing.startEditing(state, id, caret));
      },
      holdDraft: (id, read) => {
        if (get().editingId !== id) return () => undefined;
        const held = { id, read };
        draft = held;
        return () => {
          // Only its own: by now another editor may have lent one.
          if (draft === held) draft = null;
        };
      },
      readDraft: (id) => (draft?.id === id ? draft.read() : null),
      pressed: (target) => {
        set((state) => editing.pressed(state, target));
      },
      escaped: () => {
        set(editing.escaped);
      },
      deleted: (id) => {
        set((state) => editing.deleted(state, id));
      },
      pageHidden: () => {
        set(editing.pageHidden);
      },
      showUndo: (note) => {
        setField('lastDeleted', note);
      },
      hideUndo: () => {
        setField('lastDeleted', null);
      },
      setCurrentColour: (colour) => {
        setField('currentColour', colour);
      },
      setCurrentSize: (size) => {
        setField('currentSize', size);
      },
    };
  });
}
