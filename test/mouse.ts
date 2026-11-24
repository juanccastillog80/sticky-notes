import { commands, type Locator } from 'vitest/browser';
import type { MouseButton, MouseStep } from './mouseStep';

declare module 'vitest/browser' {
  interface BrowserCommands {
    mouse: (steps: readonly MouseStep[]) => Promise<void>;
  }
}

/** The client point at `position` inside the element, or its centre. */
function pointIn(locator: Locator, position?: { x: number; y: number }) {
  const rect = locator.element().getBoundingClientRect();
  return position
    ? { x: rect.x + position.x, y: rect.y + position.y }
    : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

/** Real mouse input: press on `locator`, then move by (dx, dy) in `steps`, holding the button. */
export async function pressAndMove(
  locator: Locator,
  {
    dx,
    dy,
    steps = 10,
    position,
  }: { dx: number; dy: number; steps?: number; position?: { x: number; y: number } },
) {
  const start = pointIn(locator, position);
  await commands.mouse([
    { type: 'move', ...start },
    { type: 'down' },
    { type: 'move', x: start.x + dx, y: start.y + dy, steps },
  ]);
  return { x: start.x + dx, y: start.y + dy };
}

export async function release() {
  await commands.mouse([{ type: 'up' }]);
}

/** A complete real drag of `locator` by (dx, dy). */
export async function drag(
  locator: Locator,
  options: { dx: number; dy: number; steps?: number; position?: { x: number; y: number } },
) {
  await pressAndMove(locator, options);
  await release();
}

/** A real press and release in place: a click, with the left button unless told otherwise. */
export async function press(
  locator: Locator,
  position?: { x: number; y: number },
  button: MouseButton = 'left',
) {
  await commands.mouse([
    { type: 'move', ...pointIn(locator, position) },
    { type: 'down', button },
    { type: 'up', button },
  ]);
}
