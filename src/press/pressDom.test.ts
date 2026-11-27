import { expect, it } from 'vitest';
import { isInText } from './pressDom';

/** A stand-in element, inside text editing or not. Node has no DOM. */
const element = (insideEditable: boolean) =>
  ({
    closest: (selector: string) => (insideEditable && selector.includes('textarea') ? {} : null),
  }) as unknown as EventTarget;

it('a press inside a textarea or contenteditable is in text', () => {
  expect(isInText({ target: element(true) })).toBe(true);
  expect(isInText({ target: element(false) })).toBe(false);
});

it('a press with no element target is not in text', () => {
  expect(isInText({ target: null })).toBe(false);
});
