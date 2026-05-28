# LLM の Shadow Traffic、Canary Rollout、Progressive Deployment

> LLM rollout は software deployment の難しい要素を組み合わせる。unit tests がなく、failure modes は拡散し、signals は遅れて届く。順序は (1) shadow mode — prod requests を candidate model に複製し、log して比較する。user impact はゼロ。明らかな distribution issue は捕まえるが quality guarantee ではない。(2) canary rollout — 10% → 25% → 50% → 75% → 100% と progressive traffic shift し、各 step で gate する。latency percentiles、cost/request、error/refusal rate、output length distribution、user-feedback rate を追う。(3) stability が確認された後、distinct alternatives に対して A/B testing を行う。non-determinism は取り除けない。同一 input でも GPU FP non-associativity と batch-size variance により、run 間で最大15%の accuracy variation があり得る。cost は constant ではなく variable である。20%良い model が call あたり3x 高価なこともある。rollback speed が決定的に重要だ。rollback に redeploy が必要なら遅すぎる。policy は config/flags に置き、model は pinned digests を持つ registry に置く。rollback = policy を flip + threshold を revert + old model を数秒で pin。

**種別:** 学習
**言語:** Python (stdlib, toy canary-progression simulator)
**前提条件:** Phase 17 · 13 (Observability), Phase 17 · 21 (A/B Testing)
**所要時間:** 約60分

## 学習目標

- shadow mode（zero-impact compare）、canary（live traffic progressive）、A/B（stability-confirmed comparison）を区別する。
- LLM-specific canary metrics を5つ挙げる（latency、cost/request、error/refusal、output-length distribution、user feedback）。
- LLM non-determinism（最大15%）が rollout における "stable" の意味をどう変えるか説明する。
- 数秒で完了する rollback path（policy flip）を設計する。hours かかる redeploy ではない。

## 課題

新しい model を ship する。offline evals は accuracy +3% を示す。本番で有効化する。24時間以内に cost は40%増え、user thumbs-down は8%増え、3件の customer ticket が「weird answers」を報告する。rollback する。redeploy は3時間かかる。週末が潰れる。

このすべては避けられた。shadow mode は user に見せる前に40% cost spike を捕まえたはずだ。canary は thumbs-down が動いた時点で10%で止めたはずだ。policy-flag rollback なら30秒で終わった。規律が、「offline evals look good」と「real users are happy」の間を埋める。

## コンセプト

### Shadow mode

Candidate は production と同じ requests を受け取る。outputs は log され、users には返されない。user impact はゼロ。log するもの:

- Output content（production との差分）。
- Token counts（cost delta）。
- Latency。
- Refusal and error。

捕まえるもの: cost blow-ups、length regressions、明らかな refusal changes、hard errors。捕まえないもの: users が感じる quality delta。shadow は smoke test であり、quality test ではない。

### Canary rollout

gate 付きの progressive traffic shift。典型 progression: 1% → 10% → 25% → 50% → 75% → 100%。各 step で5つの metrics を gate する:

1. **Latency percentiles** — P50、P95、P99。breach: canary の P99 > 1.5x baseline。
2. **Cost per request** — blended $。breach: baseline より >20% 上。
3. **Error / refusal rate** — 5xx と explicit refusals。breach: baseline の 2x。
4. **Output length distribution** — mean + P99。breach: distributional shift。
5. **User-feedback rate** — thumbs-down / ticket filings。breach: baseline の 1.5x。

### non-determinism は新しい variance

同一 input でも output は同一にならない。理由:

- GPU FP non-associativity（floating-point reduction order が batch により変わる）。
- Batch-size variance（同じ prompt でも batch 128 と batch 16 で違う）。
- Sampling（temperature > 0）。

測定上、同一 eval set の run-to-run accuracy variation は最大15%に達し得る。rollout における "stable" は baseline と同一という意味ではなく、expected variance の範囲内という意味だ。gate は noise floor より上に設定する。

### cost は variable

20%良い model が call あたり3x 高価なことがある。Cost/request は5つの gate の1つだ。unit economics を壊す「より良い」model の出荷は rollback case である。

