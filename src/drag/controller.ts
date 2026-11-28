import type { Point, Rect, Size } from '../geometry';
import type { DragContext, DragKind, DragSave } from './kinds';

/** How far a press must travel before it becomes a Drag. Inside it, a release is a click. */
export const DEAD_ZONE_PX = 3;

export interface PointerSignal {
  readonly pointerId: number;
  readonly clientX: number;
  readonly clientY: number;
}

export interface MoveSignal extends PointerSignal {
  readonly buttons: number;
}

/**
 * `armed` while a move runs, `over` while the dragged Note overlaps the zone and a
 * release would delete it.
 */
export type TrashState = 'quiet' | 'armed' | 'over';

/** DOM → controller, attached only while a Press is live. */
export interface DragHandlers {
  move: (e: MoveSignal) => void;
  up: (e: PointerSignal) => void;
  cancel: (e: Pick<PointerSignal, 'pointerId'>) => void;
  scroll: () => void;
  key: (e: { readonly key: string }) => void;
}

/** Controller → DOM. Tests pass a recording fake. Client coordinates throughout. */
export interface DragIO {
  scrollPosition: () => Point;
  /** Returns the function that detaches them. */
  attachPointerListeners: (handlers: DragHandlers) => () => void;
  releaseCapture: (pointerId: number) => void;
  /** `null` resets to `base`, the committed rect. */
  writePreview: (rect: Rect | null, base: Rect) => void;
  save: DragSave;
  click: (pointer: Point) => void;
  trashRect: () => Rect | null;
  boardOrigin: () => Point;
  boardSize: () => Size;
  /** Called only when the state changes. */
  writeTrash: (state: TrashState) => void;
}

interface Session {
  readonly preview: (delta: Point, ctx: DragContext) => Rect;
  readonly commit: (delta: Point, ctx: DragContext) => void;
  readonly overTrash: ((delta: Point, ctx: DragContext) => boolean) | undefined;
  // Measured once, at press: the zone is pinned to the window, and a window resize
  // mid-drag doesn't change what the Drag allows.
  readonly trash: Rect | null;
  /**
   * The Note has been clear of the zone, at press or since. Until then the zone doesn't
   * count, so a Note left over it (by a window resize) isn't deleted by a nudge.
   */
  clearOfTrash: boolean;
  readonly pressBoardOrigin: Point;
  readonly board: Size;
  trashState: TrashState;
  readonly from: Rect;
  readonly pointerId: number;
  readonly pressPoint: Point;
  readonly pressScroll: Point;
  pointer: Point;
  /** Still inside the Dead zone. */
  pending: boolean;
  readonly detach: () => void;
}

export interface DragController {
  press: <From extends Rect>(e: PointerSignal, kind: DragKind<From>, from: From) => void;
  dispose: () => void;
}

/**
 *   press → attach listeners
 *   move / scroll → past the Dead zone → Preview
 *   up → Click if still in the Dead zone, else commit
 *   cancel / Escape / dispose → reset, save nothing
 */
export function createDragController(io: DragIO): DragController {
  let session: Session | null = null;

  function scrolled(s: Session): Point {
    const scroll = io.scrollPosition();
    return { x: scroll.x - s.pressScroll.x, y: scroll.y - s.pressScroll.y };
  }

  function delta(s: Session): Point {
    // The Board moves under a still pointer when the container scrolls.
    const scroll = scrolled(s);
    return {
      x: s.pointer.x - s.pressPoint.x + scroll.x,
      y: s.pointer.y - s.pressPoint.y + scroll.y,
    };
  }

  function stillInDeadZone(s: Session): boolean {
    const d = delta(s);
    return s.pending && Math.hypot(d.x, d.y) <= DEAD_ZONE_PX;
  }

  function context(s: Session, trash: Rect | null): DragContext {
    // The Board moves up and left on screen as the container scrolls down and right.
    const scroll = scrolled(s);
    return {
      trash,
      boardOrigin: { x: s.pressBoardOrigin.x - scroll.x, y: s.pressBoardOrigin.y - scroll.y },
      board: s.board,
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
    // The whole zone, to see whether the Note is clear of it.
    const ctx = context(s, s.trash);
    // Synchronously, from the event: no rAF, so the Preview is never a frame behind.
    io.writePreview(s.preview(d, ctx), s.from);
    if (!s.overTrash) return;
    const over = s.overTrash(d, ctx);
    if (!over) s.clearOfTrash = true;
    setTrash(s, over && s.clearOfTrash ? 'over' : 'armed');
  }

  /** Every exit, once. Only a `pointerup` we saw (`released`) turns a Press into a Click. */
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
    // The zone counts only once the Note has been clear of it.
    const ctx = context(s, s.clearOfTrash ? s.trash : null);
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
    press(e, kind, from) {
      end(false);
      const pressPoint = { x: e.clientX, y: e.clientY };
      const { overTrash } = kind;
      const trash = overTrash ? io.trashRect() : null;
      const pressBoardOrigin = overTrash ? io.boardOrigin() : { x: 0, y: 0 };
      const board = io.boardSize();
      const atPress = { trash, boardOrigin: pressBoardOrigin, board };
      session = {
        preview: (d, ctx) => kind.preview(from, d, ctx),
        commit: (d, ctx) => {
          kind.commit(from, d, ctx, io.save);
        },
        overTrash: overTrash && ((d, ctx) => overTrash(from, d, ctx)),
        trash,
        clearOfTrash: !overTrash?.(from, { x: 0, y: 0 }, atPress),
        pressBoardOrigin,
        board,
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
