# CLIP 與對比式視覺—語言預訓練

> OpenAI 的 CLIP（2021）證明了一個夠大的想法，足以撐起接下來五年：只用網路上有雜訊的影像—字幕配對加上一個對比損失，就能把影像編碼器與文字編碼器對齊到同一個向量空間。零個監督標籤。4 億組配對。得到的嵌入空間能做零樣本分類、影像—文字檢索，還能當成視覺塔插進每一個 2026 年的 VLM。SigLIP 2（2025）把 softmax 換成 sigmoid，用更低的成本把規模推得比 CLIP 更遠。這一課會把數學從 InfoNCE 一路走到 sigmoid 成對損失，並用 stdlib Python 把訓練步驟做出來。

**類型：** 實作
**程式語言：** Python (stdlib, InfoNCE + sigmoid loss implementations)
**先修單元：** 階段 12 · 01（ViT patch）、階段 7（Transformers）
**時間：** 約 180 分鐘

## 學習目標

- 從互資訊推導出 InfoNCE 損失，並實作一個數值穩定的向量化版本。
- 說明為什麼 sigmoid 成對損失（SigLIP）能擴展到 32768 以上的批次大小，而不需要 softmax 所要求的 all-gather 開銷。
- 建構文字模板（`a photo of a {class}`）並對餘弦相似度取 argmax，跑一次零樣本 ImageNet 分類。
- 說出 CLIP／SigLIP 預訓練給你的四根槓桿：批次大小、溫度、提示詞模板、資料品質。

## 問題所在

CLIP 之前的視覺是監督式的。蒐集有標註的資料集（ImageNet：120 萬張影像、1000 個類別），訓練一個 CNN，出貨。標籤很貴，標籤會偏向標註者能取得共識的東西，而且標籤沒有微調就無法遷移到新任務。

網路上的影像—字幕，有十億組以上鬆散標註的配對，而且免費。一張黃金獵犬的照片配上 alt 文字「my dog Max in the park」，本身就帶著監督訊號 —— 這段文字描述了這張影像。問題是：你能不能把這變成有用的訓練？

CLIP 的答案：把影像—字幕配對當成一個匹配任務。給定一批 N 張影像與 N 段字幕，學會在 N-1 個干擾項之中，把每張影像配到它自己的字幕。監督訊號是「這兩個東西是一組；那 N-1 個不是」。沒有類別標籤。沒有人工標註。就只有一個對比損失。

得到的嵌入空間，能做的比 CLIP 訓練時的目標更多。ImageNet 零樣本之所以行得通，是因為「a photo of a cat」的嵌入，會落在那些從未被明確標成貓的貓照片附近。正是這一注，孕育出 2026 年的每一個 VLM。

## 核心概念

### 雙編碼器

CLIP 有兩座塔：

- 影像編碼器 `f`：ViT 或 ResNet，每張影像輸出一個 D 維向量。
- 文字編碼器 `g`：一個小型 Transformer，每段字幕輸出一個 D 維向量。

兩座塔都會把輸出正規化成單位長度。既然兩邊都是單位範數，相似度就是 `cos(f(x), g(y)) = f(x)^T g(y)`。

對一批 N 組 (影像, 字幕) 配對，建出形狀為 `(N, N)` 的相似度矩陣 `S`：

```math
S[i, j] = \cos(f(x_i), g(y_j)) / \tau
```

其中 `tau` 是一個學習得到的溫度（CLIP 初始化為 0.07；在對數空間中學習）。

### InfoNCE 損失

CLIP 用的是橫跨列與行的對稱交叉熵：

```
loss_i2t = CE(S, labels=identity)     # each image's positive is its own caption
loss_t2i = CE(S^T, labels=identity)   # each caption's positive is its own image
loss = (loss_i2t + loss_t2i) / 2
```

這就是 InfoNCE。CE 裡的 softmax 會逼著每張影像跟自己的字幕匹配得比批次中其他任何字幕都好。「負例」就是這一批裡的所有其他項目。批次越大 = 負例越多 = 訊號越強。CLIP 用 32k 的批次訓練；規模是有差的。

### 溫度

`tau` 控制 softmax 的銳利程度。tau 低 → 分布銳利，有難負例挖掘的效果。tau 高 → 平緩，所有樣本都有貢獻。CLIP 學的是 log(1/tau)，並做截斷以避免崩潰。SigLIP 2 則固定初始的 tau，改用一個學習得到的偏置。

