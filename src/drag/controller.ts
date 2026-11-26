import type { Point, Rect } from '../geometry';
import type { DragContext, DragKind, DragSave } from './kinds';

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
 * How the Trash zone looks: `quiet` with no move running, `armed` while a move runs,
 * `over` while the dragged Note overlaps it. The dragged Note shows `over` too.
 */
export type TrashState = 'quiet' | 'armed' | 'over';

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
  /** Where a Press's Raise and a released Drag's one save go. */
  save: DragSave;
  /** A Click: the Press was released inside the Dead zone, at `pointer` (client coordinates). */
  click: (pointer: Point) => void;
  /** The Trash zone's rect in client coordinates, or `null` if it isn't on screen. Read once per Press. */
  trashRect: () => Rect | null;
  /** The Board's top-left in client coordinates. Read once per Press, by a kind that can delete. */
  boardOrigin: () => Point;
  /** Edge-triggered: called only when the state changes, and only for a kind that can delete. */
  writeTrash: (state: TrashState) => void;
}

interface Session {
  /** The Drag kind, bound to the rect it started from. */
  readonly preview: (delta: Point, ctx: DragContext) => Rect;
  readonly commit: (delta: Point, ctx: DragContext) => void;
  /** Absent for a kind that never deletes, such as a resize. */
  readonly overTrash: ((delta: Point, ctx: DragContext) => boolean) | undefined;
  /** Measured at press: the zone is pinned to the window, so a scroll never moves it. */
  readonly trash: Rect | null;
  /** The Board's top-left on screen, measured at press. A scroll since moves it the other way. */
  readonly pressBoard: Point;
  /** Last written to the DOM. */
  trashState: TrashState;
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
 *   press → kind.press saves through io.save, io.attachPointerListeners(sessionHandlers)
 *   move / scroll → Dead zone → Preview (io.writePreview)
 *   up → end(true, released);  buttons === 0 → end(true), but inside the Dead zone the `pointerup` decides
 *   cancel / Escape / dispose → end(false)
 *   end → detach, io.releaseCapture, then a Click (io.click) or quiet Trash zone + reset Preview + kind.commit saves through io.save
 *
 * A kind with `overTrash` (a move) also drives the Trash zone: `armed` once it leaves the
 * Dead zone, `over` while the Note overlaps the zone, `quiet` at the end, each written once.
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

  /** Still a would-be Click: it has never left the Dead zone, and isn't outside it now. */
  function stillInDeadZone(s: Session): boolean {
    const d = delta(s);
    return s.pending && Math.hypot(d.x, d.y) <= DEAD_ZONE_PX;
  }

  function context(s: Session): DragContext {
    // The Board moves up and left on screen as the container scrolls down and right.
    const scroll = io.scrollPosition();
    return {
      trash: s.trash,
      board: {
        x: s.pressBoard.x - (scroll.x - s.pressScroll.x),
        y: s.pressBoard.y - (scroll.y - s.pressScroll.y),
      },
    };
  }

  function setTrash(s: Session, state: TrashState) {
    if (!s.overTrash || s.trashState === state) return;
    s.trashState = state;
    io.writeTrash(state);
  }

  function update(s: Session) {
    if (stillInDeadZone(s)) return;
    const d = delta(s);
    s.pending = false;
    const ctx = context(s);
    // Synchronously, from the event: no rAF, so the Preview is never a frame behind.
    io.writePreview(s.preview(d, ctx), s.from);
    setTrash(s, s.overTrash?.(d, ctx) ? 'over' : 'armed');
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
    // Measured before the reset, so what is saved is exactly what the Preview showed.
    const d = delta(s);
    const ctx = context(s);
    setTrash(s, 'quiet');
    // Reset before saving: the re-render then moves the Note to where the Preview was.
    io.writePreview(null, s.from);
    if (commit) s.commit(d, ctx);
  }

  const ownPointer = (e: Pick<PointerSignal, 'pointerId'>) => e.pointerId === session?.pointerId;

  const sessionHandlers: DragHandlers = {
    move(e) {
      if (!session || !ownPointer(e)) return;
      session.pointer = { x: e.clientX, y: e.clientY };
      if (e.buttons === 0) {
        // Chrome sends a button-less move just before the `pointerup` of a press that
        // wobbled as it was let go: inside the Dead zone, that `pointerup` decides.
        if (stillInDeadZone(session)) return;
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
      kind.press?.(from, io.save);
      if (inText) return;
      const pressPoint = { x: e.clientX, y: e.clientY };
      const { overTrash } = kind;
      session = {
        preview: (d, ctx) => kind.preview(from, d, ctx),
        commit: (d, ctx) => {
          kind.commit(from, d, ctx, io.save);
        },
        overTrash: overTrash && ((d, ctx) => overTrash(from, d, ctx)),
        trash: overTrash ? io.trashRect() : null,
        pressBoard: overTrash ? io.boardOrigin() : { x: 0, y: 0 },
        trashState: 'quiet',
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
