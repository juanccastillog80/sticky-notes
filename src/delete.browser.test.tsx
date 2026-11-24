import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { page, userEvent, type Locator } from 'vitest/browser';
import type { ProfilerOnRenderCallback } from 'react';
import { makeNote, testId } from '../test/factories';
import { press } from '../test/mouse';
import { renderApp } from '../test/renderApp';
import type { NoteAction } from './notes/notesReducer';
import { UNDO_TOAST_MS } from './components/UndoToast';

beforeEach(async () => {
  await page.viewport(1024, 768);
});

afterEach(() => {
  vi.useRealTimers();
});

const a = makeNote({ id: testId('a'), x: 100, y: 100, z: 1, text: 'keep me', colour: 'yellow' });
const b = makeNote({ id: testId('b'), x: 400, y: 100, z: 2 });

async function setup({ onNoteRender }: { onNoteRender?: ProfilerOnRenderCallback } = {}) {
  const { screen, stores } = await renderApp(onNoteRender ? { onNoteRender } : {});
  stores.notes.dispatch({ type: 'load', notes: [a, b] });
  const actions: NoteAction[] = [];
  const dispatch = stores.notes.dispatch;
  stores.notes.dispatch = (action) => {
    actions.push(action);
    dispatch(action);
  };
  const notes = screen.getByRole('article', { name: 'Note' });
  await expect.element(notes.nth(1)).toBeVisible();
  const toast = screen.getByRole('status');
  return { screen, stores, actions, notes, noteA: notes.nth(0), noteB: notes.nth(1), toast };
}

const deleteButton = (note: Locator) => note.getByRole('button', { name: 'Delete note' });

it('every Note shows a × on its strip, and clicking it deletes only that Note, with no Raise or move', async () => {
  const { stores, actions, noteA, toast } = await setup();
  await expect.element(deleteButton(noteA)).toBeVisible();

  await press(deleteButton(noteA));

  expect(stores.notes.getSnapshot().ids).toEqual([b.id]);
  expect(actions).toEqual([{ type: 'delete', id: a.id }]);
  await expect.element(toast.getByText('Note deleted')).toBeVisible();
});

it('Undo brings the same Note back: id, rect, text, colour and z', async () => {
  const { stores, noteA, toast } = await setup();
  await press(deleteButton(noteA));

  await toast.getByRole('button', { name: 'Undo' }).click();

  expect(stores.notes.getSnapshot().notes[a.id]).toEqual(a);
  await expect.element(toast.getByText('Note deleted')).not.toBeInTheDocument();
});

it('deleting the Note being edited ends Editing', async () => {
  const { stores, noteA } = await setup();
  stores.ui.dispatch({ type: 'startEditing', id: a.id });
  await expect.element(noteA.getByRole('textbox')).toHaveFocus();

  await press(deleteButton(noteA));

  expect(stores.ui.getSnapshot().editingId).toBeNull();
  expect(stores.notes.getSnapshot().notes[a.id]).toBeUndefined();
});

it('the toast hides after its time, and a newer delete restarts the timer', async () => {
  const { noteA, noteB, toast } = await setup();
  const deleteB = page.elementLocator(deleteButton(noteB).element());
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await press(deleteButton(noteA));
  await expect.element(toast.getByText('Note deleted')).toBeVisible();

  vi.advanceTimersByTime(UNDO_TOAST_MS - 1000);
  await press(deleteB);
  vi.advanceTimersByTime(UNDO_TOAST_MS - 1000);
  await expect.element(toast.getByText('Note deleted')).toBeVisible();

  vi.advanceTimersByTime(1000);
  await expect.element(toast.getByText('Note deleted')).not.toBeInTheDocument();
});

it('the × works from the keyboard', async () => {
  const { stores, noteA } = await setup();
  (deleteButton(noteA).element() as HTMLElement).focus();

  await userEvent.keyboard('{Enter}');

  expect(stores.notes.getSnapshot().notes[a.id]).toBeUndefined();
});

it('deleting Note a does not re-render Note b', async () => {
  const renders: string[] = [];
  const { noteA } = await setup({ onNoteRender: (id) => renders.push(id) });
  renders.length = 0;

  await press(deleteButton(noteA));

  expect(renders).not.toContain('b');
});
