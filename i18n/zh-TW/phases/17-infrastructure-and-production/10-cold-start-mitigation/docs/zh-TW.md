# 無伺服器 LLM 的冷啟動抑制機制（Cold Start Mitigation for Serverless LLMs）

> 20 GB 的模型映像檔從冷啟動到可提供服務，往往需要耗費 5 至 10 分鐘（7B 模型）乃至超過 20 分鐘（70B 模型）。在真正的無伺服器（Serverless）架構中，這絕非正常的預熱——這是一場嚴重的服務中斷事故。抑制手段深跨五大架構層次：預植節點映像檔（AWS Bottlerocket 的雙磁碟區架構）、模型串流載入（NVIDIA Run:ai Model Streamer，在 vLLM 中原生支援）、GPU 記憶體快照（Modal 快照機制，重啟速度提升高達 10 倍）、常駐預熱池（`min_workers=1`）、分層階梯式載入（ServerlessLLM 打造的 NVMe→DRAM→HBM 階梯管線，冷載入延遲可縮短 10 至 200 倍），以及僅遷移輸入 Token（KB 級）而非龐大 KV 快取（GB 級）的即時線上遷移。Modal 官方標稱以 2 至 4 秒作為冷啟動下限；Baseten 預設為 5 至 10 秒，配合預熱甚至能達到次秒級。本課教你如何嚴密測量、規劃預算，並將這五大防禦層有機疊加。

**Type:** Learn
**Languages:** Python (stdlib, toy cold-start path simulator)
**Prerequisites:** Phase 17 · 02 (Inference Platform Economics), Phase 17 · 03 (GPU Autoscaling)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 列出冷啟動抑制機制的五大架構層次，並指出每一層對應的一項核心工具或架構設計模式。
- 精確將 70B 模型的總冷啟動時間拆解為四大物理耗時總和：（節點佈建） + （下載權重） + （將權重載入 HBM） + （推論引擎初始化）。
- 深刻解釋為何即時線上遷移選擇傳輸輕量的輸入 Token（KB 級）而非龐大的 KV 快取（GB 級），以及系統為此付出的重算代價。
- 透視預熱池的經典工程權衡（為閒置 GPU 付費 vs 默默承受長尾冷啟動延遲），並給出 `min_workers > 0` 成為絕對強制的關鍵 SLA 臨界門檻。

## The Problem｜問題

你的無伺服器 LLM 端點在深夜沒有流量時自動縮容歸零（Scale-to-zero）。清晨 8 點業務高峰流量突然湧入。然而第一個不幸的使用者請求被迫陷入無盡的漫長等待：

1. Karpenter 動態佈建全新 GPU 實體節點：耗時 45 至 60 秒。
2. 容器從映像檔儲存庫下載含有權重的 30 GB 映像檔：耗時 120 至 300 秒。
3. 推論引擎將龐大權重自磁碟載入至 HBM 顯示記憶體：依據模型大小與儲存頻寬，耗時 45 至 120 秒。
4. vLLM 或 TRT-LLM 開始初始化 CUDA Graphs、KV 快取記憶體池與 Tokenizer：耗時 10 至 30 秒。

全部耗時累計：高達 220 至 510 秒（大約 3 至 8 分鐘），系統才能生成第一個 token。而你的業務 SLA 承諾是 2 秒。團隊隨後匆忙配置了預熱池（`min_workers=1`），表面上冷啟動卡頓瞬間消失——但現在你必須 7x24 小時為一張昂貴且大部分時間完全閒置的 GPU 支付全額機時費。若你的後台同時維運 5 款產品且各自維持 1 個預熱副本，這意味著每月必須固定消耗 5 * 24 * 30 = 3,600 個 GPU-hours，無論這期間是否有真實使用者造訪。

冷啟動抑制的核心主旨，正是如何在維持無伺服器經濟效益的同時，盡量接近常駐服務的延遲。

## The Concept｜核心概念

### 第 1 層——預植節點映像檔（Bottlerocket）

在 AWS 上，Bottlerocket 專為容器最佳化的作業系統採用了獨特的雙磁碟區（Dual-volume）架構，將底層 OS 與業務資料完全實體解耦。你可以將預先下載好容器映像檔的資料磁碟區製作為快照；隨後在 Karpenter 的 `EC2NodeClass` 中直接引用該快照 ID。當新節點開闢時，啟動的本機 NVMe 磁碟上早已預載了完整的模型權重——步驟 2 及部分步驟 3 可省去。該方案原生無縫整合 Karpenter。典型收益：為超大模型在每次冷啟動時直接節省 2 至 4 分鐘寶貴時間。

在 GCP 上的等價物是包含預烘焙容器層的客製化 VM Image；在 Azure 上則是使用相同模式的受控磁碟快照（Managed Disk Snapshot）。

