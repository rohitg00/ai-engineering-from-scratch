# 差分注意力（V2）

> softmax 注意力會把一小撮機率散到每一個不匹配的詞元上。在 10 萬個詞元的尺度下，這些雜訊會累積起來把訊號淹掉。Differential Transformer（Ye 等人，ICLR 2025）的解法是把注意力算成兩個 softmax 的差，把共用的雜訊底噪減掉。DIFF V2（Microsoft，2026 年 1 月）則是給生產堆疊用的重寫版：解碼延遲追平基準 Transformer、不需要自訂 kernel、與 FlashAttention 相容。這一課從 V1 一路走到 V2，並附上一個你能用 stdlib Python 跑起來的差分運算玩具實作。

**類型：** 實作
**程式語言：** Python (stdlib)
**先修單元：** 階段 7 · 02（自注意力）、階段 7 · 15（注意力變體）、階段 10 · 14（架構逐段走讀）
**時間：** 約 60 分鐘

## 學習目標

- 精確說出 softmax 注意力為什麼有雜訊底噪，以及它為什麼會隨脈絡長度成長。
- 推導差分注意力的公式，並解釋這個減法為什麼能消掉共用的雜訊成分，同時保住訊號。
- 走一遍 V1 到 V2 的差異：什麼變快了、什麼變簡單了、什麼變穩了，以及每項改動對生產級預訓練為何是必要的。
- 用純 Python 從零實作差分注意力，並在一個「訊號加雜訊」的合成查詢上實證驗證雜訊消除的性質。

## 問題所在

標準 softmax 注意力有一個數學性質，一放大到規模就變成營運上的頭痛問題。對一個查詢 `q`，注意力權重是 `softmax(qK^T / sqrt(d))`。softmax 永遠產不出精確的零 —— 每個不匹配的詞元都會拿到一些正的質量。這些殘留質量就是雜訊，而且它會隨脈絡長度放大。在 12.8 萬個詞元下，就算每個不匹配的詞元只拿到 0.001% 的機率，127,999 個加起來也貢獻了約 12%。模型必須學會繞開一層會隨脈絡長大的雜訊底噪。

實證上，這會表現成注意力頭的互相干擾：長脈絡 RAG 裡幻覺出來的引用、10 萬詞元檢索任務上的 lost-in-the-middle 失敗，以及超過 32k 之後大海撈針基準上細微的準確率退化。Differential Transformer 論文（arXiv:2410.05258，ICLR 2025）量測出了這個落差：DIFF Transformer 相較同尺寸的基準模型，困惑度更低、長脈絡準確率更高、幻覺更少。

DIFF V1 有三個問題，讓它進不了前沿的預訓練管線。它的 value 快取每個解碼步驟得載入兩次；它需要自訂的 CUDA kernel，因而破壞了 FlashAttention 相容性；而且它的逐頭 RMSNorm 會讓 70B 以上規模的長時間訓練失穩。DIFF V2（Microsoft unilm 部落格，2026 年 1 月 20 日）把三個都修掉了。這一課會走過兩個版本、建出差分運算子，並在一個玩具查詢上跑雜訊消除的基準測試。

## 核心概念

### softmax 的雜訊底噪

對一個查詢 `q` 與鍵 `K = [k_1, ..., k_N]`，注意力權重是：

```math
w_i = \frac{\exp(q \cdot k_i / \sqrt{d})}{\sum_j \exp(q \cdot k_j / \sqrt{d})}
```

沒有任何一個 `w_i` 會是零。如果 `k_i` 與 `q` 完全無關，分數 `q . k_i` 也不會是 0 —— 它會在零附近以變異數 `||q||^2 / d` 波動。經過 softmax 正規化後，每個無關詞元對加權和仍然貢獻 `O(1/N)`。無關詞元的總貢獻是 `O((N-1)/N) = O(1)` —— 這可不是個小量。

模型真正想要的是類似硬性 top-k 的東西：匹配的詞元權重高，其他地方權重趨近零。softmax 太平滑了，直接做不到。

### 差分的想法

