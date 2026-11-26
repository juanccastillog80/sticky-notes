import type { Rect } from '../geometry';
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
  const { id, text, colour, z, ...rest } = raw as Record<string, unknown>;
  const noteId = parseNoteId(id);
  const rect = parseRect(rest);
  if (!noteId || !rect || typeof text !== 'string' || !isColour(colour)) return null;
  if (!isFiniteNumber(z)) return null;
  return { id: noteId, ...rect, text, colour, z };
}

function parseRect({ x, y, width, height }: Record<string, unknown>): Rect | null {
  const valid =
    isFiniteNumber(x) && isFiniteNumber(y) && isFiniteNumber(width) && isFiniteNumber(height);
  return valid ? { x, y, width, height } : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isColour(value: unknown): value is NoteColour {
  return (NOTE_COLOURS as readonly unknown[]).includes(value);
}