### 第 2 層——模型串流載入（Run:ai Model Streamer）

傳統做法必須等完整的巨型權重檔案完全讀入記憶體後才開始接客；串流載入則打破該限制，逐層將權重串流載入 GPU 顯示記憶體，並在第一個 Transformer 區塊載入就緒的瞬間立即著手處理輸入文字。NVIDIA Run:ai Model Streamer 在 2026 年的 vLLM 中已原生支援。它相容 S3、GCS 與本機高效能 NVMe。透過將底層 I/O 讀取與計算環境初始化深度重疊，大型模型的權重載入時間約減半。

### 第 3 層——GPU 記憶體快照（Modal）

Modal 在模型首次完成載入與初始化後，直接對 GPU 的完整實體狀態（靜態權重、編譯後的 CUDA Graphs、已初始化的 KV 快取區塊）進行二進位快照（Checkpoint）。後續冷啟動時，系統直接將快照二進位反序列化倒灌進 HBM 顯示記憶體——重啟速度比從零初始化狂飆 10 倍。這是業界眼下最接近「2 秒內喚醒一張溫熱 GPU」的神技。工程代價：該快照與特定的 GPU 實體硬體拓撲綁定；若 Karpenter 將你的任務遷移至不同的 GPU SKU，就必須重新建立快照。

### 第 4 層——預熱資源池（min_workers=1）

最純粹直觀的抑制手段：永遠在 GPU 顯示記憶體中常駐一個熱備副本。財務代價是一張 GPU 7x24 小時的全額租賃費率。這筆數學帳在微型模型上極其不划算（你每小時花費 0.85 至 1.50 美元，僅僅為了規避 30 秒的短暫延遲）；但放在超大模型上卻是極具性價比的投資（每小時花費 4 美元，換取規避長達 5 分鐘的致命癱瘓）。觸發預熱池成為剛性必選的 SLA 門檻：針對 70B 以上模型，一旦產品要求 TTFT P99 必須小於 60 秒，預熱池便不再可選。

### 第 5 層——分層階梯式載入（ServerlessLLM）

ServerlessLLM 將儲存體系抽象為清晰的金字塔階梯：NVMe（容量大且速度快）、DRAM 主記憶體（容量適中但層級居中）、HBM（容量小但近乎即時）。靜態模型權重長駐於主機 DRAM 記憶體中；僅在推論請求抵達時才依需極速灌入 GPU 的 HBM。其原著論文指出，相較於天真的磁碟至 HBM 載入，冷載入延遲可縮短 10 至 200 倍。目前雖然處於產業早期，但社群已陸續推出針對 vLLM 的開源整合。

### 第 6 層——即時線上遷移（額外進階模式）

當某個節點遭遇即時中斷（如 Spot 競價執行個體被雲端廠商強制收回、節點排空維護）時，傳統做法是在別處冷啟動一個新副本並排空請求。即時線上遷移（Live migration）則選擇將純文字輸入 Token（僅數個 KB）網路轉發至另一座早已載入該模型的就緒節點，並在目的地節點上即時重算 KV 快取。在跨節點網路中，重新計算 Token 的代價遠遠低於在網路上搬運 GB 級的龐大 KV 快取。該模式在 Prefill/Decode 拆解式叢集中具備極高的實用意義。

### 預熱資源池經濟學精算（The warm-pool math）

對於承諾 P99 TTFT SLA 小於 2 秒的高標準業務，架構決策絕非單純的「要不要開預熱池」，而是「配置多少個預熱副本，以及哪些關鍵鏈路有資格享有預熱」：

- 高價值即時互動鏈路（線上對話、即時語音 Agent）：建議設定 `min_workers=1-2`。
- 背景離線批次鏈路（深夜資料分類、離線報表生成）：完全擁抱縮容歸零（Scale-to-zero），坦然接受 5 至 10 分鐘冷啟動。
- 高階方案：每個租戶配置專屬容量與 `min_workers`。

### 先嚴密測量，再著手最佳化（Measure before optimizing）

全新節點上 70B 模型的冷啟動拆解（示意）：

| 階段 | 時間 | 緩解方式 |
|-------|------|-----------|
| 節點佈建 | 50s | Bottlerocket + 預先植入映像檔、預熱池 |
| 映像檔下載 | 180s | 預先植入資料磁碟區（省去下載時間） |
| 權重載入至 HBM | 75s | 模型串流載入（減半）；GPU 快照（消除載入時間） |
| 引擎初始化 | 20s | 持續保存 CUDA graph 快取 |
| 首次前向傳遞 | 3s | 最低固有延遲 |
| **冷啟動總計** | **328s** | |
| **套用緩解措施後總計** | **~15s** | 縮短 22 倍 |

