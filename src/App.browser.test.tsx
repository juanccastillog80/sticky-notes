import { beforeEach, expect, it } from 'vitest';
import { page, userEvent, type Locator } from 'vitest/browser';
import { makeNote } from '../test/factories';
import { renderApp } from '../test/renderApp';

beforeEach(async () => {
  await page.viewport(1024, 768);
});

async function setup() {
  const { screen, stores } = await renderApp();
  const board = screen.getByRole('region', { name: 'Board' });
  const scroller = scrollContainerOf(board.element());
  return { screen, stores, board, scroller, notes: screen.getByRole('article', { name: 'Note' }) };
}

function scrollContainerOf(element: Element): Element {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (getComputedStyle(parent).overflowX === 'auto') return parent;
  }
  throw new Error('The Board has no scroll container');
}

/** An element's rect in Board coordinates. */
function rectOnBoard(element: Element, board: Locator) {
  const { x, y, width, height } = element.getBoundingClientRect();
  const origin = board.element().getBoundingClientRect();
  return { x: x - origin.x, y: y - origin.y, width, height };
}

/** Real input lands on device pixels, so a pointer position can be a pixel out. */
function expectWithinAPixel(actual: number, expected: number) {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1);
}

it('double-clicking empty Board creates a default-size Note centred on the pointer', async () => {
  const { board, notes } = await setup();

  await userEvent.dblClick(board, { position: { x: 400, y: 300 } });

  await expect.element(notes).toBeVisible();
  const note = rectOnBoard(notes.element(), board);
  // 220×170 is the default (Medium) size.
  expect(note).toMatchObject({ width: 220, height: 170 });
  expectWithinAPixel(note.x + 110, 400);
  expectWithinAPixel(note.y + 85, 300);
});

it('double-clicking a scrolled Board still centres the Note on the pointer', async () => {
  const { board, scroller, notes } = await setup();
  scroller.scrollTo(500, 200);

  await userEvent.dblClick(board, { position: { x: 900, y: 500 } });

  await expect.element(notes).toBeVisible();
  const note = rectOnBoard(notes.element(), board);
  expectWithinAPixel(note.x + 110, 900);
  expectWithinAPixel(note.y + 85, 500);
});

it('double-clicking a Note creates nothing', async () => {
  const { board, notes } = await setup();
  await userEvent.dblClick(board, { position: { x: 400, y: 300 } });
  await expect.element(notes).toBeVisible();

  // The Grip strip, then the body: both are inside the Note.
  await userEvent.dblClick(notes, { position: { x: 110, y: 10 } });
  await userEvent.dblClick(notes, { position: { x: 110, y: 100 } });

  expect(notes.elements()).toHaveLength(1);
});

it('a double-click that starts on a Note creates nothing', async () => {
  const { board, stores, notes } = await setup();
  const note = makeNote({ x: 100, y: 100 });
  stores.notes.dispatch({ type: 'load', notes: [note] });
  await expect.element(notes).toBeVisible();
  // Move the Note after the first click, so the second lands on empty Board.
  notes.element().addEventListener(
    'click',
    () => {
      stores.notes.dispatch({ type: 'load', notes: [{ ...note, x: 600 }] });
    },
    { once: true },
  );

  await userEvent.dblClick(board, { position: { x: 200, y: 200 }, delay: 50 });

  expect(rectOnBoard(notes.first().element(), board).x).toBe(600);
  expect(notes.elements()).toHaveLength(1);
});

it('a double-click that starts outside the Board creates nothing', async () => {
  const { screen, board, notes } = await setup();
  // An earlier press on empty Board, which must not count towards the double-click.
  await userEvent.click(board, { position: { x: 700, y: 400 } });
  const topBar = screen.getByRole('banner').element() as HTMLElement;
  // Shrink the top bar after the first click, so the second lands on empty Board.
  topBar.addEventListener(
    'click',
    () => {
      topBar.style.height = '24px';
    },
    { once: true },
  );
  let target: EventTarget | null = null;
  board.element().addEventListener('dblclick', (event) => (target = event.target));

  await userEvent.dblClick(document.body, { position: { x: 500, y: 40 }, delay: 50 });

  expect(target).toBe(board.element());
  expect(notes.elements()).toHaveLength(0);
});

