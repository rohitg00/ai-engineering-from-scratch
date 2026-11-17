# 為什麼是 Transformer——RNN 的問題

> RNN 一次處理一個 token。Transformer 一次處理全部 token。2017 年之後，深度學習裡每一條縮放曲線都被這一個架構選擇改寫。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 3 (Deep Learning Core), Phase 5 · 09 (Sequence-to-Sequence), Phase 5 · 10 (Attention Mechanism)
**Time:** ~45 minutes

## The Problem｜問題

2017 年以前，這個星球上每一個最前沿的序列模型（sequence model）——語言、翻譯、語音——都是循環神經網路（recurrent neural network）。LSTM 和 GRU 在翻譯評測上贏了五年，那些評測的地位相當於 ImageNet。那是當時唯一的工具。

它們有三個致命弱點。序列計算表示你沒辦法沿著時間軸平行化：token `t+1` 需要 token `t` 的隱藏狀態（hidden state）。1024 個 token 的序列，就是 GPU 上 1024 個循序步驟，而那顆 GPU 每個週期能做 100 萬次浮點（floating-point）運算。在為平行設計的硬體上，訓練的實際耗時隨序列長度線性成長。

梯度消失（vanishing gradient）表示，50 個 token 之前的資訊已經被壓過 50 次非線性。閘控的循環單元（LSTM、GRU）緩解了這種資訊壓縮，但從未消除。長程依賴——「我去年夏天在飛往京都的飛機上讀的那本書是……」——經常失敗。

固定寬度的隱藏狀態表示，編碼器（encoder）在解碼器（decoder）看到任何東西之前，把整段來源序列擠成單一向量。來源是 5 個 token 還是 500 個都沒差；瓶頸的形狀一樣。

2017 年的論文 “Attention Is All You Need” 提出一件激進的事：把循環整個丟掉。讓每個位置平行地注意（attention）到其他每個位置。用一次大的矩陣乘法訓練，而不是 1024 次循序的。

結果到 2026 年主導每一種模態。語言（GPT-5、Claude 4、Llama 4）、視覺（ViT、DINOv2、SAM 3）、音訊（Whisper）、生物（AlphaFold 3）、機器人（RT-2）。同一個區塊，不同的輸入。

## The Concept｜核心概念

![RNN sequential compute vs Transformer parallel attention](../assets/rnn-vs-transformer.svg)

**循環是瓶頸。** RNN 計算 `h_t = f(h_{t-1}, x_t)`。每一步依賴前一步。你不能在 `h_4` 之前算出 `h_5`。現代 GPU 有 1 萬個以上的平行核心，長序列上這浪費了 99% 的運算資源。

**注意力採廣播式運作。** 自注意力（self-attention）對每一對 `(i, j)` 同時計算 `output_i = sum_j(a_ij * v_j)`。整張 N×N 的注意力矩陣在一次批次（batch）矩陣乘法裡填滿。沒有一步依賴另一步。GPU 喜歡這樣。

**加速不是常數。** 它是 `O(N)` 循序計算深度和 `O(1)` 循序計算深度的差別。實務上，在對得上的硬體、N = 512 時，transformer 每個訓練週期（epoch）快 5 到 10 倍，差距隨序列長度變大，直到你撞上注意力的 `O(N²)` 記憶體（memory）牆（Flash Attention 後來補上了——見第 12 課）。

**Transformer 的代價。** 注意力的記憶體依 `O(N²)` 縮放。2000 的脈絡（context）沒問題。12.8 萬的脈絡，你需要滑動視窗、RoPE 外插、Flash Attention 的分塊，或線性注意力的變體。循環在時間和記憶體都是 `O(N)`；transformer 用記憶體換時間，再靠平行把時間贏回來。

**歸納偏差（inductive bias）的轉移。** RNN 假設局部性和近期性。Transformer 什麼都不假設——每一對都是注意力的候選。所以 transformer 要更多資料才訓練得好，但一旦有了資料就縮放得更遠。Chinchilla（2022）把這件事形式化：token 夠多時，transformer 永遠打贏參數（parameter）數量相同的 RNN。

```figure
rnn-vs-parallel
```

## Build It｜動手實作

這裡沒有神經網路（neural network）——我們用數值模擬核心瓶頸，讓你在自己的筆電上感覺到落差。

### 步驟 1：量循序計算深度

見 `code/main.py`。我們做兩個函式。一個把序列編成一條加法鏈（循序，像 RNN）。一個編成平行的歸約（廣播，像注意力）。數學一樣，依賴圖不同。

```python
def rnn_style(xs):
    h = 0.0
    for x in xs:
        h = 0.9 * h + x   # can't parallelize: h depends on previous h
    return h

def attention_style(xs):
    return sum(xs) / len(xs)  # every x is independent
```

