# 差分注意力（Differential Attention）（V2）

> Softmax 注意力機制會向每個不相干的 token 分散微量的機率。在超過 10 萬個 token 的脈絡下，這些雜訊累積起來會徹底淹沒真實訊號。Differential Transformer（Ye 等人，ICLR 2025）透過將注意力計算為兩個 softmax 的差值，抵消共同的雜訊底限，解決了這個難題。DIFF V2（微軟，2026 年 1 月）則是生產級技術堆疊的重構版本：decode 延遲與基準 Transformer 持平、無需自訂核心，且完全相容於 FlashAttention。本課將端到端剖析 V1 到 V2 的演進，並提供可在標準 Python 中執行的差分運算實作。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 7 · 02 (self-attention), Phase 7 · 15 (attention variants), Phase 10 · 14 (architecture walkthrough)
**Time:** ~60 minutes

## Learning Objectives｜學習目標

- 精確陳述為何 softmax 注意力存在雜訊底限，以及為何該底限會隨著脈絡長度增長
- 推導差分注意力（Differential Attention）公式，並解釋相減操作如何消除共同雜訊分量同時完整保留訊號
- 梳理 V1 到 V2 的具體架構差異：速度如何提升、結構如何簡化、穩定性如何改善，以及為何每項改變對正式環境預訓練皆屬必要
- 從零以純 Python 實作差分注意力（Differential Attention），並在合成的訊號加雜訊 query 上實證檢驗雜訊抵消特性

## The Problem｜問題

標準 softmax 注意力具備一項數學特性，在超大規模長脈絡下會演變成難以承受的維運負擔。對於 query `q`，注意力權重為 `softmax(qK^T / sqrt(d))`。Softmax 永遠無法產出嚴格的零——每個不相干的 token 都會被分配到微小的正機率。這筆殘留機率就是雜訊，且會隨脈絡長度增加而累積。在 128k token 下，即使每個不相關的 token 僅分到 0.001% 的機率，127,999 個 token 累積起來也會貢獻約 12% 的總權重。模型被迫學會如何繞過一個隨脈絡膨脹的雜訊底限。

實證上，這表現為注意力頭的相互干擾：長脈絡 RAG 中的幻覺引用、10 萬 token 檢索任務上的「迷失在中間（lost-in-the-middle）」失效，以及超過 32k 後大海撈針基準測試上的微幅準確率衰退。Differential Transformer 論文（arXiv:2410.05258，ICLR 2025）測量了這項差距：DIFF Transformer 達到了更低的困惑度、更高的長脈絡準確率，且相較於同等規模的基準模型具有更少的幻覺。

然而 DIFF V1 存在三個問題，使其無法進入頂尖預訓練管線：其 value 快取在每個 decode 步驟中必須載入兩次、需要破壞 FlashAttention 相容性的自訂 CUDA 核心，且其逐頭 RMSNorm 在 70B 以上規模的長期訓練中會引發不穩定。DIFF V2（微軟 unilm 部落格，2026 年 1 月 20 日）修復了這三項缺陷。本課完整涵蓋這兩個版本，親手實作差分算子，並在玩具 query 上基準測試雜訊抵消效果。

## The Concept｜核心概念

### Softmax 的雜訊底限

對於 query `q` 與 keys `K = [k_1, ..., k_N]`，注意力權重為：

```
w_i = exp(q . k_i / sqrt(d)) / sum_j exp(q . k_j / sqrt(d))
```

沒有任何一個 `w_i` 會嚴格等於零。如果 `k_i` 與 `q` 完全無關，分數 `q . k_i` 並非為 0——它會在零附近浮動，變異數為 `||q||^2 / d`。在 softmax 正規化後，每個不相干的 token 依然對加權總和貢獻 `O(1/N)`。所有不相干 token 的總貢獻高達 `O((N-1)/N) = O(1)`——這絕非可以忽略的小量。

模型真正渴望的是類似硬性 top-k 的效果：在相干 token 上給予高權重，在其他所有地方給予近乎嚴格的零。Softmax 太過平滑，無法直接做到這一點。

### 差分的核心思想

將每個頭的 Q 與 K 投影拆分成兩半：Q = (Q_1, Q_2) 與 K = (K_1, K_2)。計算兩個注意力圖（attention maps）：

```
A_1 = softmax(Q_1 K_1^T / sqrt(d))
A_2 = softmax(Q_2 K_2^T / sqrt(d))
```

輸出：

```
DiffAttn = (A_1 - lambda * A_2) V
```

相減操作消除了這兩個注意力圖所共享的任何雜訊分布。若兩張圖在 127k 個不相干 token 上都具備大致均勻的權重（在隨機初始化時必然如此），相減會直接將其抵消。而真實訊號——集中在少數真正相關 token 上的尖銳權重——只有在兩張圖中以完全相同幅度出現時才會抵消，但模型一旦經過訓練就不會呈現相同幅度。

`lambda` 是每個頭的可學習純量，參數化為 `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`。它可以為負數。`lambda_init` 預設為微小的正數，如 0.8。

### 為什麼這形同主動降噪

