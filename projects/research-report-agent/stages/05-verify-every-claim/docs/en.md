# Verify every claim

> A citation is a claim about a claim. Check it, and let the harness decide when the run is done.

**Type:** Build
**Languages:** Python
**Stage:** 5 of 7 (core)
**Time:** ~2 hours

## What you build

`report_agent/critic.py`:

- `support_score(sentence, snippet_text)` returns a score and a reason.
- `review(markdown, snippets)` returns one `Verdict` per sentence.
- `apply_verdicts(report, verdicts)` drops unsupported sentences.
- `Budget` limits steps and tokens, and `decide_state` picks the terminal state: `completed`, `needs_review` or `failed`.

## Why it matters

Your writer in stage 4 is honest because it copies. The moment a model writes the prose, citations drift: a name gets swapped, a "not" disappears, a number changes, or a real snippet gets attached to a claim it never made. A second pass checks the cited evidence independently of the writer. A marker resolving to a source is a syntactic guarantee; source support is a separate judgment.

The checked-in public fixture file `heldout/poisoned_drafts.json` contains drafts with each of these attacks, plus faithful paraphrases that must pass. The legacy folder name does not make these hidden tests. Your critic has to catch the first without flagging the second.

## Support, in three rules

```python
def support_score(sentence, snippet_text):
    # 1. names and numbers must appear in the source
    # 2. negation words must match
    # 3. otherwise: share of the claim's content tokens found in the source
```

| Attack | Rule that catches it |
|---|---|
| "The Hypervisor component intercepts system calls" cited to an interceptor sentence | Hypervisor is a strict term missing from the source |
| "Denylists are a security boundary" cited to "Denylists are not a security boundary." | negation differs |
| "allows 5 destinations" cited to "allows 10 destinations" | the number 5 is missing |
| A real snippet attached to an unrelated claim | low overlap or a negation mismatch |
| A sentence with no marker, or a marker to `S9` | uncited or dangling |

Strict terms are words with digits, words with a capital after the first letter (`microVMs`), and capitalized words after the first position. Lexical checks are crude, but they are fast, free and explainable. They also set the bar a model-based judge has to beat.

## Budgets and terminal states

The model never decides when the run is over. The harness does:

```python
budget = Budget(max_steps=50, max_tokens=20000)
budget.charge("plan", estimate_tokens(question))   # raises BudgetExceeded when over
```

| State | When |
|---|---|
| `completed` | every sentence is supported |
| `needs_review` | some sentences were dropped |
| `failed` | the budget ran out, or nothing was supported |

A run that says `needs_review` is not a failure. It is a report that tells a human exactly where to look.

```figure
pj-rra-critic
```

## Follow the mechanism

Lexical overlap is a heuristic, not an entailment model. A copied false source can pass, and a faithful paraphrase can fail. Keep the score, threshold and rejection reason in each verdict so a later semantic judge can be compared with this baseline rather than silently replacing it.

## Your task

```python
class Budget:
    def __init__(self, max_steps=50, max_tokens=20000): ...
    def charge(self, step, tokens=0): ...
def strict_terms(sentence) -> set[str]: ...
def support_score(sentence, snippet_text) -> tuple[float, str]: ...
def review(markdown, snippets, threshold=0.6) -> list[Verdict]: ...
def decide_state(verdicts, budget_exceeded=False) -> str: ...
def apply_verdicts(report, verdicts) -> Report: ...
```

`snippets` may map ids to `Snippet` objects or to plain strings. `snippet_text()` handles both.

## Run the tests

```bash
python3 scripts/project_test.py research-report-agent --stage 5 --path my-report-agent
```

## What you should see

Stage 5 passes 9 Python tests, and all preceding stages still pass. All six poisoned drafts receive their expected verdict sequences. Entity swaps, changed numbers, negation changes and dangling markers are rejected; faithful paraphrases pass. A two-step budget stops before the third charge.

## Check yourself

1. Your writer copies snippets. Why build a critic at all?
2. Find a paraphrase that your critic wrongly rejects. What would a model judge do better, and what would it cost?
3. Why is `needs_review` safer than silently dropping sentences and reporting `completed`?

## Going further

- Add a model judge behind the `Model` protocol for sentences whose lexical score falls between 0.4 and 0.6, and record its answers in a cassette.
- Write three new poisoned drafts that fool your critic, then fix the critic.

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 4](../../04-write-with-citations/docs/en.md) first.

Verification checks lexical support, numbers and negation under a finite work budget. The critic can reject a changed timeout, but it cannot prove that a source is true or current in the real world.

```text
source timeout=15; draft timeout=60 -> reject number
no evidence -> failed or needs_review according to verdict state
budget exhausted -> named terminal state
```

## Build and inspect

Charge work before starting the next operation. Preserve rejected claims in the trace rather than erasing the reason a report became shorter.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py research-report-agent --stage 5 --path learning-artifacts/research-report-agent
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What independent check would you add before acting on a deployment recommendation?
