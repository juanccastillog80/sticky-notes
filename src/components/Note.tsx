import {
  memo,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { useBoardDom } from '../BoardDomContext';
import type { Point } from '../geometry';
import { moveKind, resizeKinds, type ResizeHandle } from '../drag/kinds';
import { isInText } from '../drag/press';
import { useDrag } from '../drag/useDrag';
import type { NoteId } from '../notes/note';
import { useIsEditing, useNotes, useStores } from '../StoresContext';
import { caretOffsetAt } from './caret';
import { DOUBLE_CLICK_MS, ignorePressesFor } from './ignorePressesFor';
import styles from './Note.module.css';
import { useStopEditing } from './useStopEditing';
import { ResizeHandles } from './ResizeHandles';

/**
 * Idle, a press anywhere but a handle starts a move, and a Click starts Editing.
 * While Editing, the body is a textarea, so a press there only Raises (see `isInText`)
 * and Drags start from the Grip strip and the handles alone.
 *
 * From the keyboard, the article itself takes focus: Enter starts Editing, Delete or
 * Backspace deletes. A left press prevents its default, so it never focuses the article;
 * a right or middle press can, which is why only keyboard focus (`:focus-visible`) Raises.
 */
export const Note = memo(function Note({ id }: { id: NoteId }) {
  const note = useNotes((state) => state.notes[id]);
  const editing = useIsEditing(id);
  const { notes, ui } = useStores();
  const stopEditing = useStopEditing();
  const { scrollerRef, boardRef, trashRef } = useBoardDom();
  const ref = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  // Where the Click that starts Editing puts the caret; `null` is the end of the text.
  const pendingCaret = useRef<number | null>(null);
  // Escape ended Editing: the article takes focus once the textarea is gone.
  const refocusWhenIdle = useRef(false);
  const start = useDrag(ref, { scrollerRef, boardRef, trashRef, onClick: startEditingAt });

  // Before paint, so the caret is in place on the first frame of Editing.
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editing || !editor) return;
    const offset = pendingCaret.current ?? editor.value.length;
    pendingCaret.current = null;
    editor.focus();
    editor.setSelectionRange(offset, offset);
  }, [editing]);

  // After the textarea unmounts: focused any earlier, Firefox's next Tab skips the ×.
  useLayoutEffect(() => {
    if (editing || !refocusWhenIdle.current) return;
    refocusWhenIdle.current = false;
    ref.current?.focus();
  }, [editing]);

  if (!note) return null;

  /** `caret` is a text offset, or `null` for the end of the text. */
  function startEditing(caret: number | null) {
    if (editing) return;
    pendingCaret.current = caret;
    ui.getState().startEditing(id);
  }

  function startEditingAt(pointer: Point) {
    // Measured on the idle text, which the textarea lays out identically.
    startEditing(caretOffsetAt(textRef.current, pointer));
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
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    // So Tab carries on from this Note.
    refocusWhenIdle.current = true;
    stopEditing();
  }

  /** Keys on the focused article itself: not those bubbling up from the × or the textarea. */
  function keyDownOnNote(e: KeyboardEvent<HTMLElement>) {
    // With a modifier, the key belongs to the browser or the system (Cmd+Backspace and the like).
    if (e.target !== e.currentTarget || editing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter') {
      // Or the textarea, focused before the key's default runs, would get a line break.
      e.preventDefault();
      startEditing(null);
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

  function focusNote(e: FocusEvent<HTMLElement>) {
    // The textarea is focused only by Editing, which a Press or Enter already Raised.
    if (isInText(e)) return;
    // Focus arriving from another Note's Editing ends it, as a press on this Note would,
    // so the focus ring and the Editing outline are never on two Notes at once.
    if (!editing) stopEditing();
    // Raised, so the focus ring is never under another Note. Only keyboard focus: a
    // right-button press focuses the article too, and must not Raise.
    if (e.target.matches(':focus-visible')) notes.getState().raise(id);
  }

  const { x, y, width, height, z, colour, text } = note;
  return (
    <article
      ref={ref}
      aria-label="Note"
      tabIndex={0}
      className={styles.note}
      data-colour={colour}
      data-editing={editing ? '' : undefined}
      // Geometry only. `transform` is left free for the Drag Preview.
      style={{ left: x, top: y, width, height, zIndex: z }}
      onPointerDown={press}
      onKeyDown={keyDownOnNote}
      onFocus={focusNote}
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
          notes.getState().deleteNote(id);
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
            notes.getState().setText(id, e.target.value);
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
