import type { Point } from '../geometry';

/**
 * The text offset under the client `point` inside `text`, an element holding at most
 * one text node, or `null` when the point isn't over its text. The caller falls back
 * to the end of the text.
 */
export function caretOffsetAt(text: HTMLElement | null, { x, y }: Point): number | null {
  const position = text ? document.caretPositionFromPoint(x, y) : null;
  if (!position || position.offsetNode !== text?.firstChild) return null;
  return position.offset;
}
