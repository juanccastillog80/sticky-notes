import { beforeEach, expect, it } from 'vitest';
import { page, userEvent, type Locator } from 'vitest/browser';
import type { ProfilerOnRenderCallback } from 'react';
import { NOTE_COLOURS, type NoteColour } from './notes/note';
import { makeNote, testId } from '../test/factories';
import { press } from '../test/mouse';
import { renderApp } from '../test/renderApp';

beforeEach(async () => {
  await page.viewport(1024, 768);
});

const a = makeNote({ id: testId('a'), x: 100, y: 100, z: 1, text: 'hello world' });
const b = makeNote({ id: testId('b'), x: 400, y: 100, z: 2 });

async function setup({ onNoteRender }: { onNoteRender?: ProfilerOnRenderCallback } = {}) {
  const { screen, stores } = await renderApp(onNoteRender ? { onNoteRender } : {});
  stores.notes.dispatch({ type: 'load', notes: [a, b] });
  const notes = screen.getByRole('article', { name: 'Note' });
  await expect.element(notes.nth(1)).toBeVisible();
  const colours = screen.getByRole('group', { name: 'Colour' });
  const swatch = (colour: NoteColour) => colours.getByRole('button', { name: capitalise(colour) });
  return { screen, stores, noteA: notes.nth(0), colours, swatch };
}

function capitalise(colour: NoteColour) {
  return colour.charAt(0).toUpperCase() + colour.slice(1);
}

const strip = (note: Locator) => note.element().firstElementChild as HTMLElement;
const background = (element: Element) => getComputedStyle(element).backgroundColor;

it('each colour has its own background, strip and Editing-strip shade', async () => {
  const { stores, noteA } = await setup();
  const seen = new Set<string>();

  for (const colour of NOTE_COLOURS) {
    stores.ui.dispatch({ type: 'stopEditing' });
    stores.notes.dispatch({ type: 'setColour', id: a.id, colour });
    await expect.element(noteA).toHaveAttribute('data-colour', colour);
    const idle = [background(noteA.element()), background(strip(noteA))];
    stores.ui.dispatch({ type: 'startEditing', id: a.id });
    await expect.element(noteA).toHaveAttribute('data-editing');
    const editingStrip = background(strip(noteA));

    expect(new Set([...idle, editingStrip]).size).toBe(3);
    for (const shade of [...idle, editingStrip]) {
      expect(shade).not.toBe('rgba(0, 0, 0, 0)');
      seen.add(shade);
    }
  }

  expect(seen.size).toBe(NOTE_COLOURS.length * 3);
});

it('while Editing, a swatch recolours that Note and sets the Current colour, keeping focus and caret', async () => {
  const { stores, noteA, swatch } = await setup();
  await press(noteA, { x: 20, y: 40 });
  const editor = noteA.getByRole('textbox');
  await expect.element(editor).toHaveFocus();
  const textarea = editor.element() as HTMLTextAreaElement;
  textarea.setSelectionRange(3, 3);

  await press(swatch('pink'));

  await expect.element(noteA).toHaveAttribute('data-colour', 'pink');
  expect(stores.notes.getSnapshot().notes[b.id]?.colour).toBe('yellow');
  expect(stores.ui.getSnapshot().currentColour).toBe('pink');
  await expect.element(editor).toHaveFocus();
  expect([textarea.selectionStart, textarea.selectionEnd]).toEqual([3, 3]);
  expect(stores.ui.getSnapshot().editingId).toBe(a.id);
});

it('while not Editing, a swatch sets only the Current colour, and the next Note uses it', async () => {
  const { screen, stores, swatch } = await setup();

  await press(swatch('green'));

  expect(stores.ui.getSnapshot().currentColour).toBe('green');
  expect(Object.values(stores.notes.getSnapshot().notes).map((note) => note.colour)).toEqual([
    'yellow',
    'yellow',
  ]);

  await userEvent.click(screen.getByRole('button', { name: 'New medium note' }));

  const created = screen.getByRole('article', { name: 'Note' }).nth(2);
  await expect.element(created).toHaveAttribute('data-colour', 'green');
});

it('the label, the pressed swatch and the New-button glyphs track the state', async () => {
  const { screen, stores, noteA, colours, swatch } = await setup();
  const glyph = () =>
    screen.getByRole('button', { name: 'New small note' }).element().querySelector('[data-colour]');

  await expect.element(colours).toHaveTextContent('next note');
  await expect.element(swatch('yellow')).toHaveAttribute('aria-pressed', 'true');
  expect(glyph()?.getAttribute('data-colour')).toBe('yellow');

  await press(swatch('blue'));
  await expect.element(swatch('blue')).toHaveAttribute('aria-pressed', 'true');
  await expect.element(swatch('yellow')).toHaveAttribute('aria-pressed', 'false');
  expect(glyph()?.getAttribute('data-colour')).toBe('blue');

  // Note a is still yellow: while it is edited, the swatches show its colour.
  await press(noteA, { x: 20, y: 40 });
  await expect.element(colours).toHaveTextContent('this note');
  await expect.element(swatch('yellow')).toHaveAttribute('aria-pressed', 'true');
  expect(stores.ui.getSnapshot().currentColour).toBe('blue');
});

it('setColour on Note a re-renders a and not b', async () => {
  const renders: string[] = [];
  const { stores } = await setup({ onNoteRender: (id) => renders.push(id) });
  renders.length = 0;

  stores.notes.dispatch({ type: 'setColour', id: a.id, colour: 'purple' });
  await expect.poll(() => renders).toContain('a');

  expect(renders).not.toContain('b');
});
