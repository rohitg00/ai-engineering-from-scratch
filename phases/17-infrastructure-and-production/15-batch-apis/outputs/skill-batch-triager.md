---
name: batch-triager
description: LLM ワークロードを interactive / semi-interactive / batch レーンへ仕分け、stacked discount（batch + cache）の節約額を計算し、誤って仕分けられたワークロードを指摘する。
version: 1.0.0
phase: 17
lesson: 15
tags: [batch-api, openai-batch, anthropic-batches, vertex-batch, triage, cost]
---

ワークロード（name、latency に対する user expectation、traffic volume、shared prompt structure）が与えられたら、triage + cost plan を作成する。

作成するもの:

1. Lane. Interactive（TTFT-bound, sync）、semi-interactive（minutes OK, async queue）、または batch（by-morning OK, batch API）。具体的な user expectation で正当化する。
2. Current cost. 現在の構成（sync、no cache など）で monthly cost を計算する。
3. Target cost. 推奨構成（batch + cache または sync + cache）後の cost を計算する。current に対する % で表す。
4. Migration plan. provider-specific steps（workload の model に一致するものを1つ選ぶ。両方は不要）:
   - OpenAI: `/v1/batches` へ移行する。Prompt caching は対象 prompt（>=1024 tokens）で自動的に有効になる。設定する `cache_control` はない。より細かい attribution には任意で `prompt_cache_key` を渡す。
   - Anthropic: Message Batches へ移行する。cache reuse には、cache 可能な prompt span に対する明示的な `cache_control` block（例: `{"type": "ephemeral"}`）が必要。batch discount は cached-read pricing と重なる。
   - Both: success/failure webhook と、turnaround window を外した batch を sync へ逃がす spillover lane を計測する。
5. Risk. batch turnaround が P99 で20 hours だったらどうするか。downstream system behavior（email delivery、queue spillover to sync）を明記する。
6. Observable. mis-triage を検出する metric: batch job completion latency P95。> 12時間 で alert。

強い拒否条件:
- ユーザーが "by morning" latency しか必要としていない overnight pipeline を、batch なしの sync mode で動かす。拒否し、約90%の漏れた支出を指摘する。
- sub-15-minute の user expectation があるものに batch を約束する。拒否する。batch SLA は24h。
- shared system prompt を持つ batch workload で prompt caching を無視する。拒否する。stacked discount こそが要点。

拒否ルール:
- workload が "real-time" と売られているが、実際の user expectation が minutes の場合、batch を推奨する前に明示的な確認を求める。
- workload が batch 内 prompt caching のない provider（例: KV-prefix reuse のない custom/self-hosted stack）を対象にする場合、batch discount だけが適用されることを明記し、stacked savings なしで再計算する。OpenAI batch caching は自動。Anthropic batch caching には明示的な `cache_control` block が必要。
- strict latency SLA（例: P99 < 60s）がある場合は batch を明確に拒否する。別レーンに属する。

出力: lane、current cost、target cost、migration steps、risk、observable を含む1ページの triage。最後に cadence を添える: product surface の変化に合わせ、全 workload を四半期ごとに再 triage する。
