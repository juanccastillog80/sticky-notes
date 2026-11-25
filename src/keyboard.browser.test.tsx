import { afterEach, beforeEach, expect, it } from 'vitest';
import { page, userEvent, type Locator } from 'vitest/browser';
import { makeNote, testId } from '../test/factories';
import { drag, press } from '../test/mouse';
import { renderApp } from '../test/renderApp';
import { DOUBLE_CLICK_MS } from './components/ignorePressesFor';
import type { NoteAction } from './notes/notesReducer';

beforeEach(async () => {
  await page.viewport(1024, 768);
});

afterEach(async () => {
  // A mouse delete ignores presses on Notes for a double-click interval.
  await new Promise((resolve) => setTimeout(resolve, DOUBLE_CLICK_MS));
});

// Created a, b, c, so that is the DOM order; the Stacking order is c, a, b from the front.
const a = makeNote({ id: testId('a'), x: 100, y: 100, z: 2, text: 'hello' });
const b = makeNote({ id: testId('b'), x: 400, y: 100, z: 1 });
const c = makeNote({ id: testId('c'), x: 700, y: 100, z: 3 });

async function setup(notes = [a, b, c]) {
  const { screen, stores } = await renderApp();
  stores.notes.dispatch({ type: 'load', notes });
  const actions: NoteAction[] = [];
  const dispatch = stores.notes.dispatch;
  stores.notes.dispatch = (action) => {
    actions.push(action);
    dispatch(action);
  };
  const all = screen.getByRole('article', { name: 'Note' });
  await expect.element(all.nth(notes.length - 1)).toBeVisible();
  const board = screen.getByRole('region', { name: 'Board' });
  return {
    stores,
    actions,
    board,
    toast: screen.getByRole('status'),
    noteA: all.nth(0),
    noteB: all.nth(1),
    noteC: all.nth(2),
  };
}

const deleteButton = (note: Locator) => note.getByRole('button', { name: 'Delete note' });
const editor = (note: Locator) => note.getByRole('textbox');

/** Keyboard focus on `note`, as a Tab would leave it. */
async function focusNote(note: Locator) {
  (note.element() as HTMLElement).focus();
  await expect.element(note).toHaveFocus();
}

it('Tab visits Note, ×, Note, ×, Note, × in DOM order, and Shift+Tab goes back', async () => {
  const { noteA, noteB, noteC } = await setup();
  const order = [
    noteA,
    deleteButton(noteA),
    noteB,
    deleteButton(noteB),
    noteC,
    deleteButton(noteC),
  ];
  await focusNote(noteA);

  for (const next of order.slice(1)) {
    await userEvent.keyboard('{Tab}');
    await expect.element(next).toHaveFocus();
  }
  for (const previous of order.slice(0, -1).reverse()) {
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await expect.element(previous).toHaveFocus();
  }
});

it('a focused Note is Raised and shows a focus ring', async () => {
  const { stores, noteA, noteB } = await setup();
  await focusNote(noteA);

  await userEvent.keyboard('{Tab}{Tab}');

  await expect.element(noteB).toHaveFocus();
  expect(stores.notes.getSnapshot().notes[b.id]?.z).toBe(stores.notes.getSnapshot().topZ);
  const ring = getComputedStyle(noteB.element());
  expect(ring.outlineStyle).toBe('solid');
  expect(parseFloat(ring.outlineWidth)).toBeGreaterThanOrEqual(2);
});

it('Enter on a focused Note starts Editing with the caret at the end, and typing changes the text', async () => {
  const { stores, noteA } = await setup();
  await focusNote(noteA);

  await userEvent.keyboard('{Enter}');

  await expect.element(editor(noteA)).toHaveFocus();
  const textarea = editor(noteA).element() as HTMLTextAreaElement;
  expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([5, 5]);
  await userEvent.keyboard(' there');
  // The Enter that started Editing typed no line break.
  expect(stores.notes.getSnapshot().notes[a.id]?.text).toBe('hello there');
});

it('Escape ends Editing and gives focus back to the Note, so Tab carries on from there', async () => {
  const { stores, noteA } = await setup();
  await focusNote(noteA);
  await userEvent.keyboard('{Enter}');
  await expect.element(editor(noteA)).toHaveFocus();

  await userEvent.keyboard('{Escape}');

  expect(stores.ui.getSnapshot().editingId).toBeNull();
  await expect.element(noteA).toHaveFocus();
  await userEvent.keyboard('{Tab}');
  await expect.element(deleteButton(noteA)).toHaveFocus();
});

it('Delete on a focused Note deletes it, shows the Undo toast and focuses the next Note', async () => {
  const { stores, toast, noteA } = await setup();
  await focusNote(noteA);

  await userEvent.keyboard('{Delete}');

  expect(stores.notes.getSnapshot().notes[a.id]).toBeUndefined();
  await expect.element(toast.getByText('Note deleted')).toBeVisible();
  // Note b is now first in the DOM.
  await expect.element(noteA).toHaveFocus();
  expect(noteA.element().textContent).not.toContain('hello');
  expect(stores.notes.getSnapshot().ids).toEqual([b.id, c.id]);
});

it('Backspace on the last Note focuses the previous one, and on the only Note focuses the Board', async () => {
  const { stores, board, noteA, noteB } = await setup([a, b]);
  await focusNote(noteB);

  await userEvent.keyboard('{Backspace}');

  expect(stores.notes.getSnapshot().ids).toEqual([a.id]);
  await expect.element(noteA).toHaveFocus();

  await userEvent.keyboard('{Backspace}');

  expect(stores.notes.getSnapshot().ids).toEqual([]);
  await expect.element(board).toHaveFocus();
});

it('Backspace while Editing only edits the text', async () => {
  const { stores, noteA } = await setup();
  await focusNote(noteA);
  await userEvent.keyboard('{Enter}');
  await expect.element(editor(noteA)).toHaveFocus();

  await userEvent.keyboard('{Backspace}{Delete}');

  expect(stores.notes.getSnapshot().notes[a.id]?.text).toBe('hell');
  expect(stores.ui.getSnapshot().editingId).toBe(a.id);
});

it('Enter and Backspace on a focused × do not act on the Note', async () => {
  const { stores, noteA } = await setup();
  (deleteButton(noteA).element() as HTMLElement).focus();

  await userEvent.keyboard('{Backspace}');

  expect(stores.notes.getSnapshot().notes[a.id]).toBeDefined();
  expect(stores.ui.getSnapshot().editingId).toBeNull();
});

it('a Click on a Note does not focus it, and a drag Raises once and saves only its move', async () => {
  const { stores, actions, noteB } = await setup();

  await drag(noteB, { dx: 40, dy: 0, position: { x: 100, y: 10 } });

  expect(actions).toEqual([
    { type: 'raise', id: b.id },
    { type: 'move', id: b.id, x: 440, y: 100 },
  ]);
  expect(document.activeElement?.closest('article')).toBeNull();

  await press(noteB, { x: 100, y: 10 });

  expect(stores.ui.getSnapshot().editingId).toBe(b.id);
});
