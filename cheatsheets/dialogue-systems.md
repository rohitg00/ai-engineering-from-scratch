---
id: dialogue-systems
title: Chatbots and Dialogue State Tracking
code: CS
subtitle: Route turns, run the agent loop, track slots across turns and budget the context window. Python from the lessons.
hue: 170
sources: phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural, phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking, phases/11-llm-engineering/05-context-engineering
source_hash: e4e39898a4e411b5
---

## Hybrid routing
type: architecture
from: phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/docs/en.md

```arch
node | in | 1,1 | User input | | client
node | rule | 2,1 | Destructive check | danger words | process
node | flow | 3,1 | Structured flow | confirm first | process
node | faq | 2,2 | FAQ retrieval | threshold 0.6 | store
node | agent | 3,2 | LLM agent loop | RAG and tool calls | model
node | tools | 4,2 | Tools | callable functions | process
node | out | 4,1 | Reply | | client
edge | in | rule |
edge | rule | flow | destructive
edge | rule | faq | else
edge | faq | out | match
edge | faq | agent | None
edge | agent | tools | tool_call
edge | flow | out |
```

## The agent loop
type: flow
from: phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/docs/en.md

1. **Start**: `history` holds one user message. The loop runs `max_steps` times at most.
2. **LLM**: `llm(history, tools=tools)` returns content or a `tool_call`.
3. **Check**: unknown tool name or non-dict arguments add an error message. The loop continues.
4. **Tool**: `fn(**args)` runs. The call and its result go into `history`.
5. **Stop**: a reply without a `tool_call` is the final answer.
6. **Budget**: after `max_steps`, return "I could not complete the task in the step budget."

## Tasks in code
type: task-table
span: 2
from: phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/docs/en.md, phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/docs/en.md, phases/11-llm-engineering/05-context-engineering/code/main.py

| Task | Code |
|---|---|
| FAQ answer or `None` | `faq_respond(user_input, threshold=0.5)` |
| Detect a destructive request | `is_destructive_action(text)` |
| Agent with a step budget | `agent_loop(user_message, tools, llm, max_steps=5)` |
| Score a tracker | `joint_goal_accuracy(predicted_states, gold_states)` |
| Budget the window | `ContextBudget(max_tokens=128000, generation_reserve=4000)` |
| Add a component with a cap | `budget.allocate("tools", tool_text, max_tokens=2000)` |
| Prune tools by intent | `select_tools(query, token_budget=2000)` |
| Best docs at start and end | `reorder_lost_in_middle(items, scores)` |

## Rule-based state update
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/code/main.py

```python
SLOT_EXTRACTORS = {"cuisine": extract_cuisine, "area": extract_area,
                   "price": extract_price, "people": extract_people}

def update_state(state, utterance):
    new_state = dict(state)                    # never reset untouched slots
    for slot, extractor in SLOT_EXTRACTORS.items():
        value = extractor(utterance)
        if value is not None:
            new_state[slot] = value            # a correction overwrites
            continue
        if is_negation(utterance, slot):
            new_state[slot] = None             # "never mind the cuisine"
    return new_state
```

## LLM tracker with a schema
type: annotated-code
lang: python
from: phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/docs/en.md

```python
class RestaurantState(BaseModel):
    cuisine: Optional[Literal["italian", "chinese", "indian", "thai", "any"]] = None
    area: Optional[Literal["north", "south", "east", "west", "center"]] = None
    price: Optional[Literal["cheap", "moderate", "expensive"]] = None
    people: Optional[int] = None
    day: Optional[str] = None                  # free-form slot

def llm_dst(history, llm):
    prompt = f"""...{render(history)}...Output only the JSON state."""
    return llm(prompt, response_model=RestaurantState)  # whole state each turn
```

## Assemble context per query
type: flow
from: phases/11-llm-engineering/05-context-engineering/docs/en.md, phases/11-llm-engineering/05-context-engineering/code/main.py

1. **System prompt**: goes first. Cap `max_tokens=1000`.
2. **Tools**: `classify_intent` then `select_tools`. Cap 2000.
3. **Retrieval**: `score_relevance` drops docs below the threshold. Cap 3000.
4. **Reorder**: `reorder_lost_in_middle` puts the best docs at the start and the end.
5. **History**: summaries plus recent turns. Cap 5000.
6. **Query**: goes last. Cap 500. The rest is the generation reserve.

