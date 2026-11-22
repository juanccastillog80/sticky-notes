import { expectTypeOf, it } from 'vitest';
import type { Note, NoteColour, NoteId } from './note';
import type { NoteAction } from './notesReducer';

it('a plain string is not a NoteId', () => {
  expectTypeOf<string>().not.toExtend<NoteId>();
  // @ts-expect-error -- only newNoteId and parseNoteId make a NoteId
  const id: NoteId = 'a';
  expectTypeOf(id).toExtend<string>();
});

it("'red' is not a NoteColour", () => {
  expectTypeOf<'red'>().not.toExtend<NoteColour>();
  expectTypeOf<'yellow'>().toExtend<NoteColour>();
});

it('an unknown action type does not compile', () => {
  expectTypeOf<{ type: 'explode' }>().not.toExtend<NoteAction>();
  expectTypeOf<{ type: 'load'; notes: Note[] }>().toExtend<NoteAction>();
});
