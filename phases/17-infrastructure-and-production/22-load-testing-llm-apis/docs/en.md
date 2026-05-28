# LLM API の負荷テスト — k6 と Locust の数値が嘘をつく理由

> 従来の負荷テスターは、ストリーミング応答、可変の出力長、トークン単位のメトリクス、GPU 飽和を前提に設計されていません。多くのチームは 2 つの罠にはまります。GIL の罠: Locust のトークン単位計測は Python GIL の下でトークナイズを実行するため、高並行時にはリクエスト生成と競合します。その結果、トークナイズの滞留が報告上の inter-token latency を膨らませます。遅いのはサーバーではなくクライアントです。プロンプト均一性の罠: ループ内で同一プロンプトを投げると、トークン分布上の 1 点だけをテストします。実トラフィックは長さがばらつき、prefix の一致も多様です。LLMPerf は `--mean-input-tokens` と `--stddev-input-tokens` でこれを補正します。2026 年のツール対応: トークン単位の精度には LLM 特化ツール (GenAI-Perf, LLMPerf, LLM-Locust, guidellm)。**k6 v2026.1.0** + **k6 Operator 1.0 GA (Sept 2025)** はストリーミング対応で、TestRun/PrivateLoadZone CRD による Kubernetes ネイティブな分散実行ができ、CI/CD ゲートに最適です。Vegeta は Go の定レート飽和テスト向け。Locust 2.43.3 はストリーミング用途では LLM-Locust 拡張つきの場合だけ使います。負荷パターン: steady-state、ramp、spike (オートスケーリングテスト)、soak (メモリリーク)。

**種類:** Build
**言語:** Python (標準ライブラリ、現実的なプロンプト生成器 + レイテンシ収集器のトイ実装)
**前提:** Phase 17 · 08 (Inference Metrics), Phase 17 · 03 (GPU Autoscaling)
**時間:** 約 75 分

## 学習目標

- 汎用負荷テスターが LLM API で嘘をつく原因になる 2 つのアンチパターン (GIL の罠、プロンプト均一性の罠) を説明する。
- 目的に応じたツールを選ぶ: LLMPerf (ベンチマーク実行)、k6 + streaming extension (CI ゲート)、guidellm (大規模 synthetic)、GenAI-Perf (NVIDIA reference)。
- 4 つの負荷パターン (steady、ramp、spike、soak) を設計し、それぞれが捕まえる障害モードを言えるようにする。
- 固定長ではなく、入力トークン数の mean + stddev を使って現実的なプロンプト分布を作る。

## 問題

LLM エンドポイントを k6 で 500 concurrent users までテストしました。耐えました。リリースしました。しかし本番では実ユーザー 200 人でサービスが倒れました。P99 TTFT が跳ね上がり、GPU は張り付きました。

起きたことは 2 つです。第一に、k6 は同一プロンプトを 500 回送っていました。request coalescing と prefix caching により、実際には 1 つしか処理していないのに、500 の concurrent decode を処理できているように見えました。第二に、k6 はストリーミング応答の inter-token latency を人間の体感どおりには追跡しません。k6 が見るのは 1 本の HTTP 接続であり、ばらばらの間隔で到着する 500 個のトークンではありません。

LLM の負荷テストは、それ自体が 1 つの専門分野です。

## コンセプト

### GIL の罠 (Locust)

Locust は Python を使い、クライアント側トークナイズを GIL の下で実行します。高並行では tokenizer がリクエスト生成の後ろに並びます。報告される inter-token latency にはクライアント側のトークナイズ滞留が含まれます。サーバーが遅いように見えますが、遅いのはテストハーネスです。

対策: LLM-Locust 拡張でトークナイズを別プロセスへ移すか、コンパイル言語のハーネス (k6、tokenizers.rs を使う LLMPerf) を使います。

### プロンプト均一性の罠

既知の負荷テスターの多くは、1 つのプロンプトを設定できます。10,000 回のループテストでは、毎回まったく同じプロンプトが送られます。サーバーは毎回同じ prefix を見ます。prefix cache hit は 100% に近づき、throughput は非常によく見えます。

対策: プロンプト分布からサンプリングします。LLMPerf は `--mean-input-tokens 500 --stddev-input-tokens 150` を使います。長さも内容も多様になります。

### 4 つの負荷パターン

1. **Steady-state** — 30-60 分、一定 RPS。捕まえるもの: ベースライン性能の退行。
2. **Ramp** — 15 分かけて RPS を 0 から目標値まで線形に増やす。捕まえるもの: キャパシティの破断点、warm-up 異常。
3. **Spike** — 2 分間だけ突然 3-10 倍 RPS にして戻す。捕まえるもの: オートスケーリング遅延、キュー飽和、cold start 影響。
4. **Soak** — 4-8 時間の steady-state。捕まえるもの: メモリリーク、connection pool drift、observability overflow。

