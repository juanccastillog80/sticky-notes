import { COLOUR_NAMES, NOTE_COLOURS } from '../notes/note';
import { useNotes, useStores, useUi } from '../StoresContext';
import styles from './ColourSwatches.module.css';

export function ColourSwatches() {
  const { notes } = useStores();
  const editingId = useUi((state) => state.editingId);
  const currentColour = useUi((state) => state.currentColour);
  const editedColour = useNotes((state) =>
    editingId ? state.notes[editingId]?.colour : undefined,
  );
  const shown = editedColour ?? currentColour;

  return (
    <div role="group" aria-label="Colour" className={styles.group}>
      {NOTE_COLOURS.map((colour) => (
        <button
          key={colour}
          type="button"
          aria-label={COLOUR_NAMES[colour]}
          aria-pressed={colour === shown}
          title={COLOUR_NAMES[colour]}
          className={styles.swatch}
          data-colour={colour}
          // Focus moves on mousedown, so preventing it (not pointerdown) is what keeps
          // focus and caret in the edited Note. Keyboard use still focuses the swatch.
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onClick={() => {
            notes.getState().pickColour(colour);
          }}
        />
      ))}
      <span className={styles.label}>{editedColour ? 'this note' : 'next note'}</span>
    </div>
  );
}
