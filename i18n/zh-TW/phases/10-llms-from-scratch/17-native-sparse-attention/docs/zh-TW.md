# 原生稀疏注意力（DeepSeek NSA）

> 在 64k token 下，注意力計算佔據了 70% 到 80% 的 decode 延遲。每個開源實驗室都提出了相應的修復方案。DeepSeek 的 NSA（ACL 2025 最佳論文）是最終脫穎而出的贏家：三條平行的注意力路徑——壓縮的粗粒度 token、選擇性保留的細粒度 token，以及捕捉局部語境的滑動視窗——透過一個可學習的閘門相結合。它與硬體高度對齊（對 GPU 核心極度友善）、原生可訓練（直接用於預訓練，而非僅在推論時補綴），且在 64k decode 下速度超越 FlashAttention，同時保持或超越全注意力品質。本課將端到端實作這三條路徑，並揭示其稀疏性為何具備端到端可微性。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 7 · 12 (KV cache, flash-attention), Phase 7 · 15 (attention variants), Phase 10 · 16 (differential attention)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 陳述 NSA 的三條注意力路徑以及每條路徑各自捕捉的特徵
- 解釋為何 NSA 具備「原生可訓練性」，而先前的稀疏注意力方法僅限於推論階段
- 根據壓縮區塊大小與選取 top-k 數量，計算在 64k 脈絡下 NSA 相較於全注意力的運算節省量
- 在標準 Python 中於短合成序列上實作三條路徑的組合，並驗證閘門權重的運作表現

## The Problem｜問題

序列長度為 N 時，全注意力的代價是 `O(N^2)` 的時間與每層 `O(N)` 的 KV 快取。在 64k token 下，運算量與記憶體頻寬消耗令人震驚。根據 NSA 論文的實測理論估算：在 64k 下，注意力佔據了總 decode 延遲的 70% 到 80%。所有下游指標——首字延遲（TTFT）、每秒 token 數、百萬 token 成本——全被注意力成本所主導。

稀疏注意力（Sparse attention）顯然是最直接的答案。過去的嘗試大致分為兩大陣營：固定模式稀疏性（滑動視窗、跨步、區塊局部）拋棄了關鍵資訊，在長距離檢索任務上慘遭滑鐵盧；推論期稀疏性（KV 快取剪枝、H2O、StreamingLLM）套用在針對稠密注意力預訓練的模型上，僅能回收一小部分潛在加速，因為模型從未被訓練過如何透過稀疏模式傳遞資訊。

原生稀疏注意力（Native Sparse Attention，Yuan 等人，DeepSeek + 北京大學 + 華盛頓大學，ACL 2025 最佳論文，arXiv:2502.11089）兼顧了兩者：模型在預訓練期間自主學習稀疏模式，並以與硬體高度對齊的核心演算法實作，在推論時切實兌現運算節省。兩年後，NSA 或其直接衍生技術將成為所有尖端長脈絡模型的預設注意力機制。

## The Concept｜核心概念

### 三條平行路徑

針對每個 query，NSA 執行三次注意力運算，分別對應 KV 快取的三種不同視角：

1. **壓縮路徑（Compressed branch）。** Token 被分組為大小為 `l`（通常為 32 或 64）的區塊。每個區塊透過一個小型可學習 MLP 被壓縮為單一摘要 token。Query 在這些壓縮後的 token 上進行注意力計算，獲得對整個序列的粗粒度全域視角。

2. **選取路徑（Selected branch）。** 利用壓縮路徑計算出的注意力分數，辨識出與當前 query 最相關的 top-k 個區塊。讀取這些區塊中的細粒度（未壓縮）原始 token，query 在所有這些 token 上進行注意力計算。可以將壓縮路徑的注意力視為引導選取邏輯的路由訊號。

3. **滑動視窗路徑（Sliding-window branch）。** Query 關注最近的 `W` 個 token（通常為 512）以取得局部語境。這條路徑捕捉結構密集的短程模式（語法、局部共指），彌補另外兩條路徑可能遺漏的細節。

