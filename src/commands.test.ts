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

describe('commit, where a Drag saves', () => {
  const a = makeNote({ id: testId('a'), z: 1 });
  const b = makeNote({ id: testId('b'), x: 500, z: 2 });

  function setup() {
    const notes = createNotesStore();
    notes.dispatch({ type: 'load', notes: [a, b] });
    const ui = createUiStore();
    return { notes, ui, ...createCommands({ notes, ui }) };
  }

  it('a delete (a drop on the Trash zone) records Undo and ends Editing of that Note', () => {
    const { notes, ui, commit } = setup();
    ui.dispatch({ type: 'startEditing', id: a.id });

    commit({ type: 'delete', id: a.id });

    expect(notes.getSnapshot().ids).toEqual(['b']);
    expect(ui.getSnapshot()).toMatchObject({ lastDeleted: a, editingId: null });
  });

  it('a delete leaves Editing of another Note alone', () => {
    const { ui, commit } = setup();
    ui.dispatch({ type: 'startEditing', id: b.id });

    commit({ type: 'delete', id: a.id });

    expect(ui.getSnapshot().editingId).toBe(b.id);
  });

  it('any other action goes straight to the Notes store, with no Undo', () => {
    const { notes, ui, commit } = setup();

    commit({ type: 'move', id: a.id, x: 300, y: 200 });

    expect(notes.getSnapshot().notes[a.id]).toMatchObject({ x: 300, y: 200 });
    expect(ui.getSnapshot().lastDeleted).toBeNull();
  });
});

describe('recolour', () => {
  const a = makeNote({ id: testId('a'), colour: 'yellow', z: 1 });
  const b = makeNote({ id: testId('b'), x: 500, colour: 'yellow', z: 2 });

  function setup() {
    const notes = createNotesStore();
    notes.dispatch({ type: 'load', notes: [a, b] });
    const ui = createUiStore();
    return { notes, ui, ...createCommands({ notes, ui }) };
  }

  it("sets the Note's colour and the Current colour", () => {
    const { notes, ui, recolour } = setup();

    recolour(a.id, 'pink');

    expect(notes.getSnapshot().notes[a.id]?.colour).toBe('pink');
    expect(notes.getSnapshot().notes[b.id]?.colour).toBe('yellow');
    expect(ui.getSnapshot().currentColour).toBe('pink');
  });

  it('a missing Note changes nothing, not even the Current colour', () => {
    const { notes, ui, recolour } = setup();
    const before = notes.getSnapshot();

    recolour(testId('gone'), 'pink');

    expect(notes.getSnapshot()).toBe(before);
    expect(ui.getSnapshot()).toBe(INITIAL_UI);
  });
});

describe('pickColour, what a swatch does', () => {
  const a = makeNote({ id: testId('a'), colour: 'yellow', z: 1 });

  function setup() {
    const notes = createNotesStore();
    notes.dispatch({ type: 'load', notes: [a] });
    const ui = createUiStore();
    return { notes, ui, ...createCommands({ notes, ui }) };
  }

  it('while Editing, recolours the edited Note and sets the Current colour', () => {
    const { notes, ui, pickColour } = setup();
    ui.dispatch({ type: 'startEditing', id: a.id });

    pickColour('blue');

    expect(notes.getSnapshot().notes[a.id]?.colour).toBe('blue');
    expect(ui.getSnapshot().currentColour).toBe('blue');
  });

  it('while not Editing, sets only the Current colour', () => {
    const { notes, ui, pickColour } = setup();
    const before = notes.getSnapshot();

    pickColour('blue');

    expect(notes.getSnapshot()).toBe(before);
    expect(ui.getSnapshot().currentColour).toBe('blue');
  });
});
