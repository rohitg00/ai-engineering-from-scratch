# 從零做一個 transformer——總驗收

> 十三課。一個模型。沒有捷徑。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 01 through 13. Don't skip.
**Time:** ~120 minutes

## The Problem｜問題

你每篇論文都讀了。注意力、多頭切分、位置編碼、編碼器和解碼器區塊、BERT 和 GPT 的損失（loss）、MoE、KV cache，你都實作過。現在讓它們在一個真實任務上一起工作。

總驗收：在字元級的語言建模（language modeling）任務上，端到端（end-to-end）訓練一個小的、只有解碼器的 transformer。它讀莎士比亞。它生成新的莎士比亞。小到在筆電上不到 10 分鐘就能訓練。正確到你換上更大的資料集（dataset）、訓練更久，就會得到真正的語言模型。

這是這門課的「nanoGPT」。它不是原創——Karpathy 2023 年的 nanoGPT 教學是每個學生至少寫一次的參考實作。我們沿用它的架構，再依本課講過的內容調整。

## The Concept｜核心概念

![Transformer-from-scratch block diagram](../assets/capstone.svg)

架構，加上註記：

```
input tokens (B, N)
   │
   ▼
token embedding + positional embedding  ◀── Lesson 04 (RoPE option)
   │
   ▼
┌──── block × L ────────────────────┐
│  RMSNorm                          │  ◀── Lesson 05
│  MultiHeadAttention (causal)      │  ◀── Lesson 03 + 07 (causal mask)
│  residual                         │
│  RMSNorm                          │
│  SwiGLU FFN                       │  ◀── Lesson 05
│  residual                         │
└────────────────────────────────── ┘
   │
   ▼
final RMSNorm
   │
   ▼
lm_head (tied to token embedding)
   │
   ▼
logits (B, N, V)
   │
   ▼
shift-by-one cross-entropy            ◀── Lesson 07
```

### 我們交付什麼

- `GPTConfig`——一個地方設定全部超參數（hyperparameter）。
- `MultiHeadAttention`——因果、有批次（batch）、可選 Flash 風格路徑（PyTorch 的 `scaled_dot_product_attention`）。
- `SwiGLUFFN`——現代 FFN。
- `Block`——先做正規化（pre-norm），殘差（residual）包住注意力加 FFN。
- `GPT`——embedding、堆起來的區塊、LM head、generate()。
- 訓練迴圈（training loop），用 AdamW、餘弦學習率、梯度裁剪（gradient clipping）。
- 莎士比亞文本上的字元級 tokenizer。

### 我們不交付什麼

- RoPE——第 04 課概念上實作過。這裡為了單純，用學來的位置 embedding。練習要你換成 RoPE。
- 生成時的 KV cache——每一步生成都對整個前綴重算注意力。較慢但較單純。練習要你加 KV cache。
- Flash Attention——PyTorch 2.0 以上在輸入對得上時會自動分派；我們用 `F.scaled_dot_product_attention`。
- MoE——每個區塊一個 FFN。你在第 11 課看過 MoE。

### 目標指標

在 Mac M2 筆電上，4 層、4 頭、d_model = 128 的 GPT，在 `tinyshakespeare.txt` 上訓練 2,000 步：

- 訓練損失從大約 4.2（隨機）降到大約 1.5，耗時約 6 分鐘。
- 抽出的輸出有莎士比亞的形狀：古詞、換行、像「ROMEO:」的專名會出現。
- 驗證損失（validation loss，留出的最後 10% 文本）與訓練損失相近；這個大小和預算沒有過擬合（overfitting）。

```figure
n5-block-stack
```

## Build It｜動手實作

這一課用 PyTorch。安裝 `torch`（CPU 版就行）。見 `code/main.py`。腳本會執行以下工作：

- 缺了就下載 `tinyshakespeare.txt`（或讀本地副本）。
- 位元組級（byte-level）的字元 tokenizer。
- 訓練／驗證以 90／10 切開。
- 支援的硬體上用 bf16 autocast 的訓練迴圈。
- 訓練完之後取樣。

### 步驟 1：資料

```python
text = open("tinyshakespeare.txt").read()
chars = sorted(set(text))
stoi = {c: i for i, c in enumerate(chars)}
itos = {i: c for c, i in stoi.items()}
encode = lambda s: [stoi[c] for c in s]
decode = lambda xs: "".join(itos[x] for x in xs)
```

65 個不重複字元。很小的詞彙。vocab_size 用 4 個位元組就裝得下。沒有 BPE，也不需要複雜的 tokenizer。

### 步驟 2：模型

