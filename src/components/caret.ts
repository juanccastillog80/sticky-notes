import type { Point } from '../geometry';

/**
 * The text offset under the client `point` inside `text`, an element holding at most
 * one text node, or `null` when the point isn't over its text. The caller falls back
 * to the end of the text.
 */
export function caretOffsetAt(text: HTMLElement | null, { x, y }: Point): number | null {
  // Older browsers lack the API: they fall back to the end too.
  if (!text || !('caretPositionFromPoint' in document)) return null;
  const position = document.caretPositionFromPoint(x, y);
  return position?.offsetNode === text.firstChild ? position.offset : null;
}
