import { beforeEach, expect, it } from 'vitest';
import { page, userEvent, type Locator } from 'vitest/browser';
import type { ProfilerOnRenderCallback } from 'react';
import { makeNote, testId } from '../test/factories';
import { drag, press, pressAndMove, release } from '../test/mouse';
import { renderApp } from '../test/renderApp';

beforeEach(async () => {
  await page.viewport(1024, 768);
});

const a = makeNote({ id: testId('a'), x: 100, y: 100, z: 1, text: 'hello world' });
const b = makeNote({ id: testId('b'), x: 400, y: 100, z: 2 });
const c = makeNote({ id: testId('c'), x: 700, y: 100, z: 3 });

async function setup({ onNoteRender }: { onNoteRender?: ProfilerOnRenderCallback } = {}) {
  const { screen, stores } = await renderApp(onNoteRender ? { onNoteRender } : {});
  stores.notes.dispatch({ type: 'load', notes: [a, b, c] });
  const notes = screen.getByRole('article', { name: 'Note' });
  await expect.element(notes.nth(2)).toBeVisible();
  const board = screen.getByRole('region', { name: 'Board' });
  return { stores, notes, noteA: notes.nth(0), noteB: notes.nth(1), board };
}

const editor = (note: Locator) => note.getByRole('textbox');
const focused = () => document.activeElement as HTMLTextAreaElement | null;

/** Where, inside the Note, the left edge of character `index` of its idle text is drawn. */
function pointBeforeChar(note: Locator, index: number) {
  const text = note.element().querySelector('[data-note-text]');
  const node = text?.firstChild;
  if (!node) throw new Error('The Note has no text');
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + 1);
  const char = range.getBoundingClientRect();
  const box = note.element().getBoundingClientRect();
  return { x: char.left - box.x + 1, y: char.top - box.y + char.height / 2 };
}

/** A Click on Note a that leaves the caret before `world`. */
async function editABeforeWorld(noteA: Locator) {
  await press(noteA, pointBeforeChar(noteA, 6));
  await expect.element(editor(noteA)).toHaveFocus();
}

it('a click inside the Dead zone starts Editing, with the caret where it landed (scenario 2)', async () => {
  const { stores, noteA } = await setup();

  await editABeforeWorld(noteA);

  expect(stores.ui.getSnapshot().editingId).toBe(a.id);
  expect(focused()?.selectionStart).toBe(6);
  expect(focused()?.selectionEnd).toBe(6);
  expect(noteA.element().hasAttribute('data-editing')).toBe(true);
});

it('keeps text exactly as typed, line breaks included', async () => {
  const { stores, noteA } = await setup();
  await editABeforeWorld(noteA);

  await userEvent.keyboard('big{Enter}');

  expect(stores.notes.getSnapshot().notes[a.id]?.text).toBe('hello big\nworld');
});

it('the text does not shift when Editing starts or ends', async () => {
  const { noteA } = await setup();
  const idle = noteA.element().querySelector<HTMLElement>('[data-note-text]');
  if (!idle) throw new Error('No idle text');
  const before = idle.getBoundingClientRect();
  const style = (element: Element) => {
    const s = getComputedStyle(element);
    return [s.paddingTop, s.paddingLeft, s.fontFamily, s.fontSize, s.lineHeight, s.letterSpacing];
  };
  const idleStyle = style(idle);

  await editABeforeWorld(noteA);
  const textarea = editor(noteA).element();

  expect(textarea.getBoundingClientRect()).toEqual(before);
  expect(style(textarea)).toEqual(idleStyle);
});

it('double-clicking empty Board creates a Note centred on the pointer, already in Editing (scenario 5)', async () => {
  const { stores, notes, board } = await setup();

  await board.dblClick({ position: { x: 500, y: 500 } });

  const created = notes.nth(3);
  await expect.element(editor(created)).toHaveFocus();
  const id = stores.notes.getSnapshot().ids[3];
  expect(stores.ui.getSnapshot().editingId).toBe(id);
  expect(stores.notes.getSnapshot().notes[id ?? testId('none')]).toMatchObject({
    x: 500 - 110,
    y: 500 - 85,
  });
});

