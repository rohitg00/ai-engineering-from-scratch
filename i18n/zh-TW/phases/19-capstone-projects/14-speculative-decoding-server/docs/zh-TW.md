# 專案實戰 14——推測解碼推論伺服器（Capstone 14 — Speculative-Decoding Inference Server）

> 推測解碼（Speculative Decoding）——由輕量級的草稿模型預先提出候選 Token，再由主力目標模型單次前向傳播完成並行驗證——如今已是可用於正式環境的最佳化技術，而非研究技巧。vLLM 0.7 整合的 EAGLE-3 在真實線上流量中能提供基準 2.5 至 3 倍的吞吐量。AWS 於 2026 年推出的 P-EAGLE 進一步推進了平行推測。SGLang 的 SpecForge 則可大規模訓練草稿預測頭。紅帽（Red Hat）的 Speculators 社群中心發布了針對各大主流開源模型的對齊草稿頭。NVIDIA 的 TensorRT-LLM 亦將推測解碼列為第一公民。2026 年正式環境的推論服務堆疊採用 vLLM 或 SGLang，搭載 EAGLE 系列草稿頭、FP8 或 INT4 量化（quantization），並在 K8s 上依據「佇列等待時間」設定 HPA 自動擴縮容。本專案實戰要求你為兩款開源模型部署推測推論服務，達成相較於基準 2.5 倍以上的吞吐量提升，並出具詳盡的尾部延遲分析報告。

**Type:** Capstone
**Languages:** Python (serving), C++ / CUDA (kernel inspection), YAML (configs)
**Prerequisites:** Phase 3 (deep learning), Phase 7 (transformers), Phase 10 (LLMs from scratch), Phase 17 (infrastructure)
**Phases exercised:** P3 · P7 · P10 · P17
**Time:** 30 hours

## Problem｜問題

到了 2026 年，推測解碼已成為模型推論的普及標準技術。EAGLE-3 草稿預測頭直接基於目標模型的隱藏層特徵進行輕量訓練，能向前預測 N 個 Token；目標模型隨後在單次前向計算中完成全量驗證。60% 至 80% 的接受率（acceptance rate）直接轉化為端到端 2 至 3 倍的真實吞吐量提升。vLLM 0.7 原生內建了該能力；SGLang + SpecForge 提供了完整的訓練管線；Red Hat 的 Speculators 則直接開箱提供針對 Llama 3.3 70B、Qwen3-Coder-30B MoE 與 GPT-OSS-120B 的現成對齊草稿權重。

真正的工程精湛度在於推論維運（Inference Ops），而非模型本身。草稿接受率會隨著線上流量分布而變動（通用對話 ShareGPT vs 程式碼補全 vs 垂直領域專有名詞）。更致命的是：在草稿遭拒時，其尾部延遲（Tail Latency）甚至會比完全不使用推測解碼時更為惡劣——你必須在多種不同併發批次大小（Batch Size）下嚴格度量並呈報 p99 延遲，而絕不能僅拿穩定狀態下的純 Token 吞吐自欺欺人。此外，與 Anthropic / OpenAI 商業 API 相比的 $/1M tokens 成本，有助於評估私有託管的成本效益。

## Concept｜核心概念

推測解碼採用分層雙模架構。**草稿模型（Draft）**（EAGLE-3 預測頭、n-gram 統計模型或輕量級小模型）在每一步預先提出 k 個候選 Token。**目標模型（Target）**在單次前向計算中並行校驗這 k 個 Token；一旦校驗通過的合法前綴被採納，即刻替代了傳統逐字生成的 Greedy 解碼路徑。整體的接受率取決於草稿模型與目標模型之間的特徵對齊深度，以及輸入資料分布。

在大多數流量上，EAGLE-3 的表現優於 n-gram 草稿。P-EAGLE 則引入了平行推測機制，在驗證前建置更深層的樹狀草稿（Tree of Drafts）。然而架構權衡在於：在預測遭到連續拒絕時，驗證計算負載更大，導致 p99 延遲進一步惡化。推論服務配置必須提供按批次大小嚴格分桶的延遲統計，方能精準捕捉這項效能邊界。

