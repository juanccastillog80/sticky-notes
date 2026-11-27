import { BOARD_SIZE } from '../geometry';
import { useNotes } from '../StoresContext';
import styles from './EmptyHint.module.css';

/** Sits over the scroll container, so it stays in the middle of the visible Board. */
export function EmptyHint() {
  const isEmpty = useNotes((state) => state.ids.length === 0);
  if (!isEmpty) return null;

  return (
    <div
      className={styles.hint}
      // On a window larger than the Board, centre on the Board, not on the backdrop.
      style={{ maxWidth: BOARD_SIZE.width, maxHeight: BOARD_SIZE.height }}
    >
      <p className={styles.title}>Your board is empty</p>
      <p className={styles.action}>Double-click anywhere to add a note of the selected size</p>
    </div>
  );
}