把每個頭的 Q 與 K 投影切成兩份：Q = (Q_1, Q_2) 與 K = (K_1, K_2)。算出兩張注意力圖：

```math
\begin{aligned}
A_1 &= \mathop{\mathrm{softmax}}(Q_1 K_1^T / \sqrt{d}) \\
A_2 &= \mathop{\mathrm{softmax}}(Q_2 K_2^T / \sqrt{d})
\end{aligned}
```

輸出：

```math
\mathop{\mathrm{DiffAttn}} = (A_1 - \lambda \cdot A_2) V
```

這個減法會消掉兩張圖共有的那份雜訊分布。如果兩張圖對那 12.7 萬個無關詞元都給出大致均勻的權重（在隨機初始化下必然如此），它們就會互相抵銷。而訊號 —— 集中在少數真正相關詞元上的尖峰權重 —— 只有在兩張圖裡以相同幅度出現時才會被抵銷，而模型一旦訓練起來就不會這樣。

`lambda` 是每個頭一個的可學習純量，參數化成 `lambda = exp(lambda_q1 dot lambda_k1) - exp(lambda_q2 dot lambda_k2) + lambda_init`。它可以是負的。`lambda_init` 預設是一個小的正數，例如 0.8。

### 為什麼這對應到抗噪耳機的原理

想像兩支有雜訊的麥克風錄同一個人說話。兩支都收到了講者的聲音，加上彼此相關的背景雜訊。把其中一支減掉另一支，共有的雜訊就掉了。人聲之所以活下來，是因為兩路訊號在相位或振幅上差得夠多，不至於完全抵銷。逐頭的 `lambda` 學的正是這個平衡。

### V1 對 V2：差在哪

V1 讓參數量與基準 Transformer 持平。為了讓每個頭有兩個查詢，它把頭維度砍半。這犧牲了頭的表達力，更痛的是把每個頭的 value 快取也砍半了。解碼時每一步得把 value 快取載入兩次（兩個 softmax 分支各一次）。結果是：參數量雖然打平，解碼卻比基準還慢。

V2 把查詢頭的數量加倍，KV 頭維持不變（參數是從 up-projection 借來的）。頭維度與基準相同。做完減法後，多出來的那個維度會被投影回去，好對上基準 Transformer 的 O_W 投影。三件事同時發生：

1. 解碼速度追平基準（KV 快取只載入一次）。
2. FlashAttention 原封不動就能跑（不用自訂 kernel）。
3. 解碼時的算術強度上升（每從 HBM 載入一個位元組能做更多運算）。

V2 也拿掉了 V1 用來穩定減法的逐頭 RMSNorm。在 70B 等級的預訓練規模下，那個 RMSNorm 會讓訓練後期失穩。V2 改用一套更簡單的初始化方案，不多掛模組也能維持訓練穩定。

### 什麼時候該搬出來用

| 工作負載 | 好處 |
|----------|---------|
| 長脈絡 RAG（64k 以上） | 注意力圖更乾淨，幻覺引用更少 |
| 大海撈針基準 | 超過 32k 後準確率大幅提升 |
| 多文件問答 | 跨文件干擾更少 |
| 8k 的程式碼補全 | 效益邊際，不值得為它改架構 |
| 短聊天（小於 4k） | 基本上與基準無從區分 |

價值隨脈絡長度成長。4k 詞元時，雜訊底噪小到標準注意力就夠用。到 12.8 萬時，它就在扯你後腿了。

### 它與 2026 年其他旋鈕怎麼疊

| 特性 | 與 DIFF V2 相容？ |
|---------|------------------------|
| GQA | 相容（V2 增加的是 Q 頭，不是 KV 頭） |
| MLA（DeepSeek） | 原理上相容，但還沒有把兩者結合的公開論文 |
| MoE | 相容（注意力與 MLP 區塊互相獨立） |
| RoPE | 相容（不需改動） |
| YaRN／長脈絡外推 | 相容（而且正是 DIFF 最能幫上忙的地方） |
| FlashAttention | V2 相容（V1 不相容） |
| 推測式解碼 | 相容（注意力的改動對推測式解碼迴圈不可見） |

