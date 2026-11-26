import { describe, expect, it } from 'vitest';
import { makeNote, testId } from '../../test/factories';
import { createUiStore } from '../ui/uiStore';
import type { Note } from './note';
import { createNotesStore } from './notesStore';

/** The two stores, wired as the app wires them, with `loaded` on the Board. */
function setup(loaded: Note[] = [], ui = createUiStore()) {
  const notes = createNotesStore(ui);
  notes.getState().load(loaded);
  return { ...notes.getState(), notes, ui };
}

describe('createNote', () => {
  const rect = { x: 290, y: 215, width: 220, height: 170 };
  const created = (notes: ReturnType<typeof setup>['notes']) =>
    Object.values(notes.getState().notes);

  it('creates an empty Note at the rect, yellow to start with', () => {
    const { notes, createNote } = setup();

    createNote(rect);

    expect(created(notes)).toEqual([
      { id: expect.any(String) as string, ...rect, text: '', colour: 'yellow', z: 1 },
    ]);
  });

  it('uses the Current colour', () => {
    const { notes, createNote } = setup([], createUiStore({ currentColour: 'blue' }));

    createNote(rect);

    expect(created(notes)[0]?.colour).toBe('blue');
  });

  it('gives each Note its own id', () => {
    const { notes, createNote } = setup();

    createNote(rect);
    createNote(rect);

    expect(new Set(created(notes).map((note) => note.id)).size).toBe(2);
  });

  it('opens the new Note straight into Editing', () => {
    const { notes, ui, createNote } = setup();

    createNote(rect);

    expect(ui.getState().editingId).toBe(created(notes)[0]?.id);
  });
});

describe('deleteNote and undoDelete', () => {
  const a = makeNote({ id: testId('a'), text: 'keep me', z: 1 });
  const b = makeNote({ id: testId('b'), x: 500, z: 2 });

  it('deletes the Note and records it for Undo', () => {
    const { notes, ui, deleteNote } = setup([a, b]);

    deleteNote(a.id);

    expect(notes.getState().ids).toEqual(['b']);
    expect(ui.getState().lastDeleted).toEqual(a);
  });

  it('ends Editing when the deleted Note was being edited, and only then', () => {
    const { ui, deleteNote } = setup([a, b]);
    ui.getState().startEditing(b.id);

    deleteNote(a.id);
    expect(ui.getState().editingId).toBe(b.id);

    deleteNote(b.id);
    expect(ui.getState().editingId).toBeNull();
  });

  it('undoDelete restores the same Note and hides the toast', () => {
    const { notes, ui, deleteNote, undoDelete } = setup([a, b]);
    deleteNote(a.id);

    undoDelete();

    expect(notes.getState().notes[a.id]).toEqual(a);
    expect(ui.getState().lastDeleted).toBeNull();
  });

  it('does nothing for a missing Note, or with nothing to undo', () => {
    const { notes, ui, deleteNote, undoDelete } = setup([a, b]);
    const before = { notes: notes.getState(), ui: ui.getState() };

    deleteNote(testId('gone'));
    undoDelete();

    expect(notes.getState()).toBe(before.notes);
    expect(ui.getState()).toBe(before.ui);
  });
});

describe('recolour', () => {
  const a = makeNote({ id: testId('a'), colour: 'yellow', z: 1 });
  const b = makeNote({ id: testId('b'), x: 500, colour: 'yellow', z: 2 });

  it("sets the Note's colour and the Current colour", () => {
    const { notes, ui, recolour } = setup([a, b]);

    recolour(a.id, 'pink');

    expect(notes.getState().notes[a.id]?.colour).toBe('pink');
    expect(notes.getState().notes[b.id]?.colour).toBe('yellow');
    expect(ui.getState().currentColour).toBe('pink');
  });

  it('a missing Note changes nothing, not even the Current colour', () => {
    const { notes, ui, recolour } = setup([a, b]);
    const before = { notes: notes.getState(), ui: ui.getState() };

    recolour(testId('gone'), 'pink');

    expect(notes.getState()).toBe(before.notes);
    expect(ui.getState()).toBe(before.ui);
  });
});

describe('pickColour, what a swatch does', () => {
  const a = makeNote({ id: testId('a'), colour: 'yellow', z: 1 });

  it('while Editing, recolours the edited Note and sets the Current colour', () => {
    const { notes, ui, pickColour } = setup([a]);
    ui.getState().startEditing(a.id);

    pickColour('blue');

    expect(notes.getState().notes[a.id]?.colour).toBe('blue');
    expect(ui.getState().currentColour).toBe('blue');
  });

  it('while not Editing, sets only the Current colour', () => {
    const { notes, ui, pickColour } = setup([a]);
    const before = notes.getState();

    pickColour('blue');

    expect(notes.getState()).toBe(before);
    expect(ui.getState().currentColour).toBe('blue');
  });
});

describe('the actions a Drag saves through', () => {
  const a = makeNote({ id: testId('a'), z: 1 });
  const b = makeNote({ id: testId('b'), x: 500, z: 2 });

  it('move, resize and raise change only the Notes store', () => {
    const { notes, ui, move, resize, raise } = setup([a, b]);
    const uiBefore = ui.getState();

    move(a.id, 300, 200);
    resize(b.id, { x: 500, y: 100, width: 300, height: 200 });
    raise(a.id);

    expect(notes.getState().notes[a.id]).toMatchObject({ x: 300, y: 200, z: 3 });
    expect(notes.getState().notes[b.id]).toMatchObject({ width: 300, height: 200 });
    expect(ui.getState()).toBe(uiBefore);
  });

  it('an action that changes nothing leaves the state reference the same', () => {
    const { notes, move, raise, setText } = setup([a, b]);
    const before = notes.getState();

    move(a.id, a.x, a.y);
    raise(b.id);
    setText(a.id, a.text);

    expect(notes.getState()).toBe(before);
  });
});
