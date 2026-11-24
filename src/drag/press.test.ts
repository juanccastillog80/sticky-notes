import { expect, it } from 'vitest';
import { isInText, isPress } from './press';

/** A stand-in element, inside text editing or not. Node has no DOM. */
const element = (insideEditable: boolean) =>
  ({
    closest: (selector: string) => (insideEditable && selector.includes('textarea') ? {} : null),
  }) as unknown as EventTarget;

it('the primary pointer’s left button is a Press', () => {
  expect(isPress({ isPrimary: true, button: 0 })).toBe(true);
});

it('the right and middle buttons are not', () => {
  expect(isPress({ isPrimary: true, button: 2 })).toBe(false);
  expect(isPress({ isPrimary: true, button: 1 })).toBe(false);
});

it('a second finger or pen is not', () => {
  expect(isPress({ isPrimary: false, button: 0 })).toBe(false);
});

it('a press inside a textarea or contenteditable is in text', () => {
  expect(isInText({ target: element(true) })).toBe(true);
  expect(isInText({ target: element(false) })).toBe(false);
});

it('a press with no element target is not in text', () => {
  expect(isInText({ target: null })).toBe(false);
});
