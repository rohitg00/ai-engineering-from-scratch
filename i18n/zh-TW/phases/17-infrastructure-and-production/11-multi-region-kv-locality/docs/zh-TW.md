# 多區域 LLM 服務與 KV 快取局部性（Multi-Region LLM Serving and KV Cache Locality）

> 循環輪替式負載平衡（round-robin）對於具備快取特性的 LLM 推論而言是有害的。一個未精準命中持有該前綴節點的請求，將被迫付出完整的 Prefill 前向運算代價——在長 Prompt 負載下，P50 延遲約為 800 ms，而命中快取時僅需約 80 ms。2026 年常見的 production pattern 是快取感知路由器（如以 Rust 編寫的 vLLM Router、llm-d router）：持續訂閱並消費各節點的 KV 快取事件，並基於前綴雜湊（Prefix-hash）精準調度。最新研究（GORGO）更進一步將跨區域網路往返延遲顯式納入路由目標函數。商業「跨區域推論」服務（如 AWS Bedrock 跨區域推論、GKE 多群集閘道）將推論視為完全黑盒——它們只處理可用性，無法感知 TTFT。摩根大通（JPMorgan）與梅奧醫學中心（Mayo Clinic）於 2024 年 11 月在 us-east-1 進行演練，並在約 22 分鐘內完成災難復原切換。常被引用的統計指出：32% 的 LLM 災難復原失敗，是因為團隊備份了權重，卻遺漏了 tokenizer 檔案或量化配置。

**Type:** Learn
**Languages:** Python (stdlib, toy prefix-cache-aware router simulator)
**Prerequisites:** Phase 17 · 04 (vLLM Serving), Phase 17 · 06 (SGLang RadixAttention)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 深刻解釋為何循環輪替式負載平衡會直接破壞前綴快取，並量化其對 TTFT 首字延遲所帶來的巨大懲罰。
- 精準繪製快取感知路由器架構圖：掌握輸入特徵（KV 快取事件）、核心演算法（前綴雜湊比對）以及決勝仲裁邏輯（GPU 利用率平衡）。
- 指出導致 32% LLM 災難復原失敗的核心元兇（遺漏 Tokenizer 檔案與量化設定檔），並列出至少三份檔案的災備清單。
- 嚴格釐清商業跨區域產品（Bedrock CRI、GKE Multi-Cluster Gateway）與應用層 KV 快取感知路由之間的本質邊界。

## The Problem｜問題

你的推論服務同時跨越 us-east-1、us-west-2 與 eu-west-1 三大區域運作。你在前端掛載了一台傳統 ALB 負載平衡器，並配置了經典的循環輪替（round-robin）策略。上線後正式環境的前綴快取命中率暴跌至 8%。P50 TTFT 首字延遲暴增為原先的三倍。vLLM 的底層紀錄顯示：每一個請求都在重複支付完整的 Prefill 算力代價。

循環輪替演算法是為無狀態（Stateless）微服務量身打造的最佳策略。然而大模型推論在本質上高度有狀態——KV 快取深深刻錄著模型過去所看過的一切歷史。盲目的負載均衡，無異於將請求持續送進錯誤的快取中。

與此同時，你的團隊制定了一套災難復原（DR）計畫。你們定期將模型權重跨區域同步備份至 S3。某區域發生中斷；你們匆忙啟動異地容錯移轉（Failover）；然而新拉起的副本卻報錯拒絕啟動。排查發現：tokenizer.json、量化配置參數與 RoPE 頻率縮放設定被放置在另一個未同步的獨立儲存貯體中。

多區域 LLM 推論本質上是快取問題、路由問題與嚴肅的災備衛生問題——絕非單純換個傳統負載平衡器所能解決。

## The Concept｜核心概念

### 快取感知路由機制（Cache-aware routing）

當攜帶 Prompt 的新請求抵達時：路由器首先對其公共前綴進行雜湊運算（例如截取前 512 個 Token 的 Hash 值）；隨後向群集內的所有推論副本發起快速檢索：「你們誰已經快取了這個前綴？」。推論副本在內部動態配置或釋放 KV Block 時，會透過 Pub/Sub 事件佇列即時廣播 KV 快取生命週期事件。路由器直接命中持有該前綴的副本；若全場皆無快取，則以 GPU 使用率作為 tie-breaker。

