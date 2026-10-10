# GPT——因果語言模型（causal language modeling）

> BERT 看兩邊。GPT 只看過去。那個三角形遮罩，是現代 AI 裡影響最深遠的一行程式碼。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 06 (BERT)
**Time:** ~75 minutes

## The Problem｜問題

語言模型回答一個問題：給定前面 `t-1` 個 token，token `t` 上的機率分布（probability distribution）是什麼？在那個訊號上訓練——next-token prediction——你就得到一個模型，能一次一個 token 生成任意文字。

要在整段序列上端到端、平行地訓練，每個位置的預測只能依賴更早的位置。不然模型會偷看答案，輕易作弊。

因果遮罩（causal mask）做的就是這件事。它是單一個上三角矩陣，裡面是 `-inf`，在 softmax 之前加到注意力分數上。softmax 之後，那些位置變成 0。每個位置只能注意到自己和更早的位置。而且因為你對整段序列只套一次，一次前向傳遞就得到 N 個平行的 next-token prediction。

GPT-1（2018）、GPT-2（2019）、GPT-3（2020）、GPT-4（2023）、GPT-5（2025）、Claude、Llama、Qwen、Mistral、DeepSeek、Kimi——它們都是只有解碼器的因果 transformer，核心迴圈相同。分開它們的是資料品質、規模、架構上的改良，以及後訓練（SFT、RLHF、DPO，和它們的後繼）。

## The Concept｜核心概念

![Causal mask creates a triangular attention matrix](../assets/causal-attention.svg)

### 遮罩

給定長度 `N` 的序列，建一張 `N × N` 矩陣：

```
M[i, j] = 0       if j <= i
M[i, j] = -inf    if j > i
```

在 softmax 之前把 `M` 加到原始注意力分數上。`exp(-inf) = 0`，所以被遮住的位置貢獻零權重。注意力矩陣的每一列，都是只涵蓋先前位置的機率分布。

實作成本：一次 `torch.tril()` 呼叫。計算時間：奈秒。對這個領域的影響：全部。

### 三角形從哪來

遮罩通常被講成栓在注意力上的補丁。從反方向推導一遍，它就不再神秘：注意力是前綴平均（prefix averaging）的第三次精煉，三角形是那個平均的迴圈邊界，寫成矩陣。

**第 1 階段——前綴平均。** 一條序列最簡單的因果摘要：位置 `i` 變成位置 `0…i` 的平均數（mean）。寫成迴圈就是 `out[i] = X[:i+1].mean(0)`。同一個計算是一次矩陣乘法。取一張下三角的全 1 矩陣，每一列除以自己的個數，再乘：

```python
import numpy as np

A = np.tril(np.ones((n, n)))
A = A / A.sum(axis=1, keepdims=True)
out = A @ X
```

`A` 的第 `i` 列是 `[1/(i+1), …, 1/(i+1), 0, …, 0]`。對角上面的零就是因果性。未來不是被遮掉的；未來從頭就不在那個和裡面。

**第 2 階段——學來的權重。** 均勻平均把每個過去的 token 當成一樣要緊。把那些 1 換成學來的分數矩陣 `S`。現在列不再天然加總成 1，所以改用 softmax 正規化每一列，而不是除以個數。Softmax 永遠不會輸出精確的零，這會破壞因果性——除非未來的分數以 `-inf` 送進去，因為 `exp(-inf) = 0`：

```python
def softmax(x, axis):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)

S = S + np.triu(np.full((n, n), -np.inf), k=1)
A = softmax(S, axis=1)
out = A @ X
```

同一個三角形、同一個列隨機矩陣（row-stochastic matrix）、同一次矩陣乘法。`-inf` 遮罩不是新機制。它是第 1 階段的那些零，搬進 softmax 的輸入域。

**第 3 階段——隨內容而變的權重。** 第 2 階段裡，`S` 在訓練後是固定的：不管 token 說什麼，位置 7 對位置 3 的權重永遠一樣。讓分數依賴 token 本身：`S = Q @ K.T / sqrt(d_k)`。其他都不變。遮罩、softmax、矩陣乘法——一樣。

