import { describe, expect, it } from 'vitest';
import { makeNote } from '../../test/factories';
import type { Point, Rect } from '../geometry';
import type { NoteAction } from '../notes/notesReducer';
import { createDragController, type DragHandlers, type DragIO } from './controller';
import { moveKind } from './kinds';

type Call =
  | { readonly call: 'attachPointerListeners' }
  | { readonly call: 'detach' }
  | { readonly call: 'releaseCapture'; readonly pointerId: number }
  | { readonly call: 'writePreview'; readonly rect: Rect | null }
  | { readonly call: 'dispatch'; readonly action: NoteAction };

/** A fake `io` that records every call, with a scroll position the test sets. */
function setup() {
  const calls: Call[] = [];
  let scroll: Point = { x: 0, y: 0 };
  let attached: DragHandlers | null = null;

  const io: DragIO = {
    scrollPosition: () => scroll,
    attachPointerListeners(handlers) {
      calls.push({ call: 'attachPointerListeners' });
      attached = handlers;
      return () => {
        calls.push({ call: 'detach' });
        attached = null;
      };
    },
    releaseCapture: (pointerId) => calls.push({ call: 'releaseCapture', pointerId }),
    writePreview: (rect) => calls.push({ call: 'writePreview', rect }),
    dispatch: (action) => calls.push({ call: 'dispatch', action }),
  };
  const controller = createDragController(io);
  const note = makeNote({ x: 100, y: 100 });

  /** The handlers the controller attached. Signals after detach go nowhere, as in the DOM. */
  const on = (): DragHandlers => {
    if (!attached) throw new Error('No listeners attached');
    return attached;
  };
  const signal = (fire: (handlers: DragHandlers) => void) => {
    if (attached) fire(attached);
  };

  return {
    calls,
    note,
    on,
    signal,
    controller,
    press: (x = 10, y = 10) => {
      controller.press({ pointerId: 1, clientX: x, clientY: y }, moveKind, note);
    },
    move: (x: number, y: number, buttons = 1) => {
      signal((h) => {
        h.move({ pointerId: 1, clientX: x, clientY: y, buttons });
      });
    },
    up: (x: number, y: number) => {
      signal((h) => {
        h.up({ pointerId: 1, clientX: x, clientY: y });
      });
    },
    scrollTo: (to: Point) => {
      scroll = to;
      signal((h) => {
        h.scroll();
      });
    },
    of: <K extends Call['call']>(kind: K) =>
      calls.filter((c): c is Extract<Call, { call: K }> => c.call === kind),
  };
}

const lastPreview = (previews: readonly { rect: Rect | null }[]) => previews.at(-1)?.rect;

it('a drag moves the Note by the pointer delta, with exactly one move', () => {
  const t = setup();
  t.press(10, 10);
  t.move(40, 30);
  t.move(60, 50);
  t.up(60, 50);

  expect(t.of('dispatch')).toEqual([
    { call: 'dispatch', action: { type: 'move', id: t.note.id, x: 150, y: 140 } },
  ]);
});

it('the Preview follows each move synchronously', () => {
  const t = setup();
  t.press(10, 10);
  t.move(40, 30);

  expect(lastPreview(t.of('writePreview'))).toMatchObject({ x: 130, y: 120 });
});

describe('the Dead zone', () => {
  it('a release inside it is a click and dispatches nothing', () => {
    const t = setup();
    t.press(10, 10);
    t.move(12, 12);
    t.up(12, 12);

    expect(t.of('dispatch')).toEqual([]);
    expect(t.of('writePreview')).toEqual([]);
    expect(t.of('detach')).toHaveLength(1);
  });

  it('a press shows nothing until the pointer travels past 3 px', () => {
    const t = setup();
    t.press(10, 10);
    t.move(13, 10);
    expect(t.of('writePreview')).toEqual([]);

    t.move(14, 10);
    expect(lastPreview(t.of('writePreview'))).toMatchObject({ x: 104, y: 100 });
  });

  it('once past it, coming back inside still drags', () => {
    const t = setup();
    t.press(10, 10);
    t.move(30, 10);
    t.move(11, 10);
    t.up(11, 10);

    expect(t.of('dispatch')).toEqual([
      { call: 'dispatch', action: { type: 'move', id: t.note.id, x: 101, y: 100 } },
    ]);
  });
});

