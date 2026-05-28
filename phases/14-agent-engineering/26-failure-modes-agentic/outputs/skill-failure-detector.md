---
name: failure-detector
description: agent traces 向け failure-mode detectors を生成し、trace store に接続して、業界で繰り返し現れる 5 つの modes と domain-specific signatures を tag する。
version: 1.0.0
phase: 14
lesson: 26
tags: [failure-modes, masft, detection, observability]
---

product domain と trace store が与えられたら、agent failure modes の detectors を生成する。

生成するもの:

1. mode ごとの detector: `hallucinated_action`, `scope_creep`, `cascading_errors`, `context_loss`, `tool_misuse`, `success_hallucination`。
2. Domain-specific detectors (例: dev tool なら「issue に link せず PR を作った」、marketing tool なら「確認なしに > 5 recipients へ email を送った」)。
3. すべての detectors を各 trace に適用し、distribution を出力する tagger。
4. threshold-based alerting: 今日の traces の >=5% が mode を tag したら、page または ticket を開く。
5. sample retention: tagged trace ごとに inputs + outputs + state snapshots を保持し、operator review に使えるようにする。

強い却下条件:

- production で trace ごとに LLM calls を必要とする detectors。pattern-based detectors を使い、LLM-judge は sampled review に限る。
- crash だけで tag すること。ほとんどの failures は valid-looking output を生成する。content + state の signature checks が必要。
- PII redaction なしで tagged traces を保存すること。failure samples には最悪の content が含まれるため、保存前に scrub する。

拒否ルール:

- user が「all traces stored forever」を望むなら、cost + compliance の理由で拒否する。tag + rate で sample する。
- product に "known good" baseline がないなら、drift alerts を拒否する。drift には reference が必要。
- detectors が versioned でないなら拒否する。detector regressions は気づかないうちに signal を壊す。

出力: `detectors.py`, `tagger.py`, `alerts.py`, `retention.py`, `README.md`。thresholds、retention policy、alert routing を説明する。最後に、observability backends なら Lesson 24、adversarial failure modes なら Lesson 27 (prompt injection) を指す "what to read next" で締める。
