import type { Note, NoteColour, NoteId } from '../notes/note';
import { createStore, type Store } from '../store/createStore';

export interface UiState {
  readonly editingId: NoteId | null;
  /** The colour the next new Note gets. */
  readonly currentColour: NoteColour;
  /** The Note that Undo would bring back. */
  readonly lastDeleted: Note | null;
}

/** Nothing changes UI state yet: each feature that does adds its action to this union. */
export type UiAction = never;

export const INITIAL_UI: UiState = { editingId: null, currentColour: 'yellow', lastDeleted: null };

export type UiStore = Store<UiState, UiAction>;

export function createUiStore(initial: UiState = INITIAL_UI): UiStore {
  return createStore((state) => state, initial);
}
