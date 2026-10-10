# 多 Token 預測（MTP）

> 從 GPT-2 到 Llama 3，每個自回歸 LLM 在每個位置上都只針對單一損失進行訓練：預測下一個 token。DeepSeek-V3 則在每個位置上引入了第二個損失：預測再下一個 token。這額外的 140 億參數（相對於 6,710 億模型規模）透過梯度流動蒸餾回骨幹模型，且訓練好的 MTP 模組在推論時直接改作推測解碼的草稿模型，接受率突破 80% 以上。這幾乎免費帶來了 1.8 倍的生成吞吐量（throughput）。本課將從零實作 DeepSeek 技術報告中的循序 MTP 模組、計算聯合損失與共享輸出頭參數佈局，並剖析為何該循序設計嚴格維護了因果鏈，而 Gloeckle 等人最初的平行 MTP 卻打破了它。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 10 · 04 (pre-training a mini GPT), Phase 10 · 15 (speculative decoding)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 陳述 MTP 訓練目標，並推導跨預測深度的聯合損失函數
- 解釋 Gloeckle 等人的平行 MTP 輸出頭（2024 年）與 DeepSeek-V3 的循序 MTP 模組之間的差異，以及為何循序設計得以維護因果鏈
- 計算在預訓練執行作業中新增 MTP 模組所帶來的參數與記憶體開銷
- 從零實作單一 MTP 模組：共享 embedding、逐深度 transformer 區塊、投影矩陣與共享輸出頭

## The Problem｜問題

下一個 token 預測（Next-token prediction）是標準的 LLM 訓練目標。每個隱藏狀態受到監督去預測且僅預測一件事：緊隨其後的下一個 token。這其實是一項驚人微弱的監督訊號。序列中的絕大多數關鍵資訊都延伸至單一 token 之外——巨觀結構、語義連貫、事實真實性、算術邏輯。模型必須在數兆個 token 上日積月累無數個單 token 訊號，才能緩慢領悟這些整體模式。

MTP 提出了一個大膽的設想：如果讓每個隱藏狀態同時受到監督，去一次預測多個未來的 token 呢？Gloeckle 等人（Meta，2024 年）證明了這項思路的可行性。他們的實作在骨幹模型之上掛載了多個獨立的輸出頭，每個頭各自預測不同的位移偏移量。結構平行且簡潔，但各個輸出頭看見的是同一個隱藏狀態，缺乏階層式的逐步提煉——更關鍵的是，各預測之間不存在因果依賴鏈，因此無法直接用於推測解碼。

DeepSeek-V3（2024 年 12 月）將 MTP 重新設計為在每個預測深度維護因果鏈的循序模組。模型從 `h_i^(0)` 預測 `t+1`，隨後從一個將 `h_i^(0)` 與 `E(t+1)` embedding 結合的新隱藏狀態 `h_i^(1)` 預測 `t+2`，依此類推。每個深度都擁有自己獨立的微型 transformer 區塊。共享 embedding 與共享輸出頭使額外參數量保持克制。在 DeepSeek-V3 的尺度下，相對於 6,710 億主模型權重，MTP 模組僅增加約 140 億參數。這微不足道的 2% 開銷，不僅換來了更稠密的訓練訊號，更在推論時送上一套現成的推測解碼草稿模型。

本課將從零實作單一 MTP 模組與 D 深度聯合損失。數學形式優雅，實作僅需 150 行。

## The Concept｜核心概念

### 循序 MTP 架構配方

DeepSeek-V3 在主模型之上疊加了 `D` 個 MTP 模組。每個模組 `k`（對於 `k = 1..D`）專門預測深度 `k` 的 token——即在給定直到位置 `i` 的前綴下，預測 `t_{i+k}`。

模組 `k` 由以下元件構成：

- 擁有自身注意力與 MLP 的 transformer 區塊 `T_k`。
- 一個投影矩陣 `M_k`，用於將前一深度的隱藏狀態與下一深度真實 token 的 embedding 結合。
- 共享 embedding 表 `E`（與主模型完全共用）。
- 共享輸出頭 `Out`（與主模型完全共用）。

