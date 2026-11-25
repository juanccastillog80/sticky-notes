import { useLayoutEffect } from 'react';
import { useBoardDom } from '../BoardDomContext';
import styles from './TrashZone.module.css';

/**
 * Pinned to the bottom-right of the visible Board, above Notes, whatever the scroll.
 * Dropping a moved Note with the pointer inside it deletes the Note. The Drag engine
 * writes `data-state` (`quiet`, `armed`, `over`) straight to the DOM, so a move never
 * re-renders it.
 */
export function TrashZone() {
  const { scrollerRef, trashRef } = useBoardDom();

  // Inset from the scroll container's scrollbars, which come and go with the window size.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    const zone = trashRef.current;
    if (!scroller || !zone) return;
    const inset = () => {
      zone.style.setProperty(
        '--scrollbar-x',
        `${String(scroller.offsetWidth - scroller.clientWidth)}px`,
      );
      zone.style.setProperty(
        '--scrollbar-y',
        `${String(scroller.offsetHeight - scroller.clientHeight)}px`,
      );
    };
    inset();
    const observer = new ResizeObserver(inset);
    observer.observe(scroller);
    return () => {
      observer.disconnect();
    };
  }, [scrollerRef, trashRef]);

  return (
    // Hidden from assistive technology: it is a pointer-only target. The × deletes from the keyboard.
    <div ref={trashRef} aria-hidden="true" className={styles.zone} data-state="quiet">
      <svg
        className={styles.icon}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
      </svg>
      <span>Drop to delete</span>
    </div>
  );
}
