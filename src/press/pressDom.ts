import { measureBoardSize, type BoardDom } from '../BoardDomContext';
import { createDragController, type DragHandlers } from '../drag/controller';
import { RESIZE_HANDLES, type ResizeHandle } from '../drag/kinds';
import { toBoardPoint, type Rect } from '../geometry';
import { parseNoteId } from '../notes/note';
import type { Stores } from '../StoresContext';
import { caretOffsetAt } from './caret';
import { createPress, type Press, type PressTarget } from './press';

export function isInText({ target }: { readonly target: EventTarget | null }): boolean {
  const element = target as { closest?: (selector: string) => unknown } | null;
  return element?.closest?.('textarea, [contenteditable]:not([contenteditable="false"])') != null;
}

/**
 * The DOM side of the Press module: it reads Press targets off `data-press-target`
 * and `data-note-id`, hands them to `createPress`, which decides, and owns the real
 * `DragIO`. Returns the cleanup.
 */
export function attachPress(stores: Stores, { scrollerRef, boardRef, trashRef }: BoardDom) {
  const root = boardRef.current;
  if (!root) return () => undefined;
  const board: HTMLElement = root;
  const { notes } = stores;
  let pressedNote: HTMLElement | null = null;
  let captured: Element | null = null;

  const drag = createDragController({
    scrollPosition() {
      const scroller = scrollerRef.current;
      return { x: scroller?.scrollLeft ?? 0, y: scroller?.scrollTop ?? 0 };
    },
    attachPointerListeners(handlers) {
      return listenForDrag(handlers, scrollerRef.current);
    },
    releaseCapture(pointerId) {
      const element = captured;
      captured = null;
      if (element?.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    },
    writePreview(rect, base) {
      if (pressedNote) writePreview(pressedNote, rect, base);
    },
    save: {
      move: (id, x, y) => {
        notes.getState().move(id, x, y);
      },
      resize: (id, rect) => {
        notes.getState().resize(id, rect);
      },
      deleteNote: (id) => {
        notes.getState().deleteNote(id);
      },
    },
    click(pointer) {
      // Measured on the idle text, which the textarea lays out identically.
      const text = pressedNote?.querySelector<HTMLElement>(':scope > [data-note-text]') ?? null;
      press.clicked(caretOffsetAt(text, pointer));
    },
    trashRect() {
      const rect = trashRef.current?.getBoundingClientRect();
      return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
    },
    boardOrigin() {
      const rect = board.getBoundingClientRect();
      return { x: rect.x, y: rect.y };
    },
    boardSize() {
      return measureBoardSize(board);
    },
    writeTrash(state) {
      const zone = trashRef.current;
      if (zone) zone.dataset.state = state;
      if (pressedNote) {
        if (state === 'over') pressedNote.dataset.overTrash = '';
        else delete pressedNote.dataset.overTrash;
      }
    },
  });
  const press: Press = createPress(stores, drag);

  function pointerDown(e: PointerEvent) {
    const target = pressTargetOf(e.target, board);
    const outcome = press.pointerDown(target, {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
      isPrimary: e.isPrimary,
      button: e.button,
      inText: isInText(e),
    });
    if (outcome === 'none') return;
    // No focus change, no text selection and no native drag.
    e.preventDefault();
    if (outcome !== 'drag') return;
    const note = noteOf(e.target);
    pressedNote = note;
    // On the handle for a resize, so its cursor stays.
    const handle =
      e.target instanceof Element ? e.target.closest('[data-press-target="handle"]') : null;
    const holder = handle ?? note;
    if (holder) {
      captured = holder;
      holder.setPointerCapture(e.pointerId);
    }
  }

  function focusIn(e: FocusEvent) {
    const id = noteIdOf(e.target);
    if (!id || !(e.target instanceof Element)) return;
    press.focused(id, { keyboard: e.target.matches(':focus-visible'), inText: isInText(e) });
  }

  function click(e: MouseEvent) {
    const id = noteIdOf(e.target);
    if (!id || !(e.target instanceof Element)) return;
    if (!e.target.closest('[data-press-target="delete"]')) return;
    // `detail` 0: Enter or Space, which can't be half a double-click.
    press.deleteButtonClicked(id, { mouse: e.detail > 0 });
  }

  function doubleClick(e: MouseEvent) {
    // A `dblclick` reports only where the second press landed: the core remembers the first.
    const point = toBoardPoint({ x: e.clientX, y: e.clientY }, board.getBoundingClientRect());
    press.doubleClickedBoard(point, measureBoardSize(board));
  }

  const capture = { capture: true };
  document.addEventListener('pointerdown', pointerDown, capture);
  board.addEventListener('focusin', focusIn, capture);
  board.addEventListener('click', click, capture);
  board.addEventListener('dblclick', doubleClick, capture);
  return () => {
    document.removeEventListener('pointerdown', pointerDown, capture);
    board.removeEventListener('focusin', focusIn, capture);
    board.removeEventListener('click', click, capture);
    board.removeEventListener('dblclick', doubleClick, capture);
    // A running Drag is cancelled and its listeners removed.
    press.dispose();
  };
}

function noteOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? target.closest<HTMLElement>('[data-note-id]') : null;
}

