# Validate cases before scoring

**Stage 1 of 4.** Python. Plan about 2 hours.

An evaluation case needs a stable id, a prompt, and a small set of assertions. Duplicate ids silently overwrite evidence when results become a dictionary. Validate ids and assertion types before replaying any responses.

Assertions here are literal text checks and JSON syntax checks. They are useful for contract drift, but cannot prove factual correctness or tone. Separate those limitations from what your gate actually enforces.

```figure
pj-prompt-regression-tester-1
```

Primary reference: [Primary technical reference](https://docs.python.org/3/library/difflib.html).

## Worked Orchard case

Before coding, review [Python data structures](https://docs.python.org/3/tutorial/datastructures.html) and [Structured outputs](../../../../../phases/11-llm-engineering/03-structured-outputs/docs/en.md).

Orchard must return JSON and preserve a source locator. Keep `format-json` and `source-link` as different case ids: they are separate promises to the caller. The cassette hashes the entire case list, including prompts and checks, before comparing runs.

```text
case ids: [format-json, source-link]
checks: json; contains("source:")
repeat format-json -> reject before replay
```

## Build and inspect

Build a set of ids while validating. Validate each check kind before looking up a recorded response.

Implement the stage in your learner workspace. The CLI helpers are provided adapters and import your functions; they do not substitute the reference solution.

```bash
python3 scripts/project_test.py prompt-regression-tester --init learning-artifacts/prompt-regression-tester
python3 scripts/project_test.py prompt-regression-tester --stage 1 --path learning-artifacts/prompt-regression-tester
```

Predict the intermediate state above, then run the stage. A fresh stub fails; a passing reference run does not establish completion of your learner workspace.

## Investigate next

Change only the prompt wording. Why must the previous case hash stop matching?
