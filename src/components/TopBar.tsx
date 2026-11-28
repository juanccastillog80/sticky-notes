import { ColourSwatches } from './ColourSwatches';
import { SizeButtons } from './SizeButtons';
import styles from './TopBar.module.css';

export function TopBar() {
  return (
    <header className={styles.topBar}>
      <h1 className={styles.name}>Sticky Notes</h1>
      <SizeButtons />
      <ColourSwatches />
      {/* Always shown: S/M/L only pick a size, and the empty-Board hint goes with the first Note. */}
      <p className={styles.hint}>Double-click the Board to add a note</p>
    </header>
  );
}
