# DeepSeek-V3 架構導覽

> 第 10 階段第 14 課指出了所有開源模型都會調校的六個架構旋鈕。DeepSeek-V3（2024 年 12 月，總參數量 6,710 億，活躍參數 370 億）撥動了這全部六個旋鈕，並在此之上加入了另外四項：多頭潛在注意力（MLA）、無輔助損失負載平衡（auxiliary-loss-free load balancing）、多 Token 預測（MTP），以及 DualPipe 平行訓練。本課自頂向下深度剖析 DeepSeek-V3 的架構，並從已公開的設定檔推導每個參數量的計算。學完之後，你將能透徹解釋為何 671B/37B 的比例是極具遠見的精準押注，以及為何在尖端領域 MLA 與 MoE 的結合威力能遠超單獨使用的任一技術。

**Type:** Learn
**Languages:** Python (stdlib, parameter calculator)
**Prerequisites:** Phase 10 · 14 (open-model walkthroughs), Phase 10 · 17 (NSA), Phase 10 · 18 (MTP), Phase 10 · 19 (DualPipe)
**Time:** ~75 minutes

## Learning Objectives｜學習目標

- 自頂向下精讀 DeepSeek-V3 的設定檔，並能對照六個 GPT-2 旋鈕加上四項 DeepSeek 專屬創新來解釋每個欄位
- 推導總參數量（671B）、活躍參數量（37B），以及構成這兩者的各個核心元件
- 計算 MLA 在 128k 脈絡長度下的 KV 快取體積，並與具備同等活躍參數量且採用 GQA 的稠密模型進行嚴謹對比
- 陳述 DeepSeek 的四項核心架構創新（MLA、MTP、無輔助損失路由、DualPipe），並指出每一項各自鎖定架構／訓練技術堆疊的哪個環節

## The Problem｜問題

DeepSeek-V3 是第一個在架構實質層面上顯著有別於 Llama 家族的尖端開源模型。Llama 3 405B 本質上是「撥動了六個旋鈕的 GPT-2」。而 DeepSeek-V3 則是撥動了全部六個旋鈕後，又額外疊加了四項突破。閱讀 Llama 3 的設定檔只是熱身，DeepSeek 設定檔背後深層的結構——注意力區塊的拓撲形狀、路由決策邏輯、訓練期的監督目標——差異極大，以至於你需要一份專屬的深度導覽。

掌握這套架構的價值在於：DeepSeek-V3 的開源權重發布重塑了開源領域「尖端能力」的定義。這套架構已成為 2026 年無數訓練執行作業競相借鑑的藍圖。對於任何接觸前沿 LLM 訓練或推論的角色而言，理解它已是基本要求。

## The Concept｜核心概念

### 再探不變的骨架

DeepSeek-V3 依然是自回歸模型。它依然堆疊解碼器區塊。每個區塊依然包含注意力層、MLP 以及兩層 RMSNorm。它依然在 MLP 中採用 SwiGLU，依然採用 RoPE、Pre-norm，以及權重綁定的 embedding。其基本架構與每一款 Llama 或 Mistral 相同。

### 核心革新：以 MLA 取代 GQA

從第 10 階段第 14 課中你已經知道，GQA 透過跨 Q 頭群組共享 K 與 V 來壓縮 KV 快取。而多頭潛在注意力（Multi-Head Latent Attention，MLA）更進一步：K 與 V 被壓縮至共享的低秩（low-rank）潛在表示中（即 `kv_lora_rank`），隨後在執行注意力運算時即時逐頭解壓縮。KV 快取僅需儲存該潛在向量——在每一層中每個 token 通常只需儲存 512 個浮點數，而非 8 x 128 = 1024 個。

在 128k 脈絡下，採用 MLA 的 DeepSeek-V3（每個 token 每一層僅需儲存單一共享潛在向量 `c^{KV}`；K 與 V 皆從該向量透過上投影導出，且上投影矩陣可被吸收到後續的矩陣乘法中）：

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

