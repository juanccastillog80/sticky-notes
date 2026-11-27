import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Note, NoteColour, NoteId } from '../notes/note';
import * as editing from './editing';

export interface UiState extends editing.EditingState {
  /** The colour the next new Note gets. */
  readonly currentColour: NoteColour;
  /** The Note that Undo would bring back. */
  readonly lastDeleted: Note | null;
}

export interface UiActions {
  // Editing: callers report what happened, and `./editing` decides whether it ends.
  /** At most one Note is in Editing: starting it on one Note ends it on any other. */
  readonly startEditing: (id: NoteId) => void;
  /** A press on a Note or keyboard focus on it, or (`null`) a press on empty Board. */
  readonly pressed: (target: NoteId | null) => void;
  /** Escape in the edited Note's text, unless it cancelled a Drag. */
  readonly escaped: () => void;
  /** A Note was deleted: ends Editing only if it was that Note. */
  readonly deleted: (id: NoteId) => void;
  readonly showUndo: (note: Note) => void;
  readonly hideUndo: () => void;
  readonly setCurrentColour: (colour: NoteColour) => void;
}

export type UiStore = StoreApi<UiState & UiActions>;

const INITIAL_UI: UiState = { ...editing.NOT_EDITING, currentColour: 'yellow', lastDeleted: null };

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
      // An Editing transition returns its input when nothing changes.
      startEditing: (id) => {
        set((state) => editing.startEditing(state, id));
      },
      pressed: (target) => {
        set((state) => editing.pressed(state, target));
      },
      escaped: () => {
        set(editing.escaped);
      },
      deleted: (id) => {
        set((state) => editing.deleted(state, id));
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
