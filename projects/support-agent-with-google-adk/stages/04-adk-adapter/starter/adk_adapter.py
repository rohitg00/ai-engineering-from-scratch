"""Run two actual ADK agents with a session handoff.

Lesson: projects/support-agent-with-google-adk/stages/04-adk-adapter/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""


def collect_events(events):
    raise NotImplementedError("Stage 4: implement collect_events")


async def run_adk(
    ticket_text,
    route_reply=None,
    answer_reply=None,
    *,
    ticket_id="local-ticket",
    requested_tool=None,
    model=None,
):
    raise NotImplementedError("Stage 4: implement run_adk")