### 為什麼 sigmoid 擴展得更好（SigLIP）

softmax 需要整個相似度矩陣同步。在分散式訓練中，你必須把每個嵌入 all-gather 到每個複本上，然後才能做 softmax。這樣的通訊量是世界大小的平方。

SigLIP 把 softmax 換成逐元素的 sigmoid：對每一組配對 `(i, j)`，損失是一個「這兩個是不是配對的一組？」的二元分類，正類的標籤在對角線上，其餘全是負的。損失是：

```math
L = -\frac{1}{N} \sum_{(i, j)} \Big[ y_{ij} \log \mathop{\mathrm{sigmoid}}(S[i,j]) + (1-y_{ij}) \log \mathop{\mathrm{sigmoid}}(-S[i,j]) \Big]
```

`i == j` 時 `y_ij = 1`，否則為 0。每組配對的損失彼此獨立。不需要 all-gather。每張 GPU 算自己那個區塊再加總。SigLIP 2 能便宜地擴展到 32k 到 512k 的批次，而 CLIP 在同樣規模下需要成比例增加的通訊量。

### 零樣本分類

給定 N 個類別名稱，為每個類別建一段文字模板：

```
"a photo of a {class}"
```

用文字編碼器把每段模板嵌入。用影像編碼器把你的影像嵌入。餘弦相似度的 argmax 就是預測的類別。目標類別上沒有做任何訓練。

提示詞模板是有影響的。CLIP 原始論文對每個類別用了 80 種模板（樸素的、藝術的、照片、繪畫等等）並把嵌入平均起來。ImageNet 上多 3 分。現代用法通常只挑一兩種模板。

### 線性探針與微調

零樣本是基準線。線性探針（在凍結的 CLIP 特徵上，針對你的目標類別訓練一層線性層）在領域內任務上會贏過零樣本。完整微調在領域內又會贏過線性探針，但可能傷害零樣本的遷移能力。三種做法，三種取捨。

### SigLIP 2：NaFlex 與密集特徵

SigLIP 2（2025）加上了：
- NaFlex：單一模型就能處理可變的長寬比與解析度。
- 更好的密集特徵，可用於分割與深度估計，目標是在 VLM 中當作凍結骨幹。
- 多語言：訓練涵蓋 100 種以上語言，而 CLIP 只有英文。
- 10 億參數的規模，而 CLIP 最高只到 4 億。

在 2026 年的開放 VLM 中，SigLIP 2 SO400m/14 是預設的視覺塔。至於純粹的影像—文字檢索，當 LAION-2B 那個特定的訓練分布正好對上你的查詢模式時，CLIP 仍是預設選擇。

### ALIGN、BASIC、OpenCLIP、EVA-CLIP

ALIGN（Google，2021）：和 CLIP 同樣的想法，18 億組配對的規模，90% 有雜訊。證明了帶雜訊的資料能擴展。OpenCLIP（LAION）：在 LAION-400M／2B 上對 CLIP 的開放重現，有多種規模，是首選的開放檢查點。EVA-CLIP：從遮罩影像建模初始化；是 VLM 的強力骨幹。BASIC：Google 的 CLIP+ALIGN 混合體。全都是同一家族，差別在資料與調校。

### 零樣本的天花板

CLIP 這一類的模型，ImageNet 零樣本大約卡在 76%（CLIP-G、OpenCLIP-G）。要再往上，要嘛需要大得多的資料（SigLIP 2 拿到 80% 以上），要嘛需要架構上的改動（監督式的 head、更多參數）。這個基準已經在飽和了；真正的價值在於那個供下游 VLM 取用的嵌入空間。

```figure
multimodal-fusion
```

## 框架應用

`code/main.py` 實作了：

1. 一個玩具版雙編碼器（基於雜湊的影像特徵、字元層級的文字特徵），讓你不靠 numpy 也能看見 InfoNCE 的形狀。
2. 純 Python 的 InfoNCE 損失（用 log-sum-exp 維持數值穩定）。
3. 用來對照的 sigmoid 成對損失。
4. 一個零樣本分類常式：對一組文字提示詞算餘弦相似度，取 argmax 作為預測。

