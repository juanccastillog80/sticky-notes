import { createContext, use } from 'react';
import { useStore } from 'zustand';
import type { NoteId } from './notes/note';
import { createNotesStore, type NotesState, type NotesStore } from './notes/notesStore';
import { createUiStore, type UiState, type UiStore } from './ui/uiStore';

export interface Stores {
  readonly notes: NotesStore;
  readonly ui: UiStore;
}

/** The two stores, wired together: the Notes store's cross-store actions reach the UI store. */
export function createStores(): Stores {
  const ui = createUiStore();
  return { ui, notes: createNotesStore(ui) };
}

/** Its value never changes, so reading it never causes a render. Subscriptions do. */
export const StoresContext = createContext<Stores | null>(null);

/**
 * The stores themselves, for calling actions in event handlers:
 * `notes.getState().move(id, x, y)`. Reading `getState()` there, not at render,
 * subscribes to nothing.
 */
export function useStores(): Stores {
  const stores = use(StoresContext);
  if (!stores) throw new Error('useStores needs a StoresContext provider');
  return stores;
}

/**
 * Re-renders only when the selected value changes by `Object.is`, so a selector
 * returns a primitive or a reference already in the state, never a new object.
 */
export function useNotes<T>(selector: (state: NotesState) => T): T {
  return useStore(useStores().notes, selector);
}

/** As `useNotes`: a selector returns a primitive or a reference already in the state. */
export function useUi<T>(selector: (state: UiState) => T): T {
  return useStore(useStores().ui, selector);
}

/** A boolean per Note, so a change of Editing re-renders only the two Notes involved. */
export function useIsEditing(id: NoteId): boolean {
  return useUi((state) => state.editingId === id);
}
