---
id: prompt-engineering
title: Prompt Engineering
code: PE
subtitle: Write the prompt, add examples and reasoning, vote, and budget the context window. Python from the lessons.
hue: 230
sources: phases/11-llm-engineering/01-prompt-engineering, phases/11-llm-engineering/02-few-shot-cot, phases/11-llm-engineering/05-context-engineering, phases/11-llm-engineering/15-prompt-caching
source_hash: 3156fd874b6b7119
---

## What goes in the window
type: architecture
from: phases/11-llm-engineering/05-context-engineering/docs/en.md

```arch
node | sys | 1,1 | System prompt | about 500 tokens
node | tools | 2,1 | Tool definitions | 2K to 8K tokens
node | ret | 3,1 | Retrieved context | 2K to 10K tokens
node | hist | 4,1 | Conversation history | 2K to 20K tokens
node | shots | 4,2 | Few-shot examples | 1K to 3K tokens
node | query | 3,2 | User query | 100 to 500 tokens
node | gen | 2,2 | Generation budget | 2K to 8K tokens
node | win | 1,2 | Context window | input plus output
edge | sys | tools |
edge | tools | ret |
edge | ret | hist |
edge | hist | shots |
edge | shots | query |
edge | query | gen |
edge | gen | win | total
```

## Assemble context per query
type: flow
from: phases/11-llm-engineering/05-context-engineering/code/main.py, phases/11-llm-engineering/05-context-engineering/docs/en.md

1. **ContextBudget**: available tokens are `max_tokens` minus `generation_reserve`.
2. **System prompt**: allocate it first, up to 1000 tokens.
3. **select_tools**: `classify_intent` picks intents. Keep matching tools within 2000 tokens.
4. **score_relevance**: keep documents with word overlap of 0.05 or more.
5. **reorder_lost_in_middle**: best documents at both ends. Allocate up to 3000.
6. **ConversationManager**: summarized old turns plus recent turns, up to 5000.
7. **User query**: allocate it last, up to 500 tokens.

## Tasks in code
type: task-table
from: phases/11-llm-engineering/01-prompt-engineering/code/prompt_engineering.py, phases/11-llm-engineering/02-few-shot-cot/code/advanced_prompting.py, phases/11-llm-engineering/05-context-engineering/code/main.py

| Task | Code |
|---|---|
| Build a prompt from a pattern | `build_prompt("persona", <variables>)` |
| Build a multi-turn message list | `build_multi_turn(<pattern>, <turns>)` |
| Score one output | `score_response(<text>, <criteria>)` |
| Few-shot CoT prompt | `build_cot_prompt(question, examples, num_examples=3)` |
| Majority vote over samples | `self_consistency_solve(question, examples, client, model, n_samples=5)` |
| CoT, then vote, then ToT | `solve_with_escalation(question, examples, client, model)` |
| Budget the window | `ContextBudget(max_tokens=128000, generation_reserve=4000)` |
| Prune tools by intent | `select_tools(query, token_budget=2000)` |

## Self-consistency vote
type: annotated-code
lang: python
from: phases/11-llm-engineering/02-few-shot-cot/code/advanced_prompting.py

```python
system, user = build_cot_prompt(question, examples)  # 3 worked examples
answers = []
for _ in range(n_samples):                       # n_samples=5
    text = call_llm(client, model, system, user, temperature=0.7)
    answer = extract_answer(text)                # reads "The answer is <n>"
    if answer is not None:
        answers.append(answer)
vote_counts = Counter(answers)
best_answer = vote_counts.most_common(1)[0][0]   # majority answer
confidence = vote_counts[best_answer] / len(answers)
if confidence >= 0.8 and single_answer == sc_answer:
    ...                                          # accept the vote
tree_of_thought_solve(question, client, model, breadth=3, depth=2)  # else
```

## Pick a reasoning technique
type: command-table
from: phases/11-llm-engineering/02-few-shot-cot/docs/en.md

| Command | What it does |
|---|---|
| Zero-shot | Simple tasks. 1 call, no overhead |
| Few-shot | Format matching. 200-500 extra tokens |
| Zero-shot CoT | Add "Let's think step by step". 50-200 tokens |
| Few-shot CoT | Best single-call accuracy. 300-600 tokens |
| Self-consistency, N=5 | High-stakes reasoning. 5x token cost |
| Tree-of-Thought | Search and planning. 10-40+ calls |
| ReAct | Knowledge-grounded reasoning. 3-10+ calls |
| Prompt chaining | Complex multi-step tasks. 2-5 calls |

