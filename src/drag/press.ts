/** The parts of a `pointerdown` that decide what a Press may do. */
export interface PressLike {
  readonly isPrimary: boolean;
  readonly button: number;
  readonly target: EventTarget | null;
}

/** The primary pointer's left button: the only Press we act on, by Raising or dragging. */
export function isPress({ isPrimary, button }: Pick<PressLike, 'isPrimary' | 'button'>): boolean {
  return isPrimary && button === 0;
}

/** Inside text the user is typing in, where a Press must leave the caret and selection alone. */
export function isInText({ target }: Pick<PressLike, 'target'>): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null;
  return element?.closest?.('textarea, [contenteditable]:not([contenteditable="false"])') != null;
}