想像兩隻帶有雜訊的麥克風同時錄製同一個聲音。兩者都收錄到了說話者的聲音，加上彼此高度相關的背景雜訊。將兩者相減，共享的背景雜訊便會被抵消。語音得以存留，因為這兩個訊號在相位或振幅上的細微差異足以防止完全抵消。逐頭的 `lambda` 正是學會了這種動態平衡。

### V1 vs V2：架構演進

V1 保持了與基準 Transformer 完全相同的參數量。為了在每個頭獲得兩個 query，它將頭維度（head dimension）直接減半。這損害了注意力頭的表現力，更痛苦的是使每個頭的 value 快取體積減半。Decode 階段在每個步驟中必須將 value 快取載入兩次（每個 softmax 路徑各一次）。結果導致：儘管參數量相當，decode 速度卻明顯慢於基準模型。

V2 將 query 頭的數量翻倍，同時保持 KV 頭數量不變（從 up-projection 中借用參數）。頭維度維持與基準模型完全一致。在執行差分相減後，將多餘的維度投影回原本的維度，以對齊基準 Transformer 的 O_W 投影。這帶來了三項重大突破：

1. Decode 速度與基準模型持平（KV 快取僅需載入一次）。
2. FlashAttention 無需自訂核心即可直接執行。
3. Decode 階段的算術強度（arithmetic intensity）顯著提升（每次從 HBM 載入位元組能執行更多運算）。

V2 還移除了 V1 用於穩定相減操作的逐頭 RMSNorm。在 70B 規模的預訓練後期，該 RMSNorm 會破壞訓練穩定性。V2 以更簡潔的初始化方案取而代之，在不引入額外模組的前提下維持了訓練的平穩。

### 何時採用差分注意力（Differential Attention）

| 工作負載 | 效益 |
|----------|---------|
| 長脈絡 RAG（64k 以上） | 更乾淨的注意力圖，大幅減少幻覺引用 |
| 大海撈針基準測試 | 超過 32k 後顯著提升檢索準確率 |
| 多文件問答 | 減少跨文件之間的注意力干擾 |
| 8k 下的程式碼補全 | 效益邊際，不值得進行架構改動 |
| 短對話（< 4k） | 與基準模型表現基本無異 |

其價值隨脈絡長度加重。在 4k token 下，雜訊底限很小，標準注意力完全夠用。但在 128k 下，雜訊底限正在造成實質損害。

### 與 2026 年其他架構旋鈕的相容性

| 架構特徵 | 是否相容於 DIFF V2？ |
|---------|------------------------|
| GQA | 是（V2 增加的是 Q 頭，而非 KV 頭） |
| MLA（DeepSeek） | 原理上相容，目前尚無公開論文將兩者結合 |
| MoE | 是（注意力機制獨立於 MLP 區塊） |
| RoPE | 是（完全不受影響） |
| YaRN / 長脈絡擴展 | 是（這正是 DIFF 最能發揮威力之處） |
| FlashAttention | 在 V2 中完全支援（V1 則否） |
| 推測解碼 | 是（注意力的修改對推測解碼迴圈完全透明） |

```figure
differential-attention
```

## Build It｜動手實作

`code/main.py` 以純 Python 實作了差分注意力（Differential Attention）。透過帶有已知訊號加雜訊結構的玩具 query，你可以直接測量雜訊抵消比例。

### 步驟 1：標準 Softmax 注意力

標準庫矩陣運算：列表的列表、手寫矩陣乘法，以及先減去最大值以維持數值穩定的 softmax。

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### 步驟 2：將 Q 與 K 拆分為兩半

V1 風格：將頭維度減半。V2 風格：保持頭維度並將頭數量翻倍。玩具實作基於教學清晰度採用了 V1——兩者的數學原理完全一致，差別只在維度與形狀的記錄方式。

### 步驟 3：雙 Softmax 路徑與相減

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

請注意：輸出的注意力權重可以是負數。這完全沒有問題——value 快取依然能妥善處理帶有正負號的貢獻，後續的 V 投影會吸收正負符號。

### 步驟 4：雜訊抵消量測

建立一條長度為 1024 的合成序列。將訊號 token 放置在已知位置，其餘填入雜訊。分別計算：(a) 標準 softmax 注意力在訊號位置的權重，以及 (b) 差分注意力（Differential Attention）的權重。測量兩者的訊噪比（SNR）。差分注意力（Differential Attention）能穩定產出高出 3 到 10 倍的訊噪比，具體取決於兩路計算在訓練後的差異程度。

### 步驟 5：V1 vs V2 參數記帳

給定設定檔（hidden=4096、heads=32、d_head=128），印出：

- 基準 Transformer：Q、K、V 各為 `hidden * hidden`，MLP 為 4 * hidden。
- DIFF V1：Q、K 各為 `hidden * hidden`，V 為 `hidden * hidden`（維持不變），內部頭維度減半。新增逐頭 `lambda` 參數（O(heads * d_head)）。
- DIFF V2：Q 大小為 `2 * hidden * hidden`，K 為 `hidden * hidden`，V 為 `hidden * hidden`。多餘維度在 O_W 之前投影還原。新增相同的 `lambda` 參數。

