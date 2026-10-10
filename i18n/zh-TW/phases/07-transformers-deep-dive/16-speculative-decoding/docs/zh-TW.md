# 推測解碼（speculative decoding）——草稿、驗證、再來

> 自迴歸（autoregressive）解碼是序列的。每個 token 都得等待前一個 token。推測解碼把這條鏈拆開：便宜模型起草 N 個 token，大型模型一次前向傳遞驗證全部 N 個。草稿對的時候，你付一次大模型的前向傳遞，換 N 次生成。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 07 (GPT Causal LM), Phase 7 · 12 (KV Cache & Flash Attention)
**Time:** ~60 minutes

## The Problem｜問題

700 億的 LLM 在 H100 上抽一個 token 大約 30 ms。30 億的草稿模型大約 3 ms。如果讓 30 億先起草 5 個 token，再讓 700 億*跑一次*驗證全部 5 個，總共是 `5×3 + 30 = 45 ms`，最多 5 個被接受的 token——對上直線生成的 `5×30 = 150 ms`。這就是推測解碼的核心價值：多付一點 GPU 記憶體（memory）給草稿模型，換解碼延遲（latency）低 2 到 4 倍。

這個手法必須保住分布（distribution）。Leviathan 等人（2023）提出的推測取樣，以及 Chen 等人同時提出的版本，保證輸出序列的分布和大模型自己會產生的**完全相同**。沒有品質上的交換。只是更快。

2026 年的推論，由四類草稿－驗證器組合主導：

1. **原味推測（Leviathan 2023）。** 分開的草稿模型（例如 Llama 3 1B）加驗證器（例如 Llama 3 70B）。
2. **Medusa（Cai 2024）。** 驗證器上多個解碼頭，平行預測位置 `t+1..t+k`。沒有分開的草稿模型。
3. **EAGLE 家族（Li 2024、2025）。** 輕量草稿，重用驗證器的隱藏狀態（hidden state）；接受率比原味高；典型 3 到 4 倍。
4. **Lookahead 解碼（Fu 2024）。** Jacobi 迭代；完全不需要草稿模型。自己推測自己。小眾，但沒有額外依賴。

2026 年每一套正式環境（production）推論（inference）堆疊都預設出貨推測解碼。vLLM、TensorRT-LLM、SGLang、llama.cpp 至少都支援原味加 EAGLE-2。

## The Concept｜核心概念

### 核心演算法（algorithm）

給定驗證器 `M_q` 和更便宜的草稿 `M_p`：

1. 讓 `x_1..x_k` 是已經解出的前綴。
2. **草稿**：用 `M_p` 自迴歸地提出 `d_{k+1}, d_{k+2}, ..., d_{k+N}`，草稿機率是 `p_1..p_N`。
3. **平行驗證**：對 `x_1..x_k, d_{k+1}, ..., d_{k+N}` 跑一次 `M_q`，得到位置 `k+1..k+N+1` 的驗證器機率 `q_1..q_{N+1}`。
4. **由左到右接受或拒絕每個草稿 token**：對每個 `i`，以機率 `min(1, q_i(d_i) / p_i(d_i))` 接受。
5. 在位置 `j` 第一次被拒：從正規化（normalization）後的「殘差（residual）」分布 `(q_j - p_j)_+` 抽 `t_j`。`j` 之後的草稿全部丟掉。
6. 全部 `N` 個都接受：從 `q_{N+1}` 再抽一個額外 token `t_{N+1}`（免費的紅利 token）。

殘差分布這個手法，是讓輸出的分布精確等於 `M_q` 從頭取樣的數學洞見。

### 哪些因素決定加速比

令 `α` 是每個草稿 token 的期望接受率。令 `c` 是草稿模型相對驗證器的成本比。每一步：

- 單純（naive）生成，每個 token 呼叫一次大模型。
- 推測在 `α` 高的時候，每 `(1 - α^{N+1}) / (1 - α) ≈ 1/(1-α)` 個 token 呼叫一次大模型。

`α = 0.75`、`N = 5` 的經驗法則：大模型呼叫少到 3 分之一。草稿成本是便宜模型的 5 倍。實際時間大約降成 2.5 分之一。

**α 取決於：**

