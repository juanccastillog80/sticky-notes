import { beforeEach, expect, it } from 'vitest';
import { commands, page, type Locator } from 'vitest/browser';
import { makeNote, testId } from '../test/factories';
import { drag, pressAndMove } from '../test/mouse';
import { renderApp } from '../test/renderApp';

beforeEach(async () => {
  await page.viewport(1024, 768);
});

const a = makeNote({ id: testId('a'), x: 100, y: 100, z: 1, text: 'bin me', colour: 'yellow' });
const b = makeNote({ id: testId('b'), x: 400, y: 100, z: 2 });

async function setup() {
  const { screen, stores } = await renderApp();
  stores.notes.dispatch({ type: 'load', notes: [a, b] });
  const notes = screen.getByRole('article', { name: 'Note' });
  await expect.element(notes.nth(1)).toBeVisible();
  const zone = screen.getByText('Drop to delete').element().parentElement;
  if (!zone) throw new Error('No Trash zone');
  const scroller = screen.getByRole('region', { name: 'Board' }).element().parentElement;
  if (!scroller) throw new Error('The Board has no scroll container');
  return { screen, stores, noteA: notes.nth(0), zone, scroller, toast: screen.getByRole('status') };
}

/** From a point 30 px into the Note to the client point `to`. */
function deltaTo(note: Locator, to: { x: number; y: number }) {
  const rect = note.element().getBoundingClientRect();
  return { dx: to.x - (rect.x + 30), dy: to.y - (rect.y + 30), position: { x: 30, y: 30 } };
}

function centreOf(element: Element) {
  const rect = element.getBoundingClientRect();
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

it('sits in the bottom-right of the window, 104×104, above the Notes, however far the Board is scrolled', async () => {
  const { zone, scroller } = await setup();
  const before = zone.getBoundingClientRect();

  scroller.scrollTo(800, 300);
  await expect.poll(() => scroller.scrollLeft).toBe(800);

  expect(zone.getBoundingClientRect().toJSON()).toEqual(before.toJSON());
  expect([before.width, before.height]).toEqual([104, 104]);
  // Inside the scrollbars, near the window's corner.
  expect(before.right).toBeGreaterThan(1024 - 60);
  expect(before.right).toBeLessThanOrEqual(
    scroller.getBoundingClientRect().x + scroller.clientWidth,
  );
  expect(before.bottom).toBeGreaterThan(768 - 60);
  expect(before.bottom).toBeLessThanOrEqual(
    scroller.getBoundingClientRect().y + scroller.clientHeight,
  );
});

it('is quiet, armed while a move runs, and over (with the Note marked) while the pointer is inside it', async () => {
  const { noteA, zone } = await setup();
  expect(zone.dataset.state).toBe('quiet');

  const { x, y } = await pressAndMove(noteA, { dx: 80, dy: 40, position: { x: 30, y: 30 } });
  expect(zone.dataset.state).toBe('armed');
  expect(noteA.element().hasAttribute('data-over-trash')).toBe(false);

  await commands.mouse([{ type: 'move', ...centreOf(zone), steps: 10 }]);
  expect(zone.dataset.state).toBe('over');
  expect(noteA.element().hasAttribute('data-over-trash')).toBe(true);

  // Back out, and let go: no delete.
  await commands.mouse([{ type: 'move', x, y, steps: 10 }, { type: 'up' }]);
  expect(zone.dataset.state).toBe('quiet');
  expect(noteA.element().hasAttribute('data-over-trash')).toBe(false);
});

it('a drop on the Trash zone deletes the Note and shows the toast; Undo restores the same Note', async () => {
  const { stores, noteA, zone, toast } = await setup();

  await drag(noteA, deltaTo(noteA, centreOf(zone)));

  expect(stores.notes.getSnapshot().notes[a.id]).toBeUndefined();
  expect(zone.dataset.state).toBe('quiet');
  await expect.element(toast.getByText('Note deleted')).toBeVisible();

  await toast.getByRole('button', { name: 'Undo' }).click();

  // The Press Raised it above `b` before the drop, and Undo keeps that place.
  expect(stores.notes.getSnapshot().notes[a.id]).toEqual({ ...a, z: 3 });
});

it('a large Note brushing the zone with the pointer outside it is moved, not deleted', async () => {
  const { stores, noteA, zone } = await setup();
  const target = zone.getBoundingClientRect();

  // The pointer stops 20 px left of the zone; the 220-wide Note reaches well into it.
  await drag(noteA, deltaTo(noteA, { x: target.x - 20, y: target.y + 50 }));

  const moved = stores.notes.getSnapshot().notes[a.id];
  expect(moved).toBeDefined();
  expect(moved?.x).not.toBe(a.x);
});

it('a double-click on the zone creates nothing', async () => {
  const { stores, screen } = await setup();

  await screen.getByText('Drop to delete').dblClick();

  expect(stores.notes.getSnapshot().ids).toEqual([a.id, b.id]);
});
