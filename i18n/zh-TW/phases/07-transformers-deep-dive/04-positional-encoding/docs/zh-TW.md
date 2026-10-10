# 位置編碼（positional encoding）——正弦、RoPE、ALiBi

> 注意力具有排列不變性。「The cat sat on the mat」和「mat the on sat cat the」沒有位置訊號時，會得到同一個輸出。三個演算法（algorithm）修這個——各自對「位置」是什麼下不同的賭注。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 03 (Multi-Head Attention)
**Time:** ~45 minutes

## The Problem｜問題

縮放點積注意力不感知順序。注意力矩陣 `softmax(Q K^T / √d) V` 由成對相似度算出。把 `X` 的列打亂，輸出的列也以同樣方式打亂。注意力內部沒有任何東西在乎位置。

這在詞袋（bag of words）模型裡不是 bug。對語言、程式碼、音訊、影片——任何順序帶有意義的東西——它是致命的。

解法是設法把位置資訊注入 embedding。三個時代的答案：

1. **絕對正弦**（Vaswani 2017）。把位置的 `sin/cos` 加到 embedding 上。簡單、不用學習、訓練長度之外的外插（extrapolation）很差。
2. **RoPE（Rotary Position Embedding）**（Su 2021）。把 Q 和 K 向量轉一個和位置成正比的角度。在內積（dot product）裡直接編碼*相對*位置。2026 年的主流。
3. **ALiBi——帶線性偏置（bias）的注意力**（Press 2022）。完全跳過 embedding；依距離，給注意力分數（attention score）加上每個頭的線性懲罰。長度外插非常好。

到 2026 年，前沿的開放模型基本上都用 RoPE：Llama 2/3/4、Qwen 2/3、Mistral、Mixtral、DeepSeek-V3、Kimi。少數長脈絡模型用 ALiBi 或它的現代變體。絕對正弦是歷史。

## The Concept｜核心概念

![Sinusoidal absolute vs RoPE rotations vs ALiBi distance bias](../assets/positional-encoding.svg)

### 絕對正弦

預先算好固定矩陣 `PE`，形狀 `(max_len, d_model)`：

```
PE[pos, 2i]   = sin(pos / 10000^(2i / d_model))
PE[pos, 2i+1] = cos(pos / 10000^(2i / d_model))
```

然後在注意力之前做 `X' = X + PE[:N]`。每個維度（dimension）是不同頻率的正弦。模型學會從相位模式讀位置。超過 `max_len` 就失敗：模型只看過位置 0 到 2047 時，沒有人告訴它位置 2048 會發生什麼。

### RoPE

旋轉 Q 和 K 向量（不是 embedding）。對一對維度 `(2i, 2i+1)`：

```
[q'_2i    ]   [ cos(pos·θ_i)  -sin(pos·θ_i) ] [q_2i   ]
[q'_2i+1  ] = [ sin(pos·θ_i)   cos(pos·θ_i) ] [q_2i+1 ]

θ_i = base^(-2i / d_head),  base = 10000 by default
```

對鍵也套上同一個旋轉，位置是 `pos_k`。內積 `q'_m · k'_n` 變成只跟 `(m - n)` 有關的函式。也就是：**注意力分數只依賴相對距離**，雖然旋轉是依絕對位置來轉的。巧妙的作法。

延伸 RoPE：可以縮放 `base`（NTK-aware、YaRN、LongRoPE），不用重新訓練就外插到更長的脈絡。Llama 3 就是這樣從 8000 延伸到 12.8 萬脈絡。

### ALiBi

跳過 embedding 這條路。直接為注意力分數加入偏置：

```
attn_score[i, j] = (q_i · k_j) / √d  -  m_h · |i - j|
```

其中 `m_h` 是每個頭自己的斜率（例如 `1 / 2^(8·h/H)`）。較近的 token 的注意力分數會被提高；較遠的則受到懲罰。訓練時沒有額外成本。論文顯示，長度外插打贏正弦，並在原本的訓練長度上打平 RoPE。

