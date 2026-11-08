# 綜合專案 14 —— 推測解碼推論伺服器

> 推測解碼 —— 一個便宜的草稿模型提出詞元，目標模型一趟就把它們驗證完 —— 現在已經是可用於生產的最佳化，不是研究上的花招。vLLM 0.7 裡的 EAGLE-3 在真實流量上出貨了 2.5-3 倍的吞吐量。P-EAGLE（AWS 2026）把平行推測又往前推了一步。SGLang 的 SpecForge 大規模訓練草稿頭。Red Hat 的 Speculators hub 替常見的開源模型發布了對齊過的草稿模型。TensorRT-LLM 讓推測解碼在 NVIDIA 上成了一等公民。2026 年的生產服務堆疊是 vLLM 或 SGLang，配 EAGLE 家族的草稿、FP8 或 INT4 量化，以及以佇列等待時間做的 HPA。這個綜合專案就是要以 2.5 倍以上的基線吞吐量服務兩個開源模型，並附上一份完整的尾端延遲報告。

**類型：** 總結專案
**程式語言：** Python (serving), C++ / CUDA (kernel inspection), YAML (configs)
**先修單元：** 階段 3（深度學習）、階段 7（transformer）、階段 10（從零打造 LLM）、階段 17（基礎設施）
**演練到的階段：** P3 · P7 · P10 · P17
**時間：** 30 小時

## 問題

推測解碼在 2026 年成了商品。EAGLE-3 的草稿頭在目標模型的隱藏狀態上訓練，並預測未來 N 個詞元；目標模型一趟就驗證完。60-80% 的接受率換算成 2-3 倍的端到端吞吐量。vLLM 0.7 原生整合了這件事。SGLang + SpecForge 給你那條訓練管線。Red Hat 的 Speculators 替 Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B 發布了對齊過的草稿模型。

手藝在服務運維上，不在模型上。接受率會隨流量分布（ShareGPT 對程式碼對領域資料）而漂移。被拒絕時的尾端延遲比不做推測還糟 —— 你必須回報多個批次大小下的 p99，不能只報穩定狀態的每秒詞元數。「相對 Anthropic / OpenAI API 的每百萬詞元成本」才是那根可信度槓桿。

## 概念

推測解碼有兩層。一個**草稿**模型（EAGLE-3 頭、ngram，或較小的目標對齊模型）每一步提出 k 個候選詞元。**目標**模型一趟就驗證全部 k 個；任何被接受的前綴取代掉貪婪路徑。接受率取決於草稿與目標的對齊程度，以及輸入的分布。

在多數流量上，EAGLE-3 打敗 ngram 草稿。P-EAGLE 跑平行推測以取得更深的草稿樹。代價是：被拒絕時的 P99 延遲更高，因為驗證那一趟更大。服務設定必須回報依批次大小分桶的延遲，才能把這件事攤開來。

部署是 Kubernetes。vLLM 0.7 每張 GPU 或每個張量平行分片跑一個副本。HPA 依佇列等待時間而不是 CPU 自動擴縮。FP8（Marlin）與 INT4（AWQ）量化讓 GPU 記憶體維持在 H100 / H200 的信封之內。端到端的報告是吞吐量、接受率、批次 1/8/32 下的 p50/p99，以及每百萬詞元多少錢。

## 架構

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

- 服務：vLLM 0.7 或 SGLang 0.4
- 推測方法：EAGLE-3 草稿頭、P-EAGLE 平行推測、ngram 退路
- 草稿訓練：SpecForge（SGLang）或 Red Hat Speculators
- 目標模型：Llama 3.3 70B、Qwen3-Coder-30B MoE、GPT-OSS-120B
- 量化：FP8（Marlin）、INT4 AWQ
- 部署：Kubernetes + NVIDIA device plugin；以佇列等待指標做 HPA
- 評估：ShareGPT、MT-Bench-v2、GSM8K、HumanEval，用來量測跨領域的接受率
- 參考：TensorRT-LLM 的推測解碼，作為廠商基線

```figure
cf-spec-decode
```

## 動手實作

1. **目標模型準備。** 挑 Llama 3.3 70B。透過 Marlin 量化到 FP8。在 1 張 H100 上（或 2 張做張量平行）以 vLLM 0.7 部署。

2. **草稿來源。** 從 Red Hat Speculators 拉一個對齊過的 EAGLE-3 草稿頭（或用 SpecForge 訓一個）。載進 vLLM 的推測解碼設定裡。

3. **基線數字。** 在推測之前：批次 1/8/32 下的每秒詞元數、p50/p99 延遲、GPU 使用率。發布出來。

4. **啟用 EAGLE-3。** 翻開設定；重跑同一份基準。回報加速比、接受率、p99 尾端延遲的差值。

