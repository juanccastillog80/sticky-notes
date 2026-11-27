import { describe, expect, it } from 'vitest';
import { makeNote, testId } from '../../test/factories';
import { recordingSave, type Call as SaveCall } from '../../test/recordCalls';
import { createDragController, type DragHandlers, type DragIO } from '../drag/controller';
import type { NoteId } from '../notes/note';
import { createStores } from '../StoresContext';
import { createPress, DOUBLE_CLICK_MS, type Pointer, type PressTarget } from './press';

const a = makeNote({ id: testId('a'), x: 100, y: 100, z: 1, text: 'hello' });
const b = makeNote({ id: testId('b'), x: 500, y: 100, z: 2, text: 'world' });
/** What the fake DOM measures under a Click's pointer. */
const CARET = 3;

/**
 * Two Notes, `b` in front, the real stores, the real Drag controller and a fake `DragIO`
 * whose Click measures `CARET` and hands it back to the Press, as the DOM side does.
 */
function setup() {
  const stores = createStores();
  stores.notes.getState().load([a, b]);
  let time = 1000;
  let attached: DragHandlers | null = null;
  const saves: SaveCall[] = [];
  const io: DragIO = {
    scrollPosition: () => ({ x: 0, y: 0 }),
    attachPointerListeners(handlers) {
      attached = handlers;
      return () => {
        attached = null;
      };
    },
    releaseCapture: () => undefined,
    writePreview: () => undefined,
    save: recordingSave((call) => {
      saves.push(call);
      const [name, ...args] = call;
      // Through to the store too, so a drop on the Trash zone really deletes.
      if (name === 'deleteNote') stores.notes.getState().deleteNote(args[0] as NoteId);
    }),
    click: () => {
      press.clicked(CARET);
    },
    trashRect: () => null,
    boardOrigin: () => ({ x: 0, y: 0 }),
    boardSize: () => ({ width: 1920, height: 1080 }),
    writeTrash: () => undefined,
  };
  const press = createPress(stores, createDragController(io), () => time);

  const left: Pointer = { pointerId: 1, clientX: 10, clientY: 10, isPrimary: true, button: 0 };
  return {
    stores,
    press,
    saves,
    /** Whether a Drag session is listening. */
    dragging: () => attached !== null,
    down: (target: PressTarget, pointer: Partial<Pointer> = {}) =>
      press.pointerDown(target, { ...left, ...pointer }),
    /** Released where it was pressed, or at `to`. */
    up: (to = { x: 10, y: 10 }) => attached?.up({ pointerId: 1, clientX: to.x, clientY: to.y }),
    move: (x: number, y: number) =>
      attached?.move({ pointerId: 1, clientX: x, clientY: y, buttons: 1 }),
    z: (id: NoteId) => stores.notes.getState().notes[id]?.z,
    editing: () => stores.ui.getState().editingId,
    later: (ms: number) => {
      time += ms;
    },
  };
}

describe('a Press on a Note', () => {
  it('Raises it at once and starts a Drag', () => {
    const t = setup();

    expect(t.down({ on: 'body', id: a.id })).toBe('drag');

    expect(t.z(a.id)).toBeGreaterThan(t.z(b.id) ?? 0);
    expect(t.dragging()).toBe(true);
  });

  it('released inside the Dead zone is a Click: Editing starts with the caret where it landed', () => {
    const t = setup();
    t.down({ on: 'body', id: a.id });
    t.move(12, 11);
    t.up({ x: 12, y: 11 });

    expect(t.editing()).toBe(a.id);
    expect(t.stores.ui.getState().caret).toBe(CARET);
    expect(t.saves).toEqual([]);
  });

  it('released as a Click after its Note was deleted starts no Editing', () => {
    const t = setup();
    t.down({ on: 'body', id: a.id });
    t.stores.notes.getState().deleteNote(a.id);
    t.up();

    expect(t.editing()).toBeNull();
  });

  it('whose Note is deleted mid-Drag ends the Drag at once, saving nothing', () => {
    const t = setup();
    t.down({ on: 'body', id: a.id });
    t.move(60, 30);
    t.stores.notes.getState().deleteNote(a.id);

    expect(t.dragging()).toBe(false);
    t.stores.notes.getState().undoDelete();
    expect(t.stores.notes.getState().notes[a.id]).toMatchObject({ x: 100, y: 100 });
  });

  it('moved past the Dead zone is a move, and starts no Editing', () => {
    const t = setup();
    t.down({ on: 'grip', id: a.id });
    t.move(60, 30);
    t.up({ x: 60, y: 30 });

    expect(t.saves).toEqual([['move', a.id, 150, 120]]);
    expect(t.editing()).toBeNull();
  });

  it('on a Resize handle is a resize', () => {
    const t = setup();
    t.down({ on: 'handle', id: a.id, handle: 'se' });
    t.move(40, 30);
    t.up({ x: 40, y: 30 });

    expect(t.saves).toEqual([['resize', a.id, { x: 100, y: 100, width: 250, height: 190 }]]);
  });

  it('with the right button, or a second finger, is no Press: no Raise, no Drag', () => {
    const t = setup();

    expect(t.down({ on: 'body', id: a.id }, { button: 2 })).toBe('none');
    expect(t.down({ on: 'body', id: a.id }, { isPrimary: false })).toBe('none');

    expect(t.z(a.id)).toBe(1);
    expect(t.dragging()).toBe(false);
  });

  it('inside text only Raises: no Drag and no Click, so the caret and selection are the browser’s', () => {
    const t = setup();
    t.stores.ui.getState().startEditing(a.id);

    expect(t.down({ on: 'body', id: a.id }, { inText: true })).toBe('none');

    expect(t.z(a.id)).toBeGreaterThan(t.z(b.id) ?? 0);
    expect(t.dragging()).toBe(false);
    expect(t.editing()).toBe(a.id);
  });
});

