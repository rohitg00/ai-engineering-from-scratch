"""Drive the actual Strands loop with a local model.

Lesson: projects/cloud-agent-with-aws-strands/stages/04-strands-adapter/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import json
from plan import validate_plan


def parse_model_plan(text, scope):
    return validate_plan(json.loads(text), scope)


def run_strands(prompt, reply):
    from strands import Agent
    from strands.models import Model

    class FixtureModel(Model):
        def __init__(self):
            self.config = {"model_id": "offline-fixture", "context_window_limit": 10000}
            self.calls = 0

        def get_config(self):
            return dict(self.config)

        def update_config(self, **config):
            self.config.update(config)

        async def structured_output(self, *args, **kwargs):
            raise NotImplementedError("fixture uses plain text plans")
            yield

        async def stream(self, messages, tool_specs=None, system_prompt=None, **kwargs):
            self.calls += 1
            yield {"messageStart": {"role": "assistant"}}
            yield {"contentBlockStart": {"start": {}}}
            yield {"contentBlockDelta": {"delta": {"text": reply}}}
            yield {"contentBlockStop": {}}
            yield {"messageStop": {"stopReason": "end_turn"}}

    model = FixtureModel()
    agent = Agent(
        model=model,
        callback_handler=None,
        system_prompt="Propose a read-only JSON plan. Execution requires a separate scope check.",
    )
    result = agent(prompt)
    return {
        "text": "".join(part.get("text", "") for part in result.message["content"]),
        "model_calls": model.calls,
    }


def bedrock_agent(model_id, region):
    from strands import Agent
    from strands.models import BedrockModel

    if not model_id or not region:
        raise ValueError("explicit model id and region required")
    return Agent(
        model=BedrockModel(model_id=model_id, region_name=region),
        callback_handler=None,
        system_prompt="Propose read-only inspection plans. Never claim execution.",
    )
