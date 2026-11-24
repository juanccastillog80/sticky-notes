import { memo, useLayoutEffect, useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { useBoardDom } from '../BoardDomContext';
import type { Point } from '../geometry';
import { moveKind, resizeKinds, type ResizeHandle } from '../drag/kinds';
import { useDrag } from '../drag/useDrag';
import type { NoteId } from '../notes/note';
import { useIsEditing, useNotes, useStores } from '../StoresContext';
import { caretOffsetAt } from './caret';
import styles from './Note.module.css';
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
  const { scrollerRef } = useBoardDom();
  const ref = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  // Where the Click that starts Editing puts the caret; `null` is the end of the text.
  const caret = useRef<number | null>(null);
  const start = useDrag(ref, { scrollerRef, commit: notes.dispatch, onClick: startEditingAt });

  // Before paint, so the caret is in place on the first frame of Editing.
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editing || !editor) return;
    const offset = caret.current ?? editor.value.length;
    caret.current = null;
    editor.focus();
    editor.setSelectionRange(offset, offset);
  }, [editing]);

  if (!note) return null;

  function startEditingAt(pointer: Point) {
    if (editing) return;
    // Measured on the idle text, which the textarea lays out identically.
    caret.current = caretOffsetAt(textRef.current, pointer);
    ui.dispatch({ type: 'startEditing', id });
  }

  function stopEditing() {
    // Explicit: a press that starts a Drag prevents its default, so focus wouldn't move.
    editorRef.current?.blur();
    ui.dispatch({ type: 'stopEditing' });
  }

  function press(e: PointerEvent<HTMLElement>) {
    if (!note) return;
    // A press on another Note ends Editing wherever it is.
    if (!editing) ui.dispatch({ type: 'stopEditing' });
    start(e, moveKind, note);
  }

  function pressHandle(e: PointerEvent<HTMLElement>, handle: ResizeHandle) {
    if (!note) return;
    start(e, resizeKinds[handle], note);
  }

  function key(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') stopEditing();
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
      <div className={styles.gripStrip} />
      {editing ? (
        <textarea
          ref={editorRef}
          aria-label="Note text"
          className={styles.editor}
          value={text}
          onChange={(e) => {
            notes.dispatch({ type: 'setText', id, text: e.target.value });
          }}
          onKeyDown={key}
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
