import { describe, expect, it } from 'vitest';
import { testId } from '../../test/factories';
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
