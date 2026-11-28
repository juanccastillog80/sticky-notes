import { describe, expect, it } from 'vitest';
import { makeNote, testId } from '../../test/factories';
import { createUiStore } from '../ui/uiStore';
import type { Note, NoteId } from './note';
import { createNotesStore } from './notesStore';

type Setup = ReturnType<typeof setup>;

/** The two stores, wired as the app wires them, with `loaded` on the Board. */
function setup(loaded: Note[] = [], ui = createUiStore()) {
  const notes = createNotesStore(ui);
  notes.getState().load(loaded);
  return { ...notes.getState(), notes, ui };
}

const created = (notes: Setup['notes']) => Object.values(notes.getState().notes);
/** The Board an empty 1024×768 window shows. */
const board = { width: 1000, height: 696 };

describe('createNoteAt, a double-click on empty Board', () => {
  it('creates an empty yellow Note of the Current size, centred on the point', () => {
    const { notes, createNoteAt } = setup();

    createNoteAt({ x: 400, y: 300 }, board);

    expect(created(notes)).toEqual([
      {
        id: expect.any(String) as string,
        x: 290,
        y: 215,
        width: 220,
        height: 170,
        text: '',
        colour: 'yellow',
        z: 1,
      },
    ]);
  });

  it('uses the Current size, and keeps the Note inside the Board', () => {
    const { notes, createNoteAt } = setup([], createUiStore({ currentSize: 'large' }));

    createNoteAt({ x: 990, y: 10 }, board);

    expect(created(notes)[0]).toMatchObject({ x: 700, y: 0, width: 300, height: 230 });
  });
});

describe('a new Note', () => {
  const createOne = (store: Setup) => {
    store.createNoteAt({ x: 400, y: 300 }, board);
  };

  it('uses the Current colour', () => {
    const store = setup([], createUiStore({ currentColour: 'blue' }));

    createOne(store);

    expect(created(store.notes)[0]?.colour).toBe('blue');
  });

  it('opens straight into Editing', () => {
    const store = setup();

    createOne(store);

    expect(store.ui.getState().editingId).toBe(created(store.notes)[0]?.id);
  });

  it('gets its own id', () => {
    const store = setup();

    createOne(store);
    createOne(store);

    expect(new Set(created(store.notes).map((note) => note.id)).size).toBe(2);
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

describe('Draft text', () => {
  const a = makeNote({ id: testId('a'), text: 'hello' });
  const b = makeNote({ id: testId('b'), x: 400, z: 2 });

  /**
   * Starts Editing on `id` and mounts a stand-in for its editor, which keeps the Draft
   * text itself and lends the ui store how to read it, as `NoteEditor` does.
   */
  function edit(ui: Setup['ui'], id: NoteId, saved: string) {
    ui.getState().startEditing(id);
    const editor = { text: saved };
    ui.getState().holdDraft(id, () => editor.text);
    return editor;
  }

  it('Editing ending saves the Draft text to the Note once', () => {
    const { notes, ui } = setup([a, b]);
    const editor = edit(ui, a.id, a.text);
    let updates = 0;
    notes.subscribe(() => (updates += 1));

    editor.text = 'hello wo';
    ui.getState().escaped();

    expect(updates).toBe(1);
    expect(notes.getState().notes[a.id]?.text).toBe('hello wo');
  });

  it('every way Editing ends saves it', () => {
    const { notes, ui } = setup([a, b]);
    const text = () => notes.getState().notes[a.id]?.text;
    const endings: Record<string, () => void> = {
      'press on empty Board': () => {
        ui.getState().pressed(null);
      },
      'press on another Note': () => {
        ui.getState().pressed(b.id);
      },
      'Editing another Note': () => {
        ui.getState().startEditing(b.id);
      },
      'page hidden': () => {
        ui.getState().pageHidden();
      },
      'new Note': () => {
        notes.getState().createNoteAt({ x: 400, y: 300 }, board);
      },
    };
    for (const [ending, end] of Object.entries(endings)) {
      edit(ui, a.id, a.text).text = ending;
      end();
      expect(text()).toBe(ending);
    }
  });

  it('the page being hidden while Editing saves the Draft text', () => {
    const { notes, ui } = setup([a]);
    edit(ui, a.id, a.text).text = 'before reload';

    ui.getState().pageHidden();

    expect(notes.getState().notes[a.id]?.text).toBe('before reload');
    expect(ui.getState().editingId).toBeNull();
  });

  it('deleting the edited Note saves the Draft text first, so Undo brings it back', () => {
    const { notes, ui } = setup([a, b]);
    edit(ui, a.id, a.text).text = 'typed';

    notes.getState().deleteNote(a.id);
    notes.getState().undoDelete();

    expect(notes.getState().notes[a.id]).toEqual({ ...a, text: 'typed' });
  });

  it('nothing typed, or the text typed back to what it was, changes nothing', () => {
    const { notes, ui } = setup([a, b]);
    const before = notes.getState();
    edit(ui, a.id, a.text);
    ui.getState().escaped();
    edit(ui, a.id, a.text).text = 'hello';
    ui.getState().escaped();

    expect(notes.getState()).toBe(before);
  });

  it('an editor that has unmounted lends nothing, unless another has lent since', () => {
    const { ui } = setup([a]);
    ui.getState().startEditing(a.id);
    const unmountOld = ui.getState().holdDraft(a.id, () => 'old');
    ui.getState().holdDraft(a.id, () => 'new');

    unmountOld();
    expect(ui.getState().readDraft(a.id)).toBe('new');

    const unmountNew = ui.getState().holdDraft(a.id, () => 'newer');
    unmountNew();
    expect(ui.getState().readDraft(a.id)).toBeNull();
  });

  it('a Draft text lent for a Note not in Editing is ignored', () => {
    const { notes, ui } = setup([a, b]);
    ui.getState().startEditing(b.id);
    ui.getState().holdDraft(a.id, () => 'lost');

    ui.getState().escaped();

    expect(ui.getState().readDraft(a.id)).toBeNull();
    expect(notes.getState().notes[a.id]?.text).toBe('hello');
  });
});
