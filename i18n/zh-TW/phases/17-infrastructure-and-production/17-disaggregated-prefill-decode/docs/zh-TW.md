# Prefill 與 Decode 拆解架構——NVIDIA Dynamo 與 llm-d（Disaggregated Prefill/Decode — NVIDIA Dynamo and llm-d）

> Prefill 是運算受限（Compute-bound）操作；Decode 是記憶體頻寬受限（Memory-bound）操作。將兩者強行混部在同一張 GPU 上，必然導致其中一項昂貴資源被白白浪費。拆解式架構（Disaggregation）將兩者實體切分至獨立的專屬資源池，並透過 NIXL（支援 RDMA/InfiniBand，具備 TCP 降級備援）在兩者之間高速傳輸 KV 快取。NVIDIA Dynamo（GTC 2025 發表，現已 1.0 GA 正式發布）架構於 vLLM/SGLang/TRT-LLM 之上——其 Planner Profiler 與 SLA Planner 能自動調整 Prefill 與 Decode 的資源池比例以符合 SLO。NVIDIA 官方公布的吞吐量數字顯示：在 GB200 NVL72 + Dynamo 組合下，在中延遲區間運作 DeepSeek-R1 MoE 能取得約 6 倍提升（developer.nvidia.com，2025-06）；Dynamo 官方產品頁面標示，在 GB300 NVL72 + Dynamo 組合下，相較於 Hopper 可達 50 倍 MoE 吞吐量（頁面未標日期）。社群口耳相傳的「30 倍」是跨 Blackwell + Dynamo + DeepSeek-R1 全端技術堆疊的綜合粗估；目前尚無單一一手文獻精確標註 30 倍，因此請將其視為方向性參考指標。llm-d（由 Red Hat 與 AWS 聯合主導）則是 Kubernetes 原生實踐：將 Prefill、Decode 與 Router 拆分為獨立的 K8s Service，並綁定專屬的 HPA。llm-d 0.5 引入了多階層 KV 卸載、快取感知 LoRA 路由、UCCL 網路層與縮容歸零（Scale-to-zero）。在財務維度：多個客戶揭露的內部綜合資料指出，在維持相同 SLA 延遲的前提下，從傳統混部架構遷移至基於 Dynamo 的拆解式架構，能在 200 萬美元級別的年度推論帳單上節省 30% 至 40%（即每年節省 60 至 80 萬美元）；此 60 至 80 萬美元是內部綜合模型估算，並非單一公開實例——請將其視為數量級錨點，而非引用依據。若業務充滿小於 512 Token 且輸出極短的微型 Prompt，跨節點傳輸 KV 的網路開銷將反向吞噬收益。

**Type:** Learn
**Languages:** Python (stdlib, toy disaggregated-vs-colocated simulator)
**Prerequisites:** Phase 17 · 04 (Serving Engine Internals), Phase 17 · 08 (Inference Metrics)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 深刻解釋為何 Prefill 與 Decode 擁有截然不同的最適 GPU 硬體配置，並量化混部（Colocation）時的資源浪費。
- 精確繪製拆解式推論架構圖：Prefill 專屬池、Decode 專屬池、基於 NIXL 的 KV 快取高速傳輸網格、智慧路由器。
- 指出拆解式架構絕對不划算的臨界條件（極短 Prompt、極短輸出）。
- 嚴格區分 NVIDIA Dynamo（架構於引擎之上的獨立編排層）與 llm-d（Kubernetes 原生技術堆疊），並將各自精準映射至最優維運情境。

## The Problem｜問題

你在 8 張 H100 上執行 Llama 3.3 70B。在混合工作負載（長 Prompt + 短輸出）下，GPU 在 Decode 階段閒置，因為大多數運算已用於 Prefill。在另一種工作負載（短 Prompt + 長輸出）下，情況則相反。Prefill 與 Decode 混部代表你必須為兩者都過度配置資源。

