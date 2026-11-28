import { memo, Profiler, useEffect, type ProfilerOnRenderCallback, type RefObject } from 'react';
import { useShallow } from 'zustand/shallow';
import { notesExtent } from '../geometry';
import type { NoteId } from '../notes/note';
import { useBoardDom } from '../BoardDomContext';
import { attachPress } from '../press/pressDom';
import { useNotes, useStores } from '../StoresContext';
import { EmptyHint } from './EmptyHint';
import { Note } from './Note';
import { TrashZone } from './TrashZone';
import { UndoToast } from './UndoToast';
import styles from './Board.module.css';

export function Board({
  scrollerRef,
  onNoteRender,
}: {
  scrollerRef: RefObject<HTMLDivElement | null>;
  onNoteRender?: ProfilerOnRenderCallback;
}) {
  const ids = useNotes((state) => state.ids);
  const stores = useStores();
  // The Board is at least as big as its Notes; CSS makes it at least the visible area too.
  // Compared field by field, so only a change of the furthest edges re-renders the Board.
  const extent = useNotes(useShallow((state) => notesExtent(Object.values(state.notes))));

  const boardDom = useBoardDom();
  const { boardRef } = boardDom;
  // Everything the pointer going down does, on Notes and on empty Board (`src/press/`).
  useEffect(() => attachPress(stores, boardDom), [stores, boardDom]);

  return (
    <main className={styles.viewport}>
      <div ref={scrollerRef} className={styles.scroller}>
        <section
          ref={boardRef}
          aria-label="Board"
          // Focusable by script only: where focus goes when the last Note is deleted.
          tabIndex={-1}
          className={styles.board}
          style={{ width: extent.width, height: extent.height }}
        >
          {ids.map((id) =>
            onNoteRender ? (
              <ProfiledNote key={id} id={id} onRender={onNoteRender} />
            ) : (
              <Note key={id} id={id} />
            ),
          )}
        </section>
      </div>
      <EmptyHint />
      <TrashZone />
      <UndoToast />
    </main>
  );
}

/**
 * Tests only. Memoised, so a Board render (create, delete) doesn't re-render the
 * `<Profiler>` itself: it then reports only when its own Note renders.
 */
const ProfiledNote = memo(function ProfiledNote({
  id,
  onRender,
}: {
  id: NoteId;
  onRender: ProfilerOnRenderCallback;
}) {
  return (
    <Profiler id={id} onRender={onRender}>
      <Note id={id} />
    </Profiler>
  );
});
