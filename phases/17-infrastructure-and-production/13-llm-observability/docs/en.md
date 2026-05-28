# LLM Observability Stack Selection

> 2026 年の observability market は 2 つの category に分かれます。Development platforms（LangSmith、Langfuse、Comet Opik）は monitoring を evals、prompt management、session replays と束ねます。Gateway/instrumentation tools（Helicone、SigNoz、OpenLLMetry、Phoenix）は telemetry に集中します。Langfuse は MIT-licensed core で OSS balance が強く、cloud free は 50K events/month です。Phoenix は Elastic License 2.0 の OpenTelemetry-native で、drift/RAG visualization に優れますが、persistent production backend ではありません。Arize AX は zero-copy Iceberg/Parquet integration によって monolithic observability より 100x cheaper と主張しています。LangSmith は LangChain/LangGraph で先行し、$39/user/mo、self-host は Enterprise のみです。Helicone は proxy-based で 15-30 min setup、100K req/mo free ですが、agent traces の深さは弱めです。一般的な production pattern は Gateway（Helicone/Portkey）+ eval platform（Phoenix/TruLens）を OpenTelemetry で glue する形です。

**種別:** 学習
**言語:** Python (stdlib、toy trace-sampling simulator)
**前提条件:** Phase 17 · 08 (Inference Metrics), Phase 14 (Agent Engineering)
**所要時間:** 約 60 分

## 学習目標

- Development platforms（bundled: evals + prompts + sessions）と gateway/telemetry tools（traces + metrics only）を区別できる。
- 主要 6 tool（Langfuse、LangSmith、Phoenix、Arize AX、Helicone、Opik）を licensing、pricing、sweet-spot use cases に対応付けられる。
- Gateway tool と別の eval platform を組み合わせられる OpenTelemetry-glue pattern を説明できる。
- 2026 年の cost differentiator（Arize AX の zero-copy approach vs monolithic ingest）と、おおよその 100x multiplier を説明できる。

## 問題

LLM feature を ship しました。動いています。しかし prompt failures、tool loops、latency regressions、cost spikes、prompt-cache hit rate への visibility がありません。"LLM observability" を検索すると、8 つの tool が同じ問題を解いていると主張し、価格帯は 3 つに分かれています。

同じ問題を解いているわけではありません。LangSmith は「なぜこの LangGraph run は失敗したのか」に答えます。Phoenix は「RAG pipeline が drift しているか」に答えます。Helicone は「どの app が tokens を燃やしているか」に答えます。Langfuse は「全体を self-host できるか」に答えます。Tool が違えば、audience も違います。

選定には 4 つの軸があります。Stack（LangChain? raw SDK? multi-vendor?）、license tolerance（MIT only? Elastic OK? commercial fine?）、budget（free tier? $100/mo? $1000/mo?）、self-host（must? nice-to-have? never?）です。

## コンセプト

### 2 つの category

**Development platforms** は observability を evals、prompt management、dataset versioning、session replay と束ねます。Experiments を走らせ、どの prompt が効いたかを見て、新しい prompt を古い winner と dataset-regression します。LangSmith、Langfuse、Comet Opik が該当します。

**Gateway/telemetry tools** は inference calls を instrument します。Prompt、response、tokens、latency、model、cost です。Helicone、SigNoz、OpenLLMetry、Phoenix が該当します。Minimalist です。OpenTelemetry を通じて別の eval tool と組み合わせられます。

### Langfuse — OSS balance

- Core は Apache / MIT licensed。Docker で self-host。
- Cloud free tier: 50K events/month。Paid: team で $29/mo。
- Evals、prompt management、traces、datasets。4 つの dev-platform features を程よくカバー。
- Sweet spot: LangSmith-class features が必要だが、self-host か OSS license に留まる必要がある。

### Phoenix（Arize）— telemetry-first、OpenTelemetry-native

- Elastic License 2.0。Self-host は簡単。
- RAG と drift visualization に優れます。Embedding-space scatter plots が first-class として提供されています。
- Persistent production backend としては設計されていません。主に development-time observability です。
- Sweet spot: RAG pipeline development、drift debugging。Production では別 gateway と組み合わせる。

### Arize AX — scale play

- Commercial。Iceberg/Parquet 経由の zero-copy data lake integration。
- Scale では monolithic observability（Datadog-class）より約 100x cheaper と主張します。計算は、traces を自分の S3 上の Parquet に保存し、Arize が直接読む、というものです。
- Sweet spot: >10M traces/day、既存 data lake、Datadog pricing なしで LLM-specific dashboards が必要。

### LangSmith — LangChain/LangGraph first

- Commercial、$39/user/month。Self-host は Enterprise のみ。
- LangChain と LangGraph stack では best-in-class。どちらも使っていない場合、魅力は下がります。
- Sweet spot: LangChain にコミットしており、支払いに問題がない team。

