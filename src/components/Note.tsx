import { memo } from 'react';
import type { NoteId } from '../notes/note';
import { useNotes } from '../StoresContext';
import styles from './Note.module.css';

export const Note = memo(function Note({ id }: { id: NoteId }) {
  const note = useNotes((state) => state.notes[id]);
  if (!note) return null;

  const { x, y, width, height, z, colour, text } = note;
  return (
    <article
      aria-label="Note"
      className={styles.note}
      data-colour={colour}
      // Geometry only. `transform` is left free for the Drag Preview.
      style={{ left: x, top: y, width, height, zIndex: z }}
    >
      <div className={styles.gripStrip} />
      <div className={styles.text}>{text}</div>
    </article>
  );
});
