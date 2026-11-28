/** One step of real mouse input, in the test page's client coordinates. Shared by both sides of the `mouse` command. */
export type MouseStep =
  | { readonly type: 'move'; readonly x: number; readonly y: number; readonly steps?: number }
  | { readonly type: 'down'; readonly button?: MouseButton }
  | { readonly type: 'up'; readonly button?: MouseButton }
  | { readonly type: 'wheel'; readonly deltaY: number };

export type MouseButton = 'left' | 'right' | 'middle';
