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

  it('stopEditing ends it', () => {
    const ui = createUiStore();
    ui.getState().startEditing(a);

    ui.getState().stopEditing();

    expect(ui.getState().editingId).toBeNull();
  });

  it('leaves the same state when nothing changes', () => {
    const ui = createUiStore();
    const idle = ui.getState();
    ui.getState().stopEditing();
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
