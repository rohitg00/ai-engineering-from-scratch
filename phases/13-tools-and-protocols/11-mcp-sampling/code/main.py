"""Phase 13 Lesson 11 - MCP sampling harness (server -> client LLM calls).

Simulated server-to-client sampling:
  - Server's summarize_repo tool runs two sampling rounds (pick files, then
    synthesize) by calling a 'fake_client_sample' stand-in for the client.
  - Rate-limited at max_samples_per_tool to prevent loop bombs.
  - ModelPreferences are printed so you can see the cost/speed/intelligence
    trade-off shape.

Stdlib only.

Run: python code/main.py
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field


FAKE_REPO = {
    "README.md": "This repo implements the toy MCP notes server.",
    "server.py": "def dispatch(msg): ... handler code ...",
    "client.py": "def connect(): ... subprocess Popen ...",
    "LICENSE": "MIT",
    "tests/test_server.py": "def test_initialize(): ...",
    "assets/diagram.svg": "<svg>...</svg>",
    "docs/intro.md": "## Introduction to the toy notes server",
}


CANNED_RESPONSES = {
    "pick": json.dumps(["README.md", "server.py", "docs/intro.md"]),
    "summarize": "This repo is a toy MCP server teaching the sampling loop. "
                 "The server dispatches JSON-RPC methods; clients drive it over stdio. "
                 "Documentation in docs/ introduces the pattern end to end.",
}


@dataclass
class SampleRequest:
    messages: list[dict]
    system_prompt: str
    model_preferences: dict
    max_tokens: int = 1024
    include_context: str = "none"
    tools: list[dict] | None = None


@dataclass
class SampleResponse:
    role: str
    content: dict
    model: str
    stop_reason: str


def fake_client_sample(req: SampleRequest) -> SampleResponse:
    """Stand-in for the client's LLM. Picks a canned response by keyword."""
    text = req.messages[-1]["content"]["text"].lower()
    if "pick" in text or "choose" in text:
        body = CANNED_RESPONSES["pick"]
    else:
        body = CANNED_RESPONSES["summarize"]
    return SampleResponse(
        role="assistant",
        content={"type": "text", "text": body},
        model="claude-3-5-sonnet-fake",
        stop_reason="endTurn",
    )


@dataclass
class SamplingBudget:
    used: int = 0
    max_samples_per_tool: int = 5


def sample(req: SampleRequest, budget: SamplingBudget) -> SampleResponse:
    if budget.used >= budget.max_samples_per_tool:
        raise RuntimeError("sampling rate limit exceeded (loop bomb guard)")
    budget.used += 1
    print(f"    [sample #{budget.used}] model_prefs={req.model_preferences} "
          f"includeContext={req.include_context!r}")
    print(f"      system: {req.system_prompt[:60]}...")
    print(f"      user  : {req.messages[-1]['content']['text'][:60]}...")
    resp = fake_client_sample(req)
    print(f"      <- model={resp.model}  stop={resp.stop_reason}  "
          f"len={len(resp.content['text'])}")
    return resp


def summarize_repo_tool(args: dict) -> dict:
    budget = SamplingBudget()

    pick_req = SampleRequest(
        messages=[{"role": "user", "content": {"type": "text", "text":
            "Given this file list, pick five files most likely to describe the repo's purpose. "
            f"Files: {list(FAKE_REPO.keys())}. Reply as a JSON array of filenames."}}],
        system_prompt="You select representative files for repo summarization.",
        model_preferences={
            "costPriority": 0.5,
            "speedPriority": 0.3,
            "intelligencePriority": 0.2,
            "hints": [{"name": "claude-3-5-haiku"}],
        },
        max_tokens=256,
        include_context="none",
    )
    pick_resp = sample(pick_req, budget)
    picked = json.loads(pick_resp.content["text"])
    print(f"    picked files: {picked}")

    combined = "\n\n".join(f"=== {f} ===\n{FAKE_REPO[f]}" for f in picked if f in FAKE_REPO)

    summ_req = SampleRequest(
        messages=[{"role": "user", "content": {"type": "text", "text":
            f"Summarize the repo in three paragraphs given these files:\n\n{combined}"}}],
        system_prompt="You write concise, accurate repo summaries.",
        model_preferences={
            "costPriority": 0.2,
            "speedPriority": 0.2,
            "intelligencePriority": 0.6,
            "hints": [{"name": "claude-3-5-sonnet"}],
        },
        max_tokens=512,
        include_context="none",
    )
    summ_resp = sample(summ_req, budget)

    return {
        "content": [{"type": "text", "text": summ_resp.content["text"]}],
        "isError": False,
        "_meta": {"samplesUsed": budget.used},
    }


def main() -> None:
    print("=" * 72)
    print("PHASE 13 LESSON 11 - MCP SAMPLING HARNESS")
    print("=" * 72)
    print()
    print("summarize_repo invoked (no server-side LLM credentials)")
    print("-" * 72)
    try:
        result = summarize_repo_tool({})
        print("\n  result.content[0].text:")
        print(f"    {result['content'][0]['text']}")
        print(f"\n  samples used: {result['_meta']['samplesUsed']}")
    except RuntimeError as e:
        print(f"  loop-bomb guard triggered: {e}")


if __name__ == "__main__":
    main()
