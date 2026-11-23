/** The parts of a `pointerdown` that decide whether it may start a Drag. */
export interface PressLike {
  readonly isPrimary: boolean;
  readonly button: number;
  readonly target: EventTarget | null;
}

/** The primary pointer's left button, and not inside text the user is typing in. */
export function isDragPress({ isPrimary, button, target }: PressLike): boolean {
  if (!isPrimary || button !== 0) return false;
  const element = target as { closest?: (selector: string) => unknown } | null;
  return element?.closest?.('textarea, [contenteditable]:not([contenteditable="false"])') == null;
}
