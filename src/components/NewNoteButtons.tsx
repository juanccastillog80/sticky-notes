import type { RefObject } from 'react';
import { placeInVisibleBoard, type Size } from '../geometry';
import { NOTE_SIZE_PRESETS } from '../notes/note';
import { useStores, useUi } from '../StoresContext';
import styles from './NewNoteButtons.module.css';

const BUTTONS = [
  { label: 'S', name: 'New small note', size: NOTE_SIZE_PRESETS.small },
  { label: 'M', name: 'New medium note', size: NOTE_SIZE_PRESETS.medium },
  { label: 'L', name: 'New large note', size: NOTE_SIZE_PRESETS.large },
] as const;

export function NewNoteButtons({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const { notes } = useStores();
  const currentColour = useUi((state) => state.currentColour);

  function createInView(size: Size) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const { scrollLeft: x, scrollTop: y, clientWidth: width, clientHeight: height } = scroller;
    // Read at press time, not subscribed: the buttons don't re-render as Notes change.
    const taken = Object.values(notes.getState().notes);
    notes.getState().createNote(placeInVisibleBoard({ x, y, width, height }, size, taken));
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
