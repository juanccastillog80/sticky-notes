import type { RefObject } from 'react';
import { placeInVisibleBoard } from '../geometry';
import { NOTE_SIZE_PRESETS, type NoteSize } from '../notes/note';
import { useStores, useUi } from '../StoresContext';
import styles from './NewNoteButtons.module.css';

const BUTTONS = [
  { label: 'S', name: 'New small note', size: 'small' },
  { label: 'M', name: 'New medium note', size: 'medium' },
  { label: 'L', name: 'New large note', size: 'large' },
] as const satisfies readonly { label: string; name: string; size: NoteSize }[];

export function NewNoteButtons({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const { notes, ui } = useStores();
  const currentColour = useUi((state) => state.currentColour);
  const currentSize = useUi((state) => state.currentSize);

  /** Creates a Note of `size` in the visible Board, and makes `size` the Current size. */
  function createInView(size: NoteSize) {
    ui.getState().setCurrentSize(size);
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const { scrollLeft: x, scrollTop: y, clientWidth: width, clientHeight: height } = scroller;
    // Read at press time, not subscribed: the buttons don't re-render as Notes change.
    const taken = Object.values(notes.getState().notes);
    notes
      .getState()
      .createNote(placeInVisibleBoard({ x, y, width, height }, NOTE_SIZE_PRESETS[size], taken));
  }

  return (
    <div role="group" aria-label="New note" className={styles.group}>
      <span aria-hidden="true" className={styles.label}>
        New
      </span>
      {BUTTONS.map(({ label, name, size }) => (
        <button
          key={label}
          type="button"
          aria-label={name}
          aria-pressed={size === currentSize}
          title={name}
          className={styles.button}
          onClick={() => {
            createInView(size);
          }}
        >
          <span aria-hidden="true" className={styles.glyph} data-colour={currentColour} />
          {label}
        </button>
      ))}
    </div>
  );
}
