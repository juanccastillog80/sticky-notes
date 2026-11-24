import { createContext, use, useMemo } from 'react';
import { createCommands } from './commands';
import type { NotesState, NotesStore } from './notes/notesReducer';
import { useStore } from './store/createStore';
import type { NoteId } from './notes/note';
import type { UiState, UiStore } from './ui/uiReducer';

export interface Stores {
  readonly notes: NotesStore;
  readonly ui: UiStore;
}

/** Its value never changes, so reading it never causes a render. Subscriptions do. */
export const StoresContext = createContext<Stores | null>(null);

export function useStores(): Stores {
  const stores = use(StoresContext);
  if (!stores) throw new Error('useStores needs a StoresContext provider');
  return stores;
}

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

export function useCommands() {
  const stores = useStores();
  return useMemo(() => createCommands(stores), [stores]);
}
