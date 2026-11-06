# Kubernetes 上的 GPU 自動擴縮——Karpenter、KAI 排程器、Gang 排程（GPU Autoscaling on Kubernetes — Karpenter, KAI Scheduler, Gang Scheduling）

> 自動擴縮包含三層架構，絕非單一層級所能涵蓋。Karpenter 負責動態佈建節點（耗時 1 分鐘以內，比傳統 Cluster Autoscaler 快 40%）。KAI 排程器（KAI Scheduler）負責 Gang 原子排程、硬體拓撲感知與多階層佇列——能徹底杜絕「8 張 GPU 僅就緒 7 張」的致命部分分配陷阱（其餘 7 個節點無限期空轉燃燒經費，苦等最後 1 張缺漏的 GPU）。應用程式層級的自動擴縮器（如 NVIDIA Dynamo Planner、llm-d Workload Variant Autoscaler）則依據推論專屬的業務特徵訊號進行擴縮——排隊深度、KV 快取利用率——而非盲目依賴 CPU 或 DCGM 佔空比。傳統 HPA 最經典的致命誤區在於：`DCGM_FI_DEV_GPU_UTIL` 僅是一項佔空比度量，100% 可能代表正在處理 10 個並行請求，也可能代表 100 個；且 vLLM 預設預先分配 GPU 記憶體作為 KV 快取，導致記憶體使用量不會觸發縮容。本課教你如何深度串聯這三大層級，並避開 Karpenter 預設的 `WhenEmptyOrUnderutilized` 政策在推論中途暴力終止運作中 GPU 任務的慘痛災難。