### 2026 年選哪個

| 變體 | 外插 | 訓練成本 | 誰在用 |
|---------|---------------|---------------|---------|
| 絕對正弦 | 差 | 免費 | 原始 transformer、早期 BERT |
| 學來的絕對位置 | 沒有 | 很小 | GPT-2、GPT-3 |
| RoPE | 搭配縮放就好 | 免費 | Llama 2/3/4、Qwen 2/3、Mistral、DeepSeek-V3、Kimi |
| RoPE 加 YaRN | 非常好 | fine-tune 階段 | Qwen2-1M、Llama 3.1 128K |
| ALiBi | 非常好 | 免費 | BLOOM、MPT、Baichuan |

RoPE 贏，是因為它接進注意力而不改架構、編碼相對位置（relative position），而且它的 `base` 超參數（hyperparameter）給長脈絡 fine-tuning 一個乾淨的旋鈕。

```figure
rope-explorer
```

## Build It｜動手實作

### 步驟 1：正弦編碼

見 `code/main.py`。4 行的計算：

```python
def sinusoidal(N, d):
    pe = [[0.0] * d for _ in range(N)]
    for pos in range(N):
        for i in range(d // 2):
            theta = pos / (10000 ** (2 * i / d))
            pe[pos][2 * i]     = math.sin(theta)
            pe[pos][2 * i + 1] = math.cos(theta)
    return pe
```

把這個加到第一層注意力之前的 embedding 矩陣上。

### 步驟 2：把 RoPE 套到 Q、K

RoPE 在 Q 和 K 上原地運作。對每一對維度：

```python
def apply_rope(x, pos, base=10000):
    d = len(x)
    out = list(x)
    for i in range(d // 2):
        theta = pos / (base ** (2 * i / d))
        c, s = math.cos(theta), math.sin(theta)
        a, b = x[2 * i], x[2 * i + 1]
        out[2 * i]     = a * c - b * s
        out[2 * i + 1] = a * s + b * c
    return out
```

關鍵：同一個函式，Q 用在位置 `m`，K 用在位置 `n`。它們的內積在每一對座標上帶進一個 `cos((m-n)·θ_i)` 因子。注意力不用額外成本就學會相對位置。

### 步驟 3：ALiBi 的斜率與偏置

```python
def alibi_bias(n_heads, seq_len):
    # slope_h = 2 ** (-8 * h / n_heads) for h = 1..n_heads
    slopes = [2 ** (-8 * (h + 1) / n_heads) for h in range(n_heads)]
    bias = []
    for m in slopes:
        row = [[-m * abs(i - j) for j in range(seq_len)] for i in range(seq_len)]
        bias.append(row)
    return bias  # add to attention scores before softmax
```

把 `bias[h]` 加到頭 `h` 的 `(seq_len, seq_len)` 注意力分數矩陣上，再做 softmax。

### 步驟 4：驗證 RoPE 的相對距離性質

拿兩個隨機向量 `a, b`。先用 `(pos_a, pos_b)` 旋轉。再用 `(pos_a + k, pos_b + k)` 旋轉。兩個內積必須在浮點（floating-point）誤差內相符。這個性質就是 RoPE 的全部重點——它對絕對偏移不變，只有相對差距要緊。

## Use It｜實際應用

PyTorch 2.5 起在 `torch.nn.functional` 裡附了 RoPE 工具。大多數正式環境（production）程式在 `flash_attn` 或 `xformers` 裡用 RoPE，而且是做在注意力核（kernel）裡面。

```python
from transformers import AutoModel
model = AutoModel.from_pretrained("meta-llama/Llama-3.2-3B")
# model.config.rope_scaling → {"type": "yarn", "factor": 32.0, "original_max_position_embeddings": 8192}
```

**2026 年的長脈絡手法：**