function noteIdOf(target: EventTarget | null) {
  const raw = noteOf(target)?.dataset.noteId;
  return raw === undefined ? null : parseNoteId(raw);
}

function isResizeHandle(value: string | undefined): value is ResizeHandle {
  return (RESIZE_HANDLES as readonly (string | undefined)[]).includes(value);
}

function pressTargetOf(target: EventTarget | null, board: HTMLElement): PressTarget {
  if (target === board) return { on: 'board' };
  if (!(target instanceof Element) || !board.contains(target)) return { on: 'outside' };
  const id = noteIdOf(target);
  const marked = target.closest<HTMLElement>('[data-press-target]');
  if (!id || !marked) return { on: 'outside' };
  const on = marked.dataset.pressTarget;
  if (on === 'handle') {
    const handle = marked.dataset.handle;
    return isResizeHandle(handle) ? { on, id, handle } : { on: 'body', id };
  }
  return on === 'grip' || on === 'delete' ? { on, id } : { on: 'body', id };
}

/**
 * End signals listen on `window`, so they arrive whatever has the capture.
 * `lostpointercapture` isn't listened to: Chrome can fire it before a valid `pointerup`.
 */
function listenForDrag(handlers: DragHandlers, scroller: HTMLElement | null): () => void {
  const options = { capture: true };
  // Prevented, so the Escape that cancels a Drag does nothing else, such as end Editing.
  const key = (e: KeyboardEvent) => {
    if (e.key === 'Escape') e.preventDefault();
    handlers.key(e);
  };
  window.addEventListener('pointermove', handlers.move, options);
  window.addEventListener('pointerup', handlers.up, options);
  window.addEventListener('pointercancel', handlers.cancel, options);
  window.addEventListener('keydown', key, options);
  scroller?.addEventListener('scroll', handlers.scroll, { passive: true });
  return () => {
    window.removeEventListener('pointermove', handlers.move, options);
    window.removeEventListener('pointerup', handlers.up, options);
    window.removeEventListener('pointercancel', handlers.cancel, options);
    window.removeEventListener('keydown', key, options);
    scroller?.removeEventListener('scroll', handlers.scroll);
  };
}

/** A `translate`, never `scale`, so a resized Note's text reflows instead of stretching. */
function writePreview(element: HTMLElement, rect: Rect | null, base: Rect) {
  const { x, y, width, height } = rect ?? base;
  element.style.transform =
    rect === null ? '' : `translate(${String(x - base.x)}px, ${String(y - base.y)}px)`;
  element.style.width = `${String(width)}px`;
  element.style.height = `${String(height)}px`;
  if (rect === null) delete element.dataset.dragging;
  else element.dataset.dragging = '';
}
