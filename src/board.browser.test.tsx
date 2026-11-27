import { beforeEach, expect, it } from 'vitest';
import { page, type Locator } from 'vitest/browser';
import { makeNote, testId } from '../test/factories';
import { drag } from '../test/mouse';
import { renderApp } from '../test/renderApp';

// The top bar is 48 px high; the backdrop past the Board's right and bottom edges is 24 px.
const TOP_BAR = 48;
const END_GAP = 24;

beforeEach(async () => {
  await page.viewport(1024, 768);
});

/** The App with `notes` loaded. */
async function setup(...notes: ReturnType<typeof makeNote>[]) {
  const { screen, stores } = await renderApp();
  stores.notes.getState().load(notes);
  const board = screen.getByRole('region', { name: 'Board' });
  const scroller = board.element().parentElement;
  if (!scroller) throw new Error('The Board has no scroll container');
  const noteList = screen.getByRole('article', { name: 'Note' });
  if (notes.length > 0) await expect.element(noteList.nth(notes.length - 1)).toBeVisible();
  return { stores, board: board.element(), scroller, notes: noteList };
}

const sizeOf = (element: Element) => {
  const { width, height } = element.getBoundingClientRect();
  return { width, height };
};

const hasScrollbars = (scroller: Element) =>
  scroller.scrollWidth > scroller.clientWidth || scroller.scrollHeight > scroller.clientHeight;

const handle = (note: Locator, name: string) => {
  const element = note.element().querySelector(`[data-handle="${name}"]`);
  if (!element) throw new Error(`No ${name} handle`);
  return page.elementLocator(element);
};

it.each([
  [1024, 768],
  [1920, 1080],
])('an empty Board fits a %i×%i window, with no scrollbars', async (width, height) => {
  await page.viewport(width, height);
  const { board, scroller } = await setup();

  expect(hasScrollbars(scroller)).toBe(false);
  expect(sizeOf(board)).toEqual({ width: width - END_GAP, height: height - TOP_BAR - END_GAP });
});

it('Notes that fit in the window add no scrollbars', async () => {
  const { scroller } = await setup(makeNote({ x: 780, y: 526 }));

  expect(hasScrollbars(scroller)).toBe(false);
});

it('growing the window makes the Board grow at once', async () => {
  const { board } = await setup();

  await page.viewport(1400, 900);

  expect(sizeOf(board)).toEqual({ width: 1400 - END_GAP, height: 900 - TOP_BAR - END_GAP });
});

it('shrinking the window keeps a Note where it is stored, and the Board scrolls to it', async () => {
  const corner = makeNote({ id: testId('corner'), x: 760, y: 500 });
  const { stores, board, scroller, notes } = await setup(corner);

  await page.viewport(800, 600);

  expect(stores.notes.getState().notes[corner.id]).toMatchObject({ x: 760, y: 500 });
  // The Board holds the Note: its far edges are the Note's.
  expect(sizeOf(board)).toEqual({ width: 980, height: 670 });
  expect(hasScrollbars(scroller)).toBe(true);

  scroller.scrollTo(99999, 99999);
  const note = notes.element().getBoundingClientRect();
  const view = scroller.getBoundingClientRect();
  expect(note.right).toBeLessThanOrEqual(view.left + scroller.clientWidth);
  expect(note.bottom).toBeLessThanOrEqual(view.top + scroller.clientHeight);
});

// Each Note is pushed at one edge only: the Trash zone sits in the bottom-right corner.
const right = makeNote({ id: testId('right'), x: 700, y: 100 });
const low = makeNote({ id: testId('low'), x: 100, y: 450 });

it('a Note cannot be moved past the visible Board edge', async () => {
  const { stores, board, notes } = await setup(right, low);

  await drag(notes.nth(0), { dx: 250, dy: 0, position: { x: 30, y: 30 } });
  await drag(notes.nth(1), { dx: 0, dy: 200, position: { x: 30, y: 30 } });

  // 1000 × 696 is the Board in a 1024×768 window.
  const saved = stores.notes.getState().notes;
  expect(saved[right.id]).toMatchObject({ x: 1000 - 220, y: 100 });
  expect(saved[low.id]).toMatchObject({ x: 100, y: 696 - 170 });
  expect(sizeOf(board)).toEqual({ width: 1000, height: 696 });
});

it('a Note cannot be resized past the visible Board edge', async () => {
  const { stores, board, notes } = await setup(right, low);

  await drag(handle(notes.nth(0), 'e'), { dx: 90, dy: 0 });
  await drag(handle(notes.nth(1), 's'), { dx: 0, dy: 90 });

  const saved = stores.notes.getState().notes;
  expect(saved[right.id]).toMatchObject({ x: 700, width: 1000 - 700 });
  expect(saved[low.id]).toMatchObject({ y: 450, height: 696 - 450 });
  expect(sizeOf(board)).toEqual({ width: 1000, height: 696 });
});
