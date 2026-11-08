`initial():Answer`; `apply(state,event):Answer`. Answer contains text, citations, status, lastID and accepted events. `interrupt(state)` preserves text and marks interrupted. `cancel(state)` marks a noncompleted answer cancelled; cancelled answers ignore subsequent events.

Make duplicate delivery harmless while preserving incomplete state.
