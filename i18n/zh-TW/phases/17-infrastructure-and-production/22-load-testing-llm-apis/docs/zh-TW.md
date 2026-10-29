# LLM API 的壓力負載測試——為何 k6 與 Locust 會向你說謊（Load Testing LLM APIs — Why k6 and Locust Lie）

> 傳統的負載壓測工具並非為文字串流傳輸（Streaming）、動態輸出長度、Token 級微度量以及 GPU 飽和特性而設計。兩大經典陷阱常讓團隊慘遭誤導。GIL 鎖定陷阱：Locust 的 Token 級計時在 Python 全域直譯器鎖（GIL）下執行 tokenization，在極限並行下用戶端自身的運算瓶頸與請求發送激烈爭奪 CPU，tokenization 積壓會嚴重虛胖呈報的 Token 間延遲——此時真正的效能瓶頸在你的測試用戶端，而非後端推論伺服器。Prompt 同質化陷阱：在迴圈中使用單一固定 Prompt 僅僅測試了 Token 分佈空間上的孤立單點；真實業務流量長度多變，且有多樣的前綴匹配。LLMPerf 透過 `--mean-input-tokens` 與 `--stddev-input-tokens` 改善了這個問題。2026 年壓測工具矩陣：專用型工具（GenAI-Perf、LLMPerf、LLM-Locust、guidellm）守護 Token 級精確度；**k6 v2026.1.0** 搭配 **k6 Operator 1.0 GA（2025 年 9 月發布）** 支援原生串流感知，透過 TestRun 與 PrivateLoadZone 等 CRD 原生融入 Kubernetes 分散式測試，是 CI/CD 發布閘門的最佳首選；Vegeta 適用於 Go 語言極致恆定速率 HTTP 飽和壓測；原生 Locust 2.43.3 唯有掛載 LLM-Locust 擴充套件後才具備串流指標測量能力。四大標準壓測模式：平穩穩態（Steady-state）、漸進遞增（Ramp）、突發尖峰（Spike，檢驗自動擴縮）、長時浸泡（Soak，檢驗記憶體洩漏）。