我們在最多 10 萬個元素的序列上計時。RNN 版是 O(N)，而且是單一條 CPU 管線（pipeline）。就算在純 Python 裡，注意力風格的歸約在長度 ≥ 1000 時就贏過它，因為 Python 的 `sum()` 用 C 實作，逐步迭代時沒有直譯器的額外負擔。

### 步驟 2：數理論上的運算

兩個演算法（algorithm）都做 N 次加法。差別是*依賴深度*：下一個能開始之前，必須循序發生多少運算。RNN 的深度 = N。注意力的深度，樹狀歸約是 log(N)，平行掃描是 1。決定 GPU 時間的是深度，不是運算次數。

### 步驟 3：長序列上的實測縮放

我們印一張計時表，讓 O(N) 的落差看得見。在 2026 年的 Mac 筆電上，少於 1000 個元素的序列快到量不到。10 萬的序列呈現乾淨的線性掃描。把它放大成 16384 個 token、相當於 12 層 LSTM 的 transformer，你就看到為什麼 2016 年訓練的實際耗時是阻礙。

## Use It｜實際應用

2026 年什麼時候仍然選 RNN：

| 情境 | 選 |
|-----------|------|
| 串流推論（inference），一次一個 token，記憶體固定 | RNN 或狀態空間模型（Mamba、RWKV） |
| 非常長的序列（超過 100 萬 token），注意力記憶體會爆 | 線性注意力、Mamba 2、Hyena |
| 沒有矩陣乘法加速器的邊緣裝置（device） | 深度可分離的 RNN 在每瓦 FLOPs 上仍然贏 |
| 其他（訓練、批次推論、脈絡到 12.8 萬） | Transformer |

狀態空間模型（SSM），像 Mamba，本質上是帶結構化參數化的 RNN，兩邊的好處都有：`O(N)` 的掃描記憶體，用選擇性掃描做平行訓練。它們用更好的長脈絡縮放，找回 transformer 品質的 90%。2026 年大多數前沿實驗室訓練混合的 SSM 加 transformer 模型（例如 Jamba、Samba）——循環架構並未消失，而是成為組成元件（component）之一。

## Ship It｜交付成果

見 `outputs/skill-architecture-picker.md`。這個 skill 依長度、吞吐量、訓練預算，為新的序列問題挑架構。訓練超過 10 億個 token 時，它應該永遠拒絕推薦純 RNN，除非把取捨講出來。

## Exercises｜練習

1. **簡單。** 從 `code/main.py` 拿 `rnn_style`，把純量隱藏狀態換成長度 64 的隱藏狀態向量。再量一次。循序負擔隨隱藏狀態的維度（dimension）成長多少？
2. **中等。** 用純 Python 實作平行前綴和（Hillis-Steele scan）。在長度 1024 上驗證它和循序掃描的數值輸出一樣。數深度。
3. **困難。** 把注意力風格的歸約移植到 GPU 上的 PyTorch。序列長度從 64 掃到 65536，兩邊都計時。畫出來，並解釋曲線的形狀。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 循環 | 「RNN 是循序的」 | 步驟 `t` 依賴步驟 `t-1`，迫使沿著時間軸循序執行。 |
| 循序計算深度 | 「圖有多深」 | 相依運算裡最長的那條鏈；就算硬體無限，實際耗時也被它卡住。 |
| 注意力 | 「讓 token 互相看」 | 加權和 `sum_j a_ij v_j`，其中 `a_ij` 來自位置 i 和 j 的相似度。 |
| 脈絡視窗（context window） | 「模型看得到多少」 | 一層注意力能當成輸入的位置數；二次方的記憶體成本在這裡縮放。 |
| 歸納偏差 | 「烤進架構裡的假設」 | 關於資料長什麼樣的先驗；CNN 假設平移不變，RNN 假設近期性。 |
| 狀態空間模型 | 「背後有代數的 RNN」 | 為了用結構化狀態空間矩陣做平行訓練而參數化的循環。 |
| 二次方瓶頸 | 「為什麼脈絡這麼貴」 | 注意力記憶體 = `O(N²)`（以序列長度計）；Flash Attention 藏的是常數，不是縮放。 |

## Further Reading｜延伸閱讀

- [Vaswani et al. (2017). Attention Is All You Need](https://arxiv.org/abs/1706.03762) ——在主流 NLP 裡終結循環的那篇論文。
- [Bahdanau, Cho, Bengio (2014). Neural MT by Jointly Learning to Align and Translate](https://arxiv.org/abs/1409.0473) ——注意力誕生的地方，當時是栓在 RNN 上。
- [Hochreiter, Schmidhuber (1997). Long Short-Term Memory](https://www.bioinf.jku.at/publications/older/2604.pdf) ——原始的 LSTM 論文，留個紀錄。
- [Gu, Dao (2023). Mamba: Linear-Time Sequence Modeling with Selective State Spaces](https://arxiv.org/abs/2312.00752) ——對 transformer 的現代循環回答。
