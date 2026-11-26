import { parseNoteId, type Note, type NoteId } from '../src/notes/note';
import type { NotesState } from '../src/notes/notesStore';

export function testId(raw: string): NoteId {
  const id = parseNoteId(raw);
  if (!id) throw new Error(`Not a NoteId: "${raw}"`);
  return id;
}

export function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: testId('a'),
    x: 100,
    y: 100,
    width: 220,
    height: 170,
    text: '',
    colour: 'yellow',
    z: 1,
    ...overrides,
  };
}

export function makeState(...notes: Note[]): NotesState {
  return {
    notes: Object.fromEntries(notes.map((note) => [note.id, note])),
    ids: notes.map((note) => note.id),
    topZ: Math.max(0, ...notes.map((note) => note.z)),
  };
}