### rollback が武器になる

- Policy flag（feature flag system）: config 内の percentage を flip する。数秒。
- Model pinning（registry digest）: pinned model は auto-upgrade されない。
- Rollback = flag を戻す + pinned digest を previous に設定する。数秒であり、数時間ではない。

rollback に redeploy が必要な stack なら、roll する前にそこを直す。

### tooling

**Argo Rollouts** / **Flagger** — Kubernetes progressive delivery controllers。Istio/Linkerd weighted routing と統合する。

**Istio weighted routing** — service-mesh-level traffic split。

**KServe / Seldon Core** — built-in canary を持つ model serving。

**Feature flags** — LaunchDarkly、Flagsmith、Unleash。policy-level flip、redeploy 不要。

### metrics cadence

Canary gate は traffic volume に応じて5-15分ごとに確認する。10 req/min の1% traffic では window あたり50-150 data points しかない。latency には十分でも user feedback には noisy だ。10%では約10倍になる。progression は各 step で十分な sample を集めるだけ pause するべきだ。

### A/B step は optional

new model が明確に異なる場合（behavior、cost curve、tone が違う）は、canary 通過後に50%で A/B test する。単なる improved version なら、canary gates 通過後に100%へ進めてよい。

### 覚えておくべき数字

- Canary progression: 1% → 10% → 25% → 50% → 75% → 100%。
- Non-determinism ceiling: 同一 input で最大15% run-to-run variance。
- Five canary metrics: latency、cost、error/refusal、output length、user feedback。
- Cost gate: baseline より >20% は breach。
- Rollback: hours ではなく seconds。

## 使ってみる

`code/main.py` は regression を注入した canary rollout を simulate する。rollout がどの stage で止まり、どの gate が発火したかを report する。

## 成果物

この lesson は `outputs/skill-rollout-runbook.md` を生成する。candidate model、baseline、risk tolerance を受け取り、shadow→canary→100% plan を設計する。

## 演習

1. `code/main.py` を実行する。25% cost regression を注入する。canary はどの stage で止まるか。
2. new model は offline で accuracy +3% だが cost/request は +18%。ship するか。policy による。両方の path を書く。
3. end-to-end で60秒未満の rollback を設計する。必要な infrastructure を列挙する。
4. non-determinism が eval で ±7% を示している。false alarm を起こさない canary gates を設定する。どの multiplier を使うか。
5. shadow mode が canary 前に40% cost spike を捕まえた。発火する alert rule を書く。

## 重要用語

| 用語 | よく言われること | 実際の意味 |
|------|----------------|------------------------|
| Shadow mode | "duplicate to new" | logging のため candidate に zero-impact で送る |
| Canary | "progressive traffic" | gates 付きの gradual user-exposed rollout |
| Gates | "rollout checks" | progression を block する metric thresholds |
| Non-determinism | "LLM variance" | 取り除けない run-to-run differences |
| Policy flag | "flag flip rollback" | config-level rollback。hours ではなく seconds |
| Model pin | "registry digest" | model version への immutable reference |
| Argo Rollouts | "K8s progressive" | Kubernetes-native canary/rollback controller |
| KServe | "inference K8s" | canary primitive を持つ model serving |
| Istio weighted | "mesh split" | service-mesh traffic splitter |

## 参考資料

- [TianPan — Releasing AI Features Without Breaking Production](https://tianpan.co/blog/2026-04-09-llm-gradual-rollout-shadow-canary-ab-testing)
- [MarkTechPost — Safely Deploying ML Models](https://www.marktechpost.com/2026/03/21/safely-deploying-ml-models-to-production-four-controlled-strategies-a-b-canary-interleaved-shadow-testing/)
- [APXML — Advanced LLM Deployment Patterns](https://apxml.com/courses/mlops-for-large-models-llmops/chapter-4-llm-deployment-serving-optimization/advanced-llm-deployment-patterns)
- [Argo Rollouts docs](https://argo-rollouts.readthedocs.io/)
- [Flagger docs](https://docs.flagger.app/)
