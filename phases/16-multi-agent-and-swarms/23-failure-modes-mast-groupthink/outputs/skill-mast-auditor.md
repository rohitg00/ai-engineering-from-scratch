---
name: mast-auditor
description: multi-agent system に対して MAST-style failure-mode audit を実行する。execution-trace failures を Specification / Coordination / Verification と Groupthink families に分類し、期待される failure reduction で mitigations を rank する。
version: 1.0.0
phase: 16
lesson: 23
tags: [multi-agent, failure-modes, MAST, groupthink, circuit-breaker, audit]
---

multi-agent system と sampled execution traces が与えられたら、failure-mode audit を実行する。

作成するもの:

1. **Sample construction。** production から少なくとも 200 traces を、task type と time window にわたり uniformly sampling する。sampling method と bias risks を記録する。
2. **Classification pass。** 各 trace を `success | failure` として mark する。failure には MAST category を 1 つ（spec / coord / verify）割り当て、該当する場合は Groupthink family tags（monoculture / conformity / tom / mixed-motive / cascade）を 1 つ以上付ける。
3. **Distribution table。** MAST category と Groupthink tag ごとの counts and percentages。Cemri 2025 の reference distribution（41.77 / 36.94 / 21.30）と比較する。reference から大きく skew する system は、特定の weak layer を持つことが多い。
4. **Top failure patterns。** 頻度上位 3 つの specific patterns（例: 「two agents both review」）を特定する。reproduction steps を記録する。
5. **Mitigation ranking。** top pattern ごとに、standard library から mitigation を提案する: explicit role contracts、versioned shared state、independent verifier、circuit breaker、detection-diagnosis-validation（STRATUS）trio。pattern frequency から期待 failure reduction を見積もって rank する。
6. **Risk of silent failures。** plausible-but-wrong outputs を出す failure はどれだけあり、loud errors はどれだけあるか。silent rate が verification-layer investment を左右する。
7. **Slow-failure proxies。** loud error になる前に drift を表面化させる live metrics を 2-3 個推奨する: agreement rate、retry-rate、output-length distribution、inter-agent edit distance。

Hard rejects:

- random または stratified sample のない audit。hand-picked failures は派手な case を過大評価し、slow-failure drift を見逃す。
- baseline measurement のない mitigation recommendation。「Add a verifier」は current failure rate が分からなければ意味がない。
- MAST-unknown incidents を無視すること。trace が category に合わない場合、無理に分類せず taxonomy extension を提案する。
- operational slow-failure monitoring なしで quarterly audit で十分だと主張すること。quarterly audit は audit 間の drift を見逃す。

Refusal rules:

- traces に per-agent attribution（誰が何を書き、誰が何を読んだか）がない場合、audit は coordination failures と role conflicts を区別できない。再監査の前に structured per-agent logging を追加することを推奨する。
- system に failed traces が合計 50 未満しかない場合、sample は distribution estimates を出すには小さすぎる。より長い observation window を推奨する。
- traces に PII が含まれる場合、analysis 前に mask する。

Output: 3 ページの report。1 文の summary（「41% spec failures, 12% coordination, 39% verification gaps, 8% unknown; top pattern is dual-reviewer conflict; highest-ROI mitigation is explicit role contracts.」）から始め、その後に上記 7 sections を続ける。最後に prioritized action list として、estimated implementation cost と expected failure-rate reduction 付きで 3 つの mitigations を書く。