財務影響觸目驚心：高達 20% 至 40% 的 GPU 機時被無辜浪費在錯誤的硬體資源瓶頸上。你採購昂貴的 H100 運算力去跑記憶體受限的 Decode，或是購買昂貴的 HBM 頻寬去等待運算受限的 Prefill。兩者皆是極其奢侈的資本浪費。

拆解式架構將 Prefill 與 Decode 分拆至完全獨立的專屬資源池，並針對各自的物理瓶頸精準配置硬體規格。Prefill 池產出的 KV 快取透過高速互連傳輸至 Decode 池繼續吐字。

## The Concept｜核心概念

### 為什麼兩者的物理瓶頸截然不同（Why the bottlenecks differ）

**Prefill 階段**——在單次前向傳播（Forward pass）中一口氣運算完整的輸入 Prompt。矩陣乘法佔據絕對主導地位；典型運算受限（Compute-bound）。H100 在 FP8 精度下能提供約 2,000 TFLOPS 的有效吞吐量。批次利用效率極高——單次運算即可並行處理海量 Token。

**Decode 階段**——一次僅產出一個 Token，且每次迭代皆必須將全量靜態模型權重從顯示記憶體完整讀取一遍。典型記憶體頻寬受限（Memory-bandwidth-bound）。H100 的 HBM3 頻寬約為 3 TB/s。批次利用效率唯有在高並行壓力下才展現優勢——此時多條序列能均攤這 3 TB/s 的權重搬移開銷。

若將兩者混部：你被迫採購能同時兼顧兩者的頂級 GPU。H100 固然兩者皆強，但機時單價高昂。在超大規模下，最理性的配置是：Prefill 池採用 H100 等算力巨獸；Decode 池採用顯示記憶體頻寬較高的 H200，或配合激進的量化壓縮。

### 系統架構拓撲（The architecture）

```
            ┌──────────────┐
  Request → │    Router    │ ───────────────────────┐
            └──────┬───────┘                        │
                   │                                │
                   ▼ (prompt only)                  │
            ┌──────────────┐    KV cache    ┌───────▼──────┐
            │ Prefill pool │ ─── NIXL ────► │ Decode pool  │
            │  (compute)   │                │  (memory)    │
            └──────────────┘                └──────┬───────┘
                                                   │ tokens
                                                   ▼
                                                 Client
```

NIXL 是 NVIDIA 打造的跨節點極速傳輸層。在硬體支援時走 RDMA/InfiniBand 直連，否則自動降級回退至 TCP。跨節點傳輸延遲是真實存在的物理代價——在 70B FP8 模型下，搬移一個 4k Token Prompt 的 KV 快取通常耗時約 20 至 80 ms。這正是為何短 Prompt 不值得採用拆解架構：網路傳輸成本會超過節省的成本。

### Dynamo vs llm-d

**NVIDIA Dynamo**（GTC 2025 發表，現已 1.0 GA）：
- 架構於 vLLM、SGLang、TRT-LLM 等底層推論引擎之上，充當全域調度協調者。
- Planner Profiler 衡量工作負載，SLA Planner 自動設定 prefill:decode 比例。
- 採用 Rust 打造極致核心，外層提供豐富的 Python 擴充能力。
- 吞吐量實測：NVIDIA 官方報告指出，在中等延遲條件下於 GB200 NVL72 + Dynamo 上運作 DeepSeek-R1 MoE 能取得約 6 倍提升（developer.nvidia.com，2025-06）；在完整的 Blackwell + Dynamo + DeepSeek-R1 堆疊上，社群報告「高達 30 倍」的提升，但缺乏單一一手文獻支撐，請視為方向性指標。
- GB300 NVL72 + Dynamo：NVIDIA 官方產品頁面標示相較於 Hopper 可達 50 倍 MoE 吞吐量（頁面未標日期）。

