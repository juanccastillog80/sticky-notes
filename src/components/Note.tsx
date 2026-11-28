import { memo, useLayoutEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import type { NoteId } from '../notes/note';
import { useIsEditing, useNotes, useStores } from '../StoresContext';
import styles from './Note.module.css';
import { ResizeHandles } from './ResizeHandles';

/**
 * Markup and keys only. What the pointer going down does, on any of a Note's Press
 * targets, and focus arriving on it, are the Press module's (`src/press/`): each Press
 * target is marked with `data-press-target` for it to read.
 *
 * From the keyboard, the article itself takes focus: Enter starts Editing, Delete or
 * Backspace deletes.
 */
export const Note = memo(function Note({ id }: { id: NoteId }) {
  const note = useNotes((state) => state.notes[id]);
  const editing = useIsEditing(id);
  const { notes, ui } = useStores();
  const ref = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  // Tells the render where Editing ended apart from mounts that start out idle.
  const wasEditing = useRef(editing);

  // Before paint, so the caret is in place on the first frame of Editing. Read once:
  // where Editing started it (a Click's caret, or `null` for the end of the text).
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editing || !editor) return;
    const offset = ui.getState().caret ?? editor.value.length;
    editor.focus();
    editor.setSelectionRange(offset, offset);
  }, [editing, ui]);

  // Escape ended Editing: the article takes focus, so Tab carries on from this Note.
  // After the textarea unmounts: focused any earlier, Firefox's next Tab skips the ×.
  useLayoutEffect(() => {
    const ended = wasEditing.current && !editing;
    wasEditing.current = editing;
    if (ended && ui.getState().editingEndedBy === 'escape') ref.current?.focus();
  }, [editing, ui]);

  if (!note) return null;

  function keyDownInEditor(e: KeyboardEvent<HTMLTextAreaElement>) {
    // An Escape that cancelled a Drag (prevented by the Drag engine) leaves Editing on.
    if (e.key === 'Escape' && !e.defaultPrevented) ui.getState().escaped();
  }

  /** Keys on the focused article itself: not those bubbling up from the × or the textarea. */
  function keyDownOnNote(e: KeyboardEvent<HTMLElement>) {
    // With a modifier, the key belongs to the browser or the system (Cmd+Backspace and the like).
    if (e.target !== e.currentTarget || editing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') {
      // Or the textarea, focused before the key's default runs, would get a line break.
      e.preventDefault();
      ui.getState().startEditing(id, null);
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteAndFocusNeighbour(e.currentTarget);
    }
  }

  /**
   * Keeps the user's place for the next Tab: focus left on the removed article would
   * fall to the body, and Tab would start again from the toolbar.
   */
  function deleteAndFocusNeighbour(article: HTMLElement) {
    const board = article.parentElement;
    const siblings = board ? [...board.querySelectorAll<HTMLElement>(':scope > article')] : [];
    const index = siblings.indexOf(article);
    const next = siblings[index + 1] ?? siblings[index - 1] ?? board;
    notes.getState().deleteNote(id);
    // Before the Undo toast's effect runs, so it sees focus taken and leaves it here.
    next?.focus();
  }

  const { x, y, width, height, z, colour, text } = note;
  return (
    <article
      ref={ref}
      aria-label="Note"
      tabIndex={0}
      className={styles.note}
      data-note-id={id}
      data-press-target="body"
      data-colour={colour}
      data-editing={editing ? '' : undefined}
      // Geometry only. `transform` is left free for the Drag Preview.
      style={{ left: x, top: y, width, height, zIndex: z }}
      onKeyDown={keyDownOnNote}
    >
      <div className={styles.gripStrip} data-grip-strip="" data-press-target="grip" />
      {/* Deletes on click, through the Press module, which also ignores the double-click's second half. */}
      <button
        type="button"
        aria-label="Delete note"
        className={styles.delete}
        data-press-target="delete"
      >
        ×
      </button>
      {editing ? (
        <NoteEditor ref={editorRef} id={id} text={text} onKeyDown={keyDownInEditor} />
      ) : (
        <div className={styles.text} data-note-text="">
          {text}
        </div>
      )}
      <ResizeHandles />
    </article>
  );
});

/**
 * The textarea of the Note in Editing. It keeps the Draft text in its own state,
 * starting from the Note's saved `text`: typing re-renders it alone, and touches no
 * store. It lends the ui store how to read the Draft text, so however Editing ends,
 * the Notes store saves it to the Note at once, before React has unmounted anything.
 */
function NoteEditor({
  ref,
  id,
  text,
  onKeyDown,
}: {
  ref: Ref<HTMLTextAreaElement>;
  id: NoteId;
  text: string;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const { ui } = useStores();
  const [draftText, setDraftText] = useState(text);
  // Read when Editing ends, which may be from outside React (a delete, `pagehide`).
  const latest = useRef(draftText);
  // Before paint, so Editing that ends in the next event still finds it. Nothing to
  // undo on unmount: the Notes store reads it as Editing ends, and the next lends anew.
  useLayoutEffect(() => {
    ui.getState().holdDraft(id, () => latest.current);
  }, [id, ui]);
  return (
    <textarea
      ref={ref}
      aria-label="Note text"
      className={styles.editor}
      value={draftText}
      onChange={(e) => {
        latest.current = e.target.value;
        setDraftText(e.target.value);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
