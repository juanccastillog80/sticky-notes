import { beforeEach, expect, it } from 'vitest';
import { commands, page, type Locator } from 'vitest/browser';
import { makeNote, testId } from '../test/factories';
import { drag, pointIn, pressAndMove, release } from '../test/mouse';
import { renderApp } from '../test/renderApp';

beforeEach(async () => {
  await page.viewport(1024, 768);
});

const a = makeNote({ id: testId('a'), x: 100, y: 100, z: 1, text: 'drop me', colour: 'yellow' });
const b = makeNote({ id: testId('b'), x: 400, y: 100, z: 2 });
const big = makeNote({ id: testId('big'), x: 100, y: 300, width: 400, height: 300, z: 3 });

async function setup() {
  const { screen, stores } = await renderApp();
  stores.notes.getState().load([a, b, big]);
  const notes = screen.getByRole('article', { name: 'Note' });
  await expect.element(notes.nth(1)).toBeVisible();
  const zone = screen.getByText('Drop to delete').element().parentElement;
  if (!zone) throw new Error('No Trash zone');
  const scroller = screen.getByRole('region', { name: 'Board' }).element().parentElement;
  if (!scroller) throw new Error('The Board has no scroll container');
  return {
    screen,
    stores,
    noteA: notes.nth(0),
    noteBig: notes.nth(2),
    zone,
    scroller,
    toast: screen.getByRole('status'),
  };
}

/**
 * Real mouse input: press `note` at `grab` (a point inside it), then move until its
 * top-left is at the client point `topLeft`. Returns where the pointer ends up.
 */
async function pressAndMoveTo(
  note: Locator,
  topLeft: { x: number; y: number },
  grab: { x: number; y: number },
) {
  const rect = note.element().getBoundingClientRect();
  return pressAndMove(note, { dx: topLeft.x - rect.x, dy: topLeft.y - rect.y, position: grab });
}

/** From a point 30 px into the Note to the client point `to`. */
function deltaTo(note: Locator, to: { x: number; y: number }) {
  const position = { x: 30, y: 30 };
  const from = pointIn(note, position);
  return { dx: to.x - from.x, dy: to.y - from.y, position };
}

const centreOf = (element: Element) => pointIn(page.elementLocator(element));

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

it('is quiet, armed while a move runs, and over (with the Note marked) while the Note overlaps it', async () => {
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

  expect(stores.notes.getState().notes[a.id]).toBeUndefined();
  expect(zone.dataset.state).toBe('quiet');
  await expect.element(toast.getByText('Note deleted')).toBeVisible();

  await toast.getByRole('button', { name: 'Undo' }).click();

  // The Press Raised it above the others before the drop, and Undo keeps that place.
  expect(stores.notes.getState().notes[a.id]).toEqual({ ...a, z: 4 });
});

it('a large Note grabbed by its far edge, released with the pointer outside the zone, is deleted when it overlaps the zone', async () => {
  const { stores, noteBig, zone, toast } = await setup();
  const target = zone.getBoundingClientRect();

  // Grabbed 20 px in from its left edge; its right edge ends 40 px into the zone, so the
  // pointer stops 340 px left of the zone.
  const pointer = await pressAndMoveTo(
    noteBig,
    { x: target.x + 40 - 400, y: target.y - 100 },
    { x: 20, y: 150 },
  );
  expect(pointer.x).toBeLessThan(target.x - 300);
  expect(zone.dataset.state).toBe('over');
  await release();

  expect(stores.notes.getState().notes[big.id]).toBeUndefined();
  await expect.element(toast.getByText('Note deleted')).toBeVisible();
});

it('a Note released next to the zone without overlapping it is moved, not deleted', async () => {
  const { stores, noteA, zone } = await setup();
  const target = zone.getBoundingClientRect();
  const boardTop = noteA.element().getBoundingClientRect().y - a.y;

  // Its right edge stops 10 px left of the zone.
  await pressAndMoveTo(noteA, { x: target.x - 10 - a.width, y: target.y }, { x: 30, y: 30 });
  expect(zone.dataset.state).toBe('armed');
  await release();

  expect(stores.notes.getState().notes[a.id]).toMatchObject({
    x: Math.round(target.x - 10 - a.width),
    y: Math.round(target.y - boardTop),
  });
});

it("still decides by the Note's place on screen after the Board scrolls during the Drag", async () => {
  const { stores, noteA, zone, scroller } = await setup();
  const target = zone.getBoundingClientRect();
  const grab = { x: 30, y: 30 };
  const start = await pressAndMove(noteA, { dx: 40, dy: 40, position: grab });

  scroller.scrollTo(200, 100);
  await expect.poll(() => scroller.scrollTop).toBe(100);
  await new Promise(requestAnimationFrame);
  // The Note moved on the Board with the scroll, so it stays under the still pointer.
  expect(noteA.element().getBoundingClientRect()).toMatchObject({
    x: start.x - grab.x,
    y: start.y - grab.y,
  });

  // 10 px left of the zone: not over it.
  const beside = { x: target.x - 10 - a.width + grab.x, y: target.y + grab.y };
  await commands.mouse([{ type: 'move', ...beside, steps: 10 }]);
  expect(zone.dataset.state).toBe('armed');

  // 20 px into it, with the pointer still well left of it.
  await commands.mouse([{ type: 'move', x: beside.x + 30, y: beside.y, steps: 5 }]);
  expect(zone.dataset.state).toBe('over');
  await release();

  expect(stores.notes.getState().notes[a.id]).toBeUndefined();
});

it('a double-click on the zone creates nothing', async () => {
  const { stores, screen } = await setup();

  await screen.getByText('Drop to delete').dblClick();

  expect(stores.notes.getState().ids).toEqual([a.id, b.id, big.id]);
});

it.each([
  ['scrolled all the way to the bottom-right', 1024, 768],
  ['in a window larger than the Board', 2400, 1400],
])('stays over the Board when %s', async (_, width, height) => {
  await page.viewport(width, height);
  const { zone, scroller } = await setup();
  const board = scroller.firstElementChild;
  if (!board) throw new Error('No Board');

  scroller.scrollTo(99999, 99999);
  await new Promise(requestAnimationFrame);

  const z = zone.getBoundingClientRect();
  const b = board.getBoundingClientRect();
  expect(z.right).toBeLessThanOrEqual(b.right - 14);
  expect(z.bottom).toBeLessThanOrEqual(b.bottom - 14);
});
