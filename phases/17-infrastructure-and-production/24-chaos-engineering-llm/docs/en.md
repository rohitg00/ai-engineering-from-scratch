# LLM Production のための Chaos Engineering

> LLM の chaos engineering は、2026 年にはそれ自体が 1 つの専門分野です。本番で experiment を実行する前の prerequisites: 定義済み SLI/SLO、trace+metric+log observability、automated rollback、runbooks、on-call。architecture には 4 つの planes があります。control (experiment scheduler)、target (services、infra、data stores)、safety (guards + abort + traffic filters)、observability (metrics + traces + logs)、そして feedback (SLO adjustments への反映) です。Guardrails は必須です。daily error-budget burn が想定の 2 倍を超えたら burn-rate alerts が experiments を pause します。suppression windows + trace-ID correlation で alert noise を dedupe します。cadence: weekly small canary + SLO review、monthly game day + postmortem、quarterly cross-team resilience audit + dependency mapping。LLM-specific experiments: memory overload、network failures、provider outages、malformed prompts、KV cache eviction storms。Tooling: Harness Chaos Engineering (LLM-derived recommendations、blast-radius downscaling、MCP tool integration)、LitmusChaos (CNCF)、Chaos Mesh (CNCF Kubernetes-native)。

**種類:** Learn
**言語:** Python (標準ライブラリ、chaos experiment runner のトイ実装)
**前提:** Phase 17 · 23 (SRE for AI), Phase 17 · 13 (Observability)
**時間:** 約 60 分

## 学習目標

- chaos engineering の 5 つの prerequisites (SLI/SLO、observability、rollback、runbooks、on-call) を挙げ、どれかを省くと practice が壊れる理由を説明する。
- 4 つの planes (control、target、safety、observability) と、SLO への feedback loop を図示する。
- 5 つの LLM-specific experiments (memory overload、network fail、provider outage、malformed prompt、KV eviction storm) を列挙する。
- stack に応じて Harness、LitmusChaos、Chaos Mesh から tool を選ぶ。

## 問題

traditional stacks での chaos testing は確立しています。LLM stacks は新しい failure modes を追加します。poison character を含む 4K-token prompt が tokenizer を 12 秒停止させます。upstream provider が 429 を返し、gateway が retry し、retry-amplified concurrency により service が OOM します。burst load 下の KV cache eviction storm が re-prefill cascades を引き起こし、compute を飽和させます。

これらは unit tests には出てきません。ユーザーが遭遇する前に発見する方法が chaos engineering です。

## コンセプト

### 前提条件

以下なしで本番 chaos を実行してはいけません:

1. **SLI/SLO** — 定義済みの service-level indicators と objectives。
2. **Observability** — dashboards に接続された traces、metrics、logs。
3. **Automated rollback** — Phase 17 · 20 の policy-flag rollback。
4. **Runbooks** — structured、Phase 17 · 23。
5. **On-call** — 対応する人。

どれかが欠けると、chaos は本物の incident になります。

### 4 つの planes + feedback

**Control plane** — experiment scheduler (Litmus workflow、Chaos Mesh schedule、Harness UI)。

**Target plane** — services、pods、nodes、load balancers、data stores。

**Safety plane** — kill switch、suppression windows、blast-radius limits、error-budget gates。

**Observability plane** — normal metrics + trace-ID correlation により、chaos-induced failures と natural failures を区別する。

**Feedback loop** — findings を SLO adjustment、runbook updates、code fixes へ戻す。

### Guardrails は必須

- **Burn-rate alert**: daily error-budget burn が想定の 2 倍を超えたら experiment を pause する。
- **Suppression windows**: experiment 中、blast radius 内の non-experiment alerts を silence する。
- **Trace-ID correlation**: experiment-induced errors にはすべて tag を付け、on-call が dedupe できるようにする。

### 5 つの LLM-specific experiments

1. **Memory overload** — long-context requests を high concurrency で送り、KV cache preemption storm を強制する。観察: service は graceful に shed するか、crash するか。

2. **Network failure** — inference gateway と provider の connectivity を切る。観察: fallback は SLA 内に発動するか。(Phase 17 · 19)