```figure
differential-attention
```

## 動手實作

`code/main.py` 用純 Python 實作差分注意力。一個具有已知「訊號加雜訊」結構的玩具查詢，能讓你直接量測雜訊消除比。

### 步驟 1：標準 softmax 注意力

stdlib 的矩陣運算：用巢狀 list、手寫矩陣乘法，以及會先減掉最大值來保數值穩定的 softmax。

```python
def softmax(row):
    m = max(row)
    exps = [math.exp(x - m) for x in row]
    s = sum(exps)
    return [e / s for e in exps]
```

### 步驟 2：把 Q、K 切成兩半

V1 風格：把頭維度砍半。V2 風格：保持頭維度，改成把頭的數量加倍。玩具實作為了教學清晰採用 V1 —— 數學完全一樣，差別只在帳務怎麼記。

### 步驟 3：兩條 softmax 分支加減法

```python
A1 = [softmax([dot(q1, k) / scale for k in K1]) for q1 in Q1]
A2 = [softmax([dot(q2, k) / scale for k in K2]) for q2 in Q2]
diff_weights = [[a1 - lam * a2 for a1, a2 in zip(r1, r2)] for r1, r2 in zip(A1, A2)]
out = [[sum(w * v[j] for w, v in zip(row, V)) for j in range(d_v)] for row in diff_weights]
```

注意：輸出權重可以是負的。這沒問題 —— value 快取本來就處理得了帶號的貢獻，後面的 V 投影會把符號吸收掉。

### 步驟 4：量測雜訊消除

造一條長度 1024 的合成序列。把訊號詞元放在一個已知位置，其餘填上雜訊。分別算出 (a) 標準 softmax 注意力落在訊號位置的權重，以及 (b) 差分注意力的權重，量測兩者各自的訊噪比。差分注意力穩定地給出更高的訊噪比，倍率視兩條分支被訓練得差異多大而定，落在 3 倍到 10 倍之間。

### 步驟 5：V1 與 V2 的參數帳

給定一組設定（hidden=4096、heads=32、d_head=128），印出：

- 基準 Transformer：Q、K、V 各為 `hidden * hidden` 大小，MLP 為 4 * hidden。
- DIFF V1：Q、K 各為 `hidden * hidden`，V 為 `hidden * hidden`（不變），頭維度在內部砍半。多出逐頭的 `lambda` 參數（`O(heads * d_head)`）。
- DIFF V2：Q 為 `2 * hidden * hidden`，K 為 `hidden * hidden`，V 為 `hidden * hidden`。多出來的維度在進 O_W 之前投影回去。多出同樣的 `lambda` 參數。

這個玩具會量出 V2 多付的參數成本（每個注意力區塊大約多 `hidden * hidden`）並印出來。

## 框架應用

截至 2026 年 4 月，DIFF V2 還沒在每一台生產級推論伺服器上出貨，但 vLLM 與 SGLang 的整合正在進行中。同時，這個模式已經出現在：

- Microsoft 內部的長脈絡生產模型。
- 好幾個瞄準 25.6 萬以上脈絡的開放模型訓練中的研究復現。
- 把 DIFF 注意力與滑動視窗注意力交錯放在不同層的混合架構。

2026 年你什麼時候會搬出它：

- 從零訓練一個瞄準 64k 以上有效脈絡的新模型。一開始就把差分注意力放進去；之後再重訓很貴。
- 微調一個長脈絡模型，而 lost-in-the-middle 失敗主導了你的評測。在 Q 投影上掛一個 LoRA，可以近似出 DIFF 的結構。

什麼時候不會：

- 你服務的是一個長脈絡表現本來就穩的預訓練密集模型。在既有權重上，重訓成本很少回得了本。
- 你的脈絡永遠在 16k 以下。雜訊底噪可以忽略。

## 產出交付

這一課會產出 `outputs/skill-diff-attention-integrator.md`。給定模型架構、目標脈絡長度、幻覺側寫與訓練預算，它會產出一份整合計畫，說明如何把差分注意力加進一次新的預訓練或 LoRA 微調。

