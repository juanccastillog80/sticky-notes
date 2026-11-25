import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Point, Rect } from '../geometry';
import type { NoteAction } from '../notes/notesReducer';
import { createDragController, type DragController, type DragHandlers } from './controller';
import { isInText, isPress } from './press';
import type { DragKind } from './kinds';

export interface DragOptions {
  /** The Board's scroll container, which can scroll mid-drag. */
  readonly scrollerRef: RefObject<HTMLElement | null>;
  /** The Trash zone, for a kind that can delete. */
  readonly trashRef?: RefObject<HTMLElement | null>;
  /** Where a Press's Raise and a released Drag's one action go. */
  readonly commit: (action: NoteAction) => void;
  /** A Click: a Press released inside the Dead zone, at `pointer` in client coordinates. */
  readonly onClick?: (pointer: Point) => void;
}

/**
 * The DOM side of the Drag engine: filters presses, captures the pointer and
 * builds the real `io`. The decisions are all in the controller.
 *
 * `previewRef` is the element the Preview is drawn on: the Note.
 *
 * Lifecycle (the session phase is documented on `createDragController`):
 *
 *   Mount: the effect builds `io` and creates the controller, once. The `io`
 *     methods read refs when called, so they always see the current options.
 *     Nothing listens yet. `start` is returned for the Note's pointerdown.
 *   Session: start → isPress, then isInText: in text, controller.press only Raises.
 *     Otherwise setPointerCapture → controller.press
 *     → io.attachPointerListeners → window listeners, until the session ends.
 *   Unmount (or StrictMode's remount): dispose → end(false), so a running Drag
 *     is cancelled and its listeners removed.
 */
export function useDrag(previewRef: RefObject<HTMLElement | null>, options: DragOptions) {
  // The latest options, read only inside handlers, so the controller is created once.
  const latest = useRef(options);
  useEffect(() => {
    latest.current = options;
  });
  const captured = useRef<Element | null>(null);
  const controller = useRef<DragController | null>(null);

  // Created in an effect, so StrictMode's remount gets a fresh controller and every
  // unmount cancels a running Drag.
  useEffect(() => {
    const drag = createDragController({
      scrollPosition() {
        const scroller = latest.current.scrollerRef.current;
        return { x: scroller?.scrollLeft ?? 0, y: scroller?.scrollTop ?? 0 };
      },
      attachPointerListeners(handlers) {
        return listenForDrag(handlers, latest.current.scrollerRef.current);
      },
      releaseCapture(pointerId) {
        const element = captured.current;
        captured.current = null;
        if (element?.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
      },
      writePreview(rect, base) {
        const element = previewRef.current;
        if (element) writePreview(element, rect, base);
      },
      dispatch(action) {
        latest.current.commit(action);
      },
      click(pointer) {
        latest.current.onClick?.(pointer);
      },
      trashRect() {
        const rect = latest.current.trashRef?.current?.getBoundingClientRect();
        return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null;
      },
      writeTrash(state) {
        const zone = latest.current.trashRef?.current;
        if (zone) zone.dataset.state = state;
        const element = previewRef.current;
        if (element) {
          if (state === 'over') element.dataset.overTrash = '';
          else delete element.dataset.overTrash;
        }
      },
    });
    controller.current = drag;
    return () => {
      drag.dispose();
      controller.current = null;
    };
  }, [previewRef]);

  return function start<From extends Rect>(e: ReactPointerEvent, kind: DragKind<From>, from: From) {
    if (!isPress(e)) return;
    if (isInText(e)) {
      // No preventDefault and no capture: the caret and text selection keep working.
      controller.current?.press(e, kind, from, { inText: true });
      return;
    }
    // No focus change, no text selection and no native drag.
    e.preventDefault();
    // So neighbours get no hover or double-click during the Drag.
    captured.current = e.currentTarget;
    e.currentTarget.setPointerCapture(e.pointerId);
    controller.current?.press(e, kind, from);
  };
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

/**
 * The Preview is a `translate` from the committed rect, plus `width`/`height` for
 * a resize, never `scale`, so text reflows and is never distorted. A move writes
 * the same size back, so it only composites. `data-dragging` gives the lifted
 * shadow. A reset writes `base`, the rect React rendered at press.
 */
function writePreview(element: HTMLElement, rect: Rect | null, base: Rect) {
  const { x, y, width, height } = rect ?? base;
  element.style.transform =
    rect === null ? '' : `translate(${String(x - base.x)}px, ${String(y - base.y)}px)`;
  element.style.width = `${String(width)}px`;
  element.style.height = `${String(height)}px`;
  if (rect === null) delete element.dataset.dragging;
  else element.dataset.dragging = '';
}
