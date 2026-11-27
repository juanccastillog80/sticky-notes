import { describe, expect, it } from 'vitest';
import { makeNote, testId } from '../../test/factories';
import { createUiStore } from './uiStore';

describe('Editing', () => {
  const a = testId('a');
  const b = testId('b');

  it('startEditing makes the Note the one being edited, replacing any other', () => {
    const ui = createUiStore();

    ui.getState().startEditing(a);
    expect(ui.getState().editingId).toBe(a);
    ui.getState().startEditing(b);
    expect(ui.getState().editingId).toBe(b);
  });

  it('a press on the edited Note keeps Editing', () => {
    const ui = createUiStore();
    ui.getState().startEditing(a);
    const editingA = ui.getState();

    ui.getState().pressed(a);

    expect(ui.getState()).toBe(editingA);
  });

  it('a press on another Note, or on empty Board, ends Editing', () => {
    const ui = createUiStore();

    ui.getState().startEditing(a);
    ui.getState().pressed(b);
    expect(ui.getState().editingId).toBeNull();
    expect(ui.getState().editingEndedBy).toBe('press');

    ui.getState().startEditing(a);
    ui.getState().pressed(null);
    expect(ui.getState().editingId).toBeNull();
    expect(ui.getState().editingEndedBy).toBe('press');
  });

  it('Escape ends Editing, and says so', () => {
    const ui = createUiStore();
    ui.getState().startEditing(a);

    ui.getState().escaped();

    expect(ui.getState().editingId).toBeNull();
    expect(ui.getState().editingEndedBy).toBe('escape');
  });

  it('deleting the edited Note ends Editing; deleting another Note does not', () => {
    const ui = createUiStore();
    ui.getState().startEditing(a);

    ui.getState().deleted(b);
    expect(ui.getState().editingId).toBe(a);

    ui.getState().deleted(a);
    expect(ui.getState().editingId).toBeNull();
    expect(ui.getState().editingEndedBy).toBe('delete');
  });

  it('starting Editing again forgets how it last ended', () => {
    const ui = createUiStore();
    ui.getState().startEditing(a);
    ui.getState().escaped();

    ui.getState().startEditing(b);

    expect(ui.getState().editingEndedBy).toBeNull();
  });

  it('leaves the same state when nothing changes', () => {
    const ui = createUiStore();
    const idle = ui.getState();
    ui.getState().pressed(a);
    ui.getState().pressed(null);
    ui.getState().escaped();
    ui.getState().deleted(a);
    expect(ui.getState()).toBe(idle);

    ui.getState().startEditing(a);
    const editingA = ui.getState();
    ui.getState().startEditing(a);
    expect(ui.getState()).toBe(editingA);
  });
});

describe('Undo', () => {
  const note = makeNote({ id: testId('a') });

  it('showUndo remembers the deleted Note, and hideUndo forgets it', () => {
    const ui = createUiStore();

    ui.getState().showUndo(note);
    expect(ui.getState().lastDeleted).toBe(note);
    ui.getState().hideUndo();
    expect(ui.getState().lastDeleted).toBeNull();
  });

  it('leaves the same state when nothing changes', () => {
    const ui = createUiStore();
    const hidden = ui.getState();
    ui.getState().hideUndo();
    expect(ui.getState()).toBe(hidden);

    ui.getState().showUndo(note);
    const shown = ui.getState();
    ui.getState().showUndo(note);
    expect(ui.getState()).toBe(shown);
  });
});

describe('Current colour', () => {
  it('starts yellow; setCurrentColour sets it, and leaves the same state when it does not change', () => {
    const ui = createUiStore();
    expect(ui.getState().currentColour).toBe('yellow');

    ui.getState().setCurrentColour('blue');
    const blue = ui.getState();
    ui.getState().setCurrentColour('blue');

    expect(blue.currentColour).toBe('blue');
    expect(ui.getState()).toBe(blue);
  });

  it('a store can start from another colour', () => {
    expect(createUiStore({ currentColour: 'pink' }).getState().currentColour).toBe('pink');
  });
});

describe('the UI store', () => {
  it('tells subscribers about a change, but not about a no-op', () => {
    const ui = createUiStore();
    let calls = 0;
    ui.subscribe(() => (calls += 1));

    ui.getState().setCurrentColour('blue');
    ui.getState().setCurrentColour('blue');

    expect(calls).toBe(1);
  });
});