describe('ending Editing', () => {
  it('a press on another Note ends it, with any button; one on the edited Note keeps it', () => {
    const t = setup();
    t.stores.ui.getState().startEditing(a.id);

    t.down({ on: 'grip', id: a.id });
    t.up({ x: 30, y: 30 });
    expect(t.editing()).toBe(a.id);

    t.down({ on: 'body', id: b.id }, { button: 2 });
    expect(t.editing()).toBeNull();
  });

  it('a press on empty Board ends it; one outside the Board does not', () => {
    const t = setup();
    t.stores.ui.getState().startEditing(a.id);

    expect(t.down({ on: 'outside' })).toBe('none');
    expect(t.editing()).toBe(a.id);

    expect(t.down({ on: 'board' })).toBe('none');
    expect(t.editing()).toBeNull();
  });

  it('a press on another Note’s × ends it, but is no Press: no Raise, no Drag, focus left alone', () => {
    const t = setup();
    t.stores.ui.getState().startEditing(b.id);

    expect(t.down({ on: 'delete', id: a.id })).toBe('prevent');

    expect(t.editing()).toBeNull();
    expect(t.z(a.id)).toBe(1);
    expect(t.dragging()).toBe(false);
  });
});

describe('focus arriving on a Note', () => {
  it('from the keyboard Raises it and ends Editing on any other', () => {
    const t = setup();
    t.stores.ui.getState().startEditing(b.id);

    t.press.focused(a.id, { keyboard: true, inText: false });

    expect(t.z(a.id)).toBeGreaterThan(t.z(b.id) ?? 0);
    expect(t.editing()).toBeNull();
  });

  it('from a right-button press ends Editing elsewhere, but does not Raise', () => {
    const t = setup();
    t.stores.ui.getState().startEditing(b.id);

    t.press.focused(a.id, { keyboard: false, inText: false });

    expect(t.z(a.id)).toBe(1);
    expect(t.editing()).toBeNull();
  });

  it('in its text, which only Editing focuses, does nothing', () => {
    const t = setup();
    t.stores.ui.getState().startEditing(a.id);
    const before = t.stores.notes.getState();

    t.press.focused(a.id, { keyboard: true, inText: true });

    expect(t.stores.notes.getState()).toBe(before);
    expect(t.editing()).toBe(a.id);
  });
});

describe('the ×', () => {
  it('clicked with the mouse deletes its Note, then ignores presses on Notes for a double-click’s time', () => {
    const t = setup();
    t.press.deleteButtonClicked(b.id, { mouse: true });
    expect(t.stores.notes.getState().ids).toEqual([a.id]);

    // The second half of the double-click lands on the Note that was under the ×.
    expect(t.down({ on: 'body', id: a.id })).toBe('prevent');
    expect(t.down({ on: 'delete', id: a.id })).toBe('prevent');
    t.press.deleteButtonClicked(a.id, { mouse: true });

    expect(t.stores.notes.getState().notes[a.id]).toEqual(a);
    expect(t.dragging()).toBe(false);
  });

  it('ignores presses on Notes only: one on empty Board still ends Editing', () => {
    const t = setup();
    t.press.deleteButtonClicked(b.id, { mouse: true });
    t.stores.ui.getState().startEditing(a.id);

    t.down({ on: 'board' });

    expect(t.editing()).toBeNull();
  });

  it('after the double-click’s time, presses on Notes work again', () => {
    const t = setup();
    t.press.deleteButtonClicked(b.id, { mouse: true });
    t.later(DOUBLE_CLICK_MS);

    expect(t.down({ on: 'body', id: a.id })).toBe('drag');
  });

  it('clicked from the keyboard during that time still deletes: Enter can’t be half a double-click', () => {
    const t = setup();
    t.press.deleteButtonClicked(b.id, { mouse: true });

    t.press.deleteButtonClicked(a.id, { mouse: false });

    expect(t.stores.notes.getState().ids).toEqual([]);
  });

  it('clicked with Enter or Space deletes without ignoring anything after', () => {
    const t = setup();
    t.press.deleteButtonClicked(b.id, { mouse: false });

    expect(t.down({ on: 'body', id: a.id })).toBe('drag');
  });
});

describe('a double-click on empty Board', () => {
  const point = { x: 800, y: 600 };
  const board = { width: 1920, height: 1080 };

  it('creates a Note there, in Editing', () => {
    const t = setup();
    t.down({ on: 'board' });
    t.down({ on: 'board' });
    t.press.doubleClickedBoard(point, board);

    const { ids } = t.stores.notes.getState();
    expect(ids).toHaveLength(3);
    expect(t.editing()).toBe(ids[2]);
  });

  it.each<[string, PressTarget]>([
    ['on a Note', { on: 'body', id: a.id }],
    ['outside the Board', { on: 'outside' }],
  ])('whose first press was %s creates nothing', (_, first) => {
    const t = setup();
    t.down({ on: 'board' });
    t.down(first);
    t.down({ on: 'board' });
    t.press.doubleClickedBoard(point, board);

    expect(t.stores.notes.getState().ids).toHaveLength(2);
  });
});
