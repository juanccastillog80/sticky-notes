import { describe, expect, it } from 'vitest';
import { makeNote } from '../../test/factories';
import type { Point, Rect } from '../geometry';
import { recordingSave, type Call as SaveCall } from '../../test/recordCalls';
import {
  createDragController,
  type DragHandlers,
  type DragIO,
  type TrashState,
} from './controller';
import { moveKind, resizeKinds } from './kinds';

type Call =
  | { readonly call: 'attachPointerListeners' }
  | { readonly call: 'detach' }
  | { readonly call: 'releaseCapture'; readonly pointerId: number }
  | { readonly call: 'writePreview'; readonly rect: Rect | null }
  | { readonly call: 'save'; readonly save: SaveCall }
  | { readonly call: 'click'; readonly pointer: Point }
  | { readonly call: 'writeTrash'; readonly state: TrashState };

/** A fake `io` that records every call, with a scroll position the test sets. */
function setup() {
  const calls: Call[] = [];
  let scroll: Point = { x: 0, y: 0 };
  // Far from where the tests drag, unless a test moves the pointer onto it.
  const trash: Rect = { x: 900, y: 600, width: 104, height: 104 };
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
    save: recordingSave((save) => calls.push({ call: 'save', save })),
    click: (pointer) => calls.push({ call: 'click', pointer }),
    trashRect: () => trash,
    writeTrash: (state) => calls.push({ call: 'writeTrash', state }),
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

  const of = <K extends Call['call']>(kind: K) =>
    calls.filter((c): c is Extract<Call, { call: K }> => c.call === kind);

  return {
    calls,
    note,
    on,
    signal,
    controller,
    press: (x = 10, y = 10) => {
      controller.press({ pointerId: 1, clientX: x, clientY: y }, moveKind, note);
    },
    pressResize: (x = 10, y = 10) => {
      controller.press({ pointerId: 1, clientX: x, clientY: y }, resizeKinds.se, note);
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
    of,
    /** What the Drags saved: every save except the Raise each Press makes. */
    commits: () => of('save').filter(({ save }) => save[0] !== 'raise'),
  };
}

describe('the Press', () => {
  it('raises the Note before anything listens', () => {
    const t = setup();
    t.press();

    expect(t.calls.slice(0, 2)).toEqual([
      { call: 'save', save: ['raise', t.note.id] },
      { call: 'attachPointerListeners' },
    ]);
  });

  it('inside text it only raises: nothing listens, so the caret and selection are left alone', () => {
    const t = setup();
    t.controller.press({ pointerId: 1, clientX: 10, clientY: 10 }, moveKind, t.note, {
      inText: true,
    });

    expect(t.calls).toEqual([{ call: 'save', save: ['raise', t.note.id] }]);
  });

  it('released inside the Dead zone is a Click at the release point, after everything is let go', () => {
    const t = setup();
    t.press(10, 10);
    t.move(12, 11);
    t.up(12, 11);

    expect(t.calls.slice(-3)).toEqual([
      { call: 'detach' },
      { call: 'releaseCapture', pointerId: 1 },
      { call: 'click', pointer: { x: 12, y: 11 } },
    ]);
  });

  it('a button-less move just before the release, still inside the Dead zone, leaves it a Click', () => {
    // Chrome: a pointer that wobbles as the button comes up sends a move with
    // `buttons === 0`, then the `pointerup` in the same millisecond.
    const t = setup();
    t.press(10, 10);
    t.move(10.1, 10, 0);
    t.up(10.1, 10);

    expect(t.of('click')).toEqual([{ call: 'click', pointer: { x: 10.1, y: 10 } }]);
    expect(t.of('detach')).toHaveLength(1);
  });

  it('a button-less move inside the Dead zone never moves the Note', () => {
    const t = setup();
    t.press(10, 10);
    t.move(12, 10, 0);

    expect(t.of('writePreview')).toEqual([]);
    expect(t.commits()).toEqual([]);
  });

  it('a release after leaving the Dead zone is a Drag, not a Click', () => {
    const t = setup();
    t.press(10, 10);
    t.move(40, 10);
    t.move(11, 10);
    t.up(11, 10);

    expect(t.of('click')).toEqual([]);
  });

  it.each([
    [
      'pointercancel',
      (t: Setup) => {
        t.on().cancel({ pointerId: 1 });
      },
    ],
    [
      'Escape',
      (t: Setup) => {
        t.on().key({ key: 'Escape' });
      },
    ],
    [
      'dispose',
      (t: Setup) => {
        t.controller.dispose();
      },
    ],
    [
      'a release we did not see (buttons === 0, the pointer since moved off)',
      (t: Setup) => {
        t.move(20, 10, 0);
      },
    ],
  ])('ending inside the Dead zone by %s is not a Click', (_, endIt) => {
    const t = setup();
    t.press(10, 10);
    endIt(t);

    expect(t.of('detach')).toHaveLength(1);
    expect(t.of('click')).toEqual([]);
  });
});

type Setup = ReturnType<typeof setup>;

const lastPreview = (previews: readonly { rect: Rect | null }[]) => previews.at(-1)?.rect;

it('a drag moves the Note by the pointer delta, with exactly one move', () => {
  const t = setup();
  t.press(10, 10);
  t.move(40, 30);
  t.move(60, 50);
  t.up(60, 50);

  expect(t.commits()).toEqual([{ call: 'save', save: ['move', t.note.id, 150, 140] }]);
});

it('the Preview follows each move synchronously', () => {
  const t = setup();
  t.press(10, 10);
  t.move(40, 30);

  expect(lastPreview(t.of('writePreview'))).toMatchObject({ x: 130, y: 120 });
});

describe('the Dead zone', () => {
  it('a release inside it is a click and saves nothing', () => {
    const t = setup();
    t.press(10, 10);
    t.move(12, 12);
    t.up(12, 12);

    expect(t.commits()).toEqual([]);
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

    expect(t.commits()).toEqual([{ call: 'save', save: ['move', t.note.id, 101, 100] }]);
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

    expect(t.commits()).toEqual([{ call: 'save', save: ['move', t.note.id, 240, 160] }]);
  });
});

describe('cancelling', () => {
  it('Escape mid-move resets the Preview and saves nothing', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.on().key({ key: 'Escape' });
    t.up(60, 60);

    expect(lastPreview(t.of('writePreview'))).toBeNull();
    expect(t.commits()).toEqual([]);
  });

  it('other keys do nothing', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.on().key({ key: 'a' });
    t.up(60, 60);

    expect(t.commits()).toHaveLength(1);
  });

  it('pointercancel resets the Preview and saves nothing', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.on().cancel({ pointerId: 1 });

    expect(lastPreview(t.of('writePreview'))).toBeNull();
    expect(t.commits()).toEqual([]);
  });

  it('dispose() mid-move detaches once and saves nothing', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.controller.dispose();
    t.controller.dispose();

    expect(t.of('detach')).toHaveLength(1);
    expect(t.commits()).toEqual([]);
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

    expect(t.commits()).toHaveLength(1);
  });

  it('a move with no button down is a missed release, and commits where the pointer is', () => {
    const t = setup();
    t.press(10, 10);
    t.move(60, 60);
    t.move(70, 80, 0);

    expect(t.commits()).toEqual([{ call: 'save', save: ['move', t.note.id, 160, 170] }]);
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
    expect(t.commits()).toHaveLength(1);
  });

  it('on release, the Preview is reset before the one save', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.up(60, 60);

    expect(t.calls.slice(-2).map((c) => c.call)).toEqual(['writePreview', 'save']);
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

    expect(t.commits()).toEqual([{ call: 'save', save: ['move', t.note.id, 150, 150] }]);
  });

  it('a new press cancels a Drag still running', () => {
    const t = setup();
    t.press();
    t.move(60, 60);
    t.press();

    expect(t.of('detach')).toHaveLength(1);
    expect(t.of('attachPointerListeners')).toHaveLength(2);
    expect(t.commits()).toEqual([]);
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
    expect(t.commits()).toEqual([{ call: 'save', save: ['move', t.note.id, shown?.x, shown?.y] }]);
  });
});