**llm-d**（Red Hat 與 AWS 聯合主導，Kubernetes 原生技術堆疊）：
- 將 Prefill、Decode 與 Router 抽象為完全獨立的 Kubernetes 原生 Service。
- 支援基於角色的專屬 HPA：Prefill 依據排隊深度擴縮，Decode 依據 KV 快取利用率擴縮。
- 支援 `topologyConstraint packDomain: rack` 約束：將 Prefill 與 Decode 工作群組安排在同一機架，以利高頻寬 KV 傳輸。
- llm-d 0.5（2026 年最新版）：引入多階層 KV 卸載、快取感知 LoRA 路由、UCCL 網路通訊層與極致縮容歸零。

決策邏輯：若你需要堆疊上層的受管理編排器，選 Dynamo。若你擁有強大的 Kubernetes 維運底蘊且堅定擁抱 CNCF 雲原生生態，選 llm-d。

### 經濟學精算（Economics）

內部綜合評估模型（非單一公開實例——數量級錨點）：

- 某業務原本在傳統混部架構下每年支出 200 萬美元推論費用。
- 全面遷移至基於 Dynamo 的拆解式架構。
- 維持完全相同的請求量級與 P99 延遲 SLA。
- 回報的節省金額：每年 60 萬至 80 萬美元（支出減少 30% 至 40%）。
- 完全無需採購任何新硬體。

這個數字是根據多家客戶披露資料綜合估算，而非單一可引用的案例；最接近的已發表資料點是 Baseten 使用 Dynamo KV routing 後 TTFT 加快 2 倍、吞吐量提升 61%（baseten.co，2025-10），以及 VAST 與 CoreWeave 在 KV 命中率為 40% 至 60% 時預估每美元 token 產出增加 60% 至 130%（vastdata.com，2025-12）。節省來自為各資源池配置合適容量；Prefill 負載較重的工作（例如前綴長度為 8K 以上的 RAG）比負載較均衡的工作受益更多。

### 何時不適合拆解（When NOT to disaggregate）

- 輸入 Prompt 小於 512 Token 且輸出小於 200 Token：網路傳輸稅直接吃乾抹淨一切收益。
- 超小型微型群集（小於 4 張 GPU）：資源池缺乏足夠的分割彈性。
- 維運團隊缺乏管理兩套獨立 GPU 資源池及角色級別自動擴縮的能力：Dynamo 雖有助益但並非毫無學習門檻。
- 群集缺乏 RDMA 極速網路互連：走純 TCP 傳輸所帶來的延遲代價過於沉重。

### 路由器與第 17 課第 11 節無縫咬合（The router integrates with Phase 17 · 11）

拆解式架構中的智慧路由器天然具備 KV 快取感知能力（第 17 課第 11 節）。當新請求抵達時，路由器首先探查當前持有該前綴的 Decode 節點——若精準命中，直接跳過 Prefill 階段進入 Decode 吐字；唯有當完全未命中時，才將請求導向 Prefill 池並傳輸 KV 至 Decode 池。快取命中與物理拆解產生強烈的乘數相乘效應——快取感知路由器直接決定了這一次 Prefill 究竟是否需要被實體執行。

### Blackwell 上的 MoE 才是真正的威力所在（MoE on Blackwell is where the real numbers are）

在 GB300 NVL72 群集上搭配 Dynamo，MoE 模型的吞吐量相較於 Hopper 基準可達 50 倍。MoE 專家路由在 Prefill 階段偏重運算，在 Decode 階段則因專家快取（expert caches）而較耗用記憶體，因此拆解式架構對兩者都能帶來好處。2026 年的前沿模型服務以 MoE 為主流（DeepSeek-V3，以及未來的 GPT-5 變體）。

### 務必銘記的核心數字指標（Numbers you should remember）

效能基準測試數字會隨時間變化——NVIDIA 與推論堆疊每季皆會發布更新結果。引用前請核對最新文件。