### 務必銘記的核心數字指標（Numbers you should remember）

- Modal 冷啟動耗時：在 GPU 記憶體快照加持下僅需 2 至 4 秒。
- Baseten 預設冷啟動：約 5 至 10 秒；搭配預熱技術可達次秒級。
- 未經任何最佳化的裸 70B 模型冷啟動耗時：長達 3 至 8 分鐘。
- Run:ai Model Streamer 收益：權重載入速度約提升 2 倍。
- ServerlessLLM 分層階梯載入：論文標稱延遲縮短 10 至 200 倍。

```figure
cold-start-pipeline
```

## Use It｜實際應用

`code/main.py` 精確建模了包含與未包含各項抑制手段的冷啟動路徑。自動計算全鏈路冷啟動耗時、預熱池的機時支出，以及推導出預熱池在財務上開始展現淨收益的關鍵請求量平衡點。

## Ship It｜交付成果

本課交付標準實戰產物 `outputs/skill-cold-start-planner.md`。輸入業務 SLA 門檻、模型參數量級與流量波動潮汐曲線，該 Skill 將自動為你挑選要疊加的抑制措施。

## Exercises｜練習

1. 執行 `code/main.py`。計算損益兩平請求率：超過此請求率後，維持一個預熱副本會比因冷啟動而在 SLO 下額外丟棄請求的成本更低。
2. 團隊交付了一款 13B 參數模型，業務要求 P99 TTFT 必須嚴格小於 3 秒。挑選出一套達成該指標所需的最簡抑制技術堆疊（使用最少的架構層次）。
3. Bottlerocket 預植技術完全消除了網路下載映像檔的耗時，但權重依然必須從快照載入 HBM。若基於快照的本機 NVMe 循序讀取頻寬為 7 GB/s，精確推算 70B 模型的實體物理讀取時鐘耗時。
4. 某無伺服器供應商支援 GPU 顯示記憶體快照（如 Modal），但你的資訊安全團隊以「快照可能殘留歷史使用者的個資 PII」為由拒絕導入。以架構師的視角同時列出雙方的論證焦點——真實的資安攻擊面在哪裡？有哪些對應的合規防禦措施（暫態快照、加密、命名空間隔離）？
5. 設計一套分級預熱池調度策略：付費企業用戶、免費試用用戶與背景離線批次任務，各應當分配多少預熱副本？列出背後支撐決策的數學算式。

## Key Terms｜關鍵術語

| 術語 | 常見俗稱 | 實際工程意義 |
|------|----------------|------------------------|
| Cold start | 「漫長停頓」 | 從全新副本收到請求到輸出第一個 token 所需的時間 |
| Warm pool | 「常駐最低數量」 | 以 `min_workers >= 1` 至少保留一個就緒副本 |
| Pre-seeded image | 「預先製作的 AMI」 | 預先載入容器映像檔及權重的節點映像檔 |
| Bottlerocket | 「AWS 節點作業系統」 | AWS 的容器最佳化作業系統，支援雙磁碟區快照 |
| Model streamer | 「串流載入」 | 將權重 I/O 與運算環境設定重疊執行 |
| GPU 記憶體快照 | 「快照至 HBM」 | 序列化載入後的 GPU 狀態，並在重新啟動時還原 |
| Tiered loading | 「NVMe、DRAM、HBM」 | 分層儲存架構；依需求載入 |
| Live migration | 「移轉 token」 | 傳輸輸入（KB），並在目的端重算 KV |
| `min_workers` | 「預熱副本」 | 無伺服器環境中最低保留的副本數 |
| Scale-to-zero | 「完全無伺服器」 | 閒置時不產生費用，但需接受完整冷啟動成本 |

## Further Reading｜延伸閱讀

- [Modal — Cold start performance](https://modal.com/docs/guide/cold-start) — Modal 官方發布的冷啟動跑分與 GPU 記憶體快照架構手冊。
- [AWS Bottlerocket](https://github.com/bottlerocket-os/bottlerocket) — 預植資料磁碟區快照設計模式。
- [NVIDIA Run:ai Model Streamer](https://github.com/run-ai/runai-model-streamer) — 權重 I/O 與計算環境深度重疊開源專案。
- [Baseten — Cold starts](https://docs.baseten.co/deployment/autoscaling/cold-starts) — 預熱架構實戰指南。
- [ServerlessLLM paper (USENIX OSDI'24)](https://www.usenix.org/conference/osdi24/presentation/fu) — 分層階梯式儲存架構奠基論文。
- [NVIDIA — Disaggregated LLM Inference on Kubernetes](https://developer.nvidia.com/blog/deploying-disaggregated-llm-inference-workloads-on-kubernetes/) — 拆解式推論叢集中的即時線上遷移指南。
