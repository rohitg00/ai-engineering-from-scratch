# Check evidence before averaging scores

**Stage 2 of 4.** Python. Plan about 2 hours.

Treat missing evidence as a categorical failure before calculating overlap. Number and negation checks catch cases where word overlap would otherwise reward a contradictory claim. The overlap score is an inspectable heuristic; it is not a truth detector and can reject good paraphrases.

```figure
pj-report-judge-2
```

## Implementation boundary

```python
def support(claim, source):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://www.rfc-editor.org/rfc/rfc8259).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md). Complete [stage 1](../../01-claims/docs/en.md) first.

Word overlap misses relationships. The claim "Bob defeated Alice" shares every word with "Alice defeated Bob" but reverses who did what. Reject the ordering mismatch for human review; do not label this check semantic understanding.

```text
source: Alice defeated Bob
claim: Bob defeated Alice
word overlap=1; order check=false
result: order_requires_review
```

## Build and inspect

Compare ordered content tokens only after the negation and numeric guards. This conservative rule can reject valid paraphrases, so keep the reason visible.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py report-judge --stage 2 --path learning-artifacts/report-judge
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Write one true paraphrase that your lexical rule rejects. What evidence would a human need to resolve it?