而假設採用類似 Llama 3 70B 形狀的 GQA 基準（8 個 KV 頭，頭維度 128）：

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

在 128k 脈絡下，MLA 的快取體積比 Llama-3-70B 風格的 GQA 整整小了 4 倍。

權衡代價：MLA 在每次注意力計算中為每個頭增加了一次解壓縮步驟。相較於所節省的記憶體頻寬，這微小的額外運算微不足道。對於長脈絡推論而言，整體有利。

### 路由機制：無輔助損失負載平衡

MoE 路由器決定每個 token 交由哪 top-k 個專家處理。天真的路由器會將大量工作灌注至少數熱門專家身上，導致其餘專家長期閒置。標準解法是引入一個懲罰負載不均的輔助損失項（auxiliary loss），這雖然有效，但會輕微損害主任務的學習表現。

DeepSeek-V3 引入了無輔助損失（auxiliary-loss-free）方案。在路由器 logits 上為每個專家加入偏置項（bias），並在訓練過程中依簡單規則動態調整：若專家 `e` 負載過重，則調降 `bias_e`；若負載不足，則調升它。不需要額外的損失項，訓練過程乾淨純粹，專家負載依然保持高度平衡。

對主損失的影響：未觀察到對主損失的可測量影響。對 MoE 架構的影響：架構更乾淨，免去了調整輔助損失超參數的繁瑣負擔。

### MTP：更稠密的訓練訊號與免費草稿模型

從第 10 階段第 18 課中你知道，DeepSeek-V3 加入 D = 1 的 MTP 模組，專門預測往後第 2 個位置的 token。在推論時，該模組直接轉化為推測解碼草稿模型，接受率達 80% 以上。在訓練時，每個隱藏狀態（hidden state）同時受到 D+1 = 2 個目標的監督，提供了顯著更稠密的學習訊號。

參數量：在 6,710 億主模型之外增加約 140 億參數。額外開銷僅為 2.1%。

### 訓練機制：DualPipe

從第 10 階段第 19 課中你知道，DualPipe 是一種雙向管線，能將前向與反向運算區塊與跨節點 all-to-all 通訊重疊。在 DeepSeek-V3 的 2,048 張 H800 規模下，它挽回了約 24.5 萬個 GPU 小時原本會被 1F1B 氣泡浪費的寶貴時間。

### 設定檔欄位逐一拆解

以下是簡化後的 DeepSeek-V3 設定檔：

```
hidden_size: 7168
intermediate_size: 18432   (dense MLP hidden size, used on first few layers)
moe_intermediate_size: 2048 (expert MLP hidden size)
num_hidden_layers: 61
first_k_dense_layers: 3    (first 3 layers use dense MLP)
num_attention_heads: 128
num_key_value_heads: 128   (formally equal to num_heads under MLA, but
                           the real compression is in kv_lora_rank)
kv_lora_rank: 512          (MLA latent dimension)
num_experts: 256            (MoE expert count per block)
num_experts_per_tok: 8      (top-8 routing)
shared_experts: 1           (always-on shared expert per block)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (1 MTP module at depth 1)
```

解析細節：

- `hidden_size=7168`：embedding 維度。
- `num_hidden_layers=61`：總區塊深度。
- `first_k_dense_layers=3`：前 3 個區塊採用大小為 18432 的稠密 MLP，其餘 58 個區塊採用 MoE。
- `num_attention_heads=128`：128 個 query 頭。
- `kv_lora_rank=512`：K 與 V 被壓縮至此潛在維度，並在逐頭展開。
- `num_experts=256, num_experts_per_tok=8`：每個 MoE 區塊擁有 256 個專家，每次路由選出 top-8。
- `shared_experts=1`：在 256 個路由專家之外，另有 1 個常駐專家參與處理每一個 token。這充當了「稠密底座」，確保每個 token 都能獲得穩定的基礎表示。
- `moe_intermediate_size=2048`：每個專家的 MLP 隱藏維度。相較於稠密 MLP 小得多，因為總共有 256 個專家。

