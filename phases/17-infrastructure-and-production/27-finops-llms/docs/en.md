# LLM のための FinOps — Unit Economics と Multi-Tenant Attribution

> Traditional FinOps は LLM spend では破綻します。costs は resource-uptime ではなく token-transactions です。tags はそのまま map できません。API call は asset ではなく transaction です。engineering decisions (prompt design、context window、output length) は financial decisions でもあります。2026 年の playbook では、day one で instrument すべき attribution dimensions が 3 つあります。seat pricing と expansion のための per-user (`user_id`)、product surface cost と prioritization のための per-task (`task_id` + `route`)、unit economics と renewal のための per-tenant (`tenant_id`) です。4 つの token layers — prompt、tool、memory、response — を 1 bucket にまとめると spend が見えなくなります。multi-tenant products の enforcement ladder: tenant ごとの rate limits (expected peak の 2-3 倍、明確な 429 + retry-after)、daily spend cap (contracted ceiling の 1.5-3 倍、rate tightening + alert を trigger)、spend z-score > 4 の kill switches (auto-pause + page on-call)。Attribution patterns: tag-and-aggregate、telemetry-joiner (trace-ID → billing、最高精度)、sampling-and-extrapolation、model-based allocation、event-sourced、real-time streaming。Unit metric: cost per resolved query、cost per generated artifact。$/M tokens ではありません。Retroactive tagging は必ず取りこぼします。request creation 時に instrument します。

**種類:** Learn
**言語:** Python (標準ライブラリ、kill switch つき cost-attribution simulator のトイ実装)
**前提:** Phase 17 · 13 (Observability), Phase 17 · 14 (Caching)
**時間:** 約 60 分

## 学習目標

- traditional FinOps (tags + tiers) が LLM spend で破綻する理由を説明し、3 つの新しい attribution dimensions を挙げる。
- 4 つの token layers (prompt、tool、memory、response) を列挙し、single-bucket billing が cost を隠す理由を説明する。
- multi-tenant product 向けの enforcement ladder (rate → spend cap → kill switch) を設計する。
- $/M tokens ではなく unit metric (cost per resolved query / artifact) を選ぶ。

## 問題

請求額は $40,000 です。しかし次がわかりません:
- どの tenant が使ったのか。
- どの product feature が原因か。
- 個別 user の abusive usage があったか。
- prompt bloat、tool calls、memory amplification のどれが原因か。

provider-side の tag-and-aggregate は、tags が line items に propagate する cloud resources (EC2、S3) では機能します。LLM API calls は auto-tag されません。call site で user/task/tenant を stamp し、最後まで carry する必要があります。Retroactive attribution は常に edge cases を取りこぼします。

## コンセプト

### 3 つの attribution dimensions

**Per-user** (`user_id`): 誰がどれだけ cost を発生させているか。seat pricing、expansion conversations を支え、power users を特定します。

**Per-task** (`task_id` + `route`): どの product surface がどれだけ cost を発生させているか。feature prioritization や kill-expensive-features decisions を支えます。

**Per-tenant** (`tenant_id`): どの customer が profitable か。unit economics、renewal pricing、tier thresholds を支えます。

day one で call site に 3 つすべてを instrument します。retroactive は常に劣ります。

### 4 つの token layers

| Layer | Example | Typical % of total |
|-------|---------|---------------------|
| Prompt | system + user input | 40-60% |
| Tool | tool-call results fed back | 20-40% (agent workloads) |
| Memory | prior conversation / retrieved docs | 10-30% |
| Response | model output | 10-30% |

4 つをすべて 1 bucket にまとめると optimization が見えなくなります。attribution schema で分離します。

### Enforcement ladder

1. **Rate limit** per tenant。expected peak の 2-3 倍。`Retry-After` つき 429 を返す。tenant は friction を見るが、surprise bill は発生しない。

2. **Daily spend cap** per tenant。contracted ceiling の 1.5-3 倍。trigger: rate limit を tighten + customer-success に alert。

3. tenant baseline に対する spend z-score > 4 で **Kill switch**。tenant を auto-pause し、on-call に page し、ops + CS へ escalate する。

### Attribution patterns

