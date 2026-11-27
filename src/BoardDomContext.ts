import { createContext, use, type RefObject } from 'react';
import type { Size } from './geometry';

/** The Board's DOM elements that code outside the Board needs. The value never changes. */
export interface BoardDom {
  /** The Board's scroll container. */
  readonly scrollerRef: RefObject<HTMLDivElement | null>;
  /** The Board itself, whose top-left on screen places a dragged Note's rect against the Trash zone. */
  readonly boardRef: RefObject<HTMLElement | null>;
  /** The Trash zone, which a move measures at press and draws its states on. */
  readonly trashRef: RefObject<HTMLDivElement | null>;
}

/**
 * The Board's current size, rounded down to whole pixels so a Note clamped to it is
 * whole pixels and never reaches past it. The Board's size is set by CSS: the visible
 * area or the Notes' extent, whichever is larger (ADR 0003).
 */
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
