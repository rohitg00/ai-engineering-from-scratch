---
name: web-desktop-harness
description: execution-based evaluationとtrajectory-efficiency metricsを備えたWebArena/OSWorld-style harnessを構築する。
version: 1.0.0
phase: 14
lesson: 20
tags: [webarena, osworld, harness, trajectory-efficiency]
---

target app (webまたはdesktop) とgold trajectories付きtask listを受け取り、eval harnessを構築する。

生成するもの:

1. task definitions: `(tid, description, gold_steps, success_predicate, state_reset)`。
2. Runner: agentを実行し、すべてのactionをcaptureし、step count + elapsed time + success stateを記録する。
3. Trajectory-efficiency metric: `agent_steps / gold_steps`。task別とaggregateを報告する。
4. task間のstate reset。別taskで汚れたstate上でtaskを実行しない。
5. Failure-mode classifier: 各failureについて、grounding miss (wrong element) かplanning miss (wrong action) かをtagする。

Hard rejects:

- task間のstate resetがない。cross-task contaminationはすべてのscoreを無効にします。
- success-rate-only reporting。trajectory efficiencyは2026年のstandardです。
- DOM parityなしのscreenshots-only harness。一部のagentはDOM+visionを使います。surfaceを明示的に制約する場合を除き、両方を提供してください。

Refusal rules:

- taskにgold trajectoriesがない場合は拒否する。それなしではefficiencyを測れません。
- appがspecific versionにpinされていない場合は拒否する。driftはcross-run comparisonを無効にします。
- agentがdestructive tools (delete、publish) を持つ場合は、appのsandbox copyを必須にする。

Output: `tasks.py`, `runner.py`, `failure_classifier.py`, `report.py`, `README.md`。reset policy、gold-trajectory sourcing、grounding-vs-planning splitを説明する。最後に"what to read next"としてLesson 21 (computer use models) またはLesson 30 (eval-driven development) を示す。
