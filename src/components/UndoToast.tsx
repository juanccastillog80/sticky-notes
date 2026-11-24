import { useEffect } from 'react';
import { useCommands, useStores, useUi } from '../StoresContext';
import styles from './UndoToast.module.css';

/** How long the Undo toast stays after a delete. */
export const UNDO_TOAST_MS = 5000;

/**
 * "Note deleted · Undo" after a delete. A newer delete replaces `lastDeleted`, so the
 * effect restarts the timer. The live region is always mounted, so screen readers
 * announce each delete.
 */
export function UndoToast() {
  const lastDeleted = useUi((state) => state.lastDeleted);
  const { ui } = useStores();
  const { undoDelete } = useCommands();

  useEffect(() => {
    if (!lastDeleted) return;
    const timer = setTimeout(() => {
      ui.dispatch({ type: 'hideUndo' });
    }, UNDO_TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [lastDeleted, ui]);

  return (
    <div role="status" className={styles.region}>
      {lastDeleted && (
        <div className={styles.toast}>
          <span>Note deleted</span>
          <button type="button" className={styles.undo} onClick={undoDelete}>
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
