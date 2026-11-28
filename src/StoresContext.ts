import { createContext, use } from 'react';
import { useStore } from 'zustand';
import type { NoteId } from './notes/note';
import { createNotesStore, type NotesState, type NotesStore } from './notes/notesStore';
import { createUiStore, type UiState, type UiStore } from './ui/uiStore';

export interface Stores {
  readonly notes: NotesStore;
  readonly ui: UiStore;
}

export function createStores(): Stores {
  const ui = createUiStore();
  return { ui, notes: createNotesStore(ui) };
}

/** Its value never changes, so reading it never causes a render. */
export const StoresContext = createContext<Stores | null>(null);

/** For actions in event handlers: `getState()` there subscribes to nothing. */
export function useStores(): Stores {
  const stores = use(StoresContext);
  if (!stores) throw new Error('useStores needs a StoresContext provider');
  return stores;
}

/** Compared by `Object.is`: a selector that builds a new object goes through `useShallow`. */
export function useNotes<T>(selector: (state: NotesState) => T): T {
  return useStore(useStores().notes, selector);
}

export function useUi<T>(selector: (state: UiState) => T): T {
  return useStore(useStores().ui, selector);
}

/** A boolean per Note, so a change of Editing re-renders only the two Notes involved. */
export function useIsEditing(id: NoteId): boolean {
  return useUi((state) => state.editingId === id);
}
