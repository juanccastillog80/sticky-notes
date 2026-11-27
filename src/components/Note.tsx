import {
  memo,
  useLayoutEffect,
  useRef,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from 'react';
import { useBoardDom } from '../BoardDomContext';
import type { Point } from '../geometry';
import { moveKind, resizeKinds, type ResizeHandle } from '../drag/kinds';
import { isInText } from '../drag/press';
import { useDrag } from '../drag/useDrag';
import type { NoteId } from '../notes/note';
import { useIsEditing, useNotes, useStores, useUi } from '../StoresContext';
import { caretOffsetAt } from './caret';
import { DOUBLE_CLICK_MS, ignorePressesFor } from './ignorePressesFor';
import styles from './Note.module.css';
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
  const { scrollerRef, boardRef, trashRef } = useBoardDom();
  const ref = useRef<HTMLElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  // Where the Click that starts Editing puts the caret; `null` is the end of the text.
  const pendingCaret = useRef<number | null>(null);
  // Tells the render where Editing ended apart from mounts that start out idle.
  const wasEditing = useRef(editing);
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

  // Escape ended Editing: the article takes focus, so Tab carries on from this Note.
  // After the textarea unmounts: focused any earlier, Firefox's next Tab skips the ×.
  useLayoutEffect(() => {
    const ended = wasEditing.current && !editing;
    wasEditing.current = editing;
    if (ended && ui.getState().editingEndedBy === 'escape') ref.current?.focus();
  }, [editing, ui]);

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
    ui.getState().pressed(id);
    start(e, moveKind, note);
  }

  function pressHandle(e: PointerEvent<HTMLElement>, handle: ResizeHandle) {
    if (!note) return;
    ui.getState().pressed(id);
    start(e, resizeKinds[handle], note);
  }

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
    // As a press on this Note: so the focus ring and the Editing outline are never on
    // two Notes at once.
    ui.getState().pressed(id);
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
        <NoteEditor ref={editorRef} text={text} onKeyDown={keyDownInEditor} />
      ) : (
        <div ref={textRef} className={styles.text} data-note-text="">
          {text}
        </div>
      )}
      <ResizeHandles onPress={pressHandle} />
    </article>
  );
});

/**
 * The textarea of the Note in Editing. It shows the Draft text, falling back to the
 * Note's saved `text` until something is typed, and is the only component that
 * subscribes to it: typing re-renders it alone, and changes no Note until Editing ends.
 */
function NoteEditor({
  ref,
  text,
  onKeyDown,
}: {
  ref: Ref<HTMLTextAreaElement>;
  text: string;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
  const { ui } = useStores();
  const draftText = useUi((state) => state.draftText);
  return (
    <textarea
      ref={ref}
      aria-label="Note text"
      className={styles.editor}
      value={draftText ?? text}
      onChange={(e) => {
        ui.getState().typed(e.target.value);
      }}
      onKeyDown={onKeyDown}
    />
  );
}
