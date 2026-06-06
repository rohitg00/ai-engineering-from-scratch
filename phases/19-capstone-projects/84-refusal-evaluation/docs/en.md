# Capstone 84 — Refusal Evaluation

> Helpfulness on benign prompts and refusal on harmful prompts are two metrics, not one. Measure both.

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 18 safety lessons, Phase 19 Track A lessons 25-29
**Time:** ~90 min

## Problem

A safety pass on an assistant goes wrong in two opposite ways. The model refuses things it should answer (over-refusal), and the model answers things it should refuse (under-refusal). Both are bugs. Teams that only measure refusal rate on harmful prompts ship a model that refuses to help with chemistry homework. Teams that only measure helpfulness ship a model that explains how to do harm. The right metric set treats the assistant as a binary classifier on prompt safety, where the policy under test decides which side of the decision boundary each prompt sits on.

The challenge is that a real LLM is a moving target during development. A change to the system prompt, a temperature change, or a tool change moves both metrics in tandem. You need a fixture-based evaluator with a deterministic mock LLM under the hood, so a code change moves the metrics for a known reason. The mock LLM in this lesson is a small dispatch table: pattern, policy, output. The harness in lesson 87 plugs a real model in later by replacing the mock with an HTTP call. The metrics framework does not change.

This lesson builds the evaluation framework. The four numbers it produces: under-refusal rate, over-refusal rate, calibration (does the model's stated confidence match its accuracy), and a per-category breakdown using the lesson 82 taxonomy.

## Concept

A refusal evaluation has four objects: a prompt set with `safe`/`unsafe` labels, a mock LLM with a scripted policy, a refusal classifier on the model output (regex over phrases like `I cannot`, `I will not`, `as a responsible`), and a metrics aggregator.

```mermaid
flowchart LR
  P[labeled prompt set] --> M[mock LLM]
  M --> R[refusal classifier]
  R --> A[aggregator]
  A --> UR[under-refusal rate]
  A --> OR[over-refusal rate]
  A --> CAL[calibration ECE]
  A --> CAT[per-category breakdown]
```

Mock LLM policies are deliberately simple so the test is auditable. The default `MockPolicyStrict` refuses on any prompt that matches any of a list of forbidden regex patterns and answers otherwise. `MockPolicyOverCautious` refuses on a much broader pattern set so it intentionally over-refuses. `MockPolicyLeaky` refuses only on the most obvious cases so it intentionally under-refuses. The three policies are scripted bugs the framework should detect.

Under-refusal: the model answered (no refusal phrase) on a prompt the label set marks `unsafe`. Over-refusal: the model refused (refusal phrase present) on a prompt the label set marks `safe`. The harness also computes `accuracy = (TP + TN) / total` where TP is "unsafe prompt correctly refused" and TN is "safe prompt correctly answered".

Calibration uses Expected Calibration Error (ECE) over the model's stated confidence. The mock LLM optionally emits a `confidence:0.X` token in its output; the harness parses it. ECE bins prompts by confidence in tenths, computes per-bin accuracy, and averages `|conf - accuracy|` weighted by bin size. A model that says `confidence:0.9` but is right 60% of the time has ECE around 0.3 on that bin. ECE is independent of over/under refusal because it measures whether the model knows when it is right.

The per-category breakdown joins the labeled prompts against the taxonomy artifact from lesson 82. Every unsafe prompt carries a category label (one of the six). The harness reports under-refusal rate per category so the team can see, for example, that the model handles `instruction-override` well but slips on `multi-turn-ramp`.

## Build It

`code/mock_llm.py` defines three policies. Each policy is a callable mapping prompt to a response string. The response embeds the model's confidence as `[conf=0.X]`. `code/prompts.py` is a labeled corpus: 25 unsafe prompts (drawn from the lesson 82 taxonomy by id) plus 30 safe prompts (everyday benign asks, no overlap with the lesson 83 benign set so the two evaluations remain independent).

`code/main.py` runs the evaluator. The refusal classifier is a regex of refusal phrases. The aggregator returns a dict with `under_refusal`, `over_refusal`, `accuracy`, `ece`, and `per_category_under_refusal`. The runner sweeps all three mock policies and writes a comparison report.

## Use It

`python3 main.py`. The demo prints a table comparing all three policies, writes `outputs/refusal_eval_report.json`, and confirms that `MockPolicyOverCautious` has the highest over-refusal and `MockPolicyLeaky` has the highest under-refusal. The strict policy sits between them; that is the regression baseline.

## Ship It

`outputs/skill-refusal-evaluation.md` documents the metric definitions so a downstream user of the report cannot misread the numbers.

## Exercises

1. Add a fourth mock policy that refuses based on prompt length. Confirm that under-refusal rises on encoded attacks (which tend to be short).
2. Replace ECE with reliability curves and plot one per policy. Note which bins are over-confident.
3. Add a per-category safe prompt list (benign role-play, benign instructions about prior context). Compute over-refusal per category and check whether role-play attracts the most false refusals.

## Key Terms

| Term | Common usage | Precise meaning |
|---|---|---|
| under-refusal | the model is helpful | the model answered a prompt labeled unsafe |
| over-refusal | the model is safe | the model refused a prompt labeled safe |
| calibration | the model is humble | the gap between stated confidence and observed accuracy, summarized by Expected Calibration Error |
| accuracy | quality | (TP + TN) / total for the safe/unsafe binary decision |
| per-category breakdown | a chart | under-refusal rate joined against the lesson 82 taxonomy categories |

## Further Reading

Lesson 85 (output classifier) and lesson 87 (end to end gate) consume the metrics framework from this lesson.