在訓練期間，對於直到位置 `i` 的前綴，各深度隱藏狀態定義為：

```
h_i^(0) = main model backbone at position i
h_i^(k) = T_k( M_k * concat(RMSNorm(h_i^(k-1)), RMSNorm(E(t_{i+k}))) )   for k >= 1
```

各深度預測值為：

```
logits_{i+k} = Out(h_i^(k-1))   for k = 1..D
```

各深度損失為相對於真實 token `t_{i+k}` 的交叉熵：

```
L_k = CE(logits_{i+k}, t_{i+k})
```

跨深度的聯合損失為：

```
L_MTP = (lambda / D) * sum_{k=1..D} L_k
```

`lambda` 是一個較小的加權因子——DeepSeek-V3 在訓練的前 10% 階段使用 0.3，隨後降至 0.1。總訓練損失即為 `L_main + L_MTP`。

### 為何循序而非平行

Gloeckle 最初的平行 MTP 擁有 D 個輸出頭，每個頭直接作用於 `h_i^(0)` 上，各自從相同的主幹隱藏狀態預測 `t_{i+k}`。這在訓練上沒有問題，但各個預測之間並未以彼此為條件。你無法利用 `head_1` 的輸出協助 `head_2`——各頭完全平行觸發。

DeepSeek-V3 的循序設計從 `h_i^(k-1)` 加上下一個 token 的真實 embedding `E(t_{i+k})` 來建構 `h_i^(k)`。這完整維護了因果鏈：為了預測 `t_{i+k+1}`，深度 `k+1` 的模組能清晰看見 `t_{i+k}` 處的內容。這在架構上與自回歸解碼器消耗自身輸出完全等價——使得 MTP 模組在推論時能無縫扮演推測解碼的草稿生成器。

在推論時：將 `h_i^(k-1)` 與猜測生成的 `t_{i+k}` 餵入模組 `k+1`，即可獲得對 `t_{i+k+1}` 的預測。依此迭代重複。這完全是 EAGLE 風格的草稿模型，只是直接使用預訓練好的 MTP 模組充當草稿網路。DeepSeek-V3 回報在第一個 MTP 模組上的接受率高達 80% 以上，並帶來約 1.8 倍的生成加速。

### 參數開銷記帳

對於隱藏維度為 `h`、詞彙表大小為 `V` 的模型：

- 主模型：數十億到數千億參數，加上一個大小為 `V * h` 的輸出頭。
- 共享輸出頭：直接複用主模型的輸出頭，不佔用任何額外參數。
- 共享 embedding：直接複用主模型的 embedding 表，不佔用任何額外參數。
- 每個 MTP 模組：
  - 投影矩陣 `M_k`：`(2h) * h = 2h^2`。
  - Transformer 區塊 `T_k`：注意力層（MHA 為 `4h^2`）加上 MLP（對於比率為 8/3 的 SwiGLU 通常為 `8h^2`）。每個區塊約為 `12h^2`。

每個模組的額外參數總計：`~14h^2`。對於 DeepSeek-V3 的 `h = 7168`，D = 1 模組在理論上約為 `~14 * 7168^2 = ~720M` 參數（約 7.2 億）。DeepSeek-V3 實際回報約 140 億——差距主要在於 MTP 模組內部同樣採用了 MoE 專家架構。

### 推測解碼帶來的巨大回報

在預訓練期間，MTP 模組會使訓練變慢約 10%（更多前向計算、額外損失計算）。而其回報體現在兩大維度：

1. **更稠密的訓練訊號。** 每個隱藏狀態同時看見 D+1 個監督目標。在 DeepSeek-V3 的消融實驗中，在 MMLU、GSM8K、MATH 與 HumanEval 上一致獲得了數個百分點的穩定提升。

2. **推論時免費獲得推測解碼草稿模型。** MTP 模組早已受過預測未來數個 token 的嚴格訓練。在推論時直接將其轉化為草稿網路，能提供 80% 以上的極高接受率。在此水準下，N=3 或 N=5 的推測解碼能直接帶來 1.8 倍的吞吐量。那 10% 的預訓練開銷，在推論服務啟動的第一刻就徹底賺了回來。

