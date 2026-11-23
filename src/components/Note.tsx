import { memo, useRef, type PointerEvent } from 'react';
import { useBoardDom } from '../BoardDomContext';
import { moveKind } from '../drag/kinds';
import { useDrag } from '../drag/useDrag';
import type { NoteId } from '../notes/note';
import { useNotes, useStores } from '../StoresContext';
import styles from './Note.module.css';

export const Note = memo(function Note({ id }: { id: NoteId }) {
  const note = useNotes((state) => state.notes[id]);
  const { notes } = useStores();
  const { scrollerRef } = useBoardDom();
  const ref = useRef<HTMLElement>(null);
  const start = useDrag(ref, { scrollerRef, commit: notes.dispatch });
  if (!note) return null;

  function press(e: PointerEvent<HTMLElement>) {
    if (!note) return;
    // At once, and for the whole Drag: the Note being dragged never slides under others.
    notes.dispatch({ type: 'raise', id });
    start(e, moveKind, note);
  }

  const { x, y, width, height, z, colour, text } = note;
  return (
    <article
      ref={ref}
      aria-label="Note"
      className={styles.note}
      data-colour={colour}
      // Geometry only. `transform` is left free for the Drag Preview.
      style={{ left: x, top: y, width, height, zIndex: z }}
      onPointerDown={press}
    >
      <div className={styles.gripStrip} />
      <div className={styles.text}>{text}</div>
    </article>
  );
});
