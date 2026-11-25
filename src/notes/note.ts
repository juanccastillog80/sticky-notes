import type { Rect, Size } from '../geometry';

declare const noteIdBrand: unique symbol;
export type NoteId = string & { readonly [noteIdBrand]: true };

export function newNoteId(): NoteId {
  return crypto.randomUUID() as NoteId;
}

/** The way in for an id from outside the app, such as storage or the server. */
export function parseNoteId(raw: unknown): NoteId | null {
  return typeof raw === 'string' && raw !== '' ? (raw as NoteId) : null;
}

export const NOTE_COLOURS = ['yellow', 'orange', 'pink', 'purple', 'blue', 'green'] as const;
export type NoteColour = (typeof NOTE_COLOURS)[number];

/** What a swatch is called, to people and to assistive tech. */
export const COLOUR_NAMES: Record<NoteColour, string> = {
  yellow: 'Yellow',
  orange: 'Orange',
  pink: 'Pink',
  purple: 'Purple',
  blue: 'Blue',
  green: 'Green',
};

export interface Note extends Rect {
  readonly id: NoteId;
  readonly text: string;
  readonly colour: NoteColour;
  /** The Note's place in the Stacking order: higher is nearer the front. */
  readonly z: number;
}

export const NOTE_SIZE_PRESETS = {
  small: { width: 160, height: 120 },
  medium: { width: 220, height: 170 },
  large: { width: 300, height: 230 },
} as const satisfies Record<string, Size>;

export const DEFAULT_NOTE_SIZE = NOTE_SIZE_PRESETS.medium;
