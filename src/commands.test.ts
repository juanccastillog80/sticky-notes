import { describe, expect, it } from 'vitest';
import { createCommands } from './commands';
import { createNotesStore } from './notes/notesReducer';
import { createUiStore, INITIAL_UI } from './ui/uiReducer';

describe('createNote', () => {
  const rect = { x: 290, y: 215, width: 220, height: 170 };

  function setup(ui = createUiStore()) {
    const notes = createNotesStore();
    const { createNote } = createCommands({ notes, ui });
    const created = () => Object.values(notes.getSnapshot().notes);
    return { createNote, created };
  }

  it('creates an empty Note at the rect, yellow to start with', () => {
    const { createNote, created } = setup();

    createNote(rect);

    expect(created()).toEqual([
      { id: expect.any(String) as string, ...rect, text: '', colour: 'yellow', z: 1 },
    ]);
  });

  it('uses the Current colour', () => {
    const { createNote, created } = setup(createUiStore({ ...INITIAL_UI, currentColour: 'blue' }));

    createNote(rect);

    expect(created()[0]?.colour).toBe('blue');
  });

  it('gives each Note its own id', () => {
    const { createNote, created } = setup();

    createNote(rect);
    createNote(rect);

    expect(new Set(created().map((note) => note.id)).size).toBe(2);
  });
});