- **NTK-aware 內插。** 從 4000 延伸到 1.6 萬以上時，把 `base` 重縮放成 `base * (scale_factor)^(d/(d-2))`。
- **YaRN。** 更聰明的內插，在長脈絡上保住注意力熵（entropy）。Llama 3.1 的 12.8 萬用的就是它。
- **LongRoPE。** Microsoft 2024 的方法，用演化搜尋挑每個維度的縮放因子。Phi-3-Long 用它。
- **位置內插加 fine-tuning。** 就把位置按延伸倍率縮小，再用 10 億到 50 億個 token 做 fine-tuning。意外地有效。

## Ship It｜交付成果

見 `outputs/skill-positional-encoding-picker.md`。這個 skill 依目標脈絡長度、外插需求、訓練預算，為新模型挑編碼策略。

## Exercises｜練習

1. **簡單。** 把正弦 `PE` 矩陣畫成熱圖，`max_len=512, d=128`。確認「維度索引變大，條紋變寬」的模式。
2. **中等。** 實作 NTK-aware 的 RoPE 縮放。在長度 256 的序列上訓練一個小語言模型，再在長度 1024 上測有縮放和沒縮放。量困惑度（perplexity）。
3. **困難。** 在同一個注意力模組裡實作 ALiBi 和 RoPE。在長度 512 的複製任務上訓練一個 4 層 transformer。測試時外插到 2048。比較退化。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 位置編碼 | 「告訴注意力順序」 | 任何加到 embedding 或注意力上、用來編碼位置的訊號。 |
| 正弦 | 「最早的那個」 | 幾何頻率的 `sin/cos` 加到 embedding 上；不會外插。 |
| RoPE | 「旋轉 embedding」 | 依位置相關的角度旋轉 Q、K；內積編碼相對距離。 |
| ALiBi | 「線性偏置的手法」 | 把 `-m·\|i-j\|` 加到注意力分數上；不需要 embedding，外插很好。 |
| base | 「RoPE 的旋鈕」 | RoPE 裡的頻率縮放器；加大它，推論（inference）時就能延伸脈絡。 |
| NTK-aware | 「一種 RoPE 縮放手法」 | 重縮放 `base`，讓脈絡變長時高頻維度不被擠扁。 |
| YaRN | 「花俏的那個」 | 每個維度的內插加外插，保住注意力熵。 |
| 外插 | 「訓練長度之外也行」 | 位置方案能不能在訓練時看過的 `max_len` 之後，仍然給出正確輸出？ |

## Further Reading｜延伸閱讀

- [Vaswani et al. (2017). Attention Is All You Need §3.5](https://arxiv.org/abs/1706.03762) ——原始的正弦。
- [Su et al. (2021). RoFormer: Enhanced Transformer with Rotary Position Embedding](https://arxiv.org/abs/2104.09864) ——RoPE 論文。
- [Press, Smith, Lewis (2021). Train Short, Test Long: Attention with Linear Biases Enables Input Length Extrapolation](https://arxiv.org/abs/2108.12409) ——ALiBi。
- [Peng et al. (2023). YaRN: Efficient Context Window Extension of Large Language Models](https://arxiv.org/abs/2309.00071) ——當時 RoPE 縮放的前沿。
- [Chen et al. (2023). Extending Context Window of Large Language Models via Positional Interpolation](https://arxiv.org/abs/2306.15595) ——Meta 的 Llama 2 長脈絡論文。
- [Ding et al. (2024). LongRoPE: Extending LLM Context Window Beyond 2 Million Tokens](https://arxiv.org/abs/2402.13753) ——Phi-3-Long 用的、實際應用節也引到的 Microsoft 方法。
- [HuggingFace Transformers — `modeling_rope_utils.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/modeling_rope_utils.py) ——每一種 RoPE 縮放方案的生產級實作（預設、線性、動態、YaRN、LongRoPE、Llama-3）。