### Helicone — proxy-based minimum viable

- `OPENAI_API_BASE` を Helicone proxy に差し替えるだけで 15-30 分 setup。
- MIT licensed。100K req/mo free、paid は $20/mo+。
- Failover、caching、rate limits を含み、gateway としても振る舞います。
- Agent / multi-step traces の深さは弱めです。
- Sweet spot: quick start、single-stack app、gateway + observability を 1 つにしたい場合。

### Opik（Comet）— OSS dev platform

- Apache 2.0、fully OSS。
- Langfuse に近い feature set を持ち、Comet の heritage があります。
- Sweet spot: すでに Comet を使っている ML teams が、同じ画面で LLM observability を見たい場合。

### SigNoz — OpenTelemetry-first full APM

- Apache 2.0。General APM と OpenTelemetry 経由の LLM を扱います。
- Sweet spot: Services と LLM calls をまとめた unified observability。

### Glue: OpenTelemetry + GenAI semantic conventions

OpenTelemetry は 2025 年後半に GenAI semantic conventions（`gen_ai.system`、`gen_ai.request.model`、`gen_ai.usage.input_tokens`）を公開しました。OTel を consume する tools は相互運用できます。Emerging production pattern:

1. すべての LLM call から GenAI conventions 付き OTel を emit する。
2. Day-to-day 用に gateway（Helicone / Portkey）へ route する。
3. Regression 用に eval platform（Phoenix / Langfuse）へ dual-ship する。
4. Long-term analysis 用に data lake（Iceberg）へ archive し、Arize AX または DuckDB で分析する。

### 罠: 間違った layer で instrument する

Agent framework 内で instrument する（例: LangSmith traces を追加）と、その framework に coupling します。HTTP/OpenAI-SDK layer（OpenLLMetry や gateway）で instrument すれば portable です。

### Sampling — すべては保存できない

>1M requests/day では、full-trace retention の cost が LLM calls より高くなります。Rules で sample します: errors は 100%、high-cost は 100%、success は 5%。Aggregates は常に保持し、raw は long tail 用に保持します。

### 覚えておくべき数値

- Langfuse free cloud: 50K events/month。
- LangSmith: $39/user/month。
- Helicone free: 100K req/month。
- Arize AX claim: scale では monolithic より約 100x cheaper。
- OpenTelemetry GenAI conventions: 2025 年に shipping、2026 年に広く adopted。

## 使ってみる

`code/main.py` は 1M-trace day を retention strategies（100% ingest、sampling、sampling + errors）全体で simulate します。Storage cost と各 strategy で失われるものを報告します。

## Ship It

このレッスンは `outputs/skill-observability-stack.md` を生成します。Stack、scale、budget、license posture を与えると tool(s) を選びます。

## 演習

1. LangChain を使う team が OSS self-hosted observability を求めています。Langfuse または Opik を選んで理由を述べてください。
2. 5M traces/day で Datadog 見積もりが $150K/month の場合、Arize AX の break-even を計算してください。
3. 組織の guideline としてすべての LLM call に必須にすべき OpenTelemetry GenAI attribute set を設計してください。
4. Phoenix だけで production に十分かを論じてください。どんな場合に不十分ですか。
5. Helicone は 20ms の proxy overhead です。P99 TTFT 300 ms なら許容できますか。SLA が 100 ms ならどうですか。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| OpenLLMetry | "OTel for LLMs" | LLM 向け open-source OpenTelemetry instrumentation |
| GenAI conventions | "OTel attributes" | LLM calls 用の標準 OTel attribute names |
| LangSmith | "LangChain observability" | LangChain ecosystem と束ねられた commercial platform |
| Langfuse | "OSS LangSmith" | 類似 feature set を持つ MIT OSS |
| Phoenix | "Arize dev tool" | OpenTelemetry-native dev/eval platform |
| Arize AX | "scale observability" | Commercial zero-copy Iceberg/Parquet observability |
| Helicone | "proxy observability" | LLM telemetry + gateway features を集める HTTP proxy |
| Opik | "Comet LLM" | Comet の Apache 2.0 OSS dev platform |
| Session replay | "trace rerun" | Tool calls を含む full agent session の replay |
| Eval | "offline test" | Labeled dataset 上で candidate model/prompt を実行すること |

## 参考資料

- [SigNoz — Top LLM Observability Tools 2026](https://signoz.io/comparisons/llm-observability-tools/)
- [Langfuse — Arize AX Alternative analysis](https://langfuse.com/faq/all/best-phoenix-arize-alternatives)
- [PremAI — Setting Up Langfuse, LangSmith, Helicone, Phoenix](https://blog.premai.io/llm-observability-setting-up-langfuse-langsmith-helicone-phoenix/)
- [OpenTelemetry GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- [Arize Phoenix docs](https://docs.arize.com/phoenix)
- [Helicone docs](https://docs.helicone.ai/)