it('dragging the Grip strip while Editing moves the Note, and focus and caret survive', async () => {
  const { stores, noteA } = await setup();
  await editABeforeWorld(noteA);

  await drag(noteA, { dx: 120, dy: 60, position: { x: 100, y: 10 } });

  expect(stores.notes.getSnapshot().notes[a.id]).toMatchObject({ x: 220, y: 160 });
  await expect.element(editor(noteA)).toHaveFocus();
  expect(focused()?.selectionStart).toBe(6);
  expect(stores.ui.getSnapshot().editingId).toBe(a.id);
});

it('dragging inside the text while Editing selects text and moves nothing', async () => {
  const { stores, noteA } = await setup();
  const textStart = pointBeforeChar(noteA, 0);
  await editABeforeWorld(noteA);

  await drag(noteA, { dx: 40, dy: 0, position: textStart });

  expect(stores.notes.getSnapshot().notes[a.id]).toMatchObject({ x: 100, y: 100 });
  expect(focused()?.selectionEnd).toBeGreaterThan(focused()?.selectionStart ?? 0);
});

it('Escape ends Editing and focuses the Note', async () => {
  const { stores, noteA } = await setup();
  await editABeforeWorld(noteA);

  await userEvent.keyboard('{Escape}');

  expect(stores.ui.getSnapshot().editingId).toBeNull();
  await expect.element(editor(noteA)).not.toBeInTheDocument();
  await expect.element(noteA).toHaveFocus();
});

it('a press on empty Board ends Editing', async () => {
  const { stores, noteA, board } = await setup();
  await editABeforeWorld(noteA);

  await press(board, { x: 500, y: 500 });

  expect(stores.ui.getSnapshot().editingId).toBeNull();
  // The Board is focusable, for when the last Note is deleted from the keyboard.
  expect(document.activeElement).toBe(board.element());
});

it('a press on another Note ends Editing', async () => {
  const { stores, noteA, noteB } = await setup();
  await editABeforeWorld(noteA);

  // On b's strip, so the press is not a Click that starts Editing b.
  await drag(noteB, { dx: 50, dy: 0, position: { x: 100, y: 10 } });

  expect(stores.ui.getSnapshot().editingId).toBeNull();
  expect(document.activeElement).toBe(document.body);
});

it('setText on Note a re-renders a and not b', async () => {
  const renders: string[] = [];
  const { stores } = await setup({ onNoteRender: (id) => renders.push(id) });
  renders.length = 0;

  stores.notes.dispatch({ type: 'setText', id: a.id, text: 'changed' });
  await expect.poll(() => renders).toContain('a');

  expect(renders).not.toContain('b');
});

it('a change of Editing re-renders only the two Notes involved', async () => {
  const renders: string[] = [];
  const { stores } = await setup({ onNoteRender: (id) => renders.push(id) });
  stores.ui.dispatch({ type: 'startEditing', id: a.id });
  await expect.poll(() => renders).toContain('a');
  renders.length = 0;

  stores.ui.dispatch({ type: 'startEditing', id: b.id });
  await expect.poll(() => renders).toContain('b');

  expect(new Set(renders)).toEqual(new Set(['a', 'b']));
});

it("a press on another Note's resize handle ends Editing", async () => {
  const { stores, noteA, noteB } = await setup();
  await editABeforeWorld(noteA);
  const se = noteB.element().querySelector('[data-handle="se"]');
  if (!se) throw new Error('No se handle');

  await drag(page.elementLocator(se), { dx: 20, dy: 20 });

  expect(stores.ui.getSnapshot().editingId).toBeNull();
  expect(document.activeElement).toBe(document.body);
});

it('Escape during a strip Drag cancels the Drag and keeps Editing', async () => {
  const { stores, noteA } = await setup();
  await editABeforeWorld(noteA);

  await pressAndMove(noteA, { dx: 80, dy: 0, position: { x: 100, y: 10 } });
  await userEvent.keyboard('{Escape}');
  await release();

  expect(stores.notes.getSnapshot().notes[a.id]).toMatchObject({ x: 100, y: 100 });
  expect(stores.ui.getSnapshot().editingId).toBe(a.id);
  await expect.element(editor(noteA)).toHaveFocus();
});
