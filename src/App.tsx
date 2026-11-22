import { useRef } from 'react';
import { Board } from './components/Board';
import { TopBar } from './components/TopBar';
import { StoresContext, type Stores } from './StoresContext';
import styles from './App.module.css';

export function App({ stores }: { stores: Stores }) {
  // The Board's scroll container. The top bar reads it to see which part of the Board is visible.
  const scrollerRef = useRef<HTMLDivElement>(null);

  return (
    <StoresContext value={stores}>
      <div className={styles.app}>
        <TopBar scrollerRef={scrollerRef} />
        <Board scrollerRef={scrollerRef} />
      </div>
    </StoresContext>
  );
}
