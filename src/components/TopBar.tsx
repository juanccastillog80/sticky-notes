import { ColourSwatches } from './ColourSwatches';
import { SizeButtons } from './SizeButtons';
import styles from './TopBar.module.css';

export function TopBar() {
  return (
    <header className={styles.topBar}>
      <h1 className={styles.name}>Sticky Notes</h1>
      <SizeButtons />
      <ColourSwatches />
    </header>
  );
}
