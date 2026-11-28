import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Note, NoteColour, NoteId, NoteSize } from '../notes/note';
import * as editing from './editing';

export interface UiState extends editing.EditingState {
  /** The colour the next new Note gets. */
  readonly currentColour: NoteColour;
  /** The size a double-click on empty Board gives the next Note. */
  readonly currentSize: NoteSize;
  /** The Note that Undo would bring back. */
  readonly lastDeleted: Note | null;
}

export interface UiActions {
  // Editing: callers report what happened, and `./editing` decides whether it ends.
  /**
   * At most one Note is in Editing: starting it on one Note ends it on any other.
   * `caret` is where the caret goes: a text offset, or `null` (the default) for the end.
   */
  readonly startEditing: (id: NoteId, caret?: number | null) => void;
  /**
   * The edited Note's editor keeps the Draft text in its own state, and lends here how
   * to read it, once, when it mounts; it calls what this returns when it unmounts.
   * Typing then notifies nobody. Ignored for a Note that isn't in Editing.
   */
  readonly holdDraft: (id: NoteId, read: () => string) => () => void;
  /** The Draft text of Note `id`, or `null` when no editor of it has lent one. */
  readonly readDraft: (id: NoteId) => string | null;
  /** A press on a Note or keyboard focus on it, or (`null`) a press on empty Board. */
  readonly pressed: (target: NoteId | null) => void;
  /** Escape in the edited Note's text, unless it cancelled a Drag. */
  readonly escaped: () => void;
  /** A Note was deleted: ends Editing only if it was that Note. */
  readonly deleted: (id: NoteId) => void;
  /** The page is being hidden or closed (`pagehide`). */
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

/**
 * An action that changes nothing leaves the state reference the same, and notifies
 * nobody: each one sets its field only when the value is new. The Draft text reader
 * that `holdDraft` lends sits outside the state, so it notifies nobody either.
 */
export function createUiStore(initial: Partial<UiState> = {}): UiStore {
  // Not state: nothing subscribes to it, and lending it notifies nobody.
  let draft: { readonly id: NoteId; readonly read: () => string } | null = null;
  return createStore<UiState & UiActions>()((set, get) => {
    function setField<K extends keyof UiState>(key: K, value: UiState[K]) {
      set((state) => (Object.is(state[key], value) ? state : { [key]: value }));
    }
    return {
      ...INITIAL_UI,
      ...initial,
      // An Editing transition returns its input when nothing changes.
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