## Paradigms and DST terms
type: concepts
from: phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/docs/en.md, phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/docs/en.md

- **Rule-based**: patterns, intents and slot filling. Fails outside its scope.
- **Retrieval-based**: nearest stored response. No generation, so no hallucination.
- **Neural seq2seq**: fluent, but generic replies and factual drift.
- **LLM agent**: plan, call tool, observe result, decide next step.
- **Slot**: a named parameter the backend needs, such as cuisine or date.
- **Classification DST**: yes or no for each slot and candidate value. Closed vocabulary.
- **Generation DST**: generate slot values as text. Open vocabulary. The modern default.
- **JGA**: fraction of turns where every slot is correct. All or nothing.

## Defaults and numbers
type: defaults
from: phases/11-llm-engineering/05-context-engineering/code/main.py, phases/11-llm-engineering/05-context-engineering/docs/en.md, phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `max_tokens` | 128000 | Window size of `ContextBudget` |
| `generation_reserve` | 4000 | Reserve 2,000-4,000 for the answer |
| `max_history_tokens` | 5000 | Above it, summarize the 2 oldest turns |
| `token_budget` | 2000 | Tool definitions for one query |
| Relevance threshold | 0.05 | The lesson text uses 0.1 |
| Token estimate | 1.3 | Tokens for each whitespace word |
| `max_steps` | 5 | Agent step budget |
| FAQ `threshold` | 0.5 | Hybrid route uses 0.6 |

## Troubleshooting
type: troubleshooting
from: phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/docs/en.md, phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/docs/en.md, phases/11-llm-engineering/05-context-engineering/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Agent claims an action it did not do | Confident fabrication | Trust only a successful tool return |
| Input overrides the system prompt | Prompt injection | Untrusted input, PVE, confirm destructive |
| Same tool called again and again | Infinite loop | Step budget, dedupe tool calls |
| Earliest turns lost | Context window full | Summarize or retrieve old turns |
| Fact in the middle ignored | Lost in the middle | Key facts first or last |
| Correction clears other slots | Reset of untouched slots | Overwrite only the corrected slot |
| "Italian" and "italian" differ | Case | Normalize everywhere |
| Old training data breaks | New slots added later | Version the schema |

## Abbreviations
type: glossary
from: phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/docs/en.md, phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/docs/en.md, phases/11-llm-engineering/05-context-engineering/docs/en.md

- **DST**: Dialogue State Tracking. Keeps the slot-value dict across turns.
- **JGA**: Joint Goal Accuracy. MultiWOZ 2.4 top systems reach 80-83%.
- **MultiWOZ**: Multi-domain WOZ dataset. The standard DST benchmark.
- **LDST**: LLaMA plus LoRA, instruction-tuned with domain-slot prompts.
- **TripPy**: copy-based DST with BERT encoding. Pre-LLM standard.
- **PVE**: Plan-Verify-Execute. Check each action against the plan first.
- **RAG**: retrieve relevant docs, then ground the reply in them.
- **Lost-in-the-middle**: 85-90% accuracy at the ends, 60-70% in the middle.

## Questions
type: qa
from: phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/docs/en.md, phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/docs/en.md, phases/11-llm-engineering/05-context-engineering/docs/en.md

- **Why route instead of one model?** No single architecture handles every request well.
- **Why rules for payments?** Destructive actions need deterministic, confirmed flows.
- **Incremental update or regenerate?** Regenerate the whole state from history. It handles corrections.
- **What does regeneration cost?** $O(n^2)$ total tokens. Cap or summarize old turns.
- **Is a bigger window enough?** No. A curated 10K context often beats a dumped 100K.

## Tips
type: tips
from: phases/05-nlp-foundations-to-advanced/17-chatbots-rule-to-neural/docs/en.md, phases/05-nlp-foundations-to-advanced/29-dialogue-state-tracking/docs/en.md, phases/11-llm-engineering/05-context-engineering/docs/en.md

- Below the FAQ threshold, return `None` and escalate.
- Log every agent step. Measure off-task rate.
- Mix free-form slots (names, times) with closed slots (cuisine, area).
- Always pass the full history so earlier slots stay set.
- Tool pruning cuts tool tokens by 60-80%.
- Two or three good few-shot examples often beat long instructions.
