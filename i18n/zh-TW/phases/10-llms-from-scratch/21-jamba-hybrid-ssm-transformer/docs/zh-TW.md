# Jamba——混合 SSM-Transformer

> 狀態空間模型（SSM）與 Transformer 各自追求不同的目標。Transformer 透過注意力機制換取高品質，但承受二次方運算代價；SSM 透過遞迴換取線性時間推論與常數記憶體佔用，但在品質上略遜一籌。AI21 的 Jamba（2024 年 3 月）與 Jamba 1.5（2024 年 8 月）將兩者融為一爐：每 7 個 Mamba 層搭配 1 個 Transformer 層，每隔一個區塊啟用 MoE，並在單張 80GB GPU 上實現了 256k 脈絡視窗。Mamba-3（ICLR 2026）則在純 SSM 端引入複數值狀態空間（complex-valued state spaces）與 MIMO（multi-input multi-output）投影。本課將深入剖析這兩種架構，解釋為何這套混合配方能歷經三年擴展仍持續發展，而純 SSM 與純 Transformer 的長脈絡嘗試則未能延續。

**Type:** Learn
**Languages:** Python (stdlib, layer-mix calculator)
**Prerequisites:** Phase 10 · 14 (open-model architectures), Phase 10 · 17 (native sparse attention)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 解釋 Jamba 區塊中的三種核心原語——Transformer 層、Mamba 層、MoE——以及 1:7 的交錯交織配方
- 在巨觀層面陳述 SSM 遞迴的運作機制，以及為何它能實現常數級記憶體推論
- 計算 Jamba 模型在 256k 脈絡長度下的 KV 快取體積，並與純 Transformer 模型所需開銷進行對比
- 說明 Mamba-3 的三項核心創新（指數梯形離散化（exponential-trapezoidal discretization）、複數值狀態更新（complex-valued state update）、MIMO），以及每項創新各自解決的痛點

## The Problem｜問題

注意力機制相對於序列長度呈二次方複雜度增長，而狀態空間模型則呈線性複雜度。這項差異隨著長度拉長而急劇放大：在 256k token 下，Transformer 的注意力圖在每個頭上高達 650 億個條目；而 SSM 的遞迴狀態無論序列長度多長，體積始終固定不變。

純 SSM 模型（Mamba、Mamba-2）在小型規模下能匹敵 Transformer 的困惑度，但在狀態追蹤任務上略顯乏力，且在某些類別的脈絡內檢索（in-context retrieval）任務上表現不佳。背後的直覺在於：SSM 將漫長的歷史壓縮進固定大小的狀態中，當歷史極長時，資訊不可避免地會發生洩漏。而注意力機制能精確記住一切細節，卻必須付出慘烈的二次方代價。

顯而易見的解法是：結合兩者。在需要精確回想的關鍵位置佈設 Transformer 層，在大量常規處理位置採用 SSM 層，並精確調配兩者的比例。Jamba 是第一個在大規模下交付這套混合配方的生產級模型（總參數 520 億，活躍參數 120 億，256k 脈絡，單張 80GB GPU 即可裝下）。Jamba 1.5 將此家族進一步擴展至總參數量 3,980 億 / 活躍參數 940 億。Mamba-3（ICLR 2026）則是當前最強的純 SSM 基準線，混合架構可在此之上進一步重構。

本課通讀這三篇論文，為你建立「挑選最佳比例」的架構心智模型。

## The Concept｜核心概念

### 一頁讀懂 SSM

狀態空間模型透過固定大小的狀態 `h` 處理序列 `x_1, ..., x_N`：

```
h_t = A h_{t-1} + B x_t
y_t = C h_t
```

在每個步驟中，狀態透過線性動態矩陣 `A` 演化，接收輸入 `B x_t`，並產出輸出 `C h_t`。`A, B, C` 皆為可學習參數。請注意其核心關鍵特性：計算 `y_t` 只需要 `h_{t-1}` 與 `x_t`，完全不需要任何更早之前的 `x`。記憶體消耗為常數，每個 token 的推論時間為 O(1)。

建模品質的關鍵在於 `A` 矩陣的結構。S4（Gu，2021 年）採用高度結構化的矩陣，使其在訓練期間能透過長卷積進行極高效的平行計算。Mamba（Gu 與 Dao，2023 年）將固定的 `A, B, C` 替換為依賴輸入資料的動態矩陣（即「選擇性」特性）。Mamba-2（2024 年）進一步簡化了該結構。Mamba-3（2026 年）則在關鍵節點重新引入了複雜度。