### 2026 年のツール対応

**LLMPerf** (Anyscale) — Python ですが Rust ベースの tokenization を使います。mean/stddev プロンプト。ストリーミング対応。性能測定の標準候補です。

**NVIDIA GenAI-Perf** — NVIDIA の reference。Triton client を使い、メトリクスの範囲が広いです。ITL は TTFT を除外し、LLMPerf は含める点に注意してください。同じサーバーでも 2 つのツールは異なる TPOT を出します。

**LLM-Locust** (TrueFoundry) — GIL の罠を修正する Locust 拡張。慣れた Locust DSL と streaming metrics を使えます。

**guidellm** — 大規模 synthetic benchmarking。

**k6 v2026.1.0** + **k6 Operator 1.0 GA (Sept 2025)**:
- k6 本体 (Go、コンパイル済み、GIL なし) は streaming-aware metrics を追加済み。
- k6 Operator は TestRun / PrivateLoadZone CRD を使い、Kubernetes ネイティブな分散テストを実行します。
- CI/CD ゲートと SLA テストに最適です。

**Vegeta** — Go 製で k6 より単純。定レート HTTP 飽和テスト。LLM-aware ではありませんが、gateway / rate-limit テストには有効です。

**Locust 2.43.3 stock** — LLM では GIL の罠があります。LLM-Locust 拡張つきの場合だけ使います。

### CI の SLA ゲート

PR で k6 を実行します:

- baseline RPS で各 30-50 iteration。
- ゲート: P50/P95 TTFT、5xx < 5%、TPOT がしきい値未満。
- 違反したらビルドを落とします。

### 現実的なプロンプト分布

実トラフィックのサンプルがあればそれを使い、なければ公開分布 (例: chat なら ShareGPT prompts、code なら HumanEval) から作ります。mean + stddev を LLMPerf に渡します。1 つのプロンプトだけをループするテストは絶対に避けます。

### 覚えておくべき数字

- k6 Operator 1.0 GA: 2025 年 9 月。
- k6 v2026.1.0: streaming-aware metrics。
- 一般的な LLMPerf 実行: concurrency X で 100-1000 requests。
- 一般的な CI ゲート: PR ごとに 30-50 iterations。
- 4 つのパターン: steady、ramp、spike、soak。

## 使ってみる

`code/main.py` は、現実的なプロンプト分布を使った負荷テストをシミュレートし、有効 TPOT を測定し、uniform-prompt trap を示します。

## 成果物

この lesson では `outputs/skill-load-test-plan.md` を作ります。ワークロードと SLA を受け取り、ツールを選び、4 つの負荷パターンを設計します。

## 演習

1. `code/main.py` を実行してください。uniform と realistic distribution を比較します。差はどこに出ますか。
2. CI ゲート用の k6 script を書いてください: 100 concurrent、runtime 5 分、TTFT P95 < 800 ms。
3. soak test でメモリが 50 MB/hour 増えています。原因を 3 つ挙げ、切り分けるための instrumentation を示してください。
4. 10 RPS から 100 RPS への spike test。Karpenter + vLLM production-stack がある場合 (Phase 17 · 03 + 18)、期待される復旧時間はどのくらいですか。
5. 同じサーバーで GenAI-Perf は TPOT=6ms、LLMPerf は TPOT=11ms と報告しました。説明してください。

## 重要語句

| 用語 | よくある言い方 | 実際の意味 |
|------|----------------|------------------------|
| LLMPerf | 「LLM ハーネス」 | Anyscale の benchmark tool、streaming-aware |
| GenAI-Perf | 「NVIDIA tool」 | NVIDIA reference harness |
| LLM-Locust | 「LLM 向け Locust」 | GIL の罠を修正する Locust 拡張 |
| guidellm | 「synthetic benchmark」 | 大規模 synthetic tool |
| k6 Operator | 「K8s k6」 | CRD ベースの分散 k6 |
| GIL trap | 「Python client overhead」 | tokenization backlog が報告レイテンシを膨らませる |
| Prompt-uniformity trap | 「single-prompt lie」 | 同じプロンプトのループが cache に当たり、throughput を過大評価する |
| Steady-state | 「constant load」 | N 分間のフラットな RPS |
| Ramp | 「linear up」 | 所定時間で 0 から目標値まで増やす |
| Spike | 「burst test」 | 突然倍率をかけてから戻す |
| Soak | 「long test」 | リーク検出のための数時間テスト |

## 参考資料

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