見 `code/main.py`。區塊是第 05 課的教科書版本——先做正規化、RMSNorm、SwiGLU、因果 MHA。4／4／128 的參數（parameter）數量：大約 80 萬。

### 步驟 3：訓練迴圈

拿一個長度 256 的 token 視窗（window）隨機批次。前向傳遞。目標序列向後位移一格後算交叉熵（cross-entropy）。反向傳遞。AdamW 一步。記日誌。重複。

```python
for step in range(max_steps):
    x, y = get_batch("train")
    logits = model(x)
    loss = F.cross_entropy(logits.view(-1, vocab_size), y.view(-1))
    loss.backward()
    torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
    opt.step()
    opt.zero_grad()
```

### 步驟 4：取樣

給一個 prompt，反覆做前向傳遞，用 top-p 從 logits 取樣，接上去，繼續。500 個 token 後停。

### 步驟 5：讀輸出

2,000 步之後：

```
ROMEO:
Away and mild will not thy friend, that thou shalt wit:
The chief that well shame and hath been his friends,
...
```

不是莎士比亞。但是莎士比亞的形狀。大約 80 萬參數、筆電上 6 分鐘，這是明確的成果。

## Use It｜實際應用

這個總驗收是一套參考架構。要把它發展成實際應用，有三個延伸：

1. **換 tokenizer。** 用 BPE（例如 `tiktoken.get_encoding("cl100k_base")`）。詞彙從 65 跳到大約 5 萬。模型容量（capacity）得放大來補。
2. **在更大的語料庫（corpus）上訓練。** 用 `OpenWebText` 或 `fineweb-edu`（HuggingFace）。單張 A100 上 100 億 token，1.25 億參數的 GPT 大約要 24 小時。
3. **加上 RoPE、KV cache、Flash Attention。** 下面的練習帶你一個一個做。

最終會得到一個 1.25 億參數的 GPT，生成流暢英文。不是前沿模型。但同一條程式路徑——只是更大——就是 Karpathy、EleutherAI、Allen Institute 在 2026 年拿來訓練研究檢查點（checkpoint）的東西。

## Ship It｜交付成果

見 `outputs/skill-transformer-review.md`。這個 skill 依前面 13 課，審查一個從零做的 transformer 實作是否正確。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。確認訓練好的模型最後一步驗證損失低於 2.0。把 `max_steps` 從 2,000 改成 5,000——驗證損失還會繼續改善嗎？
2. **中等。** 把學來的位置 embedding 換成 RoPE。在 `MultiHeadAttention` 裡對 Q 和 K 做旋轉。訓練並確認驗證損失至少一樣低。
3. **中等。** 在取樣迴圈裡實作 KV cache。有快取和沒快取各生成 500 個 token。筆電上實際時間應該快 5 到 20 倍。
4. **困難。** 給模型加第二個頭，預測再下一個 token，也就是 DeepSeek-V3 的多 token 預測（Multi-Token Prediction，MTP）。一起訓練。有幫助嗎？
5. **困難。** 把每個區塊的單一 FFN 換成 4 個專家的 MoE。路由器加 top-2 路由。在活躍參數對上的情況下，看驗證損失怎麼變。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| nanoGPT | 「Karpathy 的教學 repo」 | 最小的只有解碼器 transformer 訓練程式，大約 300 行；標準參考。 |
| tinyshakespeare | 「標準玩具語料庫」 | 大約 1.1 MB 的文本；2015 年以來每個字元語言模型教學都用它。 |
| 綁定的 embedding | 「共用輸入／輸出矩陣」 | LM head 的權重等於 token embedding 矩陣的轉置；省參數，品質更好。 |
| bf16 autocast | 「訓練精度的手法」 | 前向傳遞和反向傳遞用 bf16，調校器狀態留在 fp32；自 2021 年以來的標準做法。 |
| 梯度裁剪 | 「擋住尖峰」 | 把全域梯度範數頂在 1.0；防止訓練爆掉。 |
| 餘弦學習率排程（learning-rate schedule） | 「2020 年之後的預設」 | 學習率先線性爬升，這段叫預熱（warmup），再依餘弦形狀衰到峰值的 10%。 |
| MFU | 「模型 FLOP 利用率」 | 達到的 FLOPs 除以理論峰值；2026 年稠密 40%、MoE 30% 就算強。 |
| 驗證損失 | 「留出的損失」 | 模型沒看過的資料上的交叉熵；過擬合偵測器。 |

## Further Reading｜延伸閱讀

- [The Annotated Transformer (Harvard NLP)](https://nlp.seas.harvard.edu/annotated-transformer/) ——經典的註解實作。