核心屬性：對於解碼器 LLM 而言，SSM 層是注意力層的直接隨插即用替代品，以固定大小的逐層狀態取代了隨脈絡持續膨脹的 KV 快取。

### Jamba 區塊架構

Jamba 區塊依據兩個關鍵數字交錯排布各層：

- `l`：注意力與 Mamba 的比例。Jamba 採用 `l = 8`，意即每 7 個 Mamba 層搭配 1 個 Transformer 層（每組 7 個 Mamba + 1 個 Attention = 8 層）。
- `e`：MoE 啟用的頻率。Jamba 採用 `e = 2`，意即每隔一層套用 MoE。

單一區塊內部的層級序列：

```
M  M  M  M  M  M  M  A    (7 Mamba + 1 Attention)
|  M  |  M  |  M  |  M    (where | marks MoE applied)
```

每個 Jamba 區塊由 8 層構成。在 4 個區塊深（總計 32 層）的架構下，包含 28 個 Mamba 層與 4 個 Attention 層，其中 16 層啟用了 MoE。

### 為何選擇 1:7 比例

AI21 進行了詳盡的消融實驗：什麼樣的注意力與 Mamba 比例能在其長脈絡評估中取得最佳的單位參數困惑度與脈絡內回想能力？

- 注意力過多（1:1）：品質上升，但記憶體與推論速度大幅惡化。
- 注意力過少（1:15）：記憶體極其精簡，但脈絡內檢索能力嚴重崩潰。
- 最佳甜蜜點（Sweet spot）：1:7 或 1:8。

直覺在於：Transformer 層專職負責精確回想與跨長程狀態追蹤，而 Mamba 層承擔絕大多數廉價的高效常規運算。

### 位置編碼設計

Mamba 層本身已具備位置感知能力（透過其遞迴機制）。在最初基於 Mamba 的混合模型中，注意力層並未採用 RoPE——SSM 層已提供了充分的位置資訊。Jamba 1.5 則在注意力層中重新引入了 RoPE，這是依據長脈絡實證評估所做的後期改進，旨在加強更長脈絡下的外推泛化能力。

### 記憶體預算算式

對於 Jamba-1 規格（32 層：28 個 Mamba + 4 個 Attention，隱藏維度 4096，32 個注意力頭）：

- KV 快取（僅計算 Attention 層）：在 256k BF16 下為 `2 * 4 * 32 * 128 * 256k * 2 = 8.4 GB`。僅有 4 個注意力層會產生快取。
- SSM 狀態：每前綴 token 為 `28 * hidden * state_size`，但這在每層中是固定大小，不隨序列長度膨脹。典型 Mamba 狀態每個特徵維度為 16，隱藏維度 4096：總計僅為 `28 * 4096 * 16 * 2 = 3.7 MB`。

對比具有 32 層、相同隱藏維度、採用 32 頭全 MHA 的純 Transformer：在 256k BF16 下高達 `2 * 32 * 32 * 128 * 256k * 2 = 128 GB`。KV 快取體積直接縮減 8 倍！即便對比多數 2024 年模型採用的 GQA(8) 基準線（`2 * 32 * 8 * 128 * 256k * 2 = 32 GB`），Jamba 1:7 混合架構仍小了整整 2 倍。

這正是 AI21 所宣稱的「單張 80GB GPU 實現 256k 脈絡」的真正底氣。全 MHA 純 Transformer 的 KV 快取根本裝不進去；即便是 GQA 基準線也幾乎沒有餘裕容納權重與活化值；而 Jamba 則綽綽有餘。

### Mamba-3：2026 年純 SSM 頂尖基準

Mamba-3（ICLR 2026，arXiv:2603.15569）在純 SSM 端引入了三項關鍵革新：

1. **指數梯形離散化（Exponential-trapezoidal discretization）。** 取代了 Mamba-2 中的尤拉法（Euler-method）離散化，具備表現力更強的遞迴形式。在核心遞迴內部將類卷積運算直接作用於狀態輸入上，而非僅作為 `x_t` 上的外層卷積。

2. **複數值狀態更新（Complex-valued state update）。** 先前的 Mamba 版本將狀態矩陣從複數（S4）一路簡化為實數對角矩陣（Mamba），再到縮放單位矩陣（Mamba-2）。Mamba-3 重新引入了複數值——這在數學上等價於作用在狀態上的資料自適應旋轉位置編碼。這修復了先前過度簡化實數矩陣所喪失的狀態追蹤能力。