**vLLM Router**（以 Rust 撰寫，屬於 2026 年 production stack）：在背景即時監聽 `kv.cache.block_added` 等微事件，在記憶體中維護高效率的 prefix-hash 至 replica 的索引，以 O(1) 時間進行路由檢索。在完全未命中時自動回退至最小排隊深度調度。

**llm-d router**：採用完全相同的架構哲學，專為 Kubernetes 原生環境設計。透過 ControlPlane API 發布事件。

**SGLang RadixAttention**（第 17 課第 06 節）是副本內部的對應機制；跨副本路由則嚴格位於上游。

### 核心數字差距（Numbers）

在單張 H100 上運作 Llama 3.3 70B FP8 處理 2k Token 的輸入 Prompt，其 P50 TTFT 對比如下：
- 快取精準命中（相同副本、前綴常駐）：僅約 80 ms。
- 快取完全未命中（冷啟動 Prefill）：高達約 800 ms。

整整 10 倍的物理天壤之別。若你的智慧路由器能在跨副本間達到 60% 至 80% 的前綴快取命中率，你便能以 N 個副本的龐大吞吐容量，維持逼近單副本快取的極限低延遲。若命中率僅有 10%，效能表現近似一般擴容。

### 跨區域引入了全新的物理約制——網路延遲（Cross-region has a new constraint — network latency）

跨區域之間的物理光纖往返時延（RTT）：
- us-east-1 ↔ us-west-2：約 65 ms。
- us-east-1 ↔ eu-west-1：約 75 ms。
- us-east-1 ↔ ap-southeast-1：高達約 220 ms。

若路由器為了追求命中熱門前綴，強行將發源於 us-east-1 的請求跨大洋路由至 ap-southeast-1，那麼即便在 Prefill 階段節省了 720 ms（800 ms → 80 ms），相較於 440 ms 的跨區域網路往返延遲，這份收益仍相形見絀。2026 年最新前沿研究 GORGO 將這項權衡數學化：系統必須聯合最佳化 `prefill_time + network_latency` 的總和，絕非單純盲目追求快取命中。通常應將路由留在區域內；只有在超大多 MB 前綴的 prefill 優勢足以抵銷網路延遲時，才考慮跨區。

### 商業「跨區域推論」在此無法提供實質幫助（Commercial "cross-region inference" does not help here）

AWS Bedrock 的跨區域推論（Cross-Region Inference, CRI）能夠在某個區域算力飽和或遭遇突發水位時，自動將請求靜默重定向至其他區域。其底層最佳化目標是可用性（Availability），它將推論視為完全黑盒，對底層 KV 快取毫無感知。GKE Multi-Cluster Gateway 亦屬同理——它僅負責服務層級的自動容錯移轉。

即便導入了上述雲端託管服務，你在應用層依然必須部署專屬的快取感知路由器。託管服務負責處理「整個 us-east-1 陷入火海」的情況；快取感知路由則處理 TTFT。

### 災難復原紀律——致命的 32% 設定缺漏問題（DR hygiene — the 32% missing-files problem）

常被引用的 2026 年統計：32% 的 LLM 災難復原失敗，是因為工程團隊只備份了權重，卻忘了以下關鍵檔案：

- tokenizer 檔案（`tokenizer.json` 或 `tokenizer.model`）。
- 量化配置描述檔（`quantize_config.json`、AWQ 縮放矩陣、GPTQ 零點檔案）。
- 模型專屬架構設定（RoPE 頻率擴展參數、注意力遮罩規則、Chat 模板定義）。
- 推論服務引擎啟動配置（`vllm_config.yaml`、採樣預設值、LoRA 適配器清單）。

修正方式是建立至少包含三份檔案的災備資訊清單（DR Manifest）：

1. HuggingFace 模型儲存庫路徑下的全量檔案（權重 + 完整 Config + Tokenizer）。
2. 推論服務引擎專屬的組態配置檔。
3. 容器部署清單（K8s 宣告式 YAML、Dockerfile、相依套件精確鎖定檔）。

另外：每季執行一次災備演練。摩根大通於 2024 年 11 月的 us-east-1 演練僅花 22 分鐘復原，因為操作手冊已經演練過。

### 資料落地合規與快取路由完全正交（Data residency is orthogonal）