- 草稿與驗證器有多接近。使用相同模型家族與訓練資料，會明顯拉高 α。
- 解碼策略。貪婪（greedy）草稿對貪婪驗證器：α 高。溫度（temperature）取樣：較難匹配；接受率下降。
- 任務類型。程式碼和結構化輸出接受更多（可預測）；自由的創作寫作接受更少。

### Medusa——沒有草稿模型的草稿

Medusa 用驗證器上額外的輸出頭取代草稿模型。在位置 `t`：

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

每個頭輸出自己的 logits。推論時你從每個頭取樣，得到一條候選序列，再用樹狀注意力方案做一次前向傳遞驗證，一次考慮所有候選延續。

優點：沒有第二個模型。缺點：多了可訓練的參數（parameter）；需要一段監督式 fine-tuning（大約 10 億 token）；接受率比有好草稿的原味推測低一點。

### EAGLE——重用隱藏狀態，草稿更好

EAGLE-1／2／3（Li 等人，2024 到 2025）把草稿模型做成一個很小的 transformer（通常 1 層），吃驗證器最後一層的隱藏狀態。因為草稿看得到驗證器的特徵（feature）表示，它的預測和驗證器的輸出分布強烈相關。接受率從大約 0.6（原味）爬到 0.85 以上。

EAGLE-3（2025）加了候選延續上的樹搜尋。vLLM 和 SGLang 把 EAGLE-2／3 當成 Llama 3／4 和 Qwen 3 的預設推測路徑出貨。

### KV cache 的舞步

驗證時一次前向傳遞，就把 `N` 個草稿 token 送入驗證器。這把驗證器的 KV cache 延長 `N` 筆。如果有草稿被拒，你得把快取滾回已接受前綴的長度。

正式環境實作（vLLM 的 `--speculative-config`、TensorRT-LLM 的 LookaheadDecoder）用暫用的 KV 緩衝處理這件事。先寫，接受了才 commit。概念上不難，但很瑣碎。

```figure
draft-verify-tokens
```

## Build It｜動手實作

見 `code/main.py`。我們實作核心的推測取樣演算法（拒絕步驟加殘差分布），有：

- 「大模型」是手寫分布上的確定性 softmax，這樣我們可以解析地驗證接受的數學。
- 「草稿模型」是大模型的一個擾動。
- 接受／拒絕迴圈，產出的邊際分布和直接取樣相同。

### 步驟 1：拒絕步驟

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u` 是均勻隨機數。`q_prob` 是驗證器對被起草 token 的機率。`p_prob` 是草稿模型的機率。Leviathan 定理說，這個 Bernoulli 決定，加上被拒時從殘差取樣，精確保住驗證器的分布。

### 步驟 2：殘差分布

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

逐元素把 `q` 減掉 `p`，負值夾到零，再重新正規化。任何一次拒絕都從這裡抽。

### 步驟 3：一個推測步驟

```python
def spec_step(prefix, q_model, p_model, N, rng):
    drafts = []
    p_probs = []
    ctx = list(prefix)
    for _ in range(N):
        p_dist = p_model(ctx)
        d = sample(p_dist, rng)
        drafts.append(d)
        p_probs.append(p_dist[d])
        ctx.append(d)

    q_dists = [q_model(prefix + drafts[:i]) for i in range(N + 1)]

    for i, d in enumerate(drafts):
        u = rng.random()
        q_prob = q_dists[i][d]
        p_prob = p_probs[i]
        if u < min(1.0, q_prob / p_prob if p_prob > 0 else float("inf")):
            prefix = prefix + [d]
        else:
            res = residual_dist(q_dists[i], p_model(prefix))
            prefix = prefix + [sample(res, rng)]
            return prefix
    prefix = prefix + [sample(q_dists[N], rng)]
    return prefix
```

五個被接受，再加一個紅利，一次驗證器前向傳遞產出六個 token。

### 步驟 4：量接受率

在不同的草稿品質上跑 10,000 次推測步驟。畫接受率對草稿和驗證器分布之間的 KL 散度。你應該看到乾淨的單調關係。

### 步驟 5：驗證分布等價

實際上：推測迴圈產出的 token 直方圖，應該與直接從驗證器取樣的直方圖相符。這就是實務上的 Leviathan 定理。卡方檢定確認落在抽樣誤差裡。

## Use It｜實際應用

正式環境：

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "eagle", "model": "/models/llama-3.1-eagle-70b", "draft_tensor_parallel_size": 1, "num_speculative_tokens": 5}'

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'
```

