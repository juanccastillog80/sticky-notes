import type { RefObject } from 'react';
import { NewNoteButtons } from './NewNoteButtons';
import styles from './TopBar.module.css';

export function TopBar({ scrollerRef }: { scrollerRef: RefObject<HTMLDivElement | null> }) {
  return (
    <header className={styles.topBar}>
      <h1 className={styles.name}>Sticky Notes</h1>
      <NewNoteButtons scrollerRef={scrollerRef} />
    </header>
  );
}