describe('scrolling mid-drag', () => {
  it('a scroll of 100 with the pointer still moves the Preview 100', () => {
    const t = setup();
    t.press(10, 10);
    t.move(50, 10);
    t.scrollTo({ x: 100, y: 0 });

    expect(lastPreview(t.of('writePreview'))).toMatchObject({ x: 240, y: 100 });
  });

  it('the release commits the scrolled position', () => {
    const t = setup();
    t.press(10, 10);
    t.move(50, 10);
    t.scrollTo({ x: 100, y: 60 });
    t.up(50, 10);

    expect(t.of('dispatch')).toEqual([
      { call: 'dispatch', action: { type: 'move', id: t.note.id, x: 240, y: 160 } },
    ]);
  });
});

describe('cancelling', () => {
  it('Escape mid-move resets the Preview and dispatches nothing', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.on().key({ key: 'Escape' });
    t.up(60, 60);

    expect(lastPreview(t.of('writePreview'))).toBeNull();
    expect(t.of('dispatch')).toEqual([]);
  });

  it('other keys do nothing', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.on().key({ key: 'a' });
    t.up(60, 60);

    expect(t.of('dispatch')).toHaveLength(1);
  });

  it('pointercancel resets the Preview and dispatches nothing', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.on().cancel({ pointerId: 1 });

    expect(lastPreview(t.of('writePreview'))).toBeNull();
    expect(t.of('dispatch')).toEqual([]);
  });

  it('dispose() mid-move detaches once and dispatches nothing', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.controller.dispose();
    t.controller.dispose();

    expect(t.of('detach')).toHaveLength(1);
    expect(t.of('dispatch')).toEqual([]);
  });

  it('dispose() with no Drag running does nothing', () => {
    const t = setup();
    t.controller.dispose();

    expect(t.calls).toEqual([]);
  });
});

describe('ending', () => {
  it('a lost pointer capture is ignored: the later pointerup commits exactly once', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    // `lostpointercapture` isn't one of the signals the controller listens to.
    t.up(60, 60);
    t.up(60, 60);

    expect(t.of('dispatch')).toHaveLength(1);
  });

  it('a move with no button down is a missed release, and commits where the pointer is', () => {
    const t = setup();
    t.press(10, 10);
    t.move(60, 60);
    t.move(70, 80, 0);

    expect(t.of('dispatch')).toEqual([
      { call: 'dispatch', action: { type: 'move', id: t.note.id, x: 160, y: 170 } },
    ]);
    expect(t.of('detach')).toHaveLength(1);
  });

  it('repeated end signals detach once and release capture once', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    const handlers = t.on();
    handlers.up({ pointerId: 1, clientX: 60, clientY: 60 });
    handlers.up({ pointerId: 1, clientX: 60, clientY: 60 });
    handlers.cancel({ pointerId: 1 });
    handlers.key({ key: 'Escape' });
    handlers.move({ pointerId: 1, clientX: 60, clientY: 60, buttons: 0 });
    handlers.scroll();

    expect(t.of('detach')).toHaveLength(1);
    expect(t.of('releaseCapture')).toEqual([{ call: 'releaseCapture', pointerId: 1 }]);
    expect(t.of('dispatch')).toHaveLength(1);
  });

  it('on release, the Preview is reset before the one dispatch', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.up(60, 60);

    expect(t.calls.slice(-2).map((c) => c.call)).toEqual(['writePreview', 'dispatch']);
    expect(lastPreview(t.of('writePreview'))).toBeNull();
  });

  it('signals from another pointer are ignored', () => {
    const t = setup();
    t.press(10, 10);
    t.move(60, 60);
    const handlers = t.on();
    handlers.move({ pointerId: 2, clientX: 500, clientY: 500, buttons: 0 });
    handlers.up({ pointerId: 2, clientX: 500, clientY: 500 });
    handlers.cancel({ pointerId: 2 });
    t.up(60, 60);

    expect(t.of('dispatch')).toEqual([
      { call: 'dispatch', action: { type: 'move', id: t.note.id, x: 150, y: 150 } },
    ]);
  });

  it('a new press cancels a Drag still running', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.press();

    expect(t.of('detach')).toHaveLength(1);
    expect(t.of('attachPointerListeners')).toHaveLength(2);
    expect(t.of('dispatch')).toEqual([]);
  });
});

describe('moveKind', () => {
  it('stops at the Board edges, and the release saves exactly what the Preview showed', () => {
    const t = setup();
    t.press(10, 10);
    t.move(5000, -500);
    const shown = lastPreview(t.of('writePreview'));
    t.up(5000, -500);

    expect(shown).toMatchObject({ x: 1920 - t.note.width, y: 0 });
    expect(t.of('dispatch')).toEqual([
      { call: 'dispatch', action: { type: 'move', id: t.note.id, x: shown?.x, y: shown?.y } },
    ]);
  });
});