玩具程式碼計算了 V2 的額外參數開銷（每個注意力區塊約增加 `hidden * hidden`）並印出摘要。

## Use It｜實際應用

截至 2026 年 4 月，DIFF V2 尚未整合至所有正式環境推論伺服器中，但 vLLM 與 SGLang 的整合正在推進。與此同時，該模式已出現在：

- 微軟內部的長脈絡正式環境模型中。
- 目標支援 256k 以上脈絡的多個開源模型訓練研究中。
- 在交替層上結合差分注意力（Differential Attention）與滑動視窗注意力的混合架構中。

在 2026 年何時該選用這項技術：

- 從零訓練目標支援 64k 以上有效脈絡的新模型。從一開始就加入差分注意力（Differential Attention）；後續重新訓練成本極高。
- 在「迷失在中間」失效主導評估表現的長脈絡模型上進行 fine-tuning。在 Q 投影上掛載 LoRA 能近似出 DIFF 架構。

何時不應選用：

- 服務具備穩定長脈絡表現的預訓練稠密模型。在既有權重上重新訓練的代價通常難以回收。
- 脈絡始終在 16k 以下。雜訊底限在此規模下微不足道。

## Ship It｜交付成果

本課產出 `outputs/skill-diff-attention-integrator.md`。給定模型架構、目標脈絡長度、幻覺特性與訓練預算，它會產出一份在全新預訓練或 LoRA fine-tune 中整合差分注意力（Differential Attention）的完整實施計畫。

## Exercises｜練習

1. 執行 `code/main.py`。驗證在合成 query 上，差分注意力（Differential Attention）所回報的訊噪比顯著高於標準 softmax 注意力。調整雜訊振幅，找出標準注意力開始徹底失效的臨界交界點。

2. 針對 7B 級模型（hidden=4096、heads=32、d_head=128、32 層），計算從基準模型到 DIFF V1 以及到 DIFF V2 的參數量增量。指出哪些元件增加了參數，哪些保持不變。

3. 閱讀 DIFF V1 論文第 3 節（arXiv:2410.05258）與 DIFF V2 Hugging Face 部落格第 2 節。以兩句話解釋為何 V1 的逐頭 RMSNorm 過去是必要的，以及為何 V2 能安全移除它而不導致訓練發散。

4. 實作消融實驗：計算 `lambda = 0`（純首個 softmax）與 `lambda = 1`（全量相減）時的差分注意力（Differential Attention）。在合成 query 上測量訊噪比如何隨參數掃描變化，找出能最大化訊噪比的 `lambda`。

5. 將玩具實作擴展至 GQA + DIFF V2。選取 8 個 KV 頭與 32 個 Q 頭。證明其 KV 快取大小與具備相同 (8, 32) 配置的基準 GQA 模型完全吻合。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|----------------|------------------------|
| 差分注意力（Differential Attention）（Differential attention） | 「兩個 softmax 相減」 | 將 Q 與 K 拆分為兩半，計算兩張 softmax 注意力圖，將第二張（乘以 lambda 縮放）從第一張中減去，隨後乘以 V |
| 雜訊底限（Noise floor） | 「softmax 的非零長尾」 | softmax 在每個不相干 token 上賦予的 O(1/N) 權重，在長脈絡下累計高達 O(1) |
| lambda | 「相減縮放因子」 | 每個頭的可學習純量，參數化為 `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`；可以為負數 |
| DIFF V1 | 「ICLR 2025 版本」 | 最初的 Differential Transformer；將頭維度減半以保持參數量，需要自訂核心，decode 較慢 |
| DIFF V2 | 「2026 年 1 月修正版」 | 將 Q 頭數量翻倍並保持 KV 頭不變；decode 速度與基準模型持平且相容於 FlashAttention |
| 逐頭 RMSNorm | 「V1 的穩定器」 | V1 在相減後套用的額外正規化；V2 將其移除以防範訓練後期的數值不穩定 |
| 訊噪比（Signal-to-noise ratio） | 「浪費了多少注意力」 | 真實訊號位置的權重相對於不相干位置平均權重的比例 |
| 迷失在中間（Lost in the middle） | 「長脈絡失效模式」 | 處於長脈絡中段的文件檢索準確率顯著下滑的實證現象——差分注意力（Differential Attention）能顯著減輕此問題 |
| 算術強度（Arithmetic intensity） | 「載入每位元組的 FLOPs」 | V2 在 decode 階段透過每次 KV 載入翻倍 query 運算所提高的比例；對受限於頻寬的 decode 至關重要 |

## Further Reading｜延伸閱讀

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) ——包含雜訊抵消理論與長脈絡消融實驗的原始論文
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blog, January 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2) ——正式環境重構版，decode 速度對齊基準模型且相容於 FlashAttention
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) ——探討相減操作為何能復原預訓練注意力結構的理論分析
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) ——參數共享變體研究
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) ——DIFF 進行相減改良的基準 Transformer 原始論文
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) ——差分注意力（Differential Attention）旨在攻克的長脈絡基準測試經典論文
