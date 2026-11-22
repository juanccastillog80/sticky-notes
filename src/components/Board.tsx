import { useEffect, useRef, type MouseEvent, type RefObject } from 'react';
import { BOARD_SIZE, placeCentredAt, toBoardPoint } from '../geometry';
import { DEFAULT_NOTE_SIZE } from '../notes/note';
import { useCommands, useNotes } from '../StoresContext';
import { EmptyHint } from './EmptyHint';
import { Note } from './Note';
import styles from './Board.module.css';

export function Board({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const ids = useNotes((state) => state.ids);
  const { createNote } = useCommands();

  const boardRef = useRef<HTMLElement>(null);
  // A `dblclick` reports only where the second press landed, so the first is remembered.
  const presses = useRef({ previousToLast: false, last: false });

  useEffect(() => {
    // On the document, as a double-click can start outside the Board.
    function rememberPress(event: PointerEvent) {
      const onEmptyBoard = event.target === boardRef.current;
      presses.current = { previousToLast: presses.current.last, last: onEmptyBoard };
    }
    document.addEventListener('pointerdown', rememberPress, { capture: true });
    return () => {
      document.removeEventListener('pointerdown', rememberPress, { capture: true });
    };
  }, []);

  function createAtPointer(event: MouseEvent<HTMLElement>) {
    // Both presses must be on empty Board: either one anywhere else creates nothing.
    const { previousToLast, last } = presses.current;
    if (!previousToLast || !last) return;
    const pointer = toBoardPoint(
      { x: event.clientX, y: event.clientY },
      event.currentTarget.getBoundingClientRect(),
    );
    createNote(placeCentredAt(pointer, DEFAULT_NOTE_SIZE));
  }

  return (
    <main className={styles.viewport}>
      <div ref={scrollerRef} className={styles.scroller}>
        <section
          ref={boardRef}
          aria-label="Board"
          className={styles.board}
          style={BOARD_SIZE}
          onDoubleClick={createAtPointer}
        >
          {ids.map((id) => (
            <Note key={id} id={id} />
          ))}
        </section>
      </div>
      <EmptyHint />
    </main>
  );
}