3. **Provider outage simulation** — OpenAI から 100% 429。観察: routing は Anthropic へ failover するか。(Phase 17 · 16, 19)

4. **Malformed prompt** — tokenizer-stalling payload (例: deeply nested unicode、huge UTF-8 codepoint) を inject する。観察: 単一 request が worker を lock up するか。

5. **KV eviction storm** — vLLM block budget を飽和させて eviction を強制する。観察: LMCache は recover するか、service が degrade するか。

### Cadence

- **Weekly** — staging で small canary experiments。場合によっては prod 5%。
- **Monthly** — 特定 scenario の scheduled game day。cross-team attendance。postmortem。
- **Quarterly** — cross-team resilience audit。dependency map update。

### Tooling

- **Harness Chaos Engineering** — commercial。AI-derived experiment recommendations、blast-radius downscaling、MCP tool integration。
- **LitmusChaos** — CNCF graduated。Kubernetes workflow-based。
- **Chaos Mesh** — CNCF sandbox。Kubernetes-native CRD style。
- **Gremlin** — commercial。幅広い support。
- **AWS FIS** / **Azure Chaos Studio** — managed cloud offerings。

### 小さく始める

最初の experiment: steady traffic 下で decode replica を 1 つ pod-kill します。rerouting と recovery を観察します。これが動き、安全に見えたら network chaos に進みます。

最初の LLM-specific experiment: provider 429 を 5 分間 inject します。fallback を観察します。多くのチームは、自分たちの fallback が十分にテストされていなかったことに気づきます。

### 覚えておくべき数字

- 4 つの planes: control、target、safety、observability。
- Burn-rate pause: expected daily budget burn の 2 倍。
- Cadence: weekly canary、monthly game day、quarterly audit。
- 5 つの LLM experiments: memory、network、provider、malformed prompt、KV storm。

## 使ってみる

`code/main.py` は safety plane gates つきの 3 つの chaos experiments をシミュレートします。どの experiments が burn-rate abort を発火させるかを報告します。

## 成果物

この lesson では `outputs/skill-chaos-plan.md` を作ります。stack と maturity を受け取り、最初の 3 つの experiments と tooling を選びます。

## 演習

1. `code/main.py` を実行してください。どの experiment が burn-rate gate を発火させますか。なぜですか。
2. vLLM ベースの RAG service 向けに、最初の 5 つの chaos experiments を設計してください。success criteria も含めます。
3. burn-rate alert が experiment を pause しました。root cause が chaos か natural かをどう判定しますか。
4. chaos は production で実行すべきか、staging のみにすべきかを論じてください。production が正しい答えになるのはいつですか。
5. generic network-chaos では再現できない LLM-specific failure modes を 3 つ挙げてください。

## 重要語句

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|------------------------|
| SLI / SLO | 「service targets」 | Indicator + objective。必須 prerequisite |
| Blast radius | 「scope」 | experiment の影響を受ける services / users の集合 |
| Burn-rate alert | 「budget gate」 | error-budget burn rate が expected の 2 倍を超えると発火 |
| Game day | 「monthly drill」 | scheduled cross-team chaos exercise |
| LitmusChaos | 「CNCF workflow」 | Graduated CNCF Kubernetes chaos tool |
| Chaos Mesh | 「CNCF CRD」 | CNCF sandbox Kubernetes-native chaos |
| Harness CE | 「commercial AI-assisted」 | AI recommendations つき Harness chaos |
| Malformed prompt | 「tokenizer bomb」 | tokenization を停止させる input |
| KV eviction storm | 「preemption cascade」 | mass eviction が re-prefills を trigger する |

## 参考資料

- [DevSecOps School — Chaos Engineering 2026 Guide](https://devsecopsschool.com/blog/chaos-engineering/)
- [Ankush Sharma — Observability for LLMs (book)](https://www.amazon.com/Observability-Large-Language-Models-Engineering-ebook/dp/B0DJSR65TR)
- [LitmusChaos (CNCF)](https://litmuschaos.io/)
- [Chaos Mesh (CNCF)](https://chaos-mesh.org/)
- [Harness Chaos Engineering](https://www.harness.io/products/chaos-engineering)
- [AWS FIS](https://aws.amazon.com/fis/)
