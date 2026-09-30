# Parse claims and citation references

**Stage 1 of 4.** Python. Plan about 2 hours.

A citation parser identifies references without deciding whether they are true. Deduplicate markers within each sentence, preserve the claim text, and ignore markdown headings. This deliberately narrow grammar handles one paragraph per line; it does not pretend to parse arbitrary markdown or abbreviations.

```figure
pj-report-judge-1
```

## Implementation boundary

```python
def parse_claims(text):
    raise NotImplementedError("Implement the stage contract")
```

Primary reference: [Reference 1](https://www.rfc-editor.org/rfc/rfc8259).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Retrieval augmented generation](../../../../../phases/11-llm-engineering/06-rag/docs/en.md).

Audit each factual sentence separately. Orchard has a sourced retry limit and an unrelated deployment claim; one valid marker must not make the whole paragraph pass.

```text
Worker A invokes worker B [S1]. Retry limit is 99 [S2].
claim 1 -> cites [S1]
claim 2 -> cites [S2]
```

## Build and inspect

Extract markers before removing them from the claim text. Deduplicate repeated markers without discarding sentence identity.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py report-judge --init learning-artifacts/report-judge
python3 scripts/project_test.py report-judge --stage 1 --path learning-artifacts/report-judge
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

What should happen when [S2] is absent from the evidence map?
