import type { Point } from '../geometry';

/** `text` holds at most one text node. `null` when the point isn't over it. */
export function caretOffsetAt(text: HTMLElement | null, { x, y }: Point): number | null {
  // Older browsers lack the API: they fall back to the end too.
  if (!text || !('caretPositionFromPoint' in document)) return null;
  const position = document.caretPositionFromPoint(x, y);
  return position?.offsetNode === text.firstChild ? position.offset : null;
}
