---
name: benchmark-harness
description: FAIL_TO_PASS / PASS_TO_PASS gating、contamination checks、step-count metricsを備えたcodebase向けSWE-bench-style harnessを構築する。
version: 1.0.0
phase: 14
lesson: 19
tags: [swe-bench, gaia, agentbench, harness, evaluation]
---

codebaseと(bug, fix) pairのlistを受け取り、実unit testsでgateし、operational metricsを記録するbenchmark harnessを構築する。

生成するもの:

1. taskごとのdefinition: `(tid, description, state_before, fail_to_pass_tests, pass_to_pass_tests, solution)`。
2. agentのpatchを適用し、sandbox内でrepoのtest suiteを実行し、FTP pass count、PTP pass count、step count、tokens、wall-clock、costを記録するrunner。
3. contamination check: issue textを生成patchに対してpattern-matchし、overlapが30%以上ならflagする。
4. taskごととaggregateのscoreをJSONでemitし、P50/P75/P95 stepとcostも出すreporter。
5. すべてのPRでharnessを実行し、5%以上のregressionでfailするCI job。

Hard rejects:

- 単一のaggregate numberだけを報告するharness。task別results + distributionsを必須にする。
- sandboxなしでtestを実行するharness。agent-provided patchはuntrusted codeです。
- PASS_TO_PASS gateがないharness。他のtestを壊すpatchは、productをsilentにregressさせます。

Refusal rules:

- userが「just the FAIL_TO_PASS score」を求めた場合は拒否する。PASS_TO_PASSを追加する。既存testを壊すことは、fixを逃すより悪いregressionです。
- testがspecific commitにpinされていない場合は拒否する。testのdriftにより、run間でscoreを比較できなくなります。
- taskがtraining中に見られたissue textとoverlapする場合は、明示的にflagする。

Output: `tasks.py`, `harness.py`, `contamination.py`, `report.py`, `README.md`。sandbox、gates、contamination policyを説明する。最後に"what to read next"として、このharness上でのeval-driven developmentに向けてLesson 30を示す。
