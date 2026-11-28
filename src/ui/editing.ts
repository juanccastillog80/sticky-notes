import type { NoteId } from '../notes/note';

/** `Note` reads it to put focus back on the article after Escape. */
export type EditingEnd = 'press' | 'escape' | 'delete' | 'pageHide';

/** At most one Note in Editing. Callers report what happened; these transitions decide. */
export interface EditingState {
  readonly editingId: NoteId | null;
  readonly editingEndedBy: EditingEnd | null;
  /** A text offset, or `null` for the end. The editor reads it once, when it mounts. */
  readonly caret: number | null;
}

export const NOT_EDITING: EditingState = {
  editingId: null,
  editingEndedBy: null,
  caret: null,
};

/** The single exit, for `endedEditing` to find. */
function end(state: EditingState, reason: EditingEnd): EditingState {
  return state.editingId === null ? state : { ...NOT_EDITING, editingEndedBy: reason };
}

export function endedEditing(before: EditingState, after: EditingState): NoteId | null {
  const { editingId } = before;
  return editingId === null || after.editingId === editingId ? null : editingId;
}

export function startEditing(
  state: EditingState,
  id: NoteId,
  caret: number | null = null,
): EditingState {
  if (state.editingId === id) return state;
  return { ...end(state, 'press'), editingId: id, editingEndedBy: null, caret };
}

/** `null`: a press on empty Board. */
export function pressed(state: EditingState, target: NoteId | null): EditingState {
  return target === state.editingId ? state : end(state, 'press');
}

export function escaped(state: EditingState): EditingState {
  return end(state, 'escape');
}

export function deleted(state: EditingState, id: NoteId): EditingState {
  return state.editingId === id ? end(state, 'delete') : state;
}

export function pageHidden(state: EditingState): EditingState {
  return end(state, 'pageHide');
}