跑跑看，觀察損失曲線。絕對數值只是玩具；但形狀與真正的 CLIP 訓練器吐出來的一致。

## 產出交付

這一課產出 `outputs/skill-clip-zero-shot.md`。給定一組影像（用路徑指定）與一串目標類別，它會用 CLIP 模板建出文字提示詞，用指定的檢查點（例如 `openai/clip-vit-large-patch14`）把兩邊嵌入，然後回傳帶相似度分數的 top-1／top-5 預測。這項技能會拒絕對提示詞清單以外的類別下任何斷言。

## 練習

1. 用手算對一批 4 組配對實作 InfoNCE。建出 4x4 的相似度矩陣，跑 softmax，把對角線挑出來，算交叉熵。拿你的 Python 實作對照這份手算結果做驗證。

2. SigLIP 除了溫度之外還用了一個偏置參數 `b`：`S'[i,j] = S[i,j]/tau + b`。當批次有嚴重的類別不平衡（每一列的負例遠多於正例）時，`b` 扮演什麼角色？讀 SigLIP 第 3 節（arXiv:2303.15343）。

3. 做一個貓 vs 狗的零樣本分類器。試兩種提示詞模板：`a photo of a {class}` 與 `a picture of a {class}`。在 100 張測試影像上量測準確率。模板的集成有贏過單一模板嗎？

4. 算出在 512 張 GPU、批次 32k 的訓練中，softmax InfoNCE 與 sigmoid 成對損失各自的通訊成本。哪一個是 O(N)，哪一個是 O(N^2)？引用 SigLIP 第 4 節。

5. 讀 OpenCLIP 的尺度法則論文（arXiv:2212.07143，Cherti 等人）。從圖表中重現他們關於資料規模的結論：在固定模型大小下，ImageNet 零樣本準確率與訓練資料量之間，呈現什麼樣的對數線性關係？

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|----------------|------------------------|
| InfoNCE | 「對比損失」 | 對一批資料的相似度矩陣做交叉熵；每一項的正例是與它配對的那一項，負例則是其餘全部 |
| Sigmoid 損失 | 「SigLIP 損失」 | 逐配對的二元交叉熵；沒有 softmax、不需 all-gather，在分散式訓練中擴展得很便宜 |
| 溫度 | 「tau」 | 在 softmax／sigmoid 之前縮放 logits 的純量；控制分布的銳利程度 |
| 零樣本 | 「免微調分類」 | 用文字提示詞建出類別嵌入，再靠餘弦相似度分類；目標類別上沒有訓練 |
| 提示詞模板 | 「a photo of a ...」 | 包在類別名稱外面的文字鷹架；會讓零樣本準確率差上 1 到 5 分 |
| 雙編碼器 | 「雙塔」 | 一個影像編碼器 + 一個文字編碼器，輸出落在共享的 D 維空間 |
| 難負例 | 「難纏的干擾項」 | 一個與正例夠像的負例，像到模型得費勁才能把它們分開 |
| 線性探針 | 「凍結 + 一層」 | 只在凍結的特徵之上訓練一個線性分類器；用來量測特徵品質 |
| NaFlex | 「原生彈性解析度」 | SigLIP 2 的能力：不必縮放尺寸就能吃下任意長寬比與解析度的影像 |
| 溫度縮放 | 「以對數參數化的 tau」 | CLIP 把 `log(1/tau)` 拿來參數化，讓梯度乖一點；並做截斷以免崩潰到 tau 趨近零 |

## 延伸閱讀

- [Radford et al. — Learning Transferable Visual Models From Natural Language Supervision (arXiv:2103.00020)](https://arxiv.org/abs/2103.00020) —— CLIP 論文。
- [Zhai et al. — Sigmoid Loss for Language Image Pre-Training (arXiv:2303.15343)](https://arxiv.org/abs/2303.15343) —— SigLIP。
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786) —— 多語言 + NaFlex。
- [Jia et al. — ALIGN (arXiv:2102.05918)](https://arxiv.org/abs/2102.05918) —— 用帶雜訊的網路資料擴展規模。
- [Cherti et al. — Reproducible scaling laws for contrastive language-image learning (arXiv:2212.07143)](https://arxiv.org/abs/2212.07143) —— OpenCLIP 的尺度法則。
