import { NOTE_COLOURS, type NoteColour } from '../notes/note';
import { useCommands, useNotes, useStores, useUi } from '../StoresContext';
import styles from './ColourSwatches.module.css';

const NAMES: Record<NoteColour, string> = {
  yellow: 'Yellow',
  orange: 'Orange',
  pink: 'Pink',
  purple: 'Purple',
  blue: 'Blue',
  green: 'Green',
};

/**
 * While Editing, a swatch recolours the edited Note (which also sets the Current colour).
 * Otherwise it sets only the Current colour, for the next Note.
 */
export function ColourSwatches() {
  const { ui } = useStores();
  const { recolour } = useCommands();
  const editingId = useUi((state) => state.editingId);
  const currentColour = useUi((state) => state.currentColour);
  const editedColour = useNotes((state) =>
    editingId ? state.notes[editingId]?.colour : undefined,
  );
  const shown = editedColour ?? currentColour;

  function pick(colour: NoteColour) {
    if (editingId) recolour(editingId, colour);
    else ui.dispatch({ type: 'setCurrentColour', colour });
  }

  return (
    <div role="group" aria-label="Colour" className={styles.group}>
      {NOTE_COLOURS.map((colour) => (
        <button
          key={colour}
          type="button"
          aria-label={NAMES[colour]}
          aria-pressed={colour === shown}
          title={NAMES[colour]}
          className={styles.swatch}
          data-colour={colour}
          // A mouse press doesn't take focus, so the edited Note keeps its focus and caret.
          onMouseDown={(e) => {
            e.preventDefault();
          }}
          onClick={() => {
            pick(colour);
          }}
        />
      ))}
      <span className={styles.label}>{editedColour ? 'this note' : 'next note'}</span>
    </div>
  );
}
