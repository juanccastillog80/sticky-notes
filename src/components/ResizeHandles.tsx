import { RESIZE_HANDLES } from '../drag/kinds';
import styles from './ResizeHandles.module.css';

/** Invisible, except `se`, which draws a tick as a hint that Notes resize. */
export function ResizeHandles() {
  return RESIZE_HANDLES.map((handle) => (
    <div key={handle} className={styles.handle} data-press-target="handle" data-handle={handle} />
  ));
}