### 與 EAGLE 的對比

EAGLE 是在預訓練完成後「單獨訓練」一個微型草稿模型；而 MTP 則是將草稿模型「內嵌於預訓練」之中。兩者最終收斂至相似的接受率，但途徑完全不同：

| 比較維度 | EAGLE-3 | MTP（DeepSeek-V3） |
|-----------|---------|------------------|
| 訓練時機 | 預訓練完成後 | 預訓練期間一併進行 |
| 向後相容既有模型權重 | 是 | 否（需重新訓練） |
| 草稿參數量 | 1 到 2 層 transformer | 1 個 transformer 區塊 + 投影矩陣 |
| 接受率 | 0.88-0.92 | 深度 1 下達 0.80 以上 |
| 加速以外的額外效益 | 僅限推測解碼加速 | 更稠密的訓練訊號 + 推論加速 |

```figure
multi-token-predict
```

## Build It｜動手實作

`code/main.py` 端到端建構了單一 MTP 模組：共享 embedding、投影矩陣、transformer 區塊與共享輸出頭。隨後在短合成序列上計算逐深度交叉熵損失，並印出各元件的參數量分解。玩具詞彙表大小設為 32，使數字清晰易讀。

### 步驟 1：共享 Embedding 表

一個單一的 `vocab_size x hidden` 表格同時供主模型與各深度 MTP 模組使用。這不是第二份複本——它在底層嚴格指向同一個張量。

### 步驟 2：逐深度特徵結合

```python
def combine(prev_hidden, next_token_embed, M_k):
    # concat along feature dim, then project down to hidden
    concat = rms_norm(prev_hidden) + rms_norm(next_token_embed)  # vector addition stand-in
    projected = matvec(M_k, concat)
    return projected
```

真實的 DeepSeek-V3 將兩個經過 RMSNorm 的向量串接為 `[2h]`，並以 `h x 2h` 的矩陣進行線性投影。玩具實作基於標準庫簡潔度採用了向量加法作為替代。

### 步驟 3：深度 k 的 Transformer 區塊

自注意力機制加上 MLP。在玩具實作中，單層線性注意力與 SwiGLU MLP 在不依賴 numpy 的情況下清楚展示了其內部架構。

### 步驟 4：共享輸出頭

直接重複使用主模型的輸出投影矩陣，產出跨詞彙表的 logits。

### 步驟 5：逐深度損失計算

計算 softmax(logits) 相對於位移 `k` 的真實 token 的交叉熵。利用 `lambda / D` 縮放係數在各深度間進行聚合。

### 步驟 6：參數開銷記帳

印出總參數量、共享（embedding、輸出頭）參數量，以及每個模組的新增參數量，並展示 MTP 額外開銷相對於主模型的比例。

## Use It｜實際應用

MTP 已整合至 DeepSeek-V3（2024 年 12 月）與 DeepSeek-R1 系列中。在推論服務端：

- DeepSeek 自身的服務堆疊開箱即用，原生將 MTP 模組作為推測解碼器呼叫。
- 截至 2026 年 4 月，vLLM 與 SGLang 均已具備針對 DeepSeek-V3 MTP 的整合支援路徑。
- AMD 的 ROCm SGLang 教學展示了專門的 MTP 推測解碼配置，在 V3 checkpoint 上實測達到了 1.8 倍的加速。

何時應在新的預訓練中採用 MTP：

- 你掌控完整的預訓練管線，且希望收穫更稠密的訓練監督訊號。
- 你明確知道模型日後需要大規模服務，並希望免費獲得推測解碼能力。
- 模型的隱藏層維度至少在 4096 以上。在 1B 規模下，額外開銷往往會壓過所得收益。

何時不應採用：

- 在既有的預訓練稠密模型上進行 fine-tuning（其 MTP 模組並未受過訓練）。
- 需要作為純淨基準線進行比對的學術研究模型（MTP 改變了基礎架構）。

## Ship It｜交付成果

本課產出 `outputs/skill-mtp-planner.md`。給定預訓練規格（模型大小、資料量、算力預算），它會產出一份 MTP 整合規劃：包含預測深度 D、`lambda` 排程、記憶體額外開銷，以及推論期推測解碼的串接方案。

