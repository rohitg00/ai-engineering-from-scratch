# 推論指標 —— TTFT、TPOT、ITL、Goodput、P99

> 有五個指標決定一次推論部署能不能用。TTFT 是預填加排隊加網路。TPOT（常以 ITL 的名義回報，不過各工具對 ITL 是否計入第一個詞元看法不一）是記憶體受限的每詞元解碼成本。端到端延遲是 TTFT 加上 TPOT 乘以輸出長度。吞吐量是整個機隊加總的每秒詞元數。但對產品而言真正要緊的是 goodput —— 同時滿足每一項 SLO 的請求比例。高吞吐量配低 goodput，代表你在處理那些永遠來不及送到使用者手上的詞元。2026 年 Llama-3.1-8B-Instruct 在 TRT-LLM 上的參考數字：平均 TTFT 162 毫秒、平均 TPOT 7.33 毫秒、平均端到端 1,093 毫秒。永遠要報 P50、P90、P99 —— 絕不要只報平均。還要小心量測陷阱：GenAI-Perf 在計算 ITL 時排除 TTFT，LLMPerf 則納入它；兩套工具對同一趟執行的 TPOT 會給出不同答案。

**類型：** 學習
**程式語言：** Python (stdlib, toy percentile calculator and goodput reporter)
**先修單元：** 階段 17 · 04（服務引擎內部）
**時間：** 約 60 分鐘

## 學習目標

- 精確定義 TTFT、TPOT、ITL、E2E、吞吐量與 goodput，並說出每一個量的是哪個環節。
- 解釋為何平均值對 LLM 服務是錯的統計量，以及怎麼讀 P50／P90／P99。
- 建構一個 SLO 多重限制（例如 TTFT<500 毫秒 AND TPOT<15 毫秒 AND E2E<2 秒），並據以算出 goodput。
- 說出兩套在同一趟執行上對 TPOT 意見不合的基準工具，並解釋原因。

## 問題所在

「我們的吞吐量是每秒 15,000 個詞元。」那又如何？如果有 40% 的請求端到端衝破 2 秒，使用者早就放棄那個工作階段了。光看吞吐量，不會告訴你這個產品能不能用。

推論有多個延遲軸，而每一個失敗的方式都不同。預填是運算受限的，隨提示詞長度縮放。解碼是記憶體受限的，隨批次大小縮放。排隊延遲是一個運維問題。網路是一個實體距離問題。你需要替每一個都有獨立的指標、需要百分位數，也需要一個「使用者有沒有拿到他期待的東西」的單一綜合指標 —— 那就是 goodput。

## 核心概念

### TTFT —— 到第一個詞元的時間

`TTFT = queue_time + network_request + prefill_time`

提示詞很長時，預填會主導。在 H100 上跑 Llama-3.3-70B FP8，一個 32k 的提示詞要約 800 毫秒的純預填。排隊時間是負載下的排程器行為。網路請求是含 TLS 的線上時間。TTFT 就是使用者在任何東西串流回來之前所感受到的延遲。

### TPOT／ITL —— 詞元間延遲

同一個量有很多名字。`TPOT`（每個輸出詞元的時間）、`ITL`（詞元間延遲）、`每詞元的解碼延遲` —— 全都一樣。它是第一個詞元之後，連續兩個串流詞元之間的時間。

`TPOT = (decode_forward_time + scheduler_overhead) / tokens_produced`

在同一套帶分塊預填的 Llama-3.3-70B H100 堆疊上，TPOT 平均約 7 毫秒。沒有分塊預填時，在鄰近序列做長預填的期間，TPOT 可能飆到 50 毫秒。要盯 P99，不是平均。

### 端到端延遲

`E2E = TTFT + TPOT * output_tokens + network_response`

對長輸出（>500 詞元），E2E 由 TPOT 主導。對「短輸出配長提示詞」，E2E 由 TTFT 主導。要回報「依輸出長度分層」的 E2E。

### 吞吐量

`throughput = total_output_tokens / elapsed_time`

彙總指標。它告訴你機隊效率。它不告訴你個別請求的健康狀況。

### Goodput —— 你真正在意的那個指標

`goodput = fraction of requests meeting (TTFT <= a) AND (TPOT <= b) AND (E2E <= c)`

SLO 是一個多重限制。只有在每一項限制都成立時，一個請求才算「好」。Goodput 就是那個比例。有些論文和儀表板改把 goodput 回報成速率：每秒滿足所有 SLO 的請求數。把比例乘上請求速率即可換算。高吞吐量配 60% goodput 是失敗。較低吞吐量配 99% goodput 才是目標。

2026 年，goodput 是 MLPerf Inference v6.0 提交中、以及 AI 平台供應商內部 SLA 追蹤所使用的指標。

### 為什麼平均值是錯的統計量

LLM 的延遲分布是右偏的。一個解碼批次若有一個做長預填的鄰居，可能有 500 個詞元的 TPOT 約 7 毫秒、20 個詞元的 TPOT 約 60 毫秒。平均 TPOT 是 9 毫秒。P99 TPOT 是 65 毫秒。使用者經常撞上那個 P99 —— 那就是他們離開的原因。

永遠回報那組三元組（P50、P90、P99）。就使用者體驗而言，P99 才是你要最佳化的那個。

### 參考數字 —— 2026 年 TRT-LLM 上的 Llama-3.1-8B-Instruct

- 平均 TTFT：162 毫秒
- 平均 TPOT：7.33 毫秒
- 平均 E2E：1,093 毫秒
- P99 TPOT：依分塊預填的設定在 10-25 毫秒之間變動。

