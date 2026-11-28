import { afterEach, beforeEach, expect, it } from 'vitest';
import { page, userEvent, type Locator } from 'vitest/browser';
import { makeNote, testId } from '../test/factories';
import { drag, press } from '../test/mouse';
import { recordActions } from '../test/recordCalls';
import { renderApp } from '../test/renderApp';
import { DOUBLE_CLICK_MS } from './press/press';

beforeEach(async () => {
  await page.viewport(1024, 768);
});

afterEach(async () => {
  // A mouse delete ignores presses on Notes near its point for a double-click interval.
  await new Promise((resolve) => setTimeout(resolve, DOUBLE_CLICK_MS));
});

// Created a, b, c, so that is the DOM order; the Stacking order is c, a, b from the front.
const a = makeNote({ id: testId('a'), x: 100, y: 100, z: 2, text: 'hello' });
const b = makeNote({ id: testId('b'), x: 400, y: 100, z: 1 });
const c = makeNote({ id: testId('c'), x: 700, y: 100, z: 3 });

async function setup(notes = [a, b, c]) {
  const { screen, stores } = await renderApp();
  stores.notes.getState().load(notes);
  const actions = recordActions(stores.notes);
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
async function tabTo(note: Locator) {
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
  await tabTo(noteA);

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
  await tabTo(noteA);

  await userEvent.keyboard('{Tab}{Tab}');

  await expect.element(noteB).toHaveFocus();
  expect(stores.notes.getState().notes[b.id]?.z).toBe(stores.notes.getState().topZ);
  const ring = getComputedStyle(noteB.element());
  expect(ring.outlineStyle).not.toBe('none');
  expect(parseFloat(ring.outlineWidth)).toBeGreaterThanOrEqual(2);
});

it('the focus ring looks different from the Editing outline', async () => {
  const { stores, noteA, noteB } = await setup();
  stores.ui.getState().startEditing(a.id);
  await expect.element(editor(noteA)).toHaveFocus();
  const editing = getComputedStyle(noteA.element());
  await tabTo(noteB);

  // A 2 px offset alone was too close to tell apart: the line itself differs.
  expect(getComputedStyle(noteB.element()).outlineStyle).not.toBe(editing.outlineStyle);
});

it('Tab from a Note being edited to the next Note ends Editing', async () => {
  const { stores, noteA, noteB } = await setup();
  await tabTo(noteA);
  await userEvent.keyboard('{Enter}');
  await expect.element(editor(noteA)).toHaveFocus();

  await userEvent.keyboard('{Tab}');

  await expect.element(noteB).toHaveFocus();
  expect(stores.ui.getState().editingId).toBeNull();
});

it("Shift+Tab from the textarea to the Note's own × keeps Editing", async () => {
  const { stores, noteA } = await setup();
  await tabTo(noteA);
  await userEvent.keyboard('{Enter}');
  await expect.element(editor(noteA)).toHaveFocus();

  await userEvent.keyboard('{Shift>}{Tab}{/Shift}');

  await expect.element(deleteButton(noteA)).toHaveFocus();
  expect(stores.ui.getState().editingId).toBe(a.id);
});

it('Enter on a focused Note starts Editing with the caret at the end, and typing changes the text', async () => {
  const { noteA } = await setup();
  await tabTo(noteA);

  await userEvent.keyboard('{Enter}');

  await expect.element(editor(noteA)).toHaveFocus();
  const textarea = editor(noteA).element() as HTMLTextAreaElement;
  expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([5, 5]);
  await userEvent.keyboard(' there');
  // The Enter that started Editing typed no line break.
  await expect.element(editor(noteA)).toHaveValue('hello there');
});

it('Escape ends Editing and gives focus back to the Note, so Tab carries on from there', async () => {
  const { stores, noteA } = await setup();
  await tabTo(noteA);
  await userEvent.keyboard('{Enter}');
  await expect.element(editor(noteA)).toHaveFocus();

  await userEvent.keyboard('{Escape}');

  expect(stores.ui.getState().editingId).toBeNull();
  await expect.element(noteA).toHaveFocus();
  await userEvent.keyboard('{Tab}');
  await expect.element(deleteButton(noteA)).toHaveFocus();
});

it('Delete on a focused Note deletes it, shows the Undo toast and focuses the next Note', async () => {
  const { stores, toast, noteA } = await setup();
  await tabTo(noteA);

  await userEvent.keyboard('{Delete}');

  expect(stores.notes.getState().notes[a.id]).toBeUndefined();
  await expect.element(toast.getByText('Note deleted')).toBeVisible();
  // Note b, now first in the DOM.
  const first = noteA;
  await expect.element(first).toHaveFocus();
  expect(first.element().textContent).not.toContain('hello');
  expect(stores.notes.getState().ids).toEqual([b.id, c.id]);
});

it('Backspace on the last Note focuses the previous one, and on the only Note focuses the Board', async () => {
  const { stores, board, noteA, noteB } = await setup([a, b]);
  await tabTo(noteB);

  await userEvent.keyboard('{Backspace}');

  expect(stores.notes.getState().ids).toEqual([a.id]);
  await expect.element(noteA).toHaveFocus();

  await userEvent.keyboard('{Backspace}');

  expect(stores.notes.getState().ids).toEqual([]);
  await expect.element(board).toHaveFocus();
});

it('Backspace while Editing only edits the text', async () => {
  const { stores, noteA } = await setup();
  await tabTo(noteA);
  await userEvent.keyboard('{Enter}');
  await expect.element(editor(noteA)).toHaveFocus();

  await userEvent.keyboard('{Backspace}{Delete}');

  await expect.element(editor(noteA)).toHaveValue('hell');
  // Not a delete of the Note.
  expect(stores.notes.getState().notes[a.id]).toBeDefined();
  expect(stores.ui.getState().editingId).toBe(a.id);
});

it('Backspace on a focused × does not act on the Note', async () => {
  const { stores, noteA } = await setup();
  (deleteButton(noteA).element() as HTMLElement).focus();

  await userEvent.keyboard('{Backspace}');

  // Not a delete of the Note.
  expect(stores.notes.getState().notes[a.id]).toBeDefined();
  expect(stores.ui.getState().editingId).toBeNull();
});

it('Enter with a modifier, or Ctrl+Backspace, on a focused Note does nothing to it', async () => {
  const { stores, noteA } = await setup();
  await tabTo(noteA);

  await userEvent.keyboard('{Control>}{Backspace}{Enter}{/Control}{Alt>}{Delete}{/Alt}');

  // Not a delete of the Note.
  expect(stores.notes.getState().notes[a.id]).toBeDefined();
  expect(stores.ui.getState().editingId).toBeNull();
});

it('a right-button press may focus a Note, but neither Raises it nor starts Editing', async () => {
  const { stores, actions, noteB } = await setup();

  await press(noteB, { x: 100, y: 60 }, 'right');

  expect(actions).toEqual([]);
  expect(stores.ui.getState().editingId).toBeNull();
});

it('a Click on a Note does not focus it, and a drag Raises once and saves only its move', async () => {
  const { stores, actions, noteB } = await setup();

  await drag(noteB, { dx: 40, dy: 0, position: { x: 100, y: 10 } });

  expect(actions).toEqual([
    ['raise', b.id],
    ['move', b.id, 440, 100],
  ]);
  expect(document.activeElement?.closest('article')).toBeNull();

  await press(noteB, { x: 100, y: 10 });

  expect(stores.ui.getState().editingId).toBe(b.id);
});