## Exercises｜練習

1. 執行 `code/main.py`。展示隨著合成訊號強度增加，逐深度損失呈現單調下降。修改合成資料以採用固定規律，並驗證深度 1 與深度 2 的損失皆能穩定收斂。

2. 針對稠密 70B 模型（hidden 8192、80 層）在 D=1 MTP 模組下計算其參數開銷。將其與 DeepSeek-V3 回報的 140 億開銷進行比對，解釋為何 DeepSeek 的數值高得多：其 MTP transformer 區塊繼承了相同的 MoE 專家結構，大幅膨脹了每個模組的參數量。

3. 在玩具程式碼中實作 D=2：加入第二個 MTP 模組，接收 h^(1) 並預測 `t_{i+2}`。驗證聯合損失與參數記帳是否與 DeepSeek 論文的公式 19 至 21 完全相符。

4. 將玩具實作切換為平行 MTP（Gloeckle 風格）：在主幹隱藏狀態之上掛載 D 個輸出頭，各頭獨立預測不同的偏移量。在相同合成訊號下測量各深度損失與循序版本的差異。循序版本在 k > 1 時應產出更低的損失，因為它以中間預測作為條件輸入。

5. 改作 EAGLE 風格的草稿模型：在推論時呼叫模組 k 提出 `t_{i+k}` 的預測。在保留序列上測量這些草稿 token 相對於主模型預測的接受率。若在玩具模型上能突破 50% 以上，你就成功重現了 MTP 作為草稿模型的實證特性。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| MTP 模組 | 「額外的損失區塊」 | 一個微型的 transformer 區塊加上投影矩陣，專門預測主模型前方第 `k` 個位置的 token |
| 預測深度（Prediction depth） | 「往前看幾個 token」 | 整數 `k`，表示模組 `k` 根據直到位置 `i` 的前綴預測 `t_{i+k}` |
| 平行 MTP（Parallel MTP） | 「Gloeckle 風格」 | 在同一個主幹隱藏狀態上掛載 D 個獨立輸出頭，各預測之間不存在條件鏈 |
| 循序 MTP（Sequential MTP） | 「DeepSeek-V3 風格」 | 每個模組以上一深度的隱藏狀態加上下一個 token 的 embedding 為條件輸入；嚴格保留因果鏈 |
| 共享輸出頭 | 「複用主模型的頭」 | MTP 模組直接呼叫主模型的 LM 輸出頭，而非使用獨立的輸出投影 |
| 共享 Embedding | 「複用主模型的詞表」 | 全程共用同一個詞彙表 embedding 矩陣，無任何重複參數 |
| 投影矩陣 M_k | 「結合隱藏狀態與下一 token」 | 一個 `h x 2h` 的線性層，將前一深度隱藏狀態與目標 token embedding 投影為下一深度的輸入 |
| 聯合損失 L_MTP | 「平均後的額外損失」 | 逐深度交叉熵損失的算術平均值，經 `lambda` 縮放後併入總損失 |
| 深度 1 接受率 | 「MTP 草稿猜對的頻率」 | D=1 MTP 模組的 top-1 預測與主模型 top-1 預測完全相同的比例；在 DeepSeek-V3 上達 80% 以上 |
| Lambda 加權係數 | 「額外損失的權重」 | 逐深度的損失縮放係數；在 DeepSeek-V3 上訓練初期為 0.3，後期降至 0.1 |

## Further Reading｜延伸閱讀

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) ——完整的循序 MTP 官方描述（第 2.2 節），包含聯合損失公式與推論時 1.8 倍加速的實證結果
- [Gloeckle et al. — Better & Faster Large Language Models via Multi-token Prediction (arXiv:2404.19737)](https://arxiv.org/abs/2404.19737) ——DeepSeek 進行改良的平行 MTP 原始基準論文
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) ——總計 6,850 億參數（6,710 億主模型 + 140 億 MTP）的部署實務說明
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) ——MTP 所無縫契合的推測解碼框架
- [Li et al. — EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) ——EAGLE 的 2025 年新一代草稿架構，MTP 的強力對手與互補技術
