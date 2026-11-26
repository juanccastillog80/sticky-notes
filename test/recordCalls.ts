type Fn = (...args: never[]) => unknown;

/** One call, as `[name, ...args]`: `['move', id, 250, 180]`. */
export type Call = readonly [string, ...unknown[]];

/** `target` with every function wrapped to pass each call to `record`, then call through. */
export function recordCalls<T extends object>(target: T, record: (call: Call) => void): T {
  const wrapped = Object.fromEntries(
    Object.entries(target).map(([name, value]) =>
      typeof value === 'function'
        ? [
            name,
            (...args: never[]) => {
              record([name, ...args]);
              return (value as Fn)(...args);
            },
          ]
        : [name, value],
    ),
  );
  return wrapped as T;
}

/**
 * Records every action called on a Zustand store from now on. Components call actions
 * through `getState()` at the time, so they go through the recording wrappers.
 */
export function recordActions<S extends object>(store: {
  getState: () => S;
  setState: (partial: Partial<S>) => void;
}): Call[] {
  const calls: Call[] = [];
  store.setState(
    recordCalls(store.getState(), (call) => {
      calls.push(call);
    }),
  );
  return calls;
}

/** A stand-in for the actions a Drag saves through, recording each call. */
export function recordingSave(record: (call: Call) => void) {
  const noop = () => undefined;
  return recordCalls({ raise: noop, move: noop, resize: noop, deleteNote: noop }, record);
}
