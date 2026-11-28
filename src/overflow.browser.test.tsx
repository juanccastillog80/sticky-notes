import type { ProfilerOnRenderCallback } from 'react';
import { beforeEach, expect, it } from 'vitest';
import { page, userEvent, type Locator } from 'vitest/browser';
import { makeNote, testId } from '../test/factories';
import { drag, press, wheel } from '../test/mouse';
import { renderApp } from '../test/renderApp';

beforeEach(async () => {
  await page.viewport(1024, 768);
});

const LONG = Array.from({ length: 30 }, (_, i) => `line ${String(i + 1)}`).join('\n');
const long = makeNote({ id: testId('long'), x: 100, y: 100, z: 1, text: LONG });
const short = makeNote({ id: testId('short'), x: 400, y: 100, z: 2, text: 'fits' });

async function setup({ onNoteRender }: { onNoteRender?: ProfilerOnRenderCallback } = {}) {
  const { screen, stores } = await renderApp(onNoteRender ? { onNoteRender } : {});
  stores.notes.getState().load([long, short]);
  const notes = screen.getByRole('article', { name: 'Note' });
  await expect.element(notes.nth(1)).toBeVisible();
  return { screen, stores, longNote: notes.nth(0), shortNote: notes.nth(1) };
}

function idleText(note: Locator): HTMLElement {
  const text = note.element().querySelector<HTMLElement>('[data-note-text]');
  if (!text) throw new Error('No idle text');
  return text;
}

function handle(note: Locator, name: string) {
  const element = note.element().querySelector(`[data-handle="${name}"]`);
  if (!element) throw new Error(`No ${name} handle`);
  return page.elementLocator(element);
}

const faded = (note: Locator) => getComputedStyle(idleText(note)).maskImage !== 'none';

it('idle text taller than its box fades out at the bottom; text that fits does not', async () => {
  const { longNote, shortNote } = await setup();

  await expect.poll(() => faded(longNote)).toBe(true);
  expect(faded(shortNote)).toBe(false);
});

it('resizing the Note until its text fits removes the fade, and smaller again brings it back', async () => {
  const { stores, shortNote } = await setup();
  // Eight lines: about 157 px of text in a box of about 128 px.
  stores.notes.getState().setText(short.id, Array.from({ length: 8 }, () => 'line').join('\n'));
  await expect.poll(() => faded(shortNote)).toBe(true);
  const se = handle(shortNote, 'se');

  await drag(se, { dx: 0, dy: 80 });
  await expect.poll(() => faded(shortNote)).toBe(false);

  await drag(se, { dx: 0, dy: -80 });
  await expect.poll(() => faded(shortNote)).toBe(true);
});

it('the wheel over overflowing idle text scrolls it, and the fade goes at the end', async () => {
  const { longNote } = await setup();
  const text = idleText(longNote);

  await wheel(longNote, 100);
  await expect.poll(() => text.scrollTop).toBeGreaterThan(0);
  expect(faded(longNote)).toBe(true);

  await wheel(longNote, 2000);
  await expect.poll(() => faded(longNote)).toBe(false);
});

/** Where, inside the Note, the left edge of character `index` of its idle text is drawn. */
function pointBeforeChar(note: Locator, index: number) {
  const node = idleText(note).firstChild;
  if (!node) throw new Error('The Note has no text');
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + 1);
  const char = range.getBoundingClientRect();
  const box = note.element().getBoundingClientRect();
  return { x: char.left - box.x + 1, y: char.top - box.y + char.height / 2 };
}

it('a click on scrolled idle text starts Editing with the caret where it landed, and the text stays put', async () => {
  const { stores, longNote } = await setup();
  await wheel(longNote, 200);
  await expect.poll(() => idleText(longNote).scrollTop).toBeGreaterThan(0);
  const index = LONG.indexOf('line 15');
  const point = pointBeforeChar(longNote, index);
  const scrolled = idleText(longNote).scrollTop;

  await press(longNote, point);

  const editor = longNote.getByRole('textbox');
  await expect.element(editor).toHaveFocus();
  const textarea = editor.element() as HTMLTextAreaElement;
  expect(stores.ui.getState().editingId).toBe(long.id);
  expect(textarea.selectionStart).toBe(index);
  expect(textarea.scrollTop).toBe(scrolled);
});

it('a press and move on overflowing idle text still drags the Note', async () => {
  const { stores, longNote } = await setup();

  await drag(longNote, { dx: 60, dy: 40 });

  expect(stores.notes.getState().notes[long.id]).toMatchObject({ x: 160, y: 140 });
  expect(stores.ui.getState().editingId).toBeNull();
});

it('when Editing ends, the idle text keeps the scroll the textarea had', async () => {
  const { longNote } = await setup();
  await press(longNote, pointBeforeChar(longNote, 0));
  const editor = longNote.getByRole('textbox');
  await expect.element(editor).toHaveFocus();
  await wheel(longNote, 150);
  const textarea = editor.element() as HTMLTextAreaElement;
  await expect.poll(() => textarea.scrollTop).toBeGreaterThan(0);
  const scrolled = textarea.scrollTop;

  await userEvent.keyboard('{Escape}');

  await expect.poll(() => idleText(longNote).scrollTop).toBe(scrolled);
  expect(faded(longNote)).toBe(true);
});

it('typing in or resizing an overflowing Note re-renders only that Note', async () => {
  const renders: string[] = [];
  const { stores, longNote } = await setup({ onNoteRender: (id) => renders.push(id) });
  await press(longNote, pointBeforeChar(longNote, 0));
  await expect.element(longNote.getByRole('textbox')).toHaveFocus();
  renders.length = 0;

  await userEvent.keyboard('xyz{Escape}');
  const se = handle(longNote, 'se');
  await drag(se, { dx: 0, dy: 60 });
  await expect.poll(() => renders).toContain('long');
  expect(stores.notes.getState().notes[long.id]).toMatchObject({ text: `xyz${LONG}`, height: 230 });

  expect(renders.filter((id) => id !== 'long')).toEqual([]);
});

it('Tab skips the scrolling text: from the × of an overflowing Note it goes to the next Note', async () => {
  const { longNote, shortNote } = await setup();
  (longNote.getByRole('button', { name: 'Delete note' }).element() as HTMLElement).focus();

  await userEvent.keyboard('{Tab}');

  await expect.element(shortNote).toHaveFocus();
});