TensorRT-LLM 到 2026 年中有最快的 Medusa 路徑。`faster-whisper` 用一個小草稿，幫 Whisper-large 包一層推測解碼。

**挑草稿：**

| 策略 | 何時選 | 加速比 |
|----------|--------------|---------|
| 原味草稿（Llama 家族的 10 億／30 億） | 快速原型，不用訓練 | 1.8 到 2.3 倍 |
| Medusa 頭 | 你能 fine-tune 驗證器 | 2 到 3 倍 |
| EAGLE-2／3 | 正式環境，要最快 | 3 到 4 倍 |
| Lookahead | 沒有草稿、沒有訓練、沒有額外參數 | 1.3 到 1.6 倍 |

**何時不要做推測解碼：**

- 1 到 5 個 token 的單序列生成。額外成本主導。
- 非常有創意、或高溫度的取樣（α 下降）。
- 記憶體緊的部署（deployment），因為草稿模型多占 VRAM。

## Ship It｜交付成果

見 `outputs/skill-spec-decode-picker.md`。這個 skill 為新的推論工作負載挑推測解碼策略（原味／Medusa／EAGLE／lookahead）和調參（N、草稿溫度）。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。確認 50,000 個 token 上，推測的 token 分布和驗證器直接取樣的分布對得上，卡方 p 大於 0.05。
2. **中等。** 畫加速比（每次大模型前向傳遞的 token 數）對 `N` 的函數，給 `α = 0.5, 0.7, 0.85`。找出每個 α 的最佳 `N`。（提示：每次驗證呼叫期望的 token 數 = `(1 - α^{N+1}) / (1 - α)`。）
3. **困難。** 實作一個小 Medusa：拿第 14 課的總驗收 GPT，加 3 個額外 LM head，預測位置 t+2、t+3、t+4。在 tinyshakespeare 上用聯合的多頭損失（loss）訓練。和把同一個模型截短做成的原味草稿比接受率。
4. **困難。** 實作回滾：從 10 個 token 的前綴 KV cache 開始，餵 5 個草稿 token，模擬在位置 3 被拒。確認下一輪你的快取讀出來，正確等於「前綴加前 2 個被接受的草稿」。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 草稿模型 | 「便宜的那個」 | 提出候選 token 的較小模型；通常比驗證器便宜 10 到 50 倍。 |
| 驗證器 | 「大的那個」 | 我們要保住其分布的目標模型；每個推測步驟跑一次。 |
| 接受率（α） | 「草稿多常是對的」 | 驗證器接受草稿的逐 token 機率。典型 0.7 到 0.9。 |
| 殘差分布 | 「被拒時的退路」 | 正規化後的 `(q - p)_+`；被拒時從這裡抽，保住驗證器的分布。 |
| 紅利 token | 「免費的那個」 | 全部 N 個草稿都接受時，再從驗證器下一步的分布抽一個。 |
| Medusa | 「沒有草稿模型的推測」 | 驗證器上多個 LM head 平行預測位置 t+1 到 t+k。 |
| EAGLE | 「用隱藏狀態的草稿」 | 很小的 transformer 草稿，條件是驗證器最後一層的隱藏狀態。 |
| Lookahead 解碼 | 「Jacobi 迭代」 | 用定點迭代自己推測自己；沒有草稿模型。 |
| 樹狀注意力 | 「一次驗證很多候選」 | 分岔的驗證，同時考慮好幾條草稿延續。 |
| KV 回滾 | 「把被拒的草稿撤掉」 | 暫存 KV 緩衝區；接受了才 commit，拒絕就丟掉。 |

## Further Reading｜延伸閱讀

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) ——核心演算法和等價定理。
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) ——同時提出的版本；乾淨的 Bernoulli 拒絕證明。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) ——Medusa 論文；樹狀注意力驗證。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) ——EAGLE-1；以隱藏狀態為條件的草稿。
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) ——EAGLE-2；動態的樹深度。
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) ——EAGLE-3。
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) ——Lookahead，沒有草稿的做法。
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) ——正式環境的標準參考，四種策略都接上了。
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) ——EAGLE-1／2／3 的參考程式。
