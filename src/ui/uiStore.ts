import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Note, NoteColour, NoteId } from '../notes/note';

export interface UiState {
  readonly editingId: NoteId | null;
  /** The colour the next new Note gets. */
  readonly currentColour: NoteColour;
  /** The Note that Undo would bring back. */
  readonly lastDeleted: Note | null;
}

export interface UiActions {
  /** At most one Note is in Editing: starting it on one Note ends it on any other. */
  readonly startEditing: (id: NoteId) => void;
  readonly stopEditing: () => void;
  readonly showUndo: (note: Note) => void;
  readonly hideUndo: () => void;
  readonly setCurrentColour: (colour: NoteColour) => void;
}

export type UiStore = StoreApi<UiState & UiActions>;

const INITIAL_UI: UiState = { editingId: null, currentColour: 'yellow', lastDeleted: null };

/**
 * An action that changes nothing leaves the state reference the same, and notifies
 * nobody: each one sets its field only when the value is new.
 */
export function createUiStore(initial: Partial<UiState> = {}): UiStore {
  return createStore<UiState & UiActions>()((set) => {
    function setField<K extends keyof UiState>(key: K, value: UiState[K]) {
      set((state) => (Object.is(state[key], value) ? state : { [key]: value }));
    }
    return {
      ...INITIAL_UI,
      ...initial,
      startEditing: (id) => {
        setField('editingId', id);
      },
      stopEditing: () => {
        setField('editingId', null);
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
    };
  });
}
