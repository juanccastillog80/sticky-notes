import { useEffect, useRef } from 'react';
import { useStores, useUi } from '../StoresContext';
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
  const { notes, ui } = useStores();
  const undoRef = useRef<HTMLButtonElement>(null);

  // A keyboard delete removed the focused ×, dropping focus to the body: Undo takes it,
  // so the user keeps their place. A mouse delete leaves focus where it was.
  useEffect(() => {
    if (lastDeleted && document.activeElement === document.body) undoRef.current?.focus();
  }, [lastDeleted]);

  useEffect(() => {
    if (!lastDeleted) return;
    const timer = setTimeout(() => {
      ui.getState().hideUndo();
    }, UNDO_TOAST_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [lastDeleted, ui]);

  return (
    <div role="status" className={styles.region}>
      {lastDeleted && (
        // Keyed by the deleted Note, so a newer delete is new content and is announced again.
        <div key={lastDeleted.id} className={styles.toast}>
          <span>Note deleted</span>
          <button
            ref={undoRef}
            type="button"
            className={styles.undo}
            onClick={() => {
              notes.getState().undoDelete();
            }}
          >
            Undo
          </button>
        </div>
      )}
    </div>
  );
}
