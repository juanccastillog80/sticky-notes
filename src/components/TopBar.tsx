import { ColourSwatches } from './ColourSwatches';
import { SizeButtons } from './SizeButtons';
import styles from './TopBar.module.css';

export function TopBar() {
  return (
    <header className={styles.topBar}>
      <h1 className={styles.name}>Sticky Notes</h1>
      <SizeButtons />
      <ColourSwatches />

      <p className={styles.hint}>Double-click the Board to add a note</p>
    </header>
  );
}
