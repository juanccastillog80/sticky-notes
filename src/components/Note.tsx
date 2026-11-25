import { memo, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useBoardDom } from '../BoardDomContext';
import type { Point } from '../geometry';
import { moveKind, resizeKinds, type ResizeHandle } from '../drag/kinds';
import { useDrag } from '../drag/useDrag';
import type { NoteId } from '../notes/note';
import { useCommands, useIsEditing, useNotes, useStores } from '../StoresContext';
import { caretOffsetAt } from './caret';
import { DOUBLE_CLICK_MS, ignorePressesFor } from './ignorePressesFor';
import styles from './Note.module.css';
import { useStopEditing } from './useStopEditing';
import { ResizeHandles } from './ResizeHandles';

/**
 * Idle, a press anywhere but a handle starts a move, and a Click starts Editing.
 * While Editing, the body is a textarea, so a press there only Raises (see `isInText`)
 * and Drags start from the Grip strip and the handles alone.
 */
export const Note = memo(function Note({ id }: { id: NoteId }) {
  const note = useNotes((state) => state.notes[id]);
  const editing = useIsEditing(id);
  const { notes, ui } = useStores();
  const stopEditing = useStopEditing();
  const { deleteNote, commit } = useCommands();
  const { scrollerRef, trashRef } = useBoardDom();
  const ref = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  // Where the Click that starts Editing puts the caret; `null` is the end of the text.
  const pendingCaret = useRef<number | null>(null);
  const start = useDrag(ref, { scrollerRef, trashRef, commit, onClick: startEditingAt });

  // Before paint, so the caret is in place on the first frame of Editing.
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editing || !editor) return;
    const offset = pendingCaret.current ?? editor.value.length;
    pendingCaret.current = null;
    editor.focus();
    editor.setSelectionRange(offset, offset);
  }, [editing]);

  if (!note) return null;

  function startEditingAt(pointer: Point) {
    if (editing) return;
    // Measured on the idle text, which the textarea lays out identically.
    pendingCaret.current = caretOffsetAt(textRef.current, pointer);
    ui.dispatch({ type: 'startEditing', id });
  }

  function press(e: PointerEvent<HTMLElement>) {
    if (!note) return;
    // A press on another Note, handles included, ends Editing wherever it is.
    if (!editing) stopEditing();
    start(e, moveKind, note);
  }

  function pressHandle(e: PointerEvent<HTMLElement>, handle: ResizeHandle) {
    if (!note) return;
    if (!editing) stopEditing();
    start(e, resizeKinds[handle], note);
  }

  function keyDownInEditor(e: KeyboardEvent<HTMLTextAreaElement>) {
    // An Escape that cancelled a Drag (prevented by the Drag engine) leaves Editing on.
    if (e.key === 'Escape' && !e.defaultPrevented) stopEditing();
  }

  const { x, y, width, height, z, colour, text } = note;
  return (
    <article
      ref={ref}
      aria-label="Note"
      className={styles.note}
      data-colour={colour}
      data-editing={editing ? '' : undefined}
      // Geometry only. `transform` is left free for the Drag Preview.
      style={{ left: x, top: y, width, height, zIndex: z }}
      onPointerDown={press}
    >
      <div className={styles.gripStrip} data-grip-strip="" />
      <button
        type="button"
        aria-label="Delete note"
        className={styles.delete}
        onPointerDown={(e) => {
          // Not a Press: no Raise, no Drag, and focus stays where it is until the delete.
          e.stopPropagation();
          e.preventDefault();
        }}
        onClick={(e) => {
          deleteNote(id);
          // A mouse click (not Enter or Space) may be the first half of a double-click.
          if (e.detail > 0) ignorePressesFor(DOUBLE_CLICK_MS);
        }}
      >
        ×
      </button>
      {editing ? (
        <textarea
          ref={editorRef}
          aria-label="Note text"
          className={styles.editor}
          value={text}
          onChange={(e) => {
            notes.dispatch({ type: 'setText', id, text: e.target.value });
          }}
          onKeyDown={keyDownInEditor}
        />
      ) : (
        <div ref={textRef} className={styles.text} data-note-text="">
          {text}
        </div>
      )}
      <ResizeHandles onPress={pressHandle} />
    </article>
  );
});
