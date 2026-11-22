import type { Rect } from './geometry';
import { newNoteId } from './notes/note';
import type { NotesStore } from './notes/notesReducer';
import type { UiStore } from './ui/uiReducer';

/** The rules that span stores, so that each reducer knows only its own store. */
export function createCommands({ notes, ui }: { notes: NotesStore; ui: UiStore }) {
  return {
    createNote: ({ x, y, width, height }: Rect) => {
      const colour = ui.getSnapshot().currentColour;
      notes.dispatch({
        type: 'create',
        note: { id: newNoteId(), x, y, width, height, text: '', colour },
      });
    },
  };
}
