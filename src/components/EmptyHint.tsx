import { useNotes } from '../StoresContext';
import styles from './EmptyHint.module.css';

/** Sits over the scroll container, so it stays in the middle of the Board, which fits the window when empty. */
export function EmptyHint() {
  const isEmpty = useNotes((state) => state.ids.length === 0);
  if (!isEmpty) return null;

  return (
    <div className={styles.hint}>
      <p className={styles.title}>Your board is empty</p>
      <p className={styles.action}>Double-click anywhere to add a note of the current size</p>
    </div>
  );
}
