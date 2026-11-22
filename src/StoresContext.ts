import { createContext, use, useMemo } from 'react';
import { createCommands } from './commands';
import type { NotesState, NotesStore } from './notes/notesReducer';
import { useStore } from './store/createStore';
import type { UiStore } from './ui/uiReducer';

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

export function useCommands() {
  const stores = useStores();
  return useMemo(() => createCommands(stores), [stores]);
}