5. **P-EAGLE。** 啟用平行推測；量測更深的草稿樹與序列式 EAGLE-3 的差別。回報 P-EAGLE 由有幫助轉為有害的那個轉折點。

6. **領域流量。** 讓 ShareGPT、HumanEval 與領域專屬流量跑過同一台伺服器。量測各分布下的接受率。指出草稿何時開始漂移。

7. **第二個目標模型。** 在 Qwen3-Coder-30B MoE 上跑同一條管線。草稿更棘手（MoE 路由的雜訊）。回報結果。

8. **K8s HPA。** 在 K8s 上部署，HPA 追蹤 `queue_wait_ms`。示範負載增為三倍時的擴出。

9. **成本比較。** 在同一份評估上，算出相對 Anthropic Claude Sonnet 4.7 與 OpenAI GPT-5.4 的每百萬詞元成本。發布出來。

## 框架應用

```
$ curl https://infer.example.com/v1/chat/completions -d '{"messages":[...]}'
[serve]     vLLM 0.7, Llama 3.3 70B FP8, EAGLE-3 active
[decode]    bs=8, accepted_tokens_per_step=3.2, acceptance_rate=0.76
[latency]   first-token 42ms, full-response 980ms (620 tokens)
[cost]      $0.34 per 1M output tokens at sustained throughput
```

## 產出交付

`outputs/skill-inference-server.md` 描述那份交付物。一套量測過、帶推測解碼的服務堆疊、一份完整的基準報告，以及一份 K8s 部署。

| 權重 | 判準 | 怎麼量 |
|:-:|---|---|
| 25 | 相對基線量到的加速 | 在兩個模型上、品質相當之下 2.5 倍以上的吞吐量 |
| 20 | 真實流量上的接受率 | 逐分布的接受率報告 |
| 20 | P99 尾端延遲紀律 | 有無推測之下，批次 1/8/32 的 p99 |
| 20 | 維運 | K8s 部署、以佇列等待做的 HPA、上線平順 |
| 15 | 報告與方法論 | 清楚說明改了什麼、為什麼改 |
| **100** | | |

## 練習

1. 量測草稿落後目標一個版本時（例如 Llama 3.3 -> 3.4 的漂移）接受率的退化。建一個監控警報。

2. 實作 ngram 退路：若 EAGLE-3 的接受率掉到門檻以下，就切換到 ngram 草稿。回報可靠度的改善。

3. 跑一次受控的 MoE 實驗：同一個 Qwen3-Coder-30B，一組注入路由雜訊、一組不注入。量測草稿接受率的敏感度。

4. 擴充到 H200（141 GB）。回報每副本模型大小多出來的餘裕，以及你能不能服務一個未量化的 Llama 3.3 70B。

5. 在同樣的 H100 硬體上，對 TensorRT-LLM 的推測解碼做基準測試。回報它在哪裡勝過 vLLM。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際是什麼意思 |
|------|-----------------|------------------------|
| 草稿模型 | 「推測者」 | 提出 N 個詞元供目標模型驗證的小模型 |
| EAGLE-3 | 「2026 年的草稿架構」 | 在目標模型隱藏狀態上訓練的草稿頭；接受率約 75% |
| P-EAGLE | 「平行推測」 | 一棵草稿分支樹，在目標模型的一趟中被驗證完 |
| 接受率 | 「命中率」 | 草稿詞元中不需重新取樣就被接受的比例 |
| 量化 | 「FP8 / INT4」 | 用較低精度的權重，把更多模型塞進 GPU 記憶體 |
| 佇列等待 | 「HPA 指標」 | 一則請求在推論開始前於待處理佇列中等待的時間 |
| Speculators hub | 「對齊過的草稿」 | Red Hat Neural Magic 的 hub，收錄常見開源模型的 EAGLE 草稿 |

## 延伸閱讀

- [vLLM EAGLE and P-EAGLE documentation](https://docs.vllm.ai) —— 參考用的服務堆疊
- [P-EAGLE (AWS 2026)](https://aws.amazon.com/blogs/machine-learning/p-eagle-faster-llm-inference-with-parallel-speculative-decoding-in-vllm/) —— 平行推測解碼的論文 + 整合
- [SGLang SpecForge](https://github.com/sgl-project/SpecForge) —— 草稿頭的訓練管線
- [Red Hat Speculators](https://github.com/neuralmagic/speculators) —— 對齊草稿的 hub
- [TensorRT-LLM speculative decoding](https://nvidia.github.io/TensorRT-LLM/) —— 廠商的替代方案
- [Fireworks.ai serving architecture](https://fireworks.ai/blog) —— 商業參考
- [EAGLE-3 paper (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) —— 那篇方法論文
- [vLLM repository](https://github.com/vllm-project/vllm) —— 程式碼與基準