it('a Note created near the edge is pushed fully inside the Board', async () => {
  const { board, notes } = await setup();

  await userEvent.dblClick(board, { position: { x: 8, y: 8 } });

  await expect.element(notes).toBeVisible();
  expect(rectOnBoard(notes.element(), board)).toMatchObject({ x: 0, y: 0 });
});

it('shows the empty hint only while there are no Notes', async () => {
  const { screen, stores, board } = await setup();
  const hint = screen.getByText('Double-click anywhere to add a note');
  await expect.element(hint).toBeVisible();

  await userEvent.dblClick(board, { position: { x: 100, y: 100 } });
  await expect.element(hint).not.toBeInTheDocument();

  stores.notes.dispatch({ type: 'load', notes: [] });
  await expect.element(hint).toBeVisible();
});

it('a double-click on the empty hint reaches the Board under it', async () => {
  const { screen, board, notes } = await setup();
  const hint = screen.getByText('Double-click anywhere to add a note');
  await expect.element(hint).toBeVisible();
  const { x, y, width, height } = rectOnBoard(hint.element(), board);

  await userEvent.dblClick(board, { position: { x: x + width / 2, y: y + height / 2 } });

  await expect.element(notes).toBeVisible();
});

it.each([
  { size: 'small', width: 160, height: 120 },
  { size: 'medium', width: 220, height: 170 },
  { size: 'large', width: 300, height: 230 },
])(
  'the $size button creates a Note centred in the visible part of the Board',
  async ({ size, width, height }) => {
    const { screen, board, scroller, notes } = await setup();
    // Headless scrollbars take no space, so borders stand in for 16 px ones.
    (scroller as HTMLElement).style.border = 'solid transparent';
    (scroller as HTMLElement).style.borderWidth = '0 16px 16px 0';
    scroller.scrollTo(500, 200);

    await userEvent.click(screen.getByRole('button', { name: `New ${size} note` }));

    await expect.element(notes).toBeVisible();
    const note = rectOnBoard(notes.element(), board);
    expect(note).toMatchObject({ width, height });
    // 1024×768, less the 48 px top bar and the scrollbars: 1008×704 is visible.
    expectWithinAPixel(note.x + width / 2, 500 + 504);
    expectWithinAPixel(note.y + height / 2, 200 + 352);
  },
);

it('pressing a size button again cascades the new Note by (24, 24)', async () => {
  const { screen, board, notes } = await setup();
  const button = screen.getByRole('button', { name: 'New medium note' });

  await userEvent.click(button);
  await userEvent.click(button);
  await userEvent.click(button);

  await expect.element(notes.nth(2)).toBeVisible();
  const [first, second, third] = notes.elements().map((note) => rectOnBoard(note, board));
  if (!first || !second || !third) throw new Error('Expected three Notes');
  expect([second.x - first.x, second.y - first.y]).toEqual([24, 24]);
  expect([third.x - second.x, third.y - second.y]).toEqual([24, 24]);
});

it('the 1920×1080 Board scrolls in its container while the top bar stays put', async () => {
  const { screen, board, scroller } = await setup();
  const topBar = screen.getByRole('banner');

  expect(board.element().getBoundingClientRect()).toMatchObject({
    x: 0,
    y: 48,
    width: 1920,
    height: 1080,
  });

  scroller.scrollTo(10_000, 10_000);

  const end = board.element().getBoundingClientRect();
  const visible = scroller.getBoundingClientRect();
  // The Board's far edge comes into view, with backdrop beyond it.
  expect(end.right).toBeLessThan(visible.left + scroller.clientWidth);
  expect(end.bottom).toBeLessThan(visible.top + scroller.clientHeight);
  expect(topBar.element().getBoundingClientRect()).toMatchObject({ x: 0, y: 0, height: 48 });
  expect(document.documentElement.scrollWidth).toBe(1024);
  expect(document.documentElement.scrollHeight).toBe(768);
});
