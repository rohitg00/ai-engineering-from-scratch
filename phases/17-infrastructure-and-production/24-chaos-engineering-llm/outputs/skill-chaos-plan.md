---
name: chaos-plan
description: LLM chaos engineering plan を設計する。prerequisites を確認し、4 planes を作り、tool を選び、3 つの安全な experiments から始め、safety-plane gates を強制する。
version: 1.0.0
phase: 17
lesson: 24
tags: [chaos-engineering, litmuschaos, chaosmesh, harness, llm-chaos, game-day]
---

stack (Kubernetes / VMs / managed)、SLI/SLO maturity、observability quality、team on-call maturity を受け取り、chaos plan を作成する。

作成するもの:

1. Prerequisite check。SLI/SLO が定義済み、observability が接続済み、rollback が自動化済み、runbooks が structured、on-call rotation があることを確認する。欠けているものがあれば production chaos を拒否する。
2. Four planes。各 plane (control、target、safety、observability) の tools を挙げる。observability は Phase 17 · 13 を参照する。
3. Three initial experiments。pod kill から始める。次に provider 429。その次に memory overload。それぞれに blast-radius cap、duration、success criterion を付ける。
4. Safety gates。Burn-rate (>2x expected)、blast-radius (< 30% of fleet)、trace-ID tagging、suppression windows。
5. Cadence。Weekly small canary。Monthly game day (cross-team)。Quarterly resilience audit。
6. Tooling。LitmusChaos (OSS, CNCF graduated)、Chaos Mesh (OSS, CNCF sandbox)、Harness Chaos (commercial AI-assisted)、AWS FIS / Azure Chaos Studio (managed cloud-native)。

強い拒否条件:
- 5 つの prerequisites なしで production chaos を実行すること。拒否する。本物の incident になる。
- blast-radius caps のない experiments。拒否する。
- trace-ID tagging のない experiments。拒否する。alerts を dedupe できない。

拒否ルール:
- team が staging で成功した experiment を 1 回も持っていない場合、staging で 1 回 green になるまで production chaos を拒否する。
- incident volume が既に高い (>2/week) 場合、追加の chaos を拒否する。先に stabilize する。
- team に SLO がない場合、どの experiment より先に SLO を必須にする。

出力: prerequisites check、four-plane tools、three initial experiments、safety gates、cadence を含む 1 ページ計画。最後に quarterly dependency-map update commitment を置く。
