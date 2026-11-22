import { useSyncExternalStore } from 'react';

export interface Store<S, A> {
  getSnapshot: () => S;
  /** Returns the matching unsubscribe. */
  subscribe: (listener: () => void) => () => void;
  dispatch: (action: A) => void;
}

/** A store over a pure reducer. An action that returns the same state notifies nobody. */
export function createStore<S, A>(reducer: (state: S, action: A) => S, initial: S): Store<S, A> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    getSnapshot: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispatch(action) {
      const next = reducer(state, action);
      if (next === state) return;
      state = next;
      for (const listener of listeners) listener();
    },
  };
}

/**
 * Re-renders only when the selected value changes by `Object.is`, so a selector
 * returns a primitive or a reference already in the state, never a new object.
 */
export function useStore<S, A, T>(store: Store<S, A>, selector: (state: S) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getSnapshot()));
}
