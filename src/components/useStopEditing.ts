import { useStores } from '../StoresContext';

/**
 * Ends Editing, blurring the edited textarea explicitly: a press that starts a Drag
 * prevents its default, so focus would not move on its own.
 */
export function useStopEditing() {
  const { ui } = useStores();
  return () => {
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused.closest('[data-editing]')) focused.blur();
    ui.dispatch({ type: 'stopEditing' });
  };
}
