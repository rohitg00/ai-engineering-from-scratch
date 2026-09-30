"""Record allowed handoff state transitions.

Lesson: projects/support-agent-with-google-adk/stages/03-handoff/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

from routing import route


def begin(ticket):
    raise NotImplementedError("Stage 3: implement begin")


def transition(session, event, payload=None):
    raise NotImplementedError("Stage 3: implement transition")
