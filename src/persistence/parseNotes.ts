import { NOTE_COLOURS, parseNoteId, type Note, type NoteColour } from '../notes/note';

/**
 * The way in for Notes from outside the app: the Local copy now, and later
 * server responses and mock request bodies. All or nothing: one invalid Note
 * rejects the whole list, so a damaged copy is never half-loaded.
 */
export function parseNotes(raw: unknown): Note[] | null {
  if (!Array.isArray(raw)) return null;
  const notes: Note[] = [];
  for (const item of raw) {
    const note = parseNote(item);
    if (!note) return null;
    notes.push(note);
  }
  return notes;
}

function parseNote(raw: unknown): Note | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const { id, x, y, width, height, text, colour, z } = raw as Record<string, unknown>;
  const noteId = parseNoteId(id);
  if (!noteId) return null;
  if (![x, y, width, height, z].every(isFiniteNumber)) return null;
  if (typeof text !== 'string' || !isColour(colour)) return null;
  return {
    id: noteId,
    x: x as number,
    y: y as number,
    width: width as number,
    height: height as number,
    text,
    colour,
    z: z as number,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isColour(value: unknown): value is NoteColour {
  return (NOTE_COLOURS as readonly unknown[]).includes(value);
}