- **Tag-and-aggregate**: metadata headers を stamp し、後で aggregate する。単純だが粗い。
- **Telemetry joiner**: trace IDs で traces と billing を join する。最高精度。mature teams が使う方法。
- **Sampling + extrapolation**: 5-10% を sample し、掛け戻す。rough spend には cost-effective だが tails を取りこぼす。
- **Model-based allocation**: regression で cost driver を推定する。tags のない legacy data 向け。
- **Event-sourced**: stream (Kafka / Kinesis) 内の events として cost を扱う。real-time。
- **Real-time streaming**: dashboard が sub-second で更新される。

### Cost per X が unit metric

$/M tokens は vendor speak です。product metrics:

- Cost per resolved support ticket。
- Cost per generated article。
- Cost per successful agent task。
- Cost per user-session-minute。

cost を product outcome に結びつけます。そうしないと optimization の基準がなくなります。

### Cost attribution trace shape

```
trace_id: abc123
  user_id: u_42
  tenant_id: t_7
  task_id: task_classify_doc
  route: model_haiku
  layers:
    prompt_tokens: 1800
    tool_tokens: 600
    memory_tokens: 400
    response_tokens: 150
  cost_usd: 0.0135
  cached_input: true
  batch: false
```

every call で emit します。data lake に store します。dimension ごとに aggregate します。これは Phase 17 · 13 の observability stack に置きます。

### Compounded-savings stack

Stack: cache + batch + route + gateway。4 つすべてを使うと:
- Cache L2 (Phase 17 · 14): input が約 10 倍安い。
- Batch (Phase 17 · 15): 50% off。
- cheap model への route (Phase 17 · 16): 60% cost reduction。
- Gateway efficiency (Phase 17 · 19): redundancy + retries。

best-case stacked では naive baseline の約 5-10%。多くの teams は 2-3 levers を使っていますが、4 つすべてを stack しているところは少数です。

### 覚えておくべき数字

- Attribution dimensions: per-user、per-task、per-tenant。
- 4 つの token layers: prompt、tool、memory、response。
- Kill switch: spend z-score > 4。
- Unit metric: $/M tokens ではなく cost per resolved query。
- Stacked optimizations: baseline の約 5-10% まで可能。

## 使ってみる

`code/main.py` は three-tier enforcement ladder を持つ multi-tenant LLM service をシミュレートします。abusive tenant を inject し、kill switch の発火を示します。

## 成果物

この lesson では `outputs/skill-finops-plan.md` を作ります。product と scale を受け取り、attribution schema と enforcement ladder を設計します。

## 演習

1. `code/main.py` を実行してください。kill switch はどの z-score で発火しますか。threshold はどう選びますか。
2. per-tenant、per-task cost dashboard を設計してください。最初に作る 5 views は何ですか。
3. 最大 tenant が unit-economics-negative です。customer impact の小さい順に 3 つの interventions を提案してください。
4. support product の cost per resolved ticket を計算してください: 3M tokens/ticket、約 800 tickets/day、GPT-5 cached rate。
5. retroactive tagging が機能しうるかを論じてください。許容できるのはいつですか。

## 重要語句

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|------------------------|
| Per-user attribution | 「user-level cost」 | every call に `user_id` を stamp する |
| Per-task attribution | 「feature cost」 | `task_id` + `route` が product surface を特定する |
| Per-tenant attribution | 「customer cost」 | `tenant_id`。unit economics を支える |
| Four token layers | 「cost layers」 | prompt + tool + memory + response |
| Rate limit | 「429 guard」 | gateway で強制する per-tenant ceiling |
| Daily spend cap | 「daily ceiling」 | alert つき tenant-scoped budget |
| Kill switch | 「auto-pause」 | spend z-score > 4 で auto-suspension を trigger |
| Cost per resolved | 「product unit metric」 | tokens ではなく product outcome に紐づく cost |
| Telemetry joiner | 「trace-to-billing」 | 最高精度の attribution pattern |
| Stacked optimization | 「cache+batch+route+gateway」 | baseline の約 5-10% まで下げる複合 savings |

## 参考資料

- [FinOps Foundation — FinOps for AI Overview](https://www.finops.org/wg/finops-for-ai-overview/)
- [FinOps School — Cost per Unit 2026 Guide](https://finopsschool.com/blog/cost-per-unit/)
- [Digital Applied — LLM Agent Cost Attribution 2026](https://www.digitalapplied.com/blog/llm-agent-cost-attribution-guide-production-2026)
- [PointFive — Managed LLMs in Azure OpenAI](https://www.pointfive.co/blog/finops-for-ai-economics-of-managed-llms-in-azure-open-ai)