生產部署全面依託 Kubernetes。vLLM 0.7 針對每張 GPU 或張量平行（Tensor Parallel）分片運作一個 Pod 複本。HPA 自動擴縮容必須基於「推論佇列等待時間（Queue Wait）」而非 CPU 使用率進行排程。透過 FP8（Marlin）與 INT4（AWQ）量化壓縮，將 GPU 顯示記憶體需求維持在 H100 / H200 的容量範圍內。端到端交付報告的核心指標為：吞吐量倍率、草稿接受率、批次 1/8/32 下的 p50/p99 延遲，以及 $/1M tokens 成本。

## 系統架構

```
request ingress
    |
    v
vLLM server (0.7) or SGLang (0.4)
    |
    +-- draft: EAGLE-3 heads | P-EAGLE parallel | ngram fallback
    +-- target: Llama 3.3 70B | Qwen3-Coder-30B | GPT-OSS-120B
    |     quantized FP8-Marlin or INT4-AWQ
    |
    v
verify pass: batch k draft tokens through target
    |
    v (accept prefix; resample for rejected suffix)
    v
token stream back to client
    |
    v
Prometheus metrics: throughput, acceptance rate, queue wait, latency p50/p99
    |
    v
HPA on queue-wait metric
```

## 技術堆疊

- 推論服務引擎：vLLM 0.7 或 SGLang 0.4
- 推測解碼技術：EAGLE-3 草稿預測頭、P-EAGLE 平行樹狀推測、n-gram 降級備用策略
- 草稿訓練框架：SpecForge（SGLang 生態）或 Red Hat Speculators 開源庫
- 主力目標模型：Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B
- 權重低精度量化技術：FP8（Marlin 核心）、INT4 AWQ
- 基礎設施部署：Kubernetes + NVIDIA 裝置擴充功能；基於推論佇列等待時間的 HPA
- 基準評測套件：ShareGPT、MT-Bench-v2、GSM8K、HumanEval，用於跨領域測量接受率
- 晶片原廠參考：NVIDIA TensorRT-LLM 原生推測解碼作為硬體效能極限基準線

```figure
cf-spec-decode
```

## Build It｜動手實作

1. **目標模型環境就緒**。選定 Llama 3.3 70B。透過 Marlin 算子實施 FP8 量化。在單張 H100（或 2 卡張量平行）環境下透過 vLLM 0.7 完成部署。

2. **配對草稿預測頭導入**。自 Red Hat Speculators 下載精準對齊的 EAGLE-3 草稿頭（或透過 SpecForge 訓練一個）。將草稿配置正確掛載至 vLLM 推測解碼啟動參數中。

3. **原生基準資料採集**。在完全未開啟推測解碼的裸模型狀態下，精確記錄：批次大小為 1/8/32 下的每秒 Token 吞吐、p50 與 p99 延遲、GPU 利用率。將資料存檔發布。

4. **開啟 EAGLE-3 實戰驗證**。切換配置啟用推測解碼；在完全相同的測試集上重新執行壓測。度量加速倍率、整體接受率以及尾部 p99 延遲的變動 Delta。

5. **平行 P-EAGLE 極限除錯**。啟用平行樹狀推測機制；測量多路徑深層樹狀推測相較於傳統序列 EAGLE-3 的效能差異。精確繪製出 P-EAGLE 帶來正向增益與負向拖累的效能拐點曲線。

6. **垂直領域資料分佈漂移測試**。將通用對話（ShareGPT）、程式碼生成（HumanEval）以及特定領域流量同時送入推論端點。獨立度量不同語料分佈下的草稿接受率。精確定位草稿預測失效的邊界條件。

7. **第二款目標模型驗收**。在 Qwen3-Coder-30B MoE 上完整重現上述全流程。深入分析混合專家架構（MoE）路由抖動對草稿接受率帶來的干擾挑戰。出具專項分析報告。

8. **K8s 彈性擴縮容實戰**。將推論叢集部署於 K8s，配置自定義指標導出器，讓 HPA 直接追蹤 `queue_wait_ms` 指標。將負載提高至原來的 3 倍，展示系統如何擴容。

