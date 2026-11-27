import type { NoteId } from '../notes/note';

/** Why Editing last ended. `Note` reads it to put focus back on the article after Escape. */
export type EditingEnd = 'press' | 'escape' | 'delete';

/**
 * Editing: at most one Note, and the rule for how it ends ("Escape or pressing
 * anywhere else ends it"). Callers report what happened; these decide.
 */
export interface EditingState {
  readonly editingId: NoteId | null;
  /** `null` while Editing, or before it ever ended. */
  readonly editingEndedBy: EditingEnd | null;
}

export const NOT_EDITING: EditingState = { editingId: null, editingEndedBy: null };

/**
 * The single exit: every way Editing ends comes through here. Leaves the state as it
 * is when nothing is being edited, so a no-op notifies nobody.
 */
function end(state: EditingState, reason: EditingEnd): EditingState {
  return state.editingId === null ? state : { editingId: null, editingEndedBy: reason };
}

/** At most one: starting it on one Note ends it on any other, through the same exit. */
export function startEditing(state: EditingState, id: NoteId): EditingState {
  if (state.editingId === id) return state;
  return { ...end(state, 'press'), editingId: id, editingEndedBy: null };
}

/**
 * A press on a Note (handles included) or keyboard focus arriving on it, or with
 * `null`, a press on empty Board. Anywhere but the edited Note ends Editing.
 */
export function pressed(state: EditingState, target: NoteId | null): EditingState {
  return target === state.editingId ? state : end(state, 'press');
}

/** Escape that wasn't for something else, such as cancelling a Drag. */
export function escaped(state: EditingState): EditingState {
  return end(state, 'escape');
}

/** A Note was deleted: Editing ends only if it was that Note. */
export function deleted(state: EditingState, id: NoteId): EditingState {
  return state.editingId === id ? end(state, 'delete') : state;
}
