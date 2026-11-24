import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import type { Rect } from '../geometry';
import type { NoteAction } from '../notes/notesReducer';
import { createDragController, type DragController, type DragHandlers } from './controller';
import { isDragPress } from './isDragPress';
import type { DragKind } from './kinds';

export interface DragOptions {
  /** The Board's scroll container, which can scroll mid-drag. */
  readonly scrollerRef: RefObject<HTMLElement | null>;
  /** Where the one action of a released Drag goes. */
  readonly commit: (action: NoteAction) => void;
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
 *   Session: start → isDragPress, setPointerCapture → controller.press
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
    });
    controller.current = drag;
    return () => {
      drag.dispose();
      controller.current = null;
    };
  }, [previewRef]);

  return function start<From extends Rect>(e: ReactPointerEvent, kind: DragKind<From>, from: From) {
    if (!isDragPress(e)) return;
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
  window.addEventListener('pointermove', handlers.move, options);
  window.addEventListener('pointerup', handlers.up, options);
  window.addEventListener('pointercancel', handlers.cancel, options);
  window.addEventListener('keydown', handlers.key, options);
  scroller?.addEventListener('scroll', handlers.scroll, { passive: true });
  return () => {
    window.removeEventListener('pointermove', handlers.move, options);
    window.removeEventListener('pointerup', handlers.up, options);
    window.removeEventListener('pointercancel', handlers.cancel, options);
    window.removeEventListener('keydown', handlers.key, options);
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
