import {
  memo,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
  type UIEvent,
} from 'react';
import type { NoteId } from '../notes/note';
import { useIsEditing, useNotes, useStores } from '../StoresContext';
import styles from './Note.module.css';
import { ResizeHandles } from './ResizeHandles';

/** Markup and keys only: pointer presses and focus are the Press module's (`src/press/`). */
export const Note = memo(function Note({ id }: { id: NoteId }) {
  const note = useNotes((state) => state.notes[id]);
  const editing = useIsEditing(id);
  const { notes, ui } = useStores();
  const ref = useRef<HTMLElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const idleTextRef = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(editing);
  // Shared by the idle text and the textarea, so neither jumps when Editing starts or ends.
  const scrollTop = useRef(0);

  // Before paint, so the caret is in place on the first frame of Editing.
  useLayoutEffect(() => {
    const editor = editorRef.current;
    if (!editing || !editor) return;
    const caret = ui.getState().caret;
    const offset = caret ?? editor.value.length;
    editor.focus();
    editor.setSelectionRange(offset, offset);
    // A Click's caret is where the idle text showed it: keep that view. Placing the caret
    // moves it (Chrome back to the top), but the clicked line was in view, so it stays so.
    if (caret !== null) editor.scrollTop = scrollTop.current;
  }, [editing, ui]);

  // Marks the idle text `data-overflows` while text lies below its box, in its own DOM so
  // no other Note re-renders. The text is a dependency: it changes what overflows, but
  // not the box the observer watches.
  useLayoutEffect(() => {
    const element = idleTextRef.current;
    if (editing || !element) return;
    element.scrollTop = scrollTop.current;
    const mark = () => {
      scrollTop.current = element.scrollTop;
      const below = element.scrollHeight - element.scrollTop - element.clientHeight;
      if (below > 1) element.dataset.overflows = '';
      else delete element.dataset.overflows;
    };
    mark();
    const observer = new ResizeObserver(mark);
    observer.observe(element);
    element.addEventListener('scroll', mark, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener('scroll', mark);
    };
  }, [editing, note?.text]);

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

  function keyDownOnNote(e: KeyboardEvent<HTMLElement>) {
    // Not keys bubbling from the × or the textarea, nor shortcuts like Cmd+Backspace.
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

  /** Focus left on the removed article would fall to the body, and Tab restart from the toolbar. */
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
      <button
        type="button"
        aria-label="Delete note"
        className={styles.delete}
        data-press-target="delete"
      >
        ×
      </button>
      {editing ? (
        <NoteEditor
          ref={editorRef}
          id={id}
          text={text}
          onKeyDown={keyDownInEditor}
          onScroll={(e) => (scrollTop.current = e.currentTarget.scrollTop)}
        />
      ) : (
        // Out of the Tab order, where browsers put a scroller: Tab goes Note, ×, next Note.
        <div ref={idleTextRef} tabIndex={-1} className={styles.text} data-note-text="">
          {text}
        </div>
      )}
      <ResizeHandles />
    </article>
  );
});

/**
 * Keeps the Draft text in its own state, so typing touches no store. It lends the ui
 * store a reader, so the text is saved when Editing ends, before React unmounts anything.
 */
function NoteEditor({
  ref,
  id,
  text,
  onKeyDown,
  onScroll,
}: {
  ref: Ref<HTMLTextAreaElement>;
  id: NoteId;
  text: string;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onScroll: (e: UIEvent<HTMLTextAreaElement>) => void;
}) {
  const { ui } = useStores();
  const [draftText, setDraftText] = useState(text);
  // Read from outside React (a delete, `pagehide`), where state may be stale.
  const latestDraft = useRef(draftText);
  // Before paint, so Editing that ends in the next event still finds it.
  useLayoutEffect(() => ui.getState().holdDraft(id, () => latestDraft.current), [id, ui]);
  return (
    <textarea
      ref={ref}
      aria-label="Note text"
      className={styles.editor}
      value={draftText}
      onChange={(e) => {
        latestDraft.current = e.target.value;
        setDraftText(e.target.value);
      }}
      onKeyDown={onKeyDown}
      onScroll={onScroll}
    />
  );
}
