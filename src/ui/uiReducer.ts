import type { Note, NoteColour, NoteId } from '../notes/note';
import { createStore, type Store } from '../store/createStore';

export interface UiState {
  readonly editingId: NoteId | null;
  /** The colour the next new Note gets. */
  readonly currentColour: NoteColour;
  /** The Note that Undo would bring back. */
  readonly lastDeleted: Note | null;
}

/** Each feature that changes UI state adds its action to this union. */
export type UiAction =
  { readonly type: 'startEditing'; readonly id: NoteId } | { readonly type: 'stopEditing' };

export const INITIAL_UI: UiState = { editingId: null, currentColour: 'yellow', lastDeleted: null };

/** At most one Note is in Editing: starting it on one Note ends it on any other. A no-op keeps the state. */
export function uiReducer(state: UiState, action: UiAction): UiState {
  const editingId = action.type === 'startEditing' ? action.id : null;
  return editingId === state.editingId ? state : { ...state, editingId };
}

export type UiStore = Store<UiState, UiAction>;

export function createUiStore(initial: UiState = INITIAL_UI): UiStore {
  return createStore(uiReducer, initial);
}
