"""Drive the actual Strands loop with a local model.

Lesson: projects/cloud-agent-with-aws-strands/stages/04-strands-adapter/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import json

from plan import validate_plan


def parse_model_plan(text, scope):
    raise NotImplementedError("Stage 4: implement parse_model_plan")


def run_strands(prompt, reply):
    raise NotImplementedError("Stage 4: implement run_strands")


def bedrock_agent(model_id, region):
    raise NotImplementedError("Stage 4: implement bedrock_agent")