**Type:** Learn
**Languages:** Python (stdlib, toy queue-depth autoscaler simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 04 (Serving Engine Internals)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 繪製三大自動擴縮架構層次（節點動態佈建、Gang 排程、應用程式層級訊號），並精確指出每一層所使用的核心工具。
- 深刻解釋為何 `DCGM_FI_DEV_GPU_UTIL` 是設定 vLLM HPA 的錯誤訊號，並列出兩項黃金替代指標（排隊深度、KV 快取利用率）。
- 詳述 Gang 原子排程的工作原理，以及 KAI Scheduler 如何阻止致命的部分分配失效模式（8 張 GPU 中 7 張被迫空轉）。
- 指出 Karpenter 會在中途暴力終止運作中 GPU 任務的特定整併政策（`WhenEmptyOrUnderutilized`），並說明 2026 年安全的替代方案。

## The Problem｜問題

你的團隊在 Kubernetes 上交付了一套 LLM 推論服務。你配置了以 `DCGM_FI_DEV_GPU_UTIL` 作為監控訊號的常規 HPA。在正常上班時間內，GPU 利用率死死卡在 100%。然而 HPA 卻從不自動擴容——因為它誤以為目前容量已經飽和剛好。當你手動強行新增一個 Pod 副本時，TTFT（第一個 token 延遲）下降；然而 HPA 依然紋絲不動。這個監控訊號從頭到尾都在向你說謊。

在另一個維度，你使用傳統的 Cluster Autoscaler 來管理底層節點。半夜 2 點突然湧入一段 100 萬 Token 的巨型 Prompt 請求；叢集耗費了整整 3 分鐘才將底層 GPU 節點佈建完成，用戶端的請求早已超時中斷。

更嚴重的是，你部署了一個跨 2 個節點共需要 8 張 GPU 的 70B 模型。叢集有 7 張 GPU 閒置，另有 1 張分散在 3 個節點上。Cluster Autoscaler 匆忙啟動為那唯獨缺少的 1 張 GPU 開闢新節點；其餘已經啟動的 7 個節點被迫整整乾等了 4 分鐘，在 Kubernetes 慢慢拉起最後 1 張 GPU 的期間白白燒乾預算。

三層架構，三種截然不同的崩潰模式。2026 年的 GPU 感知自動擴縮絕非「開啟 HPA」那麼簡單，而是節點佈建、Gang 原子排程與應用層推論訊號的三位一體深度協同。

## The Concept｜核心概念

### 第 1 層——節點動態佈建（Karpenter）

Karpenter 持續監聽處於 Pending 狀態的 Pod，並能在約 45 至 60 秒內極速完成實體節點的動態開闢（相比之下，傳統 Cluster Autoscaler 在 GPU 節點上通常耗時 90 至 120 秒）。它根據 `NodePool` 的約束條件動態挑選最適執行個體規格——若你的 Pod 需要 8 張 H100 且叢集中當前無匹配節點，Karpenter 會直接精準佈建對應機器，而非機械化地擴充既有的固定節點群組。

**節點整併陷阱（The consolidation trap）**：Karpenter 預設的 `consolidationPolicy: WhenEmptyOrUnderutilized` 對於 GPU 節點池而言極度危險。它會主動終止正在運作的 GPU 節點，以嘗試將 Pod 移轉至更便宜、規格更精確的機型上。對於大模型推論而言，這意味著它會驅逐執行中的請求，並在新節點上耗時數分鐘重新載入 70B 模型。你承受的是數分鐘的容量損失與請求失敗。

專為 GPU 推論節點池設計的安全標準配置：

```yaml
disruption:
  consolidationPolicy: WhenEmpty
  consolidateAfter: 1h
```

該設定允許 Karpenter 在節點完全排空且閒置滿 1 小時後進行縮容整併，但絕不允許它驅逐任何正在運作中任務的節點。

### 第 2 層——Gang 協同原子排程（KAI Scheduler）

KAI Scheduler（早期專案代號為 Karp，後正式定名）專門補足預設 kube-scheduler 所欠缺的核心能力：

**Gang 原子排程（Gang scheduling）**——要麼全量調度、要麼全部延遲（All-or-nothing）。針對需要 8 張 GPU 的分散式推論 Pod，要麼 8 張同時就緒並同步啟動，要麼一個都不啟動。若無此機制，必然觸發「部分分配陷阱」：8 個 Pod 中有 7 個搶先啟動，隨後陷入無窮盡的等待，空耗寶貴算力。

**硬體拓撲感知（Topology awareness）**——精確洞悉哪些 GPU 共享極速 NVLink、哪些 GPU 位處同一個機架、哪些節點之間具備 InfiniBand 直連。據此精準指派 Pod。例如 DeepSeek-V3 67B 模型的張量平行（Tensor Parallelism）運算必須留在同一個 NVLink 網域內；KAI Scheduler 會遵守這項拓撲約束。

**階層化優先權佇列（Hierarchical queues）**——多個業務團隊依據優先權配額共享同一個實體 GPU 資源池。只有在優先權規則允許時，團隊 B 的訓練工作才能搶佔團隊 A 的正式環境尖峰負載。

KAI 通常作為輔助排程器與原生 kube-scheduler 並行部署；你只需在 Workload 的 Annotation 中指定使用它即可。Ray 與 vLLM production stack 也有整合。

### 第 3 層——應用程式層級特徵訊號（Application-level signals）

**傳統 HPA 監控指標的致命盲區**：`DCGM_FI_DEV_GPU_UTIL` 僅是一項佔空比（Duty-cycle）度量——它度量的是在特定採樣間隔內 GPU 是否正在執行指令。100% 的利用率可能意味著當前有 10 個並行請求，也可能意味著有 100 個；這兩種情況下 GPU 都處於忙碌狀態。依據佔空比進行擴縮，無異於盲人摸象。

更棘手的是，vLLM 等推論引擎會預先分配 KV 快取記憶體，配置量受 `--gpu-memory-utilization` 限制。因此即便僅有 1 個請求流入，記憶體佔用率依然高掛在 90% 附近。基於記憶體使用率的傳統 HPA 永遠無法觸發自動縮容。

**2026 年工業級黃金替代訊號**：

- 排隊深度（Queue depth，等待進入 Prefill 階段的請求總數）。
- KV 快取實際利用率（當前已分配給活躍序列的實體 Block 區塊佔比）。
- 單個 Replica 副本的 P99 TTFT（第一個 token 延遲，直接反映 SLA）。
- Goodput（每秒嚴格滿足全部 SLO 目標的合格請求數）。

NVIDIA Dynamo Planner 與 llm-d Workload Variant Autoscaler 直接監聽並消費上述推論專屬訊號，精準調控 Replica 副本數。在現代 LLM 服務架構中，它們已全面取代傳統 HPA。

### 何時該用什麼工具（When to use what）

| 擴縮與調度決策 | 推薦工具 |
|----------------|------|
| 新增／釋放底層實體節點 | Karpenter |
| 調度多 GPU 協同任務 | KAI Scheduler |
| 新增／減少推論 Pod 副本 | Dynamo Planner / llm-d WVA（或基於排隊深度的自定義 HPA） |
| 動態挑選最適 GPU 機型 | Karpenter NodePool |
| 搶佔低優先權離線負載 | KAI Scheduler 階層化佇列 |

### Prefill 與 Decode 拆解架構使一切更具挑戰（Disaggregated prefill/decode complicates everything）

若你導入了 Prefill 與 Decode 拆解架構（第 17 課第 17 節），系統中將存在兩類截然不同的 Pod 類別，且各自擁有不同的自動擴縮觸發機制：Prefill 節點依據排隊深度進行擴充，而 Decode 節點則依據 KV 快取的顯示記憶體壓力進行擴充。llm-d 將它們抽象為獨立的 `Services`，並分別綁定專屬的 HPA 策略。切忌試圖在兩者前方掛載單一且未經區分的 HPA。

### 冷啟動延遲在此同樣關鍵（Cold start matters here too）

冷啟動抑制機制（第 17 課第 10 節）決定了節點佈建耗時是否會直接傳導為使用者肉眼可見的卡頓。Karpenter 耗費 45 至 60 秒開闢節點，加上載入 20GB 模型權重，再加上推論引擎的初始化，意味著從零啟動一個全新請求將耗時 2 至 5 分鐘。在對 SLO 極度敏感的核心鏈路上，可保留 warm pool（`min_workers=1`），或在應用層使用 Modal 風格的快照機制。

### 務必銘記的核心數字指標（Numbers you should remember）

- Karpenter 節點動態佈建耗時：GPU 節點約 45-60 秒，傳統 Cluster Autoscaler 約 90-120 秒。
- KAI Scheduler 能徹底消滅「8 張中 7 張空等」的部分分配浪費。
- 將 `DCGM_FI_DEV_GPU_UTIL` 作為 HPA 擴縮訊號本質上已失效；改採排隊深度或 KV 快取利用率。
- Karpenter 的 `WhenEmptyOrUnderutilized` 會中途暴力中斷運作中 GPU 任務；推論服務應使用 `WhenEmpty + consolidateAfter: 1h`。

```figure
autoscaling
```

## Use It｜實際應用

`code/main.py` 在突發 GPU 負載下模擬了一套三層架構的自動擴縮器。全面橫向比對傳統無腦 HPA（基於 GPU 佔空比）、排隊深度感知 HPA，以及結合 KAI Gang 原子的智慧排程擴縮。終端機即時輸出未履約請求數、GPU 閒置機時分鐘數以及綜合效能評分。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-gpu-autoscaler-plan.md`。給定具體的叢集拓撲、業務負載特徵曲線與 SLO 指標，該 Skill 將自動為你推導並產出完整的三層 GPU 自動擴縮架構規劃書。

## Exercises｜練習

1. 執行 `code/main.py`。在突發負載衝擊下，傳統佔空比 HPA 相比於排隊深度 HPA 額外丟失了多少個請求？兩者之間本質的差距從何而來？
2. 為一個在 H100 SXM5 上託管 Llama 3.3 70B FP8 模型的推論叢集設計一份 Karpenter NodePool 配置。精準給出 `capacity-type`、`disruption.consolidationPolicy`、`consolidateAfter` 數值，以及防止非 GPU 任務佔用該節點的專屬 Taint 污點宣告。
3. 團隊通報當前部署的任務卡在 Pending 狀態，原因是「叢集中明明有 GPU 閒置，但 Pod 始終無法被調度」。分析故障根因——這究竟是 Karpenter、kube-scheduler 還是 KAI Scheduler 的問題？哪幾項關鍵指標能提供最終證實？
4. 為 Prefill 與 Decode 拆解後的兩組 Pod 分別挑選最適的自動擴縮度量訊號，並從系統架構層面給出充分論證。
5. 針對一套日均在 P99 TTFT > 10s 閾值下發生 60 次請求丟棄事件的 7x24 小時正式環境推論系統，估算由於採用了 `WhenEmptyOrUnderutilized` 錯誤整併政策而導致的成本。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Karpenter | 「節點佈建器」 | Kubernetes 節點自動擴縮器；佈建時間不到 1 分鐘 |
| Cluster Autoscaler | 「舊版擴縮器」 | Kubernetes 節點自動擴縮器的前身；速度較慢，以節點群組為單位 |
| KAI Scheduler | 「GPU 排程器」 | 負責 Gang 排程、拓撲感知與佇列管理的次級排程器 |
| Gang scheduling | 「全有或全無」 | 以原子方式排程 N 個 Pod，或全部延後 |
| Topology awareness | 「機架感知」 | 依 NVLink、IB 與機架位置放置 Pod |
| `DCGM_FI_DEV_GPU_UTIL` | 「GPU 利用率」 | 佔空比指標；不適用於 LLM 擴縮 |
| Queue depth | 「等待中的請求」 | 適用於 Prefill 受限擴縮的 HPA 訊號 |
| KV cache utilization | 「記憶體壓力」 | 適用於 Decode 受限擴縮的 HPA 訊號 |
| Consolidation | 「Karpenter 節點整併」 | 終止節點並改用更便宜的執行個體類型 |
| `WhenEmpty + 1h` | 「安全整併」 | 不會驅逐執行中 GPU 工作的政策 |

## Further Reading｜延伸閱讀

- [KAI Scheduler GitHub](https://github.com/kai-scheduler/KAI-Scheduler) — 官方架構設計文件與排程配置範例。
- [Karpenter Disruption Controls](https://karpenter.sh/docs/concepts/disruption/) — 節點整併政策詳細語意與 GPU 安全預設值指南。
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — Dynamo Planner 擴縮度量訊號官方深度剖析。
- [Ray docs — KAI Scheduler for RayClusters](https://docs.ray.io/en/latest/cluster/kubernetes/k8s-ecosystem/kai-scheduler.html) — Ray 叢集與 KAI 的整合實踐模式。
- [AWS EKS Compute and Autoscaling Best Practices](https://docs.aws.amazon.com/eks/latest/best-practices/aiml-compute.html) — 託管式 Kubernetes 專屬的 AI 運算擴縮最佳實踐。
- [llm-d GitHub](https://github.com/llm-d/llm-d) — Workload Variant Autoscaler 架構開源專案。
