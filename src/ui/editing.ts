import type { NoteId } from '../notes/note';

/** Why Editing last ended. `Note` reads it to put focus back on the article after Escape. */
export type EditingEnd = 'press' | 'escape' | 'delete' | 'pageHide';

/**
 * Editing: at most one Note, its Draft text, and the rule for how it ends ("Escape or
 * pressing anywhere else ends it"). Callers report what happened; these decide.
 */
export interface EditingState {
  readonly editingId: NoteId | null;
  /** The edited Note's Draft text, or `null` while nothing has been typed into it. */
  readonly draftText: string | null;
  /** `null` while Editing, or before it ever ended. */
  readonly editingEndedBy: EditingEnd | null;
  /**
   * Where Editing put the caret when it started: a text offset, or `null` for the end of
   * the text. The editor reads it once, when it mounts.
   */
  readonly caret: number | null;
}

export const NOT_EDITING: EditingState = {
  editingId: null,
  draftText: null,
  editingEndedBy: null,
  caret: null,
};

/** Draft text that Editing ending hands over, to be saved to its Note. */
export interface EndedDraft {
  readonly id: NoteId;
  readonly text: string;
}

/**
 * The single exit: every way Editing ends comes through here, and leaves the Draft
 * text behind for `endedDraft` to find. Leaves the state as it is when nothing is
 * being edited, so a no-op notifies nobody.
 */
function end(state: EditingState, reason: EditingEnd): EditingState {
  return state.editingId === null ? state : { ...NOT_EDITING, editingEndedBy: reason };
}

/**
 * The Draft text that the transition from `before` to `after` ended Editing with, or
 * `null` when Editing didn't end there or nothing was typed.
 */
export function endedDraft(before: EditingState, after: EditingState): EndedDraft | null {
  const { editingId, draftText } = before;
  if (editingId === null || draftText === null || after.editingId === editingId) return null;
  return { id: editingId, text: draftText };
}

/**
 * At most one: starting it on one Note ends it on any other, through the same exit.
 * `caret` is a text offset, or `null` for the end of the text.
 */
export function startEditing(
  state: EditingState,
  id: NoteId,
  caret: number | null = null,
): EditingState {
  if (state.editingId === id) return state;
  return { ...end(state, 'press'), editingId: id, editingEndedBy: null, caret };
}

/** Text typed into the edited Note. With no Note being edited, it is dropped. */
export function typed(state: EditingState, text: string): EditingState {
  return state.editingId === null || state.draftText === text
    ? state
    : { ...state, draftText: text };
}

/**
 * A press on a Note (handles and × included) or keyboard focus arriving on it, or with
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

/** The page is being hidden or closed: Editing ends, so its Draft text is saved. */
export function pageHidden(state: EditingState): EditingState {
  return end(state, 'pageHide');
}
