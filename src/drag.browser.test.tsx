import { beforeEach, expect, it } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { ProfilerOnRenderCallback } from 'react';
import { makeNote, testId } from '../test/factories';
import { drag, press, pressAndMove, release } from '../test/mouse';
import { renderApp } from '../test/renderApp';
import type { NoteAction } from './notes/notesReducer';

beforeEach(async () => {
  await page.viewport(1024, 768);
});

const a = makeNote({ id: testId('a'), x: 100, y: 100, z: 1 });
const b = makeNote({ id: testId('b'), x: 200, y: 150, z: 2 });

/** The App with Notes `a` and `b` loaded, recording every action dispatched after load. */
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
  const board = screen.getByRole('region', { name: 'Board' });
  const scroller = board.element().parentElement;
  if (!scroller) throw new Error('The Board has no scroll container');
  return { stores, actions, noteA: notes.nth(0), notes, scroller };
}

const moves = (actions: readonly NoteAction[]) =>
  actions.filter((action) => action.type === 'move');

it('dragging an idle Note moves it by the pointer delta, with exactly one move', async () => {
  const { stores, actions, noteA } = await setup();

  // Grab `a` where `b` doesn't cover it.
  await drag(noteA, { dx: 150, dy: 80, position: { x: 30, y: 30 } });

  expect(moves(actions)).toEqual([{ type: 'move', id: a.id, x: 250, y: 180 }]);
  expect(stores.notes.getSnapshot().notes[a.id]).toMatchObject({ x: 250, y: 180 });
  // The Preview is reset, and the Note is drawn where it was saved.
  expect(noteA.element().getAttribute('style')).not.toContain('transform');
  expect((noteA.element() as HTMLElement).style.left).toBe('250px');
});

it('while dragging, the Note follows the pointer and is lifted', async () => {
  const { noteA } = await setup();
  const before = noteA.element().getBoundingClientRect();

  await pressAndMove(noteA, { dx: 60, dy: 40, position: { x: 30, y: 30 } });

  const during = noteA.element().getBoundingClientRect();
  expect([during.x - before.x, during.y - before.y]).toEqual([60, 40]);
  expect(noteA.element().hasAttribute('data-dragging')).toBe(true);
  await release();
  expect(noteA.element().hasAttribute('data-dragging')).toBe(false);
});

it('scrolling the container mid-drag still lands the Note under the pointer', async () => {
  const { stores, noteA, scroller } = await setup();

  await pressAndMove(noteA, { dx: 100, dy: 50, position: { x: 30, y: 30 } });
  const scrolled = new Promise((resolve) => {
    scroller.addEventListener('scroll', resolve, { once: true });
  });
  scroller.scrollTo(300, 200);
  await scrolled;
  // The Preview already moved with the Board, before any pointer move.
  const pointerX = noteA.element().getBoundingClientRect().x + 30;
  await release();

  expect(stores.notes.getSnapshot().notes[a.id]).toMatchObject({
    x: 100 + 100 + 300,
    y: 100 + 50 + 200,
  });
  expect(noteA.element().getBoundingClientRect().x + 30).toBe(pointerX);
});

it('a press inside the Dead zone is a click, and moves nothing', async () => {
  const { actions, noteA } = await setup();

  await drag(noteA, { dx: 2, dy: 2, position: { x: 30, y: 30 } });
  await press(noteA, { x: 30, y: 30 });

  expect(moves(actions)).toEqual([]);
});

it('pressing a Note raises it, and DOM order never changes', async () => {
  const { stores, noteA, notes } = await setup();
  const domOrder = notes.elements();

  await press(noteA, { x: 30, y: 30 });

  const state = stores.notes.getSnapshot();
  expect(state.notes[a.id]?.z).toBe(3);
  expect(state.topZ).toBe(3);
  expect((noteA.element() as HTMLElement).style.zIndex).toBe('3');
  expect(notes.elements()).toEqual(domOrder);
});

it('a Note stays in front for the whole Drag', async () => {
  const { noteA } = await setup();

  // Over `b`, which was in front before the press.
  await pressAndMove(noteA, { dx: 120, dy: 60, position: { x: 30, y: 30 } });
  const aRect = noteA.element().getBoundingClientRect();
  const topmost = document.elementFromPoint(aRect.x + aRect.width / 2, aRect.y + aRect.height / 2);
  await release();

  expect(topmost?.closest('article')).toBe(noteA.element());
});

it('a dragged Note stops at the Board edges', async () => {
  const { stores, noteA } = await setup();
  const grip = noteA.element().getBoundingClientRect();

  // To a point over the top bar, past the Board's top-left corner but still in the window.
  await drag(noteA, { dx: 5 - (grip.x + 30), dy: 10 - (grip.y + 30), position: { x: 30, y: 30 } });

  expect(stores.notes.getSnapshot().notes[a.id]).toMatchObject({ x: 0, y: 0 });
});

it('Escape mid-drag puts the Note back and saves nothing', async () => {
  const { stores, actions, noteA } = await setup();
  const before = noteA.element().getBoundingClientRect();

  await pressAndMove(noteA, { dx: 150, dy: 80, position: { x: 30, y: 30 } });
  await userEvent.keyboard('{Escape}');
  await release();

  expect(moves(actions)).toEqual([]);
  expect(stores.notes.getSnapshot().notes[a.id]).toMatchObject({ x: 100, y: 100 });
  expect(noteA.element().getBoundingClientRect()).toEqual(before);
});

it('a move on Note a re-renders a and not b', async () => {
  const renders: string[] = [];
  const { noteA } = await setup({ onNoteRender: (id) => renders.push(id) });
  renders.length = 0;

  await drag(noteA, { dx: 150, dy: 80, position: { x: 30, y: 30 } });

  expect(renders).toContain('a');
  expect(renders).not.toContain('b');
});
