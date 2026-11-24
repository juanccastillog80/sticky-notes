import { describe, expect, it } from 'vitest';
import { makeNote, testId } from '../test/factories';
import { createCommands } from './commands';
import { createNotesStore } from './notes/notesReducer';
import { createUiStore, INITIAL_UI } from './ui/uiReducer';

describe('createNote', () => {
  const rect = { x: 290, y: 215, width: 220, height: 170 };

  function setup(ui = createUiStore()) {
    const notes = createNotesStore();
    const { createNote } = createCommands({ notes, ui });
    const created = () => Object.values(notes.getSnapshot().notes);
    return { createNote, created, ui };
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

  it('opens the new Note straight into Editing', () => {
    const { createNote, created, ui } = setup();

    createNote(rect);

    expect(ui.getSnapshot().editingId).toBe(created()[0]?.id);
  });
});

describe('deleteNote and undoDelete', () => {
  const a = makeNote({ id: testId('a'), text: 'keep me', z: 1 });
  const b = makeNote({ id: testId('b'), x: 500, z: 2 });

  function setup() {
    const notes = createNotesStore();
    notes.dispatch({ type: 'load', notes: [a, b] });
    const ui = createUiStore();
    return { notes, ui, ...createCommands({ notes, ui }) };
  }

  it('deletes the Note and records it for Undo', () => {
    const { notes, ui, deleteNote } = setup();

    deleteNote(a.id);

    expect(notes.getSnapshot().ids).toEqual(['b']);
    expect(ui.getSnapshot().lastDeleted).toEqual(a);
  });

  it('ends Editing when the deleted Note was being edited, and only then', () => {
    const { ui, deleteNote } = setup();
    ui.dispatch({ type: 'startEditing', id: b.id });

    deleteNote(a.id);
    expect(ui.getSnapshot().editingId).toBe(b.id);

    deleteNote(b.id);
    expect(ui.getSnapshot().editingId).toBeNull();
  });

  it('undoDelete restores the same Note and hides the toast', () => {
    const { notes, ui, deleteNote, undoDelete } = setup();
    deleteNote(a.id);

    undoDelete();

    expect(notes.getSnapshot().notes[a.id]).toEqual(a);
    expect(ui.getSnapshot().lastDeleted).toBeNull();
  });

  it('does nothing for a missing Note, or with nothing to undo', () => {
    const { notes, ui, deleteNote, undoDelete } = setup();
    const before = notes.getSnapshot();

    deleteNote(testId('gone'));
    undoDelete();

    expect(notes.getSnapshot()).toBe(before);
    expect(ui.getSnapshot()).toBe(INITIAL_UI);
  });
});
