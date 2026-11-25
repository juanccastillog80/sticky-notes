import type { Rect } from './geometry';
import { newNoteId, type NoteColour, type NoteId } from './notes/note';
import type { NoteAction, NotesStore } from './notes/notesReducer';
import type { UiStore } from './ui/uiReducer';

/** The rules that span stores, so that each reducer knows only its own store. */
export function createCommands({ notes, ui }: { notes: NotesStore; ui: UiStore }) {
  /** Records the Note for Undo and ends its Editing first, so no phantom Editing is left. */
  function deleteNote(id: NoteId) {
    const note = notes.getSnapshot().notes[id];
    if (!note) return;
    if (ui.getSnapshot().editingId === id) ui.dispatch({ type: 'stopEditing' });
    ui.dispatch({ type: 'showUndo', note });
    notes.dispatch({ type: 'delete', id });
  }

  return {
    createNote: ({ x, y, width, height }: Rect) => {
      const colour = ui.getSnapshot().currentColour;
      const id = newNoteId();
      notes.dispatch({ type: 'create', note: { id, x, y, width, height, text: '', colour } });
      // A new Note opens straight into Editing.
      ui.dispatch({ type: 'startEditing', id });
    },
    deleteNote,
    /** Recolouring a Note also makes its colour the Current colour, for the next Note. */
    recolour: (id: NoteId, colour: NoteColour) => {
      if (!notes.getSnapshot().notes[id]) return;
      notes.dispatch({ type: 'setColour', id, colour });
      ui.dispatch({ type: 'setCurrentColour', colour });
    },
    /** Where a Drag saves. A delete (a drop on the Trash zone) goes through `deleteNote`, for Undo. */
    commit: (action: NoteAction) => {
      if (action.type === 'delete') deleteNote(action.id);
      else notes.dispatch(action);
    },
    undoDelete: () => {
      const note = ui.getSnapshot().lastDeleted;
      if (!note) return;
      notes.dispatch({ type: 'restore', note });
      ui.dispatch({ type: 'hideUndo' });
    },
  };
}