**Type:** Build
**Languages:** Python (stdlib, toy realistic-prompt generator + latency collector)
**Prerequisites:** Phase 17 · 08 (Inference Metrics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深刻解釋導致傳統通用壓測工具在面對 LLM API 時頻繁說謊的兩大反模式（GIL 陷阱與 Prompt 同質化陷阱）。
- 根據具體壓測目標精準完成工具選型：LLMPerf（效能基準測試）、k6 搭配串流擴充（CI 阻斷閘門）、guidellm（巨量擬真合成壓測）、GenAI-Perf（NVIDIA 參考測試工具）。
- 設計四大標準負載模式（平穩穩態、階梯遞增、突發衝擊、長時浸泡），並指出每一種模式會捕捉的故障模式。
- 學會使用輸入 Token 的平均值與標準差建構擬真的輸入 Token 長度分布，而非採用固定長度文本。

## The Problem｜問題

你用 k6 在 500 個並行使用者下測試 LLM 端點。撐住了。你便上線了。到了正式環境，實際使用者只有 200 人，服務卻垮了——P99 TTFT 暴增，GPU 滿載。

兩個致命盲區同時爆發。首先，你的 k6 腳本在迴圈中向伺服器發送了 500 個完全相同的 Prompt——後端推論引擎的請求合併（Request coalescing）與前綴快取機制（Prefix caching）被極致觸發，讓你誤以為自己正在處理 500 個並行解碼，實際上只處理一個請求。其次，傳統 k6 並未在串流回應內部逐 Token 記錄吐字間隔；在它眼裡這僅僅是一條耗時數秒的普通 HTTP 長連線，完全無法感知 500 個 Token 在使用者眼前斷斷續續、忽快忽慢的嚴重卡頓。

針對 LLM 的負載測試，是一門獨立的專業領域。

## The Concept｜核心概念

### GIL 鎖定陷阱（Locust）（The GIL trap (Locust)）

Locust 完全基於 Python 開發，其用戶端的 Token 級計時必須在 Python 的全域直譯器鎖（GIL）約制下執行本地 tokenization。在超高並行壓力下，用戶端的 Tokenizer 會與底層的非同步請求生成機制爆發激烈的 CPU 爭搶。呈報的 Token 間延遲（ITL）實質上混入了用戶端本身的排隊積壓。你誤以為是伺服器吐字太慢，實質上是測試機自己早已不堪重負。

標準解決之道：採用 LLM-Locust 擴充套件將 tokenization 運算剝離至獨立的外部行程，或直接擁抱無 GIL 約制的編譯型壓測工具（基於 Go 的 k6，或是整合了 Rust 核心 tokenizers.rs 的 LLMPerf）。

### 單一 Prompt 同質化陷阱（The prompt-uniformity trap）

所有已知的負載測試工具都允許你設定一個 Prompt。在長達 10,000 次的迴圈迭代中，伺服器接收到的是千篇一律的完全相同文字。前綴快取命中率瞬間飆升至逼近 100%，推論吞吐量看似無比光鮮，但這在真實業務中純屬海市蜃樓。

標準解決之道：從擬真的 Prompt 分布中取樣。LLMPerf 透過傳入 `--mean-input-tokens 500 --stddev-input-tokens 150` 參數，生成長度各異、內容多樣的文本。

### 四大標準負載壓測模式（Four load patterns）

1. **平穩穩態（Steady-state）**——維持恆定 RPS 壓力持續執行 30 至 60 分鐘。捕捉：基準線效能回歸缺陷。
2. **階梯遞增（Ramp）**——在 15 分鐘內將 RPS 從 0 線性推升至目標上限。捕捉：容量臨界點（Breakpoint）與冷啟動預熱異常。
3. **突發尖峰（Spike）**——將 RPS 突然提高至 3 至 10 倍並維持 2 分鐘，然後回到原本水準。捕捉：自動擴縮延遲、佇列飽和與冷啟動影響。
4. **長時浸泡（Soak）**——在穩態壓力下持續不間斷壓測 4 至 8 小時。捕捉：記憶體洩漏、連線池耗盡漂移，以及可觀測性記錄儲存溢位。

### 2026 年主流壓測工具選型全貌（2026 tool mapping）

**LLMPerf**（Anyscale 出品）——雖然基於 Python，但底層 tokenization 完全交由 Rust 高效能核心接管。原生支援基於均值/標準差的動態文本生成與串流計時。是目前推論效能基準測試的最佳首選。

**NVIDIA GenAI-Perf**——NVIDIA 的參考測試工具。原生支援 Triton 用戶端，具備極致全方位的指標覆蓋。注意其計算 ITL 時排除了 TTFT（首 token 延遲）；兩者對同一伺服器回報的 TPOT 不同：GenAI-Perf 計算 ITL 時排除 TTFT，而 LLMPerf 的定義包含 TTFT。

**LLM-Locust**（TrueFoundry 出品）——用於 LLM 的 Locust 擴充套件，修正了 Python GIL 陷阱。提供熟悉的 Locust DSL 語法與串流指標度量。

**guidellm**——專攻超大規模合成基準測試。

**k6 v2026.1.0** 搭配 **k6 Operator 1.0 GA（2025 年 9 月正式釋出）**：
- k6 核心（基於 Go 語言編譯，天生零 GIL 困擾）正式支援串流感知指標。
- k6 Operator 引入 TestRun 與 PrivateLoadZone 等 Kubernetes 原生 CRD，支援將壓測負載分散式調度至叢集多個節點。
- 專門適用於 CI/CD 自動化阻斷管線與嚴肅的 SLA 合規驗收。

**Vegeta**——基於 Go 打造，架構比 k6 更為極簡。提供絕對恆定速率的 HTTP 流量飽和衝擊。雖無 Token 級感知，但極度適合檢驗前端 Gateway 的速率限制與防禦極限。

**原生 Locust 2.43.3**——在 LLM 串流推論場景下存在致命的 GIL 陷阱。未經 LLM-Locust 改造前切忌直接使用。

### CI/CD 中的自動化 SLA 閘門（SLA gate in CI）

在 Pull Request 上執行微型 k6 壓測：

- 在基準 RPS 下連續執行 30 至 50 次迭代。
- 硬性發布閘門：P50/P95 TTFT 必須達標、5xx 錯誤率嚴格低於 5%、TPOT 吐字間隔嚴格落在閾值之內。
- 任何一項超標，直接中斷 CI 建置並阻斷 PR 合併。

### 建構高度擬真的 Prompt 長度分佈（Realistic prompt distribution）

若手頭已有正式環境真實歷史軌跡，直接抽取真實記錄；若無，則採用公認的成熟資料集分佈（例如對話任務採用 ShareGPT，程式碼任務採用 HumanEval）。將均值與標準差精確餵給 LLMPerf。堅決杜絕在迴圈中使用單一固定 Prompt 欺騙自己。

### 務必銘記的核心數字指標（Numbers you should remember）

- k6 Operator 1.0 GA：2025 年 9 月正式發布。
- k6 v2026.1.0：原生支援串流感知指標。
- 典型 LLMPerf 基準壓測規模：在並行度 X 下連續執行 100 至 1,000 次請求。
- 典型 CI 自動化阻斷壓測：每個 PR 連續執行 30 至 50 次迭代。
- 四大標準模式：穩態（Steady）、遞增（Ramp）、衝擊（Spike）、浸泡（Soak）。

```figure
load-pattern-waves
```

## Use It｜實際應用

`code/main.py` 模擬了一套依據擬真輸入 Token 長度分布產生 Prompt 的負載測試框架，精確度量端到端有效 TPOT，並在終端機中直觀揭示：單一固定 Prompt 如何透過人為刷高前綴快取命中率從而向工程師撒下彌天大謊。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-load-test-plan.md`。根據工作負載與 SLA，該 Skill 選擇工具並設計四種負載模式。

## Exercises｜練習

1. 執行 `code/main.py`。橫向比對單一固定 Prompt 與依據擬真輸入 Token 長度分布產生的 Prompt 的壓測結果——兩者帳面吞吐量與實質吐字間隔的差距究竟從何而來？
2. 為團隊的 CI 自動化管線撰寫一段標準 k6 驗收腳本：在 100 個並行使用者壓力下持續壓測 5 分鐘，要求 P95 TTFT 必須嚴格小於 800 ms。
3. 你的長時浸泡測試（Soak test）顯示記憶體每小時增加 50 MB。列出引發該記憶體洩漏的三項最可能架構原因，並說明應當掛載何種監控指標予以精確定位。
4. 針對系統發起從 10 RPS 瞬間飆升至 100 RPS 的突發尖峰測試。在已部署 Karpenter 與 vLLM production-stack 的前提下（第 17 課第 03 與 18 節），系統的預期自動自癒復原耗時應當落在哪個區間？
5. 在完全相同的後端伺服器上，GenAI-Perf 回報 TPOT=6ms，而 LLMPerf 卻回報 TPOT=11ms。解釋這項差異。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| LLMPerf | 「LLM 壓測工具」 | Anyscale 基準測試工具，支援串流感知 |
| GenAI-Perf | 「NVIDIA 工具」 | NVIDIA 的參考測試執行環境 |
| LLM-Locust | 「LLM 的 Locust」 | 修正 GIL 陷阱的 Locust 擴充套件 |
| guidellm | 「合成基準測試」 | 大規模合成測試工具 |
| k6 Operator | 「Kubernetes 的 k6」 | 以 CRD 為基礎的分散式 k6 |
| GIL trap | 「Python 用戶端開銷」 | Tokenization 積壓會拉高回報的延遲 |
| Prompt-uniformity trap | 「單一 Prompt 的假象」 | 迴圈重用相同 Prompt 命中快取，使吞吐量虛高 |
| Steady-state | 「固定負載」 | 持續 N 分鐘的固定 RPS |
| Ramp | 「線性升載」 | 在指定期間從 0 線性增加到目標負載 |
| Spike | 「突發測試」 | 突然提高負載倍數，再回到原狀 |
| Soak | 「長時間測試」 | 持續數小時以偵測記憶體洩漏 |

## Further Reading｜延伸閱讀

- [TianPan — Load Testing LLM Applications](https://tianpan.co/blog/2026-03-19-load-testing-llm-applications)
- [PremAI — Load Testing LLMs 2026](https://blog.premai.io/load-testing-llms-tools-metrics-realistic-traffic-simulation-2026/)
- [NVIDIA NIM — Introduction to LLM Inference Benchmarking](https://docs.nvidia.com/nim/large-language-models/1.0.0/benchmarking.html)
- [TrueFoundry — LLM-Locust](https://www.truefoundry.com/blog/llm-locust-a-tool-for-benchmarking-llm-performance)
- [LLMPerf](https://github.com/ray-project/llmperf)
- [k6 Operator](https://github.com/grafana/k6-operator)