三條路徑的輸出透過一個針對每個位置的可學習閘門進行融合：

```
out = g_cmp * out_cmp + g_sel * out_sel + g_win * out_win
```

`g_cmp, g_sel, g_win` 是作用於 query 上的小型 MLP 產出的閘門權重。它們不必加總為 1——它們能獨立為各個路徑賦予權重。

### 為何這具備「原生可訓練性」

選取步驟（top-k 個區塊）本質上是離散操作。離散操作會切斷梯度流動。先前的稀疏注意力研究要麼在選取時跳過反向傳播（限制了訓練效果），要麼採用連續鬆弛（在推論時無法帶來真正的硬體稀疏性）。

NSA 巧妙繞過了這個難題：壓縮路徑的注意力本身就是針對全序列的可微粗粒度注意力。Top-k 操作只是直接重複使用壓縮路徑中分數最高的注意力權重，來挑選應載入哪些細粒度區塊。梯度順暢地流經壓縮路徑的分數（這同時影響了壓縮輸出與選取邏輯），且獲選區塊對最終輸出的貢獻同樣是完全可微的。不可微的 `top_k` 操作在前向計算圖上形同無運算（no-op）——它純粹控制從實體記憶體中搬運哪些區塊。

這正是為何 NSA 能端到端直接用於預訓練。模型學會了協同透過這三條路徑路由資訊，產出的稀疏模式在推論時能百分之百兌現理論上的加速承諾。

### 硬體對齊核心

NSA 的 GPU 核心專為現代記憶體階層架構量身打造。該核心按 GQA 分組載入 query（外層迴圈），按組提取對應的稀疏 KV 區塊（內層迴圈），並在 SRAM 上執行注意力運算。由於同一組 query 看見相同的獲選區塊（選取是以 query 組為單位，而非以單一 query 頭為單位），KV 載入開銷在整組內被高效分攤，算術強度始終維持高位。

論文回報 Triton 核心在 64k decode 下速度比 FlashAttention 快 9 倍，且加速效果會隨序列長度增加而提升。官方同時提供了前向與反向運算核心。

### 運算預算算式

令 `N` 為序列長度，`l` 為壓縮區塊大小，`k` 為 top-k 選取數量，`w` 為滑動視窗大小，`b` 為選取的細粒度區塊大小（通常等於 `l`）。

- 壓縮路徑：每個 query 關注 `O(N/l)` 個 keys，總計 `O(N * N / l)`。
- 選取路徑：每個 query 關注 `O(k * b)` 個 keys，總計 `O(N * k * b)`。
- 滑動視窗路徑：每個 query 關注 `O(w)` 個 keys，總計 `O(N * w)`。

總計：`O(N * (N/l + k*b + w))`。

在 `N = 64k, l = 64, k = 16, b = 64, w = 512` 下：每個 query 的運算代價為 `1000 + 1024 + 512 = 2536 keys`。全注意力則需 `64000 keys`。運算量直接削減 25 倍。

在 `N = 128k, l = 64, k = 16, b = 64, w = 512` 下：每個 query 的運算代價為 `2000 + 1024 + 512 = 3536 keys`。全注意力則需 `128000 keys`。運算量直接削減 36 倍。效益隨序列長度增加而提升，這正是核心目的所在。

### 各方案橫向評比

| 方法 | 完全可微 | 真實推論加速 | 長程召回能力 |
|--------|---------------|----------------------|-------------------|
| 僅滑動視窗 | 是 | 是 | 失敗 |
| 跨步／區塊稀疏 | 是 | 是 | 部分具備 |
| KV 剪枝（H2O、StreamingLLM） | 不適用（僅限推論期） | 是 | 部分具備 |
| MoBA（月之暗面 Moonshot） | 部分具備 | 是 | 良好 |
| NSA | 是（原生支援） | 是（64k 下快 9 倍） | 匹敵全注意力 |

