# 推論メトリクス — TTFT、TPOT、ITL、Goodput、P99

> 推論デプロイが機能しているかどうかは 4 つのメトリクスで決まります。TTFT は prefill、キュー、ネットワークの合計です。TPOT（ITL と同等）は token あたりのメモリ律速な decode コストです。エンドツーエンド latency は TTFT に、TPOT と出力長の積を足したものです。Throughput は fleet 全体で集計した tokens/sec です。ただしプロダクトで重要なのは goodput、つまりすべての SLO を同時に満たしたリクエストの割合です。Goodput が低いのに throughput が高い場合、ユーザーに時間内に届かない token を処理しているだけです。2026 年の TRT-LLM 上の Llama-3.1-8B-Instruct の参考値: mean TTFT 162 ms、mean TPOT 7.33 ms、mean E2E 1,093 ms。常に P50、P90、P99 を報告し、mean だけで済ませてはいけません。測定の罠にも注意してください。GenAI-Perf は ITL 計算から TTFT を除外し、LLMPerf は含めます。同じ実行でも 2 つのツールで TPOT が一致しません。

**種別:** 学習
**言語:** Python (stdlib、toy percentile calculator and goodput reporter)
**前提条件:** Phase 17 · 04 (vLLM Serving Internals)
**所要時間:** 約 60 分

## 学習目標

- TTFT、TPOT、ITL、E2E、throughput、goodput を正確に定義し、それぞれが測るコンポーネントを説明できる。
- LLM serving で mean が不適切な統計量である理由と、P50/P90/P99 の読み方を説明できる。
- SLO の複合制約（例: TTFT<500 ms AND TPOT<15 ms AND E2E<2 s）を作り、それに対する goodput を計算できる。
- 同じ実行の TPOT で一致しない 2 つの benchmark tool を挙げ、その理由を説明できる。

## 問題

「throughput は 15,000 tokens/sec です」。だから何でしょうか。もしリクエストの 40% が end-to-end で 2 秒を超えていれば、ユーザーはセッションを離脱しています。Throughput だけではプロダクトが機能しているかは分かりません。

推論 latency には複数の軸があり、それぞれ失敗の仕方が異なります。Prefill は compute-bound で、prompt length に応じて伸びます。Decode は memory-bound で、batch size に応じて伸びます。Queuing delay は運用上の問題です。Network は物理距離の問題です。それぞれに別のメトリクスが必要で、percentile も必要です。そして「ユーザーは期待したものを得られたか」を示す単一の合成指標が必要です。それが goodput です。

## コンセプト

### TTFT — time to first token

`TTFT = queue_time + network_request + prefill_time`

Prompt が長いと prefill が支配的になります。H100 上の Llama-3.3-70B FP8 では、32k prompt の純粋な prefill だけで約 800 ms かかります。Queue time は負荷下での scheduler の挙動です。Network request は TLS を含む wire time です。TTFT は、何かが stream で返ってくる前にユーザーが体感する latency です。

### TPOT / ITL — inter-token latency

1 つの量に多くの名前があります。`TPOT`（time per output token）、`ITL`（inter-token latency）、`decode latency per token` はすべて同じです。最初の token の後、連続する streamed token 間の時間です。

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

同じ Llama-3.3-70B H100 stack で chunked prefill を使うと、TPOT mean は約 7 ms です。Chunked prefill がない場合、隣の sequence で長い prefill が走っている間に TPOT は 50 ms まで跳ねることがあります。Mean ではなく P99 を見てください。

### E2E latency

`E2E = TTFT + TPOT * output_tokens + network_response`

長い出力（>500 tokens）では、E2E は TPOT に支配されます。短い出力で長い prompt の場合、E2E は TTFT に支配されます。出力長で条件付けた E2E を報告してください。

### Throughput

`throughput = total_output_tokens / elapsed_time`

集約メトリクスです。Fleet の効率は分かります。個々のリクエストの健全性は分かりません。

### Goodput — 実際に気にするべきメトリクス

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

SLO は複合制約です。すべての制約を満たしたときだけ、そのリクエストは「good」です。Goodput はその割合です。Throughput が高くても goodput が 60% なら失敗です。Throughput が低くても goodput が 99% であることが目標です。

2026 年時点で、goodput は MLPerf Inference v6.0 の提出や、AI platform provider の内部 SLA tracking で使われるメトリクスです。

### Mean が不適切な統計量である理由

LLM latency の分布は右に歪んでいます。1 つの長い prefill を持つ隣接 sequence がある decode batch では、500 tokens が TPOT 約 7 ms で流れ、20 tokens が TPOT 約 60 ms になることがあります。Mean TPOT は 9 ms です。P99 TPOT は 65 ms です。ユーザーは P99 に定期的に当たります。だから離脱するのです。

常に (P50, P90, P99) の 3 つを報告してください。ユーザー体験では、最適化すべき対象は P99 です。