在此情境中，歐盟客戶的 PHI 不得離開歐盟。若快取感知路由器為了命中前綴，將來自巴黎的請求路由至 us-east-1，便違反 GDPR 的資料落地規範，不論 TTFT 改善多少。最佳化快取前，先依資料落地邊界劃分路由器。

### 務必銘記的核心數字指標（Numbers you should remember）

- 2k Token 輸入下快取命中 vs 未命中的 TTFT 差距：整整 10 倍（80 ms vs 800 ms）。
- 美東至歐洲（US-EU）實體跨洋光纖 RTT：約 75 ms。
- 災備失敗案例中，有 32% 是因為遺漏 Tokenizer 或量化設定檔。
- 摩根大通 us-east-1 實戰演練復原耗時：22 分鐘（SLA 上限為 30 分鐘）。

```figure
cache-aware-router
```

## Use It｜實際應用

`code/main.py` 在一套跨多區域的模擬工作負載下，全方位模擬了三種路由調度策略：傳統循環輪替（round-robin）、區域內快取感知路由（Cache-aware regional）以及全域跨區快取感知路由（Cache-aware global）。執行結果會回報各策略的快取命中率、TTFT 的 P50/P99 指標，以及跨區域費用。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-multi-region-router.md`。根據區域、資料駐留限制與 SLA，設計一份路由計畫。

## Exercises｜練習

1. 執行 `code/main.py`。在 RTT 為 75 ms 的條件下，輸入 Prompt 長度達到多少時，跨區域路由會比僅限區域本機路由更快？
2. 系統監控警報顯示正式環境的前綴快取命中率從 70% 斷崖式暴跌至 12%。列出三項最可能的架構元兇，並指出能分別予以證實的關鍵可觀測性指標。
3. 為一個在 vLLM 中託管、掛載了 5 個 LoRA 變體的 70B AWQ 量化模型設計一份標準的災難復原資訊清單（DR Manifest）。完整枚舉所有必須納入備份的具體檔案名稱與配置項目。
4. 論證 AWS Bedrock 跨區域推論（CRI）對具有嚴格 TTFT SLO 的金融科技服務而言是否足夠，並引用具體行為。
5. 一個來自巴黎用戶端的請求，在 us-east-1 的某個節點上命中了前綴。你究竟該不該將該請求跨洋轉發過去？為架構團隊撰寫一份標準決策規範。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Cache-aware routing | 「智慧型 LB」 | 依前綴雜湊比對，將請求路由至持有 KV 快取的副本 |
| KV-cache events | 「快取發布／訂閱」 | 副本發布區塊新增／逐出事件；路由器建立索引 |
| Prefix hash | 「快取索引鍵」 | 將前 N 個 token 雜湊後，供路由器查詢 |
| GORGO | 「跨區域路由研究」 | arXiv 2602.11688；將網路延遲列為明確項目 |
| Cross-region inference | 「Bedrock CRI」 | AWS 產品；處理可用性容錯移轉，不會感知 TTFT |
| DR manifest | 「備份清單」 | 還原所需的所有檔案，不只有權重 |
| Data residency | 「GDPR 邊界」 | 限制哪些區域可以接觸使用者資料的法律規範 |
| RTT | 「往返時間」 | 網路延遲；美國－歐洲為 75 ms，美國－亞太為 220 ms |
| LLM-aware LB | 「快取命中負載平衡器」 | 快取感知路由器這類產品的分類 |

## Further Reading｜延伸閱讀

- [BentoML — Multi-cloud and cross-region inference](https://bentoml.com/llm/infrastructure-and-operations/multi-cloud-and-cross-region-inference) — 跨雲端與跨區域推論架構指南。
- [arXiv — GORGO (2602.11688)](https://arxiv.org/html/2602.11688v1) — 顯式納入網路往返延遲項目的跨區域 KV 快取複用前沿論文。
- [TianPan — Multi-Region LLM Serving Cache Locality](https://tianpan.co/blog/2026-04-17-multi-region-llm-serving-data-residency-routing) — 多區域大模型服務資料落地與快取局部性剖析。
- [AWS Bedrock Cross-Region Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/cross-region-inference.html) — 官方高可用容錯移轉文件。
- [vLLM Production Stack Router](https://github.com/vllm-project/production-stack) — 具備快取感知能力的 Rust 路由核心開源儲存庫。