這些是 NVIDIA 公布的參考點。它們會隨模型大小（70B 會顯示 3-5 倍）、硬體（H100 對 B200 約 3 倍）與負載而變。

### 那個量測陷阱

2026 年兩套最常被使用的基準工具，對同一趟執行的 TPOT 意見不合：

- **NVIDIA GenAI-Perf**：在 ITL 計算中排除 TTFT。ITL 從第 2 個詞元開始算。
- **LLMPerf**：納入 TTFT。ITL 從第 1 個詞元開始算。

對一個 TTFT 500 毫秒、100 個輸出詞元、解碼總共 700 毫秒的請求，GenAI-Perf 回報 `ITL = 700/99 = 7.07 毫秒`，LLMPerf 回報 `ITL = 1200/100 = 12.00 毫秒`。工具的選擇改變了那個數字。

永遠註明用哪套工具。永遠把定義公布出來。

### 建構一份 SLO

2026 年一份面向消費者的 70B 聊天模型，合理的 SLO 是：

- TTFT P99 <= 800 毫秒。
- TPOT P99 <= 25 毫秒。
- 輸出 <300 詞元時，E2E P99 <= 3 秒。
- Goodput 目標 >= 99%。

企業級的 SLO 會把 TTFT 收得更緊（200-400 毫秒），把 E2E 放寬。重點是把它們寫下來、三個都量，並把 goodput 當成單一綜合指標來追蹤。

### 怎麼量

- 用真實流量或貼近真實的合成流量（LLMPerf 配 `--mean-input-tokens 800 --stddev-input-tokens 300 --mean-output-tokens 150`）。
- 基準執行時瞄準尖峰併發的 2 倍。
- 跑 30-50 次迭代，對合併後的樣本取百分位數。
- 發表時附上工具名稱、工具版本、模型、硬體、併發數、提示詞分布。

```figure
throughput-latency
```

## 框架應用

`code/main.py` 是一個玩具版的 goodput 計算器。產生一份合成延遲分布、套上一份 SLO，然後算出 goodput。它也在同一條軌跡上展示 GenAI-Perf 與 LLMPerf 的 TPOT 差異。

[Inside an LLM Serving GPU](https://aiengineeringfromscratch.com/inside-an-llm-serving-gpu?users=1) 這台機器展示了在 NVIDIA L4 上每個輸出詞元的時間從何而來。一次解碼步驟要讀取 16.41 GB 的權重，以 300 GB/s 計算至少要 54.7 毫秒，而實測的步驟花了 60.16 毫秒。

## 產出交付

這一課產出 `outputs/skill-slo-goodput-gate.md`。給定工作負載與 SLO，它會產出一份 CI/CD 就緒的基準配方，以 goodput 而非吞吐量替部署把關。

## 練習

1. 跑 `code/main.py`。產生一份帶 1% 尾端尖峰的分布。當你把 P99 TPOT 從 30 毫秒收緊到 15 毫秒時，goodput 怎麼變？
2. 某家廠商報價「Llama 3.3 70B 在 H100 上每秒 15,000 個詞元」。在相信它之前，說出三個要問的問題。
3. 為什麼分塊預填保護的是 P99 TPOT，而不是平均 TPOT？
4. 替一個語音助理（第一個詞元是被聽到的，不是被讀到的）建構一份消費者 SLO。哪個指標對使用者最可見？
5. 讀 LLMPerf 的 README 與 GenAI-Perf 的文件。找出另外三個這兩套工具意見不合的指標。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|----------------|------------------------|
| TTFT | 「到第一個詞元的時間」 | 排隊 + 網路 + 預填；長提示詞時由預填主導 |
| TPOT | 「每個輸出詞元的時間」 | 第一個詞元之後、記憶體受限的每詞元解碼成本 |
| ITL | 「詞元間延遲」 | 在多數工具中與 TPOT 相同（不是全部 —— 見 GenAI-Perf） |
| E2E | 「端到端」 | TTFT + TPOT * 輸出長度；再加上回應側的網路 |
| 吞吐量 | 「tok/s」 | 機隊效率；沒有延遲百分位數就沒有用 |
| Goodput | 「達成 SLO 的比率」 | 同時滿足每一項 SLO 限制的請求比例 |
| P99 | 「尾端」 | 百分之一最糟的延遲；那個使用者體驗指標 |
| SLO 多重限制 | 「那個聯集條件」 | 三項延遲界限的 AND；任一被違反該請求就算失敗 |
| GenAI-Perf 對 LLMPerf | 「那個工具陷阱」 | 兩套工具對「ITL 要不要含 TTFT」意見不合 |

## 延伸閱讀

- [NVIDIA NIM — LLM Benchmarking Metrics](https://docs.nvidia.com/nim/benchmarking/llm/latest/metrics.html) —— TTFT、ITL、TPOT 的典範定義。
- [Anyscale — LLM Serving Benchmarking Metrics](https://docs.anyscale.com/llm/serving/benchmarking/metrics) —— 另一套定義與量測配方。
- [BentoML — LLM Inference Metrics](https://bentoml.com/llm/inference-optimization/llm-inference-metrics) —— 在真實部署上的實務量測。
- [LLMPerf](https://github.com/ray-project/llmperf) —— 基於 Ray 的開源基準工具。
- [GenAI-Perf](https://github.com/triton-inference-server/perf_analyzer/blob/main/genai-perf/README.md) —— NVIDIA 的基準工具。
- [MLPerf Inference](https://mlcommons.org/benchmarks/inference-datacenter/) —— 業界接受、以 goodput 為基礎的基準。
