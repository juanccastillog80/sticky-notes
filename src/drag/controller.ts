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

/** What the controller listens to. The DOM side attaches all of them in one `listen`. */
export interface DragHandlers {
  move: (e: MoveSignal) => void;
  up: (e: PointerSignal) => void;
  cancel: (e: Pick<PointerSignal, 'pointerId'>) => void;
  scroll: () => void;
  key: (e: { readonly key: string }) => void;
}

/** Everything outside the controller. The hook passes the real DOM; tests pass a recording fake. */
export interface DragIO {
  /** The scroll container's offset, so a scroll mid-drag moves the Preview with the Board. */
  scrollPosition: () => Point;
  /** Attaches every listener. Returns the one function that detaches them all. */
  listen: (handlers: DragHandlers) => () => void;
  releaseCapture: (pointerId: number) => void;
  /** Shows `rect` as the Preview, drawn relative to `base`. `null` resets to the committed rect. */
  writePreview: (rect: Rect | null, base: Rect) => void;
  dispatch: (action: NoteAction) => void;
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

export interface DragController {
  press: <From extends Rect>(e: PointerSignal, kind: DragKind<From>, from: From) => void;
  /** Cancels a running Drag. For unmount. */
  dispose: () => void;
}

/** The one Drag lifecycle: press, Dead zone, Preview, then exactly one release or cancel. */
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

  /** Every exit comes through here, once. */
  function end(commit: boolean) {
    const s = session;
    if (!s) return;
    session = null;
    s.detach();
    io.releaseCapture(s.pointerId);
    if (s.pending) return;
    const action = commit ? s.commit(delta(s), { pointer: s.pointer }) : null;
    // Reset before dispatching: the re-render then moves the Note to where the Preview was.
    io.writePreview(null, s.from);
    if (action) io.dispatch(action);
  }

  const ownPointer = (e: Pick<PointerSignal, 'pointerId'>) => e.pointerId === session?.pointerId;

  const handlers: DragHandlers = {
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
      end(true);
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
    press(e, kind, from) {
      end(false);
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
        detach: io.listen(handlers),
      };
    },
    dispose() {
      end(false);
    },
  };
}