## Prompt anatomy and patterns
type: concepts
from: phases/11-llm-engineering/01-prompt-engineering/docs/en.md, phases/11-llm-engineering/05-context-engineering/docs/en.md

- **System message**: identity, rules and constraints. Persists across turns.
- **User message**: the task. Changes every turn.
- **Assistant prefill**: a partial response such as `{` that sets the format.
- **Role**: a specific role narrows the output distribution.
- **Constraints**: negative "Do NOT", positive "Always", conditional "If X then Y".
- **Delimiters**: XML tags such as `<analysis>` keep sections apart.
- **Clarity**: state format, length, audience, include and exclude, one example.
- **Lost in the middle**: 85-90% accuracy first or last, 60-70% in the middle.

## Defaults and numbers
type: defaults
from: phases/11-llm-engineering/01-prompt-engineering/docs/en.md, phases/11-llm-engineering/02-few-shot-cot/docs/en.md, phases/11-llm-engineering/02-few-shot-cot/code/advanced_prompting.py, phases/11-llm-engineering/05-context-engineering/code/main.py

| Setting | Default | Note |
|---|---|---|
| Temperature, extraction and code | 0.0 | Top-p 1.0. Also for prompt tests |
| Temperature, summarization | 0.3 | Top-p 0.9 |
| Temperature, general Q&A | 0.7 | Top-p 0.95 |
| Few-shot examples | 3-5 | One per label for many labels |
| `n_samples` | 5 | At temperature 0.7. N=3 is the minimum vote |
| Vote confidence to accept | 0.8 | Below it, escalate to Tree-of-Thought |
| `generation_reserve` | 4000 | Tokens kept free for the answer |
| System prompt size | under 500 tokens | For most tasks |

## Troubleshooting
type: troubleshooting
from: phases/11-llm-engineering/01-prompt-engineering/docs/en.md, phases/11-llm-engineering/02-few-shot-cot/docs/en.md, phases/11-llm-engineering/05-context-engineering/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Generic, median-quality output | Vague task, generic role | Give a specific role, format, length, audience |
| Confident nonsense | Role too rare in training data | Use a less narrow role |
| Model follows one rule, drops another | Contradictory instructions | Audit the prompt for conflicts |
| Task quality drops | 2,000 words of rules | Keep the system prompt under 500 tokens |
| User text overrides the rules | Prompt injection | Validate input, use delimiters, filter output |
| All votes identical | Samples at temperature 0.0 | Sample at 0.7 |
| Votes cannot be compared | No fixed answer format | End with "The answer is [number]" |
| Key fact ignored | Fact in the middle of a long context | Put it first or last, or repeat it at the end |

## Abbreviations
type: glossary
from: phases/11-llm-engineering/01-prompt-engineering/docs/en.md, phases/11-llm-engineering/02-few-shot-cot/docs/en.md, phases/11-llm-engineering/05-context-engineering/docs/en.md

- **CoT**: Chain-of-Thought. Reasoning tokens before the final answer.
- **ToT**: Tree-of-Thought. Generate, score and prune reasoning branches.
- **ReAct**: Thought, Action, Observation loop with tools.
- **Self-consistency**: N samples at temperature above 0, majority vote.
- **Top-p**: nucleus sampling. Smallest token set with cumulative probability p.
- **Few-shot**: 2-10 input and output examples in the prompt.
- **NIAH**: Needle in a Haystack. Tests recall by position in long context.

## Questions
type: qa
from: phases/11-llm-engineering/01-prompt-engineering/docs/en.md, phases/11-llm-engineering/02-few-shot-cot/docs/en.md

- **Why does CoT help?** Each reasoning token is context for the next. It extends computation depth.
- **When does CoT hurt?** Simple recall and single-step classification. It adds 50-200 tokens.
- **CoT on a reasoning model?** No. It reasons internally. The phrase is redundant.
- **Why test at temperature 0 first?** It separates prompt quality from sampling noise.
- **Temperature and top-p together?** No. Use one. They interact unpredictably.

## Tips
type: tips
from: phases/11-llm-engineering/02-few-shot-cot/docs/en.md, phases/11-llm-engineering/05-context-engineering/docs/en.md, phases/11-llm-engineering/15-prompt-caching/docs/en.md

- Pick examples similar to the input. Cover every label.
- Put critical instructions first and the query last.
- Drop retrieved chunks below a relevance threshold. Bad retrieval is worse than none.
- Include only the tools the intent needs. Tool tokens drop 60-80%.
- Summarize history past a threshold such as 5,000 tokens.
- Put stable parts at the top and variable parts at the bottom for prompt caching.