## 練習

1. 執行 `code/main.py`。確認在合成查詢上，差分注意力回報的訊噪比高於標準 softmax 注意力。改變雜訊振幅，指出標準注意力開始不堪用的交叉點。

2. 為一個 7B 等級的模型（hidden=4096、heads=32、d_head=128、32 層），算出從基準到 DIFF V1、以及從基準到 DIFF V2 的參數量差額。指出哪些元件多了參數、哪些維持不變。

3. 讀 DIFF V1 論文（arXiv:2410.05258）的第 3 節，以及 DIFF V2 Hugging Face 部落格的第 2 節。用兩句話解釋為什麼 V1 的逐頭 RMSNorm 是必要的，以及 V2 為什麼能把它拿掉又不會讓訓練發散。

4. 做一個消融實驗：分別以 `lambda = 0`（純第一條 softmax）與 `lambda = 1`（完整減法）計算差分注意力。在合成查詢上量測訊噪比在整段掃描中如何變化，找出讓訊噪比最大的 `lambda`。

5. 把玩具擴充成 GQA + DIFF V2。取 8 個 KV 頭與 32 個 Q 頭。證明 KV 快取的大小，與同樣是 (8, 32) 設定的基準 GQA 模型相同。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|------------------------|
| 差分注意力 | 「兩個 softmax 相減」 | 把 Q、K 切成兩半、算出兩張 softmax 圖，把第二張（乘上 lambda）從第一張減掉，再乘上 V |
| 雜訊底噪 | 「softmax 那條不為零的尾巴」 | softmax 給每個無關詞元的 O(1/N) 權重；在長脈絡下加總起來是 O(1) |
| lambda | 「減法的比例」 | 每個頭一個的可學習純量，參數化成 `exp(lq1.lk1) - exp(lq2.lk2) + lambda_init`；可以是負的 |
| DIFF V1 | 「ICLR 2025 的那版」 | 最初的 Differential Transformer；為了維持參數量而把頭維度砍半，需要自訂 kernel，解碼較慢 |
| DIFF V2 | 「2026 年 1 月的修正版」 | 把 Q 頭加倍、KV 頭不變；解碼速度追平基準，而且能配合 FlashAttention |
| 逐頭 RMSNorm | 「V1 的穩定器」 | V1 在做完差分後多加的一層 norm；V2 把它移除以避免訓練後期失穩 |
| 訊噪比 | 「有多少注意力被浪費掉」 | 落在真正訊號位置的權重，與落在無關位置的平均權重之比 |
| Lost in the middle | 「長脈絡的失敗模式」 | 一個實證現象：長脈絡中段文件的檢索準確率會下沉 —— 差分注意力能減輕它 |
| 算術強度 | 「每載入一個位元組能做幾次 FLOP」 | V2 在解碼時靠著每次 KV 載入配上加倍的查詢而提高的比值；對記憶體受限的解碼很重要 |

## 延伸閱讀

- [Ye et al. — Differential Transformer (arXiv:2410.05258, ICLR 2025)](https://arxiv.org/abs/2410.05258) —— 原始論文，含雜訊消除理論與長脈絡消融
- [Microsoft unilm — Differential Transformer V2 (Hugging Face blog, January 2026)](https://huggingface.co/blog/microsoft/diff-attn-v2) —— 生產堆疊的重寫版，解碼追平基準、與 FlashAttention 相容
- [Understanding Differential Transformer Unchains Pretrained Self-Attentions (arXiv:2505.16333)](https://arxiv.org/abs/2505.16333) —— 從理論分析為什麼這個減法能還原出預訓練的注意力結構
- [Shared DIFF Transformer (arXiv:2501.17900)](https://arxiv.org/html/2501.17900) —— 參數共享的變體
- [Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)](https://arxiv.org/abs/1706.03762) —— DIFF 拿來相減的那個基準 Transformer
- [Liu et al. — Lost in the Middle (arXiv:2307.03172)](https://arxiv.org/abs/2307.03172) —— 差分注意力瞄準的長脈絡基準
