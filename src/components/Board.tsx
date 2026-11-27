import {
  memo,
  Profiler,
  useEffect,
  useRef,
  type MouseEvent,
  type ProfilerOnRenderCallback,
  type RefObject,
} from 'react';
import { BOARD_SIZE, placeCentredAt, toBoardPoint } from '../geometry';
import { DEFAULT_NOTE_SIZE, type NoteId } from '../notes/note';
import { useBoardDom } from '../BoardDomContext';
import { useNotes, useStores } from '../StoresContext';
import { EmptyHint } from './EmptyHint';
import { Note } from './Note';
import { TrashZone } from './TrashZone';
import { UndoToast } from './UndoToast';
import styles from './Board.module.css';

export function Board({
  scrollerRef,
  onNoteRender,
}: {
  scrollerRef: RefObject<HTMLDivElement | null>;
  onNoteRender?: ProfilerOnRenderCallback;
}) {
  const ids = useNotes((state) => state.ids);
  const { notes, ui } = useStores();

  const { boardRef } = useBoardDom();
  // A `dblclick` reports only where the second press landed, so the first is remembered:
  // the last two presses anywhere on the page, and whether each landed on empty Board.
  const lastTwoPresses = useRef({ previousWasOnEmptyBoard: false, lastWasOnEmptyBoard: false });

  useEffect(() => {
    // On the document, as a double-click can start outside the Board.
    function rememberPress(event: PointerEvent) {
      lastTwoPresses.current = {
        previousWasOnEmptyBoard: lastTwoPresses.current.lastWasOnEmptyBoard,
        lastWasOnEmptyBoard: event.target === boardRef.current,
      };
    }
    document.addEventListener('pointerdown', rememberPress, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', rememberPress, { capture: true });
    };
  }, [boardRef]);

  function createAtPointer(event: MouseEvent<HTMLElement>) {
    // Both presses must be on empty Board: either one anywhere else creates nothing.
    const { previousWasOnEmptyBoard, lastWasOnEmptyBoard } = lastTwoPresses.current;
    if (!previousWasOnEmptyBoard || !lastWasOnEmptyBoard) return;
    const pointer = toBoardPoint(
      { x: event.clientX, y: event.clientY },
      event.currentTarget.getBoundingClientRect(),
    );
    notes.getState().createNote(placeCentredAt(pointer, DEFAULT_NOTE_SIZE));
  }

  return (
    <main className={styles.viewport}>
      <div ref={scrollerRef} className={styles.scroller}>
        <section
          ref={boardRef}
          aria-label="Board"
          // Focusable by script only: where focus goes when the last Note is deleted.
          tabIndex={-1}
          className={styles.board}
          style={BOARD_SIZE}
          onDoubleClick={createAtPointer}
          onPointerDown={(event) => {
            // A press on empty Board: Editing decides whether that ends it.
            if (event.target === event.currentTarget) ui.getState().pressed(null);
          }}
        >
          {ids.map((id) =>
            onNoteRender ? (
              <ProfiledNote key={id} id={id} onRender={onNoteRender} />
            ) : (
              <Note key={id} id={id} />
            ),
          )}
        </section>
      </div>
      <EmptyHint />
      <TrashZone />
      <UndoToast />
    </main>
  );
}

/**
 * Tests only. Memoised, so a Board render (create, delete) doesn't re-render the
 * `<Profiler>` itself: it then reports only when its own Note renders.
 */
const ProfiledNote = memo(function ProfiledNote({
  id,
  onRender,
}: {
  id: NoteId;
  onRender: ProfilerOnRenderCallback;
}) {
  return (
    <Profiler id={id} onRender={onRender}>
      <Note id={id} />
    </Profiler>
  );
});