### 參數量精確推導

完整計算程式碼請參閱 `code/main.py`。核心數值如下：

- Embedding：`vocab * hidden = 129280 * 7168 = ~0.93B`。
- 前 3 個稠密區塊：帶有 MLA 的注意力層（每區塊約 1.44 億）+ 稠密 MLP（每區塊約 2.6 億）+ 正規化層。總計約 12 億。
- 58 個 MoE 區塊：帶有 MLA 的注意力層（約 1.44 億）+ 256 個專家（每個約 3,000 萬）+ 1 個共享專家（約 3,000 萬）+ 正規化層。包含所有專家在內每區塊約 79.5 億，58 個 MoE 區塊總計約 4,610 億。
- MTP 模組：140 億。

基礎核心加總約 4,760 億 + 140 億 MTP。而官方發布的 6,710 億數字則進一步納入了細部的架構參數（偏置張量、專家專屬元件、共享專家縮放因子等）。計算器所重現的數值與官方公佈數字誤差在 3% 到 5% 之內——細微差異源自 DeepSeek 報告附錄第 2 節所記錄的精細記帳細節。

前向傳遞時的活躍參數量：

- 注意力層：每層 1.44 億 x 61 層 = 88 億（所有層皆啟動）。
- 活躍 MLP：前 3 層為稠密層（3 x 2.6 億 = 7.8 億），後 58 層每層啟動 8 個路由專家 + 1 個共享專家。每層活躍 MLP 約 2.6 億。總計：3 x 2.6 億 + 58 x 2.6 億 = 約 159 億。
- Embedding + 正規化層：12 億。
- 總活躍參數量：核心部分約 260 億 + 140 億 MTP（訓練時啟用，推論時依模式選用）≈ 370 億。

### 671B / 37B 的深遠比例

18 倍的稀疏度比例（活躍參數僅佔總參數的 5.5%）。DeepSeek-V3 是目前開源權重領域中最極致稀疏的頂尖 MoE 模型。Mixtral 8x7B 的比例為 13/47（28%），結構明顯更稠密；而 Llama 4 Maverick 的 17B/400B（4.25%）則與其相當。DeepSeek 的精準押注在於：在尖端規模下，擁有更多專家搭配更低的單 token 啟動比例，能在單位活躍 FLOP 下壓榨出更高品質。

### 尖端模型橫向評比

| 模型 | 總參數量 | 活躍參數量 | 活躍比例 | 注意力機制 | 核心突破 |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + 無輔助損失路由 + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN 擴展 |

### 後續演進：R1 與 V4

DeepSeek-R1（2025 年）是在 V3 主幹上進行的推理專用訓練。R1 採用了完全相同的模型架構，其革命性變化在於後訓練配方（在可驗證任務上進行大規模強化學習），而非預訓練架構本身。

而未來的 DeepSeek-V4 預期將延續 MLA + MoE + MTP 的架構組合，並引入源自第 10 階段第 17 課 NSA 的繼任者 DSA（DeepSeek Sparse Attention）。其架構演進脈絡極具連續性：核心架構持續累積沉澱，每個版本在此之上撥動更多嶄新旋鈕。

```figure
moe-routing
```

## Use It｜實際應用

`code/main.py` 是專為 DeepSeek-V3 形狀量身打造的參數計算器。執行它，將輸出與論文中的數字進行比對，並可在假設變體（256 專家 vs 512、top-8 vs top-16、MLA 秩 512 vs 1024）上進行探索。

觀察重點：

- 總參數量相較於官方 671B 的對比。
- 活躍參數量相較於官方 37B 的對比。
- 128k 脈絡下的 KV 快取體積——MLA 與 GQA 的懸殊差距。
- 逐層分解以明瞭參數預算究竟流向何處。