3. **多輸入多輸出（MIMO）投影。** 以矩陣值投影取代逐特徵的純量投影。在不增加 decode 延遲的前提下，顯著增強了建模能力與推論時的硬體利用率。

在 15 億參數下，Mamba-3 的下游平均準確率比 Gated DeltaNet 高出 0.6 分；MIMO 變體再貢獻 1.2 分，總計取得 1.8 分的顯著優勢。在相同狀態大小下，Mamba-3 能以原本一半的狀態達到 Mamba-2 的全部效能。

Mamba-3 目前尚未在大規模商業混合模型中上線服務——但它顯然是下一代 Jamba 級架構中 SSM 模組最具潛力的候選基石。

### 何時採用混合架構

混合架構在以下場景勝出：

- 脈絡極長，純 Transformer 的 KV 快取已難以承受（64k 以上）。
- 任務融合了短程局部結構（SSM 極其擅長）與長程精確回想（依賴 Transformer）。
- 部署目標受到單張 GPU 記憶體嚴格限制，純 Transformer 的快取本身就已超出容量。

混合架構在以下場景落敗：

- 脈絡較短（16k 以下）。SSM 的額外開銷純屬浪費，純 Transformer 即可。
- 任務需要全方位隨機存取注意力（深層邏輯推理、多文件交叉比對）。混合架構中稀疏的注意力層會損害此能力。
- 擴展至數兆參數的尖端規模。純 Transformer + MLA + MoE（DeepSeek-V3 風格）目前在尖端能力競賽中拔得頭籌。

### 競爭格局綜覽

| 模型 | 架構家族 | 規模 | 核心特點 |
|-------|--------|------|-------------|
| Mamba-2 | 純 SSM | 3B | 線性時間推論，常數記憶體佔用 |
| Jamba | 混合架構 | 52B / 12B | 單張 80GB 卡實現 256k 脈絡 |
| Jamba 1.5 Large | 混合架構 | 398B / 94B | 企業級超長脈絡實戰能力 |
| Mamba-3 | 純 SSM | 1.5B（論文） | 徹底修復狀態追蹤缺陷 |
| DeepSeek-V3 | 純 Transformer + MoE | 671B / 37B | 尖端最強開源能力標竿 |

2026 年的格局非常清晰：純 Transformer MoE 統治著尖端通用能力，而混合架構則在 256k 以上超長脈絡利基市場獨領風騷。Mamba-3 在狀態追蹤上的進展，可能使下一代混合架構進一步降低注意力比例（更多 SSM，更少 Attention）。

```figure
swiglu-ffn
```

## Use It｜實際應用

`code/main.py` 是一個專門針對混合架構的記憶體計算器。給定 SSM-Transformer 比例以及隱藏維度／層數設定，它能精確計算：

- 目標脈絡下的 KV 快取體積。
- SSM 狀態記憶體佔用。
- 跨多種模型形狀在長度 N 下的總記憶體需求。

該計算器完整支援：

- 純 Transformer 基準線（KV 快取隨 N 呈線性膨脹）。
- Jamba 風格的 1:7 混合模型。
- 純 SSM（完全沒有任何 KV 快取）。

已公開規格的數值直接取自 Jamba-1 與 Jamba-1.5 論文，假設變體的數值則為外推而得。

正式環境部署注意事項：

- 大多數生產級推論伺服器（vLLM、SGLang）已支援 Jamba 與 Mamba，請確認對應版本。
- 在 256k 脈絡下，Jamba 的記憶體優勢直接轉化為並行請求吞吐量：相同的 VRAM 能同時容納更多 Jamba 序列。
- Mamba-3 作為獨立模型目前仍處於 1.5B 的研究預覽階段，尚未全面商業化量產。

## Ship It｜交付成果

本課產出 `outputs/skill-hybrid-picker.md`。給定工作負載規格（脈絡長度分布、任務組合、記憶體預算），它會在純 Transformer、Jamba 風格混合模型與純 SSM 之間提出建議，並針對記憶體與模型品質權衡給出詳盡的決策論證。

## Exercises｜練習

1. 執行 `code/main.py`，為 32 層純 Transformer（隱藏維度 4096、32 頭）與相同形狀的 Jamba-1 混合模型計算 256k 脈絡下的 KV 快取體積。驗證 AI21 論文所宣稱的約 8 倍記憶體縮減。

