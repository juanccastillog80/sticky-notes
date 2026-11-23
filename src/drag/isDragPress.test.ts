import { expect, it } from 'vitest';
import { isDragPress } from './isDragPress';

/** A stand-in element, inside text editing or not. Node has no DOM. */
const element = (insideEditable: boolean) => ({
  closest: (selector: string) => (insideEditable && selector.includes('textarea') ? {} : null),
});

const press = (overrides = {}) => ({
  isPrimary: true,
  button: 0,
  target: element(false) as unknown as EventTarget,
  ...overrides,
});

it('the primary pointer’s left button starts a Drag', () => {
  expect(isDragPress(press())).toBe(true);
});

it('the right and middle buttons do not', () => {
  expect(isDragPress(press({ button: 2 }))).toBe(false);
  expect(isDragPress(press({ button: 1 }))).toBe(false);
});

it('a second finger or pen does not', () => {
  expect(isDragPress(press({ isPrimary: false }))).toBe(false);
});

it('a press inside a textarea or contenteditable does not, so the caret keeps working', () => {
  expect(isDragPress(press({ target: element(true) }))).toBe(false);
});

it('a press with no element target still does', () => {
  expect(isDragPress(press({ target: null }))).toBe(true);
});
