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
  // The Board's scroll container. The top bar reads it to see which part of the Board is
  // visible, and a Drag to follow a scroll.
  const scrollerRef = useRef<HTMLDivElement>(null);
  const boardDom = useMemo(() => ({ scrollerRef }), []);

  return (
    <StoresContext value={stores}>
      <BoardDomContext value={boardDom}>
        <div className={styles.app}>
          <TopBar scrollerRef={scrollerRef} />
          <Board scrollerRef={scrollerRef} {...(onNoteRender && { onNoteRender })} />
        </div>
      </BoardDomContext>
    </StoresContext>
  );
}