2. 修改計算器以建模 1:3 混合架構（4 Mamba : 1 Attention）與 1:15 混合架構（14 Mamba : 1 Attention）。繪製 KV 快取對比例的曲線圖，指出在哪個臨界比例下 KV 快取體積會剛好等於 SSM 狀態記憶體。

3. 研讀 Jamba 論文第 3 節（arXiv:2403.19887）。解釋為何 AI21 在 Mamba-2 速度更快的前提下，依然選擇採用 Mamba-1。提示：混合消融實驗章節對此有詳細記載。

4. 計算 Jamba 1.5 Large（總參數 3,980 億，活躍參數 940 億）中每隔一層啟用 MoE 的參數開銷。將其活躍比例與 DeepSeek-V3（37B/671B）進行對比，並解釋為何 Jamba 的架構使得活躍比例偏高。

5. 研讀 Mamba-3 論文第 3 節（arXiv:2603.15569）。以三句話解釋為何複數值狀態更新在數學上等價於資料自適應的旋轉位置編碼。將答案與第 7 階段第 4 課的 RoPE 推導建立連結。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| 狀態空間模型（SSM） | 「帶固定狀態的遞迴」 | 具備可學習遞迴 `h_t = A h_{t-1} + B x_t` 的神經網路層；每個 token 記憶體消耗為常數 |
| 選擇性 SSM（Selective SSM） | 「Mamba 的核心技巧」 | 依賴輸入資料的 A、B、C 參數，賦予模型類似閘門機制的選擇性，具備線性時間複雜度 |
| 注意力與 Mamba 比例 | 「包含多少注意力層」 | 在 Jamba 中 `l = 8` 代表每 7 個 Mamba 層搭配 1 個注意力層 |
| Jamba 區塊 | 「8 層一組的複合結構」 | 包含 1 個注意力層 + 7 個 Mamba 層，且在交替位置啟用 MoE |
| SSM 狀態 | 「隱藏緩衝區」 | 每個層級固定大小的內部狀態，在 Mamba 層中徹底取代了 KV 快取 |
| 256k 脈絡視窗 | 「Jamba 的旗艦賣點」 | Jamba-1 在單張 80GB GPU 上所能容納的序列長度；純 Transformer 在該硬體下無法做到 |
| Mamba-3 | 「2026 年純 SSM 新基準」 | 具備複數狀態與 MIMO 的當前最強純 SSM 架構；混合模型進行下一代升級的潛在基石 |
| MIMO | 「多輸入多輸出」 | Mamba-3 的架構創新，以矩陣值投影取代逐特徵的純量投影 |
| 指數梯形離散化 | 「Mamba-3 的新遞迴」 | 表現力顯著優於 Mamba-2 尤拉法離散化的全新遞迴形式 |
| 混合架構（Hybrid architecture） | 「混合注意力與 SSM」 | 交錯交織 Transformer 與 SSM 層的任何模型架構；Jamba 是此領域的代表作 |

## Further Reading｜延伸閱讀

- [Lieber et al. — Jamba: A Hybrid Transformer-Mamba Language Model (arXiv:2403.19887)](https://arxiv.org/abs/2403.19887) ——原始 Jamba 論文，包含比例消融實驗與 256k 脈絡實證
- [AI21 — Jamba 1.5: Hybrid Transformer-Mamba at Scale (arXiv:2408.12570)](https://arxiv.org/abs/2408.12570) ——擴展後的企業級家族，包含 398B/94B 與 12B/52B 開源發布
- [Gu, Dao — Mamba: Linear-Time Sequence Modeling with Selective State Spaces (arXiv:2312.00752)](https://arxiv.org/abs/2312.00752) ——Jamba 所立足的選擇性 SSM 奠基之作
- [Dao, Gu — Mamba-2 (arXiv:2405.21060)](https://arxiv.org/abs/2405.21060) ——簡化後的結構化狀態空間繼任架構
- [Lahoti et al. — Mamba-3 (arXiv:2603.15569, ICLR 2026)](https://arxiv.org/abs/2603.15569) ——引入複數狀態與 MIMO 的 2026 年純 SSM 前沿突破
- [Gu et al. — Efficiently Modeling Long Sequences with Structured State Spaces (arXiv:2111.00396)](https://arxiv.org/abs/2111.00396) ——提出 S4 架構、拉開現代 SSM 研究序幕的經典開山之作