三個階段，一個不變量：下三角的列隨機矩陣乘上序列。均勻平均、學來的靜態權重、隨內容而變的權重。遮罩不是後來才外加到注意力機制的附屬物，而是從最初的因果平均一路延續下來的本質。

```figure
mask-derivation
```

### 平行訓練，串列推論（inference）

訓練：整段 `(N, d_model)` 序列前向傳遞一次，算 N 個交叉熵（cross-entropy）損失（每個位置一個），加總，反向傳播（backpropagation）。沿著序列平行。這就是 GPT 訓練縮放得起來的原因——一個 GPU 行程裡，一個批次（batch）處理 100 萬個 token。

推論：你一個 token 一個 token 生成。餵 `[t1, t2, t3]`，得到 `t4`。餵 `[t1, t2, t3, t4]`，得到 `t5`。餵 `[t1, t2, t3, t4, t5]`，得到 `t6`。KV 快取（第 12 課）存下 `t1…tn` 的隱藏狀態（hidden state），每一步就不用重算。但推論時的串列深度等於輸出長度。那就是自迴歸（autoregressive）帶來的代價，也是為什麼解碼是每個 LLM 的延遲（latency）瓶頸。

### 損失——往後移一位

給定 token `[t1, t2, t3, t4]`：

- 輸入：`[t1, t2, t3]`
- 目標：`[t2, t3, t4]`

每個位置 `i` 計算 `-log P(target_i | inputs[:i+1])`。加總。這就是整段序列的交叉熵。

你聽過的每個 transformer 語言模型都在這個損失上訓練。預訓練、fine-tuning、SFT——同一個損失，不同的資料。

### 解碼策略

訓練之後，取樣的選擇比大家想的更要緊。

| 方法 | 它做什麼 | 何時用 |
|--------|--------------|-------------|
| 貪婪 | 每一步取 argmax | 確定性任務、程式碼補完 |
| 溫度（temperature） | logits 除以 T，再取樣 | 創作任務，T 越高越多樣 |
| Top-k | 只從機率最高的 k 個 token 抽 | 砍掉低機率的尾巴 |
| Top-p（nucleus） | 從累積機率 ≥ p 的最小集合抽 | 2020 年之後的預設；會適應分布的形狀 |
| Min-p | 留下 `p > min_p * max_p` 的 token | 2024 年之後；比 top-p 更能拒掉長尾 |
| 推測解碼（speculative decoding） | 草稿模型提出 N 個 token，大模型驗證 | 同樣品質下快 2 到 3 倍 |

2026 年，min-p 加溫度 0.7 是開放權重模型的合理預設。推測解碼是任何正式環境（production）推論堆疊的基本功能。

### 什麼讓「GPT 配方」行得通

1. **只有解碼器。** 沒有編碼器的額外成本。每一層一次注意力加 FFN。
2. **縮放。** 1.24 億 → 15 億 → 1750 億 → 數兆。Chinchilla 縮放規律（第 13 課）告訴你運算怎麼花。
3. **上下文學習（in-context learning）。** 大約在 60 億到 130 億出現。模型能跟著少樣本（few-shot）例子走，不用 fine-tuning。
4. **RLHF。** 在人類偏好上做後訓練，把預訓練的原始文字變成聊天助理。
5. **Pre-norm 加 RoPE 加 SwiGLU。** 大規模時訓練得穩。

核心架構從 GPT-2 之後沒變多少。有趣的事都發生在資料、規模、和後訓練。

```figure
causal-mask
```

## Build It｜動手實作

### 步驟 1：因果遮罩

見 `code/main.py`。一行：

```python
def causal_mask(n):
    return [[0.0 if j <= i else float("-inf") for j in range(n)] for i in range(n)]
```

在 softmax 之前把它加到注意力分數上。整個機制就是這樣。

### 步驟 2：一個 2 層、有 GPT 味道的模型

疊兩個解碼器區塊（遮罩自注意力加 FFN，沒有交叉注意力）。加上 token embedding、位置編碼、和反 embedding（和 token embedding 矩陣綁在一起——GPT-2 之後的標準手法）。

### 步驟 3：端到端的 next-token prediction

