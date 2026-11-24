import type { Point, Rect } from '../geometry';
import type { NoteAction } from '../notes/notesReducer';
import type { DragContext, DragKind } from './kinds';

/** How far a press must travel before it becomes a Drag. Inside it, a release is a click. */
export const DEAD_ZONE_PX = 3;

export interface PointerSignal {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
}

export interface MoveSignal extends PointerSignal {
  /** 0 when no button is down: the release happened where we couldn't see it. */
  readonly buttons: number;
}

/**
 * DOM → controller. The controller's session handlers: the DOM side attaches them
 * in `attachPointerListeners` on press, and removes them when the session ends.
 */
export interface DragHandlers {
  move: (e: MoveSignal) => void;
  up: (e: PointerSignal) => void;
  cancel: (e: Pick<PointerSignal, 'pointerId'>) => void;
  scroll: () => void;
  key: (e: { readonly key: string }) => void;
}

/**
 * Controller → DOM. Everything outside the controller. The hook passes the real DOM;
 * tests pass a recording fake.
 */
export interface DragIO {
  /** The scroll container's offset, so a scroll mid-drag moves the Preview with the Board. */
  scrollPosition: () => Point;
  /** Called on press. Attaches every session handler; returns the one function that detaches them all. */
  attachPointerListeners: (handlers: DragHandlers) => () => void;
  releaseCapture: (pointerId: number) => void;
  /** Shows `rect` as the Preview, drawn relative to `base`. `null` resets to the committed rect. */
  writePreview: (rect: Rect | null, base: Rect) => void;
  dispatch: (action: NoteAction) => void;
  /** A Click: the Press was released inside the Dead zone, at `pointer` (client coordinates). */
  click: (pointer: Point) => void;
}

interface Session {
  /** The Drag kind, bound to the rect it started from. */
  readonly preview: (delta: Point, ctx: DragContext) => Rect;
  readonly commit: (delta: Point, ctx: DragContext) => NoteAction | null;
  readonly from: Rect;
  readonly pointerId: number;
  /** Client coordinates. */
  readonly pressPoint: Point;
  readonly pressScroll: Point;
  pointer: Point;
  /** Still inside the Dead zone. */
  pending: boolean;
  readonly detach: () => void;
}

export interface PressOptions {
  /** The Press landed inside text being typed in: it Raises, but never becomes a Drag or a Click. */
  readonly inText?: boolean;
}

export interface DragController {
  press: <From extends Rect>(
    e: PointerSignal,
    kind: DragKind<From>,
    from: From,
    options?: PressOptions,
  ) => void;
  /** Cancels a running Drag. For unmount. */
  dispose: () => void;
}

/**
 * The session phase of the Drag lifecycle. Mount and unmount are in `useDrag`.
 *
 *   press → io.dispatch(kind.press), io.attachPointerListeners(sessionHandlers)
 *   move / scroll → Dead zone → Preview (io.writePreview)
 *   up → end(true, released);  buttons === 0 → end(true);  cancel / Escape / dispose → end(false)
 *   end → detach, io.releaseCapture, then a Click (io.click) or reset Preview + io.dispatch the commit
 *
 * The handlers exist for the whole controller, but are attached only while a Press is live.
 */
export function createDragController(io: DragIO): DragController {
  let session: Session | null = null;

  function delta(s: Session): Point {
    // The Board moves under a still pointer when the container scrolls.
    const scroll = io.scrollPosition();
    return {
      x: s.pointer.x - s.pressPoint.x + scroll.x - s.pressScroll.x,
      y: s.pointer.y - s.pressPoint.y + scroll.y - s.pressScroll.y,
    };
  }

  function update(s: Session) {
    const d = delta(s);
    if (s.pending && Math.hypot(d.x, d.y) <= DEAD_ZONE_PX) return;
    s.pending = false;
    // Synchronously, from the event: no rAF, so the Preview is never a frame behind.
    io.writePreview(s.preview(d, { pointer: s.pointer }), s.from);
  }

  /**
   * Every exit comes through here, once. `released`: a real `pointerup` we saw,
   * the only end that turns a Press still inside the Dead zone into a Click.
   */
  function end(commit: boolean, released = false) {
    const s = session;
    if (!s) return;
    session = null;
    s.detach();
    io.releaseCapture(s.pointerId);
    if (s.pending) {
      // Last, so the Click's handler runs with the pointer already let go.
      if (released) io.click(s.pointer);
      return;
    }
    const action = commit ? s.commit(delta(s), { pointer: s.pointer }) : null;
    // Reset before dispatching: the re-render then moves the Note to where the Preview was.
    io.writePreview(null, s.from);
    if (action) io.dispatch(action);
  }

  const ownPointer = (e: Pick<PointerSignal, 'pointerId'>) => e.pointerId === session?.pointerId;

  const sessionHandlers: DragHandlers = {
    move(e) {
      if (!session || !ownPointer(e)) return;
      session.pointer = { x: e.clientX, y: e.clientY };
      if (e.buttons === 0) {
        end(true);
        return;
      }
      update(session);
    },
    up(e) {
      if (!session || !ownPointer(e)) return;
      session.pointer = { x: e.clientX, y: e.clientY };
      end(true, true);
    },
    cancel(e) {
      if (ownPointer(e)) end(false);
    },
    scroll() {
      if (session) update(session);
    },
    key(e) {
      if (e.key === 'Escape') end(false);
    },
  };

  return {
    press(e, kind, from, { inText = false } = {}) {
      end(false);
      const pressed = kind.press?.(from);
      if (pressed) io.dispatch(pressed);
      if (inText) return;
      const pressPoint = { x: e.clientX, y: e.clientY };
      session = {
        preview: (d, ctx) => kind.preview(from, d, ctx),
        commit: (d, ctx) => kind.commit(from, d, ctx),
        from,
        pointerId: e.pointerId,
        pressPoint,
        pressScroll: io.scrollPosition(),
        pointer: pressPoint,
        pending: true,
        detach: io.attachPointerListeners(sessionHandlers),
      };
    },
    dispose() {
      end(false);
    },
  };
}