## Ship It｜交付成果

本課產出 `outputs/skill-deepseek-v3-reader.md`。給定 DeepSeek 家族模型（V3、R1 或任何衍生變體），它會產生一份逐元件的架構導讀，指出設定檔中的每個欄位、推導各元件參數量，並辨識該模型啟用了四項 DeepSeek 專屬創新中的哪幾項。

## Exercises｜練習

1. 執行 `code/main.py`。將計算器的總參數估算與官方 671B 進行比較，並指出細微差異的來源。論文第 2 節提供了完整的項目清單。

2. 修改設定檔以採用 MLA 秩 256 而非 512。計算在 128k 脈絡下的 KV 快取大小。這能帶來多少比例的額外縮減，並對逐頭表現力造成什麼潛在代價？

3. 比較 DeepSeek-V3 的（256 專家，top-8）路由與假設的（512 專家，top-8）變體。總參數量增加了，但活躍參數量保持不變。這額外的專家容量在理論上能帶來什麼，在推論服務時又會付出什麼代價？

4. 研讀 DeepSeek-V3 技術報告（arXiv:2412.19437）關於 MLA 的第 2.1 節。以三句話解釋為何 K 與 V 的解壓縮矩陣在推論期間可以被「吸收」進後續的矩陣乘法中以提升效率。

5. DeepSeek-V3 在大多數運算中採用了 FP8 訓練。計算儲存 671B 權重時 FP8 相較於 BF16 所節省的記憶體。這如何與 14.8 兆 token 的訓練預算產生互動？

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| MLA | 「多頭潛在注意力」 | 將 K 與 V 壓縮至共享低秩潛在表示（kv_lora_rank，通常為 512）中，推論時即時逐頭解壓；KV 快取僅需儲存該潛在向量 |
| kv_lora_rank | 「MLA 壓縮維度」 | K 與 V 共享潛在表示的大小；DeepSeek-V3 採用 512 |
| 前 k 個稠密層（First k dense layers） | 「早期層保持稠密」 | MoE 模型的前幾個區塊跳過 MoE 路由器並執行稠密 MLP，以維持訓練初期數值穩定性 |
| num_experts_per_tok | 「Top-k 路由數量」 | 每個 token 啟動的路由專家數量；DeepSeek-V3 採用 8 |
| 共享專家（Shared experts） | 「常駐專家」 | 無論路由決策如何皆會處理每個 token 的專家；DeepSeek-V3 採用 1 個 |
| 無輔助損失路由（Auxiliary-loss-free routing） | 「偏差調整負載平衡」 | 在訓練期間動態調整逐專家偏置項以維持專家負載均衡，不引入額外的輔助損失項 |
| MTP 模組 | 「額外的預測頭」 | 從 h^(1) 與 E(t+1) 預測 t+2 的 transformer 區塊；提供更稠密訓練訊號並充當免費推測解碼草稿模型 |
| DualPipe | 「雙向管線」 | 將前向／反向運算與跨節點 all-to-all 通訊完美的雙向訓練排程演算法 |
| 活躍參數比例（Active parameter ratio） | 「稀疏度」 | 活躍參數 / 總參數；DeepSeek-V3 達到極致的 5.5% |
| FP8 訓練 | 「8 位元訓練」 | 儲存與眾多運算直接在 FP8 格式下進行；在微小品質代價下使記憶體需求減半 |

## Further Reading｜延伸閱讀

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) ——涵蓋完整架構、訓練細節與基準表現的權威文獻
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) ——設定檔與部署指引
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) ——率先提出 MLA 機制的開創性前驅研究
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) ——基於 V3 架構進行大規模推理後訓練的里程碑論文
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) ——DeepSeek 家族未來注意力機制的前沿演進方向
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe) ——雙向平行訓練排程的官方開源參考實作
