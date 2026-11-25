import { describe, expect, it } from 'vitest';
import { makeNote, testId } from '../../test/factories';
import { INITIAL_UI, uiReducer } from './uiReducer';

describe('Editing', () => {
  const a = testId('a');
  const b = testId('b');

  it('startEditing makes the Note the one being edited, replacing any other', () => {
    const editingA = uiReducer(INITIAL_UI, { type: 'startEditing', id: a });

    expect(editingA.editingId).toBe(a);
    expect(uiReducer(editingA, { type: 'startEditing', id: b }).editingId).toBe(b);
  });

  it('stopEditing ends it', () => {
    const editingA = uiReducer(INITIAL_UI, { type: 'startEditing', id: a });

    expect(uiReducer(editingA, { type: 'stopEditing' }).editingId).toBeNull();
  });

  it('returns the same state when nothing changes', () => {
    const editingA = uiReducer(INITIAL_UI, { type: 'startEditing', id: a });

    expect(uiReducer(editingA, { type: 'startEditing', id: a })).toBe(editingA);
    expect(uiReducer(INITIAL_UI, { type: 'stopEditing' })).toBe(INITIAL_UI);
  });
});

describe('Undo', () => {
  const note = makeNote({ id: testId('a') });

  it('showUndo remembers the deleted Note, and hideUndo forgets it', () => {
    const shown = uiReducer(INITIAL_UI, { type: 'showUndo', note });

    expect(shown.lastDeleted).toBe(note);
    expect(uiReducer(shown, { type: 'hideUndo' }).lastDeleted).toBeNull();
  });

  it('returns the same state when nothing changes', () => {
    const shown = uiReducer(INITIAL_UI, { type: 'showUndo', note });

    expect(uiReducer(shown, { type: 'showUndo', note })).toBe(shown);
    expect(uiReducer(INITIAL_UI, { type: 'hideUndo' })).toBe(INITIAL_UI);
  });
});

describe('Current colour', () => {
  it('setCurrentColour sets it, and returns the same state when it does not change', () => {
    const blue = uiReducer(INITIAL_UI, { type: 'setCurrentColour', colour: 'blue' });

    expect(blue.currentColour).toBe('blue');
    expect(uiReducer(blue, { type: 'setCurrentColour', colour: 'blue' })).toBe(blue);
  });
});
