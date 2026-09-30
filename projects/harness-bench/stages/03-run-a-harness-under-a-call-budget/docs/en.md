# Run a harness under a call budget

> Spend calls on a policy, not on answer leakage.

**Type:** Build
**Languages:** Go
**Stage:** 3 of 4
**Prerequisites:** Stages 1 and 2. Understand Go callbacks and context cancellation before adding a live model.
**Time:** ~2 hours

## What you build

Implement `EvaluatePolicy` and `PolicyPrompt`; retain `Evaluate` as a baseline convenience wrapper. The three policies receive the same ordered cases and model configuration. `baseline` makes one call per case. `retry-errors` permits one extra call after a provider error. `evidence` appends only the case's declared evidence to its prompt.

Charge `Calls` before every invocation. `Attempted` counts cases, `Errors` counts cases whose final call fails, and `Total` always includes every input case. Record each call's prompt, answer, failure and correctness in `Trace`. Never retry merely because an answer failed the scorer.

## Worked example

The restore question's recorded first response is an error and its second response is `ready`. Baseline ends that case with `Calls=1, Attempted=1, Errors=1`. The retry policy uses `Calls=2, Attempted=1, Errors=0, Correct=1`.

Reduce the budget to one. The retry cannot happen, so the case remains an error and the state is `budget-exhausted`. Later cases remain in the denominator. On the expiry question, a valid but wrong `60 minutes` answer never triggers an oracle retry.

```figure
pj-harness-bench-3
```

## Implement the contract

```go
func PolicyPrompt(c Case, policy string) string
func EvaluatePolicy(ctx context.Context, name, policy string, cases []Case, model ContextModel, budget int, modelReceipt string) (Result, error)
func Evaluate(name string, cases []Case, model Model, budget int) (Result, error)
```

Keep per-case attempts separate from the run's call counter. Only the model prompt enters `ContextModel`; `Expected` stays on the scoring side. Construct a fresh recorded adapter for each policy so an earlier policy cannot consume a later policy's first response. Exhausted recordings return errors instead of repeating their final answer forever.

## Run your work

From the repository root, initialize once; the grader preserves existing workspace files:

```bash
python3 scripts/project_test.py harness-bench --init /tmp/harness-bench-work
python3 scripts/project_test.py harness-bench --stage 3 --path /tmp/harness-bench-work --strict
```

Your implementation belongs in `stage3.go` in that workspace. Provided adapters call those learner functions; they do not import the reference solution. Stage tests include cases separate from the Orchard demonstration.

## Inspect and extend

Run the completed learner artifact with `go run . --budget 2 --out /tmp/orchard-budget.json` from its workspace. Explain why spending a retry on an early case can leave a later case unattempted. A context deadline bounds the provided HTTP adapter; an arbitrary custom callback must cooperate with cancellation.

[Go standard-library reference](https://pkg.go.dev/encoding/json). The runnable core uses only Go's standard library. External model calls are optional and do not run during ordinary grading.
