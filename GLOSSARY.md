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
A fixed region of the screen, always visible however far the board is scrolled; releasing a note over it deletes the note.
_Avoid_: Bin, delete area, papelera

**Gesture**:
One complete press → move → release interaction by the user, such as moving, resizing or creating a note.
_Avoid_: Drag (when meaning the whole interaction), action

**Gesture kind**:
What a gesture does: move, resize, or (later) create. Every kind shares the same press → move → release behaviour and differs only in what it shows while the gesture runs and what it saves at release.
_Avoid_: Gesture type, drag mode, handler

**Preview**:
What the user sees of a note while a gesture is still running. Only releasing turns it into the note's saved position or size; a cancelled gesture discards it.
_Avoid_: Ghost, draft, live state

**Dead zone**:
The small distance the pointer must travel after a press before it becomes a gesture. A press released inside it is a click and saves nothing.
_Avoid_: Drag threshold, slop, tolerance

**Raise**:
Bring a note to the front of the stacking order.
_Avoid_: Bring to front, focus, activate

**Stacking order**:
The front-to-back order in which notes overlap on the board.
_Avoid_: Z-order, z-index, layer
