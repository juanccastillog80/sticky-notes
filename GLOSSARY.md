# Sticky Notes

A single-page desktop app for placing, arranging and removing sticky notes on a board.

## Language

**Board**:
The bounded surface on which all notes live.
_Avoid_: Canvas, tablero, workspace

**Note**:
A single sticky note with a position, size and content on the board.
_Avoid_: Item, card, sticky

**Trash zone**:
A fixed region of the screen, always visible however far the board is scrolled; releasing a moved note while the note overlaps it (touching counts, wherever the pointer is) deletes the note.
_Avoid_: Bin, delete area, papelera

**Delete button**:
The × at the right end of every note's grip strip, always visible. Clicking it deletes the note at once; it is not a Press, so it never Raises or drags.
_Avoid_: Close button, remove

**Undo toast**:
The "Note deleted · Undo" message shown for 5 seconds after a delete. Undo brings the note back exactly as it was, stacking included. A newer delete replaces it.
_Avoid_: Snackbar, notification

**Press**:
The pointer going down on a note. It Raises the note at once; it becomes a drag only if the pointer then leaves the Dead zone.
_Avoid_: Click (that is a Press released inside the Dead zone), tap

**Click**:
A Press released inside the Dead zone. It saves nothing; on an idle note it starts Editing. Only a real release counts: a Press that is cancelled, or whose release went unseen, is neither a click nor a drag.
_Avoid_: Tap, select

**Drag**:
One complete press → move → release (or cancel) interaction by the user, such as moving or resizing a note. Chosen over "gesture", which in English suggests touch input such as pinch or swipe.
_Avoid_: Gesture, action

**Drag kind**:
What a drag does: move or resize. Every kind shares the same press → move → release behaviour and differs only in what it shows while the drag runs and what it saves at release.
_Avoid_: Drag type, drag mode, handler

**Preview**:
What the user sees of a note while a drag is still running. Only releasing turns it into the note's saved position or size; a cancelled drag discards it.
_Avoid_: Ghost, draft, live state

**Resize handle**:
One of 8 invisible zones along a note's edges and corners, named by the edges it moves (`n`, `se`, …). Pressing one starts a resize instead of a move. Only `se` draws a visible tick.
_Avoid_: Grip, resizer

**Dead zone**:
The small distance the pointer must travel after a press before it becomes a drag. A press released inside it is a click and saves nothing.
_Avoid_: Drag threshold, slop, tolerance

**Editing**:
The state of the one note whose text is being typed into. A click on a note, or Enter on a focused note, enters it; Escape or pressing anywhere else ends it. While editing, the note's body works as text and only its grip strip moves it.
_Avoid_: Edit mode, focus, active note

**Grip strip**:
The band along the top of every note. It always moves the note, including while the note is being edited.
_Avoid_: Header, handle, title bar

**Current colour**:
The colour the next new note gets. Picking a colour in the toolbar sets it, whether or not that pick also recolours the note being edited.
_Avoid_: Default colour, selected colour, active colour

**Raise**:
Bring a note to the front of the stacking order.
_Avoid_: Bring to front, focus, activate

**Stacking order**:
The front-to-back order in which notes overlap on the board.
_Avoid_: Z-order, z-index, layer

**Local copy**:
The Notes saved in this browser's localStorage, loaded before the first paint so the Board survives a reload.
_Avoid_: Cache, snapshot, offline store

**Unsaved change**:
Proposed with REST saving (ADR 0002); not built. A change to a note (including deleting it) that the server hasn't confirmed yet. It would be retried until it succeeds, and would survive a reload.
_Avoid_: Pending, dirty, unsynced
