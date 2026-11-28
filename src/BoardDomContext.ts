import { createContext, use, type RefObject } from 'react';
import type { Size } from './geometry';

/** The value never changes. */
export interface BoardDom {
  readonly scrollerRef: RefObject<HTMLDivElement | null>;
  readonly boardRef: RefObject<HTMLElement | null>;
  readonly trashRef: RefObject<HTMLDivElement | null>;
}

/** Rounded down, so a Note clamped to it is whole pixels and never reaches past it. */
export function measureBoardSize(board: Element | null): Size {
  const rect = board?.getBoundingClientRect();
  return { width: Math.floor(rect?.width ?? 0), height: Math.floor(rect?.height ?? 0) };
}

export const BoardDomContext = createContext<BoardDom | null>(null);

export function useBoardDom(): BoardDom {
  const dom = use(BoardDomContext);
  if (!dom) throw new Error('useBoardDom needs a BoardDomContext provider');
  return dom;
}