MoBA（月之暗面 Moonshot，arXiv:2502.13189）在同期發表，同樣採取了類似的「三位一體」思路，將 MoE 原理應用至注意力區塊。NSA 與 MoBA 是 2026 年長脈絡預訓練必須掌握的兩大核心架構。

```figure
sliding-window-attention
```

## Build It｜動手實作

`code/main.py` 在短合成序列上實作了這三條路徑，並展示：

- 壓縮 MLP（為教學清晰度採用了簡單的平均池化基準；真實 NSA 使用可學習 MLP）。
- 由壓縮路徑分數驅動的 top-k 區塊選取。
- 在最後 `w` 個 token 上的滑動視窗注意力。
- 具備閘門機制的輸出融合。
- 與全注意力相比的運算量統計輸出。

### 步驟 1：將 Token 壓縮為區塊

```python
def compress(K, l):
    n = len(K)
    n_blocks = (n + l - 1) // l
    out = []
    for b in range(n_blocks):
        start, end = b * l, min((b + 1) * l, n)
        block = K[start:end]
        summary = [sum(row[d] for row in block) / len(block) for d in range(len(K[0]))]
        out.append(summary)
    return out
```

### 步驟 2：壓縮路徑注意力

執行 query 相對於壓縮 keys 的 softmax 注意力。壓縮路徑的分數同時充當 top-k 選取的評分依據。

### 步驟 3：Top-k 區塊選取

選取得分最高的 `k` 個壓縮區塊索引。從這些區塊中載入原始未壓縮的 token，並在其上執行注意力運算。

### 步驟 4：滑動視窗注意力

選取最後 `w` 個 token 並在其上執行標準注意力運算。

### 步驟 5：閘門融合

作用於 query 上的小型 MLP 產出三個閘門權重。最終輸出為三條路徑輸出的加權總和。

### 步驟 6：運算量統計

印出每個 query 在各路徑下關注的 keys 數量及總計。與 `N`（全注意力）進行對比。在 `l = 32, k = 4, w = 128` 的 1024 token 合成序列上，NSA 每個 query 僅看 `32 + 128 + 128 = 288` 個 keys，而全注意力為 1024 個——運算量減少 3.5 倍。

## Use It｜實際應用

NSA 正部署於 DeepSeek 自身的長脈絡預訓練管線中。截至 2026 年 4 月在公開推論堆疊中的整合現況：

- **DeepSeek 內部**：原生支援，已公開的權重採用了 NSA 或其繼任者 DSA（DeepSeek Sparse Attention）。
- **vLLM**：針對 DeepSeek-V3.x 權重的實驗性 NSA 支援正在開發中。
- **SGLang**：已發布 NSA 基準測試，正式支援正緊隨 vLLM 推進。
- **llama.cpp / CPU**：不支援；核心分解開銷在 CPU 吞吐量下得不償失。

何時應採用 NSA：

- 目標支援 64k 以上脈絡且擁有充裕運算預算的預訓練或接續訓練。
- 部署 DeepSeek 自身的長脈絡 checkpoint（其權重原生基於 NSA）。

何時不應採用：

- 服務既有的稠密注意力預訓練模型。在未經接續訓練下無法事後硬套 NSA。
- 脈絡在 16k 以下。三路並行的開銷會壓過所省下的運算量。
- 批次為 1 的互動式對話。雖然對延遲敏感的 decode 有所助益，但僅在極長脈絡下才顯著。

## Ship It｜交付成果

本課產出 `outputs/skill-nsa-integrator.md`。給定長脈絡預訓練規格，它會產生一份 NSA 整合計畫：包含壓縮區塊大小、top-k 數量、滑動視窗寬度、閘門 MLP 寬度、核心選型，以及足以證明該架構變革合理性的特定長脈絡評估方案。

## Exercises｜練習

1. 在 1024 token 合成序列上執行 `code/main.py`。在三組預設值中掃描 `(l, k, w)` 並印出運算量統計。找出在大海撈針測試中保持 95% 召回率的同時，能達到每 query 最少 key 數量的參數組合。

