import { useRef, type MouseEvent, type PointerEvent, type RefObject } from 'react';
import { BOARD_SIZE, placeCentredAt, toBoardPoint } from '../geometry';
import { DEFAULT_NOTE_SIZE } from '../notes/note';
import { useCommands, useNotes } from '../StoresContext';
import { EmptyHint } from './EmptyHint';
import { Note } from './Note';
import styles from './Board.module.css';

export function Board({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const ids = useNotes((state) => state.ids);
  const { createNote } = useCommands();

  // A `dblclick` reports only where the second press landed, so the first is remembered.
  const presses = useRef({ first: false, second: false });

  function rememberPress(event: PointerEvent<HTMLElement>) {
    const onEmptyBoard = event.target === event.currentTarget;
    presses.current = { first: presses.current.second, second: onEmptyBoard };
  }

  function createAtPointer(event: MouseEvent<HTMLElement>) {
    // Both presses must be on empty Board: either one on a Note creates nothing.
    const { first, second } = presses.current;
    if (!first || !second) return;
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
          aria-label="Board"
          className={styles.board}
          style={BOARD_SIZE}
          onPointerDownCapture={rememberPress}
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
