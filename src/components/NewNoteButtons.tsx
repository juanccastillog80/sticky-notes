import type { RefObject } from 'react';
import { measureBoardSize, useBoardDom } from '../BoardDomContext';
import type { NoteSize } from '../notes/note';
import { useStores, useUi } from '../StoresContext';
import styles from './NewNoteButtons.module.css';

const BUTTONS = [
  { label: 'S', name: 'New small note', size: 'small' },
  { label: 'M', name: 'New medium note', size: 'medium' },
  { label: 'L', name: 'New large note', size: 'large' },
] as const satisfies readonly { label: string; name: string; size: NoteSize }[];

export function NewNoteButtons({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  const { notes } = useStores();
  const { boardRef } = useBoardDom();
  const currentColour = useUi((state) => state.currentColour);
  const currentSize = useUi((state) => state.currentSize);

  /** Creates a Note of `size` in the visible Board, and makes `size` the Current size. */
  function createInView(size: NoteSize) {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const { scrollLeft: x, scrollTop: y, clientWidth: width, clientHeight: height } = scroller;
    const view = { x, y, width, height };
    notes.getState().createNoteInView(size, view, measureBoardSize(boardRef.current));
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
