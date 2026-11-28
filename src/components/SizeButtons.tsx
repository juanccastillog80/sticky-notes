import type { NoteSize } from '../notes/note';
import { useStores, useUi } from '../StoresContext';
import styles from './SizeButtons.module.css';

const BUTTONS = [
  { label: 'S', name: 'Small notes', size: 'small' },
  { label: 'M', name: 'Medium notes', size: 'medium' },
  { label: 'L', name: 'Large notes', size: 'large' },
] as const satisfies readonly { label: string; name: string; size: NoteSize }[];

/** S/M/L pick the Current size, which a double-click on empty Board uses. They create no Note. */
export function SizeButtons() {
  const { ui } = useStores();
  const currentColour = useUi((state) => state.currentColour);
  const currentSize = useUi((state) => state.currentSize);

  return (
    <div role="group" aria-label="Size of new notes" className={styles.group}>
      <span aria-hidden="true" className={styles.label}>
        Size
      </span>
      {BUTTONS.map(({ label, name, size }) => (
        <button
          key={label}
          type="button"
          aria-label={name}
          aria-pressed={size === currentSize}
          title={name}
          className={styles.button}
          onClick={() => {
            ui.getState().setCurrentSize(size);
          }}
        >
          <span aria-hidden="true" className={styles.glyph} data-colour={currentColour} />
          {label}
        </button>
      ))}
    </div>
  );
}
