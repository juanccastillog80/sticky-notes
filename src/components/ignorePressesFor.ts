/** Longer than most systems' double-click interval. */
export const DOUBLE_CLICK_MS = 500;

/**
 * Swallows presses and clicks on Notes for `ms`. After a click on a Note's × deletes it,
 * the second half of a double-click would otherwise land on whatever was under the ×:
 * Raising, dragging, editing or even deleting another Note.
 * Presses elsewhere, such as on the Undo toast or empty Board, still work.
 */
export function ignorePressesFor(ms: number) {
  const until = performance.now() + ms;
  const events = ['pointerdown', 'mousedown', 'click', 'dblclick'] as const;
  function swallow(e: Event) {
    if (performance.now() > until) {
      stop();
      return;
    }
    // Only on Notes: the Undo toast and everything else stay live.
    if (!(e.target instanceof Element) || !e.target.closest('article')) return;
    e.preventDefault();
    e.stopPropagation();
  }
  function stop() {
    for (const type of events) document.removeEventListener(type, swallow, { capture: true });
  }
  for (const type of events) document.addEventListener(type, swallow, { capture: true });
  setTimeout(stop, ms);
}
