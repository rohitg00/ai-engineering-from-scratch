# Score recorded outputs without a model

**Stage 2 of 4.** Python. Plan about 2 hours.

Record and replay isolates the evaluator from model availability and sampling variance. Each response is scored against each check; a case passes only when all its checks pass. Missing responses are failures.

Literal substring checks are case-sensitive by design. Normalizing case or punctuation would change the assertion, so make such transformations explicit in a separate check type when needed.

```figure
pj-prompt-regression-tester-2
```

Primary reference: [Primary technical reference](https://docs.python.org/3/library/difflib.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Structured outputs](../../../../../phases/11-llm-engineering/03-structured-outputs/docs/en.md). Complete [stage 1](../../01-validate-cases/docs/en.md) first.

A valid JSON response can still omit its source. Score every assertion and retain the individual results so a maintainer can see which promise failed.

```text
response: {"answer":"ready"}
json -> true
contains("source:") -> false
case passed -> false
```

## Build and inspect

Evaluate the list of checks first, then apply all(). A missing response must not become an empty passing checklist.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py prompt-regression-tester --stage 2 --path learning-artifacts/prompt-regression-tester
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Would lowercasing the response before an excludes check change the contract for API_KEY?
