import type { PointerEvent } from 'react';
import { RESIZE_HANDLES, type ResizeHandle } from '../drag/kinds';
import styles from './ResizeHandles.module.css';

/**
 * 8 invisible hit zones along a Note's edges and corners. A press on one starts a
 * resize instead of a move. Only `se` draws a tick, as a hint that Notes resize.
 */
export function ResizeHandles({
  onPress,
}: {
  onPress: (e: PointerEvent<HTMLElement>, handle: ResizeHandle) => void;
}) {
  return RESIZE_HANDLES.map((handle) => (
    <div
      key={handle}
      className={styles.handle}
      data-handle={handle}
      onPointerDown={(e) => {
        // The Note's own pointerdown would start a move.
        e.stopPropagation();
        onPress(e, handle);
      }}
    />
  ));
}