### 参考値 — TRT-LLM 上の Llama-3.1-8B-Instruct、2026 年

- mean TTFT: 162 ms
- mean TPOT: 7.33 ms
- mean E2E: 1,093 ms
- P99 TPOT: chunked-prefill 設定により 10-25 ms の範囲。

これらは NVIDIA が公開している参考点です。モデルサイズ（70B なら 3-5 倍）、ハードウェア（H100 vs B200 で約 3 倍）、負荷によって変わります。

### 測定の罠

2026 年に最も使われている benchmark tool のうち 2 つは、同じ実行でも TPOT が一致しません。

- **NVIDIA GenAI-Perf**: ITL 計算から TTFT を除外します。ITL は token 2 から始まります。
- **LLMPerf**: TTFT を含めます。ITL は token 1 から始まります。

TTFT が 500 ms、100 output tokens、合計 decode が 700 ms のリクエストでは、GenAI-Perf は `ITL = 700/99 = 7.07 ms`、LLMPerf は `ITL = 1200/100 = 12.00 ms` と報告します。ツールの選択だけで数値が変わります。

必ずどのツールかを書いてください。必ず定義を公開してください。

### SLO を構成する

2026 年の 70B chat model に対する、妥当な consumer-facing SLO:

- TTFT P99 <= 800 ms。
- TPOT P99 <= 25 ms。
- <300-token outputs で E2E P99 <= 3 s。
- Goodput target >= 99%。

Enterprise SLO では TTFT を厳しく（200-400 ms）し、E2E は緩めることがあります。重要なのは、それらを書き下し、3 つすべてを測定し、goodput を単一の合成指標として追跡することです。

### 測定方法

- 実トラフィックまたは現実的な synthetic traffic を走らせる（LLMPerf なら `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`）。
- Benchmark run では peak concurrency の 2 倍を target にする。
- 30-50 iterations を実行し、結合サンプルの percentile を取る。
- Tool name、tool version、model、hardware、concurrency、prompt distribution とともに公開する。

## 使ってみる

`code/main.py` は toy goodput calculator です。Synthetic latency distribution を生成し、SLO を適用して goodput を計算します。同じ trace 上で GenAI-Perf と LLMPerf の TPOT の違いも示します。

## Ship It

このレッスンは `outputs/skill-slo-goodput-gate.md` を生成します。Workload と SLO を与えると、throughput ではなく goodput で deploy を gate する CI/CD-ready な benchmark recipe を出力します。

## 演習

1. `code/main.py` を実行してください。1% の tail spike を持つ分布を生成します。P99 TPOT を 30 ms から 15 ms に厳しくすると goodput はどう変わりますか。
2. Vendor が「Llama 3.3 70B H100 で 15,000 tok/s」と言っています。信用する前に尋ねるべき 3 つの質問を挙げてください。
3. Chunked prefill は P99 TPOT を守るのに、mean TPOT には効きにくいのはなぜですか。
4. Voice assistant 向けの consumer SLO を作ってください（first token は読まれるのではなく聞こえる）。どのメトリクスが最もユーザーに見えますか。
5. LLMPerf README と GenAI-Perf docs を読んでください。ツール間で定義が一致しない他の 3 つのメトリクスを特定してください。

## 重要用語

| Term | よく言われること | 実際の意味 |
|------|----------------|------------|
| TTFT | "time to first token" | Queue + network + prefill。長い prompt では prefill が支配的 |
| TPOT | "time per output token" | 最初の token 後の、token あたりの memory-bound な decode cost |
| ITL | "inter-token latency" | 多くのツールでは TPOT と同じ（すべてではない — GenAI-Perf を参照） |
| E2E | "end to end" | TTFT + TPOT * output_len。さらに response-side network が乗る |
| Throughput | "tok/s" | Fleet efficiency。latency percentile なしでは役に立たない |
| Goodput | "SLO-met rate" | すべての SLO 制約を同時に満たしたリクエストの割合 |
| P99 | "tail" | 100 件に 1 件の worst-case latency。ユーザー体験のメトリクス |
| SLO multi-constraint | "the joint" | 3 つすべての latency bound の AND。どれか 1 つでも違反すると失敗 |
| GenAI-Perf vs LLMPerf | "the tool trap" | ITL に TTFT を含めるかどうかでツールが一致しない |

## 参考資料

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) — TTFT、ITL、TPOT の標準的な定義。
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) — 別定義と測定レシピ。
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) — 実デプロイへの適用測定。
- [LLMPerf](https://github.com/ray-project/llmperf) — Ray-based open-source benchmark。
- [GenAI-Perf](https://docs.nvidia.com/deeplearning/triton-inference-server/user-guide/docs/client/src/c++/perf_analyzer/genai-perf/README.html) — NVIDIA の benchmark tool。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) — 業界で受け入れられている goodput-based benchmark。