在 20 個 token 的玩具詞彙上，每個位置產出 logits。對往後移一位的目標算交叉熵損失。沒有梯度——這是前向傳遞的健全檢查。

### 步驟 4：取樣

實作貪婪、溫度、top-k、top-p、min-p。在固定 prompt 上各跑一次，比較輸出。一個取樣函式是 10 行。

## Use It｜實際應用

PyTorch，2026 年的寫法：

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")
tok = AutoTokenizer.from_pretrained("meta-llama/Llama-3.2-3B-Instruct")

prompt = "Attention is all you need because"
inputs = tok(prompt, return_tensors="pt")
out = model.generate(
    **inputs,
    max_new_tokens=64,
    temperature=0.7,
    top_p=0.9,
    do_sample=True,
)
print(tok.decode(out[0]))
```

底層上，`generate()` 跑前向傳遞、抽出最後一個位置的 logits、抽出下一個 token、接上去、再重複。每一套正式環境的 LLM 推論堆疊（vLLM、TensorRT-LLM、llama.cpp、Ollama、MLX）都實作同一個迴圈，配上大量工程調校——批次預填、連續批次、KV 快取分頁、推測解碼。

**GPT 對 BERT，各一行：** GPT 預測 `P(x_t | x_{<t})`。BERT 預測 `P(x_masked | x_unmasked)`。損失決定這個模型能不能生成。

## Ship It｜交付成果

見 `outputs/skill-sampling-tuner.md`。這個 skill 為新的生成任務挑取樣參數，並在需要確定性解碼時標出來。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`，確認因果注意力矩陣在 softmax 之後是下三角。抽查：第 3 列的權重應該只在第 0 到 3 欄。
2. **中等。** 實作寬度 4 的集束搜尋（beam search）。在 10 個短 prompt 上比較 beam-4 和貪婪的困惑度（perplexity）。集束搜尋永遠贏嗎？（提示：翻譯通常會，開放式聊天通常不會。）
3. **困難。** 實作推測解碼：用一個小小的 2 層模型當草稿，6 層模型當驗證者。在 100 次、長度 64 的補完上量實際耗時的加速。確認輸出和驗證者的貪婪解碼相符。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 因果遮罩 | 「那個三角形」 | 加到注意力分數上的上三角 `-inf` 矩陣，讓位置 `i` 只看得到位置 `≤ i`。 |
| next-token prediction | 「那個損失」 | 模型分布對上每一個位置真正下一個 token 的交叉熵。 |
| 自迴歸 | 「一次生一個」 | 把輸出餵回當輸入；只有訓練時能平行，生成時不行。 |
| logits | 「softmax 之前的分數」 | LM 頭在 softmax 之前的原始輸出；取樣發生在這些分數上。 |
| 溫度 | 「創造力旋鈕」 | logits 除以 T；T 趨近 0 是貪婪，T 趨近無限是均勻。 |
| Top-p | 「核採樣」 | 把分布切到加總 ≥ p 的最小集合；從剩下的抽。 |
| Min-p | 「比 top-p 好」 | 留下 `p ≥ min_p × max_p` 的 token；截止點會適應分布有多尖。 |
| 推測解碼 | 「草稿加驗證」 | 便宜的模型提出 N 個 token；大模型平行驗證。 |
| teacher forcing | 「訓練手法」 | 訓練時餵真正的前一個 token，不是模型自己的預測。每個序列到序列的語言模型都這樣。 |

## Further Reading｜延伸閱讀

- [Radford et al. (2018). Improving Language Understanding by Generative Pre-Training](https://cdn.openai.com/research-covers/language-unsupervised/language_understanding_paper.pdf) ——GPT-1。
- [Radford et al. (2019). Language Models are Unsupervised Multitask Learners](https://cdn.openai.com/better-language-models/language_models_are_unsupervised_multitask_learners.pdf) ——GPT-2。
- [Brown et al. (2020). Language Models are Few-Shot Learners](https://arxiv.org/abs/2005.14165) ——GPT-3 和上下文學習。
- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) ——推測解碼論文。
- [HuggingFace `modeling_llama.py`](https://github.com/huggingface/transformers/blob/main/src/transformers/models/llama/modeling_llama.py) ——標準的因果語言模型參考程式。