9. **全維度效費比分析**。在完全相同的評測集上，嚴格計算自建推測解碼端點相較於 Claude Sonnet 4.7 與 OpenAI GPT-5.4 商業 API 的$/1M tokens 實際推論成本。發布詳細分析報告。

## Use It｜實際應用

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## Ship It｜交付成果

本專案實戰最終交付的核心技能封裝於 `outputs/skill-inference-server.md`。它代表一套包含推測解碼技術、全套壓測基準資料報告以及生產級 K8s 部署清單的高效能推論系統。驗收標準評分規程：

| 權重分值 | 驗收核心指標 | 具體客觀測量方式 |
|:-:|---|---|
| 25 | 相較於基準的實測吞吐加速比 | 在兩款開源模型上，在品質相當的條件下，取得 ≥ 2.5× 的端到端吞吐提升 |
| 20 | 真實流量下的草稿接受率 | 產出詳盡涵蓋通用文本、程式碼與垂直領域的按分佈接受率分析報告 |
| 20 | 尾部 p99 延遲控制紀律 | 完整出具在批次 1/8/32 下開啟與關閉推測解碼時的 p99 延遲對比資料 |
| 20 | 雲原生自動維運工程 | K8s 部署配置規範、基於佇列等待時長的 HPA 自動擴縮容驗證通過、版本更新平順 |
| 15 | 架構報告與方法論深度 | 清楚說明有哪些變更及其原因 |
| **100** | | |

## Exercises｜練習

1. 度量當草稿頭的版本落後於目標主力模型時（例如目標模型自 Llama 3.3 升級至 3.4，但草稿頭未同步更新）草稿接受率出現的衰退幅度。建立一套接受率驟降的主動監控告警機制。
2. 實作 n-gram 自動降級保底策略：當 EAGLE-3 的即時接受率跌破設定安全閾值時，系統自動將草稿機制切換為傳統 n-gram。回報該保底策略帶來的可靠性改善。
3. 實施嚴格受控的 MoE 對照實驗：在完全相同的 Qwen3-Coder-30B 模型上，對比注入路由雜訊前後對草稿接受率帶來的敏感情況。
4. 將伺服器硬體擴充至具備 141 GB 顯示記憶體的 NVIDIA H200。度量單節點顯示記憶體餘裕的提升情況，並驗證是否能部署未經量化的 Llama 3.3 70B。
5. 在完全相同的 H100 實體伺服器上，針對 NVIDIA TensorRT-LLM 的原生推測解碼功能展開平行壓測。深入分析在何種具體場景下 TensorRT-LLM 能擊敗 vLLM，而在何種場景下反之？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| Draft model |「推測器」| 提出 N 個 Token，供目標模型驗證的小型模型 |
| EAGLE-3 |「2026 草稿架構」| 在目標模型隱藏狀態上訓練的草稿頭；接受率約為 75% |
| P-EAGLE |「平行推測」| 在一次目標模型前向傳遞中驗證的草稿路徑樹 |
| Acceptance rate |「命中率」| 草稿 Token 中無須重新取樣便獲接受的比例 |
| Quantization |「FP8／INT4」| 使用較低精度權重，讓顯示記憶體可容納更大的模型 |
| Queue wait |「HPA 指標」| 請求開始推論前在待處理佇列中等待的時間 |
| Speculators hub |「對齊的草稿」| Red Hat Neural Magic 提供常見開放模型 EAGLE 草稿的中心 |

## Further Reading｜延伸閱讀

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) — 業界標竿級推論伺服器官方推測解碼指南。
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) — AWS 發布的平行推測解碼技術論文與整合文件。
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) — 草稿預測頭自動化大規模訓練管線。
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) — 開源模型官方對齊草稿頭社群集散地。
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/) — NVIDIA 原廠極限效能推測解碼實作。
- [Fireworks.ai serving architecture](https://fireworks.ai/blog) — 商業級超低延遲推論架構參考。
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) — EAGLE-3 方法論奠基學術論文。
- [vLLM repository](https://github.com/vllm-project/vllm) — 官方原始碼儲存庫與壓測套件。
