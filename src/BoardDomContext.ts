import { createContext, use, type RefObject } from 'react';

/** The Board's DOM elements that code outside the Board needs. The value never changes. */
export interface BoardDom {
  /** The Board's scroll container. */
  readonly scrollerRef: RefObject<HTMLDivElement | null>;
}

export const BoardDomContext = createContext<BoardDom | null>(null);

export function useBoardDom(): BoardDom {
  const dom = use(BoardDomContext);
  if (!dom) throw new Error('useBoardDom needs a BoardDomContext provider');
  return dom;
}