describe('the Trash zone', () => {
  const trashStates = (t: Setup) => t.of('writeTrash').map(({ state }) => state);

  it('a move arms it once it leaves the Dead zone, and each change is written once', () => {
    const t = setup();
    t.press(10, 10);
    t.move(12, 10);
    expect(trashStates(t)).toEqual([]);

    t.move(40, 10);
    t.move(60, 10);
    t.move(950, 650);
    t.move(960, 660);
    t.move(500, 500);
    t.move(510, 500);

    expect(trashStates(t)).toEqual(['armed', 'over', 'armed']);
  });

  it('a release over it resets it before the delete', () => {
    const t = setup();
    t.press(10, 10);
    t.move(950, 650);
    t.up(950, 650);

    expect(trashStates(t)).toEqual(['over', 'quiet']);
    expect(t.calls.slice(-2)).toEqual([
      { call: 'writePreview', rect: null },
      { call: 'save', save: ['deleteNote', t.note.id] },
    ]);
    expect(t.calls.findIndex((c) => c.call === 'writeTrash' && c.state === 'quiet')).toBeLessThan(
      t.calls.findIndex((c) => c.call === 'save' && c.save[0] === 'deleteNote'),
    );
  });

  it('Escape over it cancels: the zone goes quiet and nothing is deleted', () => {
    const t = setup();
    t.press(10, 10);
    t.move(950, 650);
    t.on().key({ key: 'Escape' });

    expect(trashStates(t)).toEqual(['over', 'quiet']);
    expect(t.commits()).toEqual([]);
  });

  it('a Click never touches it', () => {
    const t = setup();
    t.press(10, 10);
    t.up(11, 10);

    expect(trashStates(t)).toEqual([]);
  });

  it('a resize never touches it, even over the zone', () => {
    const t = setup();
    t.pressResize(10, 10);
    t.move(950, 650);
    t.up(950, 650);

    expect(trashStates(t)).toEqual([]);
    expect(t.commits().map(({ save }) => save[0])).toEqual(['resize']);
  });
});