- DeepSeek-R1 在 GB200 NVL72 + Dynamo 上：在中等延遲條件下取得約 6 倍吞吐量提升（developer.nvidia.com，2025-06）；社群標稱的「高達 30 倍」屬於全端技術堆疊的綜合預估。
- GB300 NVL72 + Dynamo：NVIDIA 官方產品頁面標示相較於 Hopper 可達 50 倍 MoE 吞吐量（頁面未標日期）。
- 成本節省錨點（內部綜合模型）：在維持相同 SLA 下，從 200 萬美元年支出中省下 60 至 80 萬美元。
- 拆解經濟效益生效門檻：輸入 Prompt > 512 Token 且輸出 > 200 Token。
- 透過 NIXL 跨節點傳輸 KV 快取延遲：在 70B FP8 模型下搬移 4k Prompt 快取通常耗時約 20 至 80 ms。

```figure
prefill-decode-split
```

## Use It｜實際應用

`code/main.py` 模擬混部與拆解式服務的對比，回報吞吐量、每次請求的成本，以及 prompt 長度的交叉點。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-disaggregation-decider.md`。給定工作負載與叢集後，判斷是否需要拆解。

## Exercises｜練習

1. 執行 `code/main.py`。拆解式服務在什麼 prompt 長度下會勝過混部服務？
2. 為 P99 前綴長度為 8K、輸出長度為 300 的 RAG 服務設計 prefill pool 與 decode pool。
3. 深入對比 Dynamo 與 llm-d：針對一支只使用 Kubernetes、且不偏好特定 Python 執行環境的雲原生團隊，哪一款工具較適合？說明你的選擇。
4. 精算 KV 快取跨節點傳輸開銷：在 70B FP8 模型下，4k Token 的 Prefill 將產出約 500 MB 的 KV 快取。在 100 GB/s 的 RDMA 網格下傳輸僅需 5 ms；而在 10 GB/s 的傳統 TCP 網路下需要 50 ms。這 45 ms 的落差對你的業務 SLA 會產生何種影響？
5. MoE 混合專家架構的路由會改變 KV 存取模式。當每個 Token 會啟用不同專家時，拆解式服務會如何運作？

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Disaggregated serving | 「拆分 prefill/decode」 | Prefill 與 Decode 各自使用獨立的 GPU 資源池 |
| NIXL | 「NVIDIA 傳輸層」 | Dynamo 用於跨節點傳輸 KV 的方式（RDMA/TCP） |
| NVIDIA Dynamo | 「編排器」 | 位於 vLLM／SGLang／TRT-LLM 之上的協調器 |
| llm-d | 「Kubernetes 原生」 | Red Hat + AWS 的 Kubernetes 拆解式堆疊 |
| Planner Profiler | 「Dynamo 自動設定」 | 測量工作負載並設定資源池比例 |
| SLA Planner | 「Dynamo 政策」 | 自動調整 Prefill 與 Decode 比例以符合 SLO |
| `packDomain: rack` | 「llm-d 拓撲」 | 將 Prefill 與 Decode 放在同一機架，以加快 KV 傳輸 |
| UCCL | 「統一 collective」 | llm-d 0.5 用於縮容至零的網路層 |
| MoE expert routing | 「每個 Token 選專家」 | DeepSeek-V3 使用的模式；拆解式服務有助益 |

## Further Reading｜延伸閱讀

- [NVIDIA — Introducing Dynamo](https://developer.nvidia.com/blog/introducing-nvidia-dynamo-a-low-latency-distributed-inference-framework-for-scaling-reasoning-ai-models/) — Dynamo 官方架構設計長文。
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — 拆解式推論在 K8s 上的實踐手冊。
- [TensorRT-LLM Disaggregated Serving blog](https://nvidia.github.io/TensorRT-LLM/blogs/tech_blog/blog5_Disaggregated_Serving_in_TensorRT-LLM.html) — TRT-LLM 官方拆解式技術部落格。
- [llm-d GitHub](https://github.com/llm-d/llm-d) — 雲原生拆解式架構開源儲存庫。
- [llm-d 0.5 release notes](https://github.com/llm-d/llm-d/releases) — 0.5 版本核心突破詳解。
