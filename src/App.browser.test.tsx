import { beforeEach, expect, it } from 'vitest';
import { page, userEvent, type Locator } from 'vitest/browser';
import { farCornerNote, makeNote } from '../test/factories';
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

it('with no size picked, double-clicking empty Board creates a medium Note centred on the pointer', async () => {
  const { board, notes } = await setup();

  await userEvent.dblClick(board, { position: { x: 400, y: 300 } });

  await expect.element(notes).toBeVisible();
  const note = rectOnBoard(notes.element(), board);
  // 220×170 is Medium.
  expect(note).toMatchObject({ width: 220, height: 170 });
  expectWithinAPixel(note.x + 110, 400);
  expectWithinAPixel(note.y + 85, 300);
});

it('double-clicking a scrolled Board still centres the Note on the pointer', async () => {
  const { stores, board, scroller, notes } = await setup();
  stores.notes.getState().load([farCornerNote]);
  await expect.element(notes).toBeVisible();
  scroller.scrollTo(500, 200);

  await userEvent.dblClick(board, { position: { x: 900, y: 500 } });

  // Listed after the far Note.
  await expect.element(notes.nth(1)).toBeVisible();
  const note = rectOnBoard(notes.nth(1).element(), board);
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
  stores.notes.getState().load([note]);
  await expect.element(notes).toBeVisible();
  // Move the Note after the first click, so the second lands on empty Board.
  notes.element().addEventListener(
    'click',
    () => {
      stores.notes.getState().load([{ ...note, x: 600 }]);
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
  const hint = screen.getByText('Double-click anywhere to add a note of the current size');
  await expect.element(hint).toBeVisible();

  await userEvent.dblClick(board, { position: { x: 100, y: 100 } });
  await expect.element(hint).not.toBeInTheDocument();

  stores.notes.getState().load([]);
  await expect.element(hint).toBeVisible();
});

it('a double-click on the empty hint reaches the Board under it', async () => {
  const { screen, board, notes } = await setup();
  const hint = screen.getByText('Double-click anywhere to add a note of the current size');
  await expect.element(hint).toBeVisible();
  const { x, y, width, height } = rectOnBoard(hint.element(), board);

  await userEvent.dblClick(board, { position: { x: x + width / 2, y: y + height / 2 } });

  await expect.element(notes).toBeVisible();
});

it.each([
  { size: 'Small', width: 160, height: 120 },
  { size: 'Medium', width: 220, height: 170 },
  { size: 'Large', width: 300, height: 230 },
])(
  'after clicking $size, double-clicking empty Board creates a Note of that size on the pointer',
  async ({ size, width, height }) => {
    const { screen, board, notes } = await setup();
    await userEvent.click(screen.getByRole('button', { name: `${size} notes`, exact: true }));
    await expect.element(notes).not.toBeInTheDocument();

    await userEvent.dblClick(board, { position: { x: 400, y: 300 } });

    await expect.element(notes).toBeVisible();
    const note = rectOnBoard(notes.element(), board);
    expect(note).toMatchObject({ width, height });
    expectWithinAPixel(note.x + width / 2, 400);
    expectWithinAPixel(note.y + height / 2, 300);
  },
);

it('the Current size button is pressed, and looks it without hovering', async () => {
  const { screen } = await setup();
  const button = (size: string) =>
    screen.getByRole('button', { name: `${size} notes`, exact: true });
  const pressed = () =>
    ['Small', 'Medium', 'Large'].map((size) => button(size).element().getAttribute('aria-pressed'));
  expect(pressed()).toEqual(['false', 'true', 'false']);

  await userEvent.click(button('Small'));
  // Move the pointer off the buttons, so no hover style is in play.
  await userEvent.hover(screen.getByRole('region', { name: 'Board' }), {
    position: { x: 400, y: 400 },
  });

  expect(pressed()).toEqual(['true', 'false', 'false']);
  const style = (size: string) => getComputedStyle(button(size).element());
  expect(style('Small').boxShadow).not.toBe(style('Large').boxShadow);
  expect(style('Small').borderColor).not.toBe(style('Large').borderColor);
});

it('a size button only picks the size: it creates no Note and keeps Editing', async () => {
  const { screen, stores, notes } = await setup();
  const note = makeNote();
  stores.notes.getState().load([note]);
  await expect.element(notes).toBeVisible();
  stores.ui.getState().startEditing(note.id);

  for (const size of ['Small', 'Large', 'Medium']) {
    await userEvent.click(screen.getByRole('button', { name: `${size} notes`, exact: true }));
  }

  expect(stores.notes.getState().ids).toHaveLength(1);
  expect(stores.ui.getState().currentSize).toBe('medium');
  expect(stores.ui.getState().editingId).toBe(note.id);
});

it('a Board larger than the window scrolls in its container while the top bar stays put', async () => {
  const { screen, stores, board, scroller, notes } = await setup();
  stores.notes.getState().load([farCornerNote]);
  await expect.element(notes).toBeVisible();
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
