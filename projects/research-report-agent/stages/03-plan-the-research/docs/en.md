# Plan the research

> One question hides several. Split it before you search, and make the model optional.

**Type:** Build
**Languages:** Python
**Stage:** 3 of 7 (core)
**Time:** ~2 hours

## What you build

- `report_agent/planner.py`: `plan_research(question, model=None)` returns a `Plan` with a list of `Facet`s. Each facet has an id, a label for the report heading, a sub-question and keywords.
- `report_agent/model.py`: a `Model` protocol, a `ReplayModel` that answers from a recorded cassette, and a `LiveModel` you can point at any chat-completions-compatible endpoint when you want to.

## Why it matters

"Why are containers a weak sandbox for agent code?" is really four questions: what a container is, how it works, where it fails, and when to use something else. A plan names these separate coverage requirements before retrieval begins. Each facet later becomes a report section, so the trace can reveal which angle had no evidence.

Planning is also the first place a model enters this project, which raises two engineering problems you meet in every real agent:

1. **Tests must not call a live model.** They would be slow, cost money and give different answers each run.
2. **Model output is untrusted input.** A reply can be chatty, truncated or invalid JSON. The pipeline must keep working.

## Rule planner first

The default planner uses four templates:

| Label | Sub-question | Extra keywords |
|---|---|---|
| Overview | What is {subject}? | none |
| How it works | How does {subject} work? | works, uses, runs |
| Risks and limits | What are the risks and limits of {subject}? | risk, attack, escape, weakness, cost |
| When to use it | When should teams use {subject}? | use, teams, tradeoff, overhead |

The subject is the question with its leading question words removed. Keywords are the question tokens plus the extras. It is simple, deterministic, and it gives you a baseline to beat.

## Record and replay

A cassette is a JSON file of recorded calls:

```json
{"entries": [{"purpose": "plan", "prompt": "You plan research...", "response": "{\"facets\": [...]}"}]}
```

`ReplayModel` looks up `prompt_key(purpose, prompt)`, a sha256 of the exact prompt. If the prompt changes by one character, the lookup misses and raises `CassetteMiss`. That strictness is the point: a changed prompt is a changed experiment, and you should record it again on purpose.

## Fallback on bad output

```python
try:
    raw = model.complete(build_planner_prompt(question), purpose="plan")
    return Plan(question, parse_model_facets(raw, max_facets), source="model")
except (KeyError, ValueError, TypeError, AttributeError) as error:
    return Plan(question, rule_plan(question), source="rules-fallback", notes=[...])
```

`plan.source` records which path ran. The trace in stage 6 will show it, so you can count how often the model plan was rejected.

```figure
pj-rra-plan-facets
```

## Follow the mechanism

The replay key includes purpose and the exact prompt hash. Keeping purpose separate prevents the same prompt from accidentally matching a different operation. A fallback must also record why it happened; otherwise a green run can silently stop exercising model planning.

## Your task

```python
# model.py
class ReplayModel:
    def __init__(self, cassette_path): ...
    def complete(self, prompt, *, purpose) -> str: ...

# planner.py
class Facet:
    def query(self) -> str: ...
def subject_of(question) -> str: ...
def rule_plan(question, max_facets=4) -> list[Facet]: ...
def parse_model_facets(raw, max_facets) -> list[Facet]: ...
def plan_research(question, model=None, max_facets=4) -> Plan: ...
```

`build_planner_prompt` is already written. Do not change it, or the recorded cassette stops matching.

## Run the tests

```bash
python3 scripts/project_test.py research-report-agent --stage 3 --path my-report-agent
```

The cassette in `fixtures/cassettes/planner.json` holds one good recorded plan and one chatty reply that is not JSON. Your planner must use the first and fall back on the second.

## What you should see

Stage 3 passes 9 Python tests, and all preceding stages still pass. The recorded denylist question returns `source="model"` with 3 facets. A chatty reply and a missing cassette both produce `source="rules-fallback"` with an explanatory note.

## Check yourself

1. Why key the cassette by a hash of the full prompt instead of by the question?
2. What should happen when the model returns valid JSON with an empty `facets` list?
3. Where would you log `plan.notes` in production?

## Going further

- Set `RRA_LLM_BASE_URL`, `RRA_LLM_MODEL` and `RRA_LLM_API_KEY`, pass `LiveModel()` to `plan_research`, and compare its facets with the rule planner.
- Write a `RecordingModel` that wraps `LiveModel` and appends every call to a cassette, so a live run becomes a test fixture.

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 2](../../02-extract-snippets/docs/en.md) first.

Choose rules, a recorded cassette, or a live planner explicitly. Only planning calls the optional model; writing still arranges retrieved source sentences. The trace records whether planning used rules, model output or fallback.

```text
--model rules -> deterministic facets
--model replay --cassette planner.json -> exact prompt lookup
invalid facet JSON -> rules-fallback
```

## Build and inspect

Keep the prompt digest and purpose together in cassette lookup. Validate the response shape before constructing facets.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py research-report-agent --stage 3 --path learning-artifacts/research-report-agent
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Why should a live model failure not be mislabeled as a verified offline run?
