import { useMemo, useRef, type ProfilerOnRenderCallback } from 'react';
import { BoardDomContext } from './BoardDomContext';
import { Board } from './components/Board';
import { TopBar } from './components/TopBar';
import { StoresContext, type Stores } from './StoresContext';
import styles from './App.module.css';

export interface AppProps {
  readonly stores: Stores;
  /** Tests only: wraps each Note in a `<Profiler>`, so a test can see which Notes re-render. */
  readonly onNoteRender?: ProfilerOnRenderCallback;
}

export function App({ stores, onNoteRender }: AppProps) {
  // The Board's scroll container. The Trash zone reads it to stay pinned to the window,
  // and a Drag to follow a scroll.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<HTMLElement>(null);
  const trashRef = useRef<HTMLDivElement>(null);
  const boardDom = useMemo(() => ({ scrollerRef, boardRef, trashRef }), []);

  return (
    <StoresContext value={stores}>
      <BoardDomContext value={boardDom}>
        <div className={styles.app}>
          <TopBar />
          <Board scrollerRef={scrollerRef} {...(onNoteRender && { onNoteRender })} />
        </div>
      </BoardDomContext>
    </StoresContext>
  );
}