2. 將平均池化壓縮器替換為微型的可學習 MLP（2 層、隱藏維度 32）。在訊號為區塊平均值的合成任務上訓練它，並在保留資料上測量相對於平均池化基準線的困惑度差距。

3. 實作閘門 MLP。它接收 query 作為輸入並輸出三個純量。展示該閘門表現出合理的行為：面對隨機 query 給予大致均勻的權重，當 query 命中深處區塊時重度偏向選取路徑。

4. 計算啟用 NSA 的 70B 模型在 128k 脈絡下的 KV 快取記憶體預算（KV 頭為 8、頭維度 128、BF16）。將其與全注意力以及 MLA 進行比較（第 10 階段第 14 課展示了 MLA 的數值）。計算 NSA 細粒度路徑的 KV 快取與全注意力打平時的序列長度臨界點。

5. 研讀 NSA 論文第 4 節（arXiv:2502.11089），並以三句話解釋為何壓縮路徑的注意力分數會直接被重複用於 top-k 選取，而不是另外計算獨立的路由分數。將答案與梯度流動建立連結。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| 壓縮路徑（Compressed branch） | 「粗粒度視角」 | 在區塊平均後的 keys 上執行的注意力，以每 query O(N/l) 個 keys 提供全域語境 |
| 選取路徑（Selected branch） | 「Top-k 區塊」 | 在壓縮路徑得分最高的 `k` 個區塊上執行的細粒度局部注意力 |
| 滑動視窗（Sliding window） | 「局部語境」 | 在最後 `W` 個 token 上執行的注意力，專門捕捉短程語義模式 |
| 原生可訓練性（Native trainability） | 「預訓練時就開啟稀疏性」 | 稀疏模式在預訓練期間端到端被聯合學習，而非在推論時事後硬套 |
| 壓縮區塊大小 l | 「粗粒度的分組大小」 | 合併為單一摘要的 token 數量；通常為 32 到 64 |
| Top-k | 「要保留的區塊數」 | 讀取其未壓縮原始 token 的壓縮區塊數量；通常為 16 |
| 滑動視窗寬度 W | 「局部注意力半徑」 | 通常為 512；太短損害局部連貫性，太長浪費運算量 |
| 路徑閘門（Branch gate） | 「如何融合三條路徑」 | 逐位置的 MLP 輸出，為三條路徑的貢獻賦予獨立權重 |
| 硬體對齊（Hardware alignment） | 「對核心友善的稀疏性」 | 精心挑選的稀疏模式，使真實 GPU 核心能真正兌現理論加速比 |
| DSA | 「NSA 的繼任者」 | DeepSeek Sparse Attention，DeepSeek 家族中繼承 NSA 理念的新一代架構 |

## Further Reading｜延伸閱讀

- [Yuan et al. — Native Sparse Attention: Hardware-Aligned and Natively Trainable Sparse Attention (arXiv:2502.11089, ACL 2025 最佳論文)](https://arxiv.org/abs/2502.11089) ——原始論文
- [DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) ——NSA 所鎖定的架構家族權威技術報告
- [Moonshot AI — MoBA: Mixture of Block Attention for Long-Context LLMs (arXiv:2502.13189)](https://arxiv.org/abs/2502.13189) ——同期發表、在注意力區塊上運用 MoE 理念的代表性研究
- [Beltagy et al. — Longformer: The Long-Document Transformer (arXiv:2004.05150)](https://arxiv.org/abs/2004.05150) ——滑動視窗注意力的技術濫觴
- [Xiao et al. — StreamingLLM: Efficient Streaming Language Models with Attention Sinks (arXiv:2309.17453)](https://arxiv.org/abs/2309.17453) ——NSA 進行改良的推論期稀疏性基準之作
- [Dao et al. — FlashAttention-2 (arXiv:2307.08691)](https://arxiv.org/abs/2307.08691) ——NSA 核心在 64k 下大幅超越的全注意力基準線
