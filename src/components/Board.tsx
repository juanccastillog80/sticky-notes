import type { MouseEvent, RefObject } from 'react';
import { BOARD_SIZE, placeCentredAt, toBoardPoint } from '../geometry';
import { DEFAULT_NOTE_SIZE } from '../notes/note';
import { useCommands, useNotes } from '../StoresContext';
import { EmptyHint } from './EmptyHint';
import { Note } from './Note';
import styles from './Board.module.css';

export function Board({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const ids = useNotes((state) => state.ids);
  const { createNote } = useCommands();

  function createAtPointer(event: MouseEvent<HTMLElement>) {
    // A double-click on a Note bubbles up to here, and must create nothing.
    if (event.target !== event.currentTarget) return;
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
