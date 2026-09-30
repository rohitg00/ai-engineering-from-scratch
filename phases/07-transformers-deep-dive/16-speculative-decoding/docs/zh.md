# 推測式解碼 —— 起草、驗證、再來一輪

> 自迴歸解碼是序列式的，每個詞元都得等前一個。推測式解碼把這條鏈打斷：便宜的模型起草 N 個詞元，貴的模型用一次前向傳播驗證全部 N 個。草稿猜對時，你就用一次大模型的前向傳播換到了 N 次生成。

**類型：** 實作
**程式語言：** Python
**先修單元：** 階段 7 · 07（GPT 因果語言建模）、階段 7 · 12（KV 快取與 Flash Attention）
**時間：** 約 60 分鐘

## 問題所在

一個 70B 的 LLM 在 H100 上取樣一個詞元約需 30 毫秒，3B 的草稿模型約需 3 毫秒。如果讓 3B 往前起草 5 個詞元，再跑 70B *一次*把這 5 個全部驗證掉，最多 5 個被接受的詞元總共花 `5×3 + 30 = 45 ms` —— 相較於直線生成的 `5×30 = 150 ms`。這就是推測式解碼完整的賣點：用一點額外的 GPU 記憶體（草稿模型），換到 2 到 4 倍更低的解碼延遲。

這招必須保住分布。推測式取樣由 Leviathan 等人（2023）與同期的 Chen 等人提出，能保證輸出序列與大模型自己生成的結果**同分布**。品質不打折，只是更快。

2026 年的推論界由四類草稿與驗證模型的組合主導：

1. **原味推測式（Leviathan 2023）。** 獨立的草稿模型（例如 Llama 3 1B）+ 驗證模型（例如 Llama 3 70B）。
2. **Medusa（Cai 2024）。** 在驗證模型上加多個解碼頭，平行預測 `t+1..t+k` 位置。不需要另一個草稿模型。
3. **EAGLE 家族（Li 2024、2025）。** 輕量的草稿模型，重用驗證模型的隱藏狀態；接受率比原味更接近，典型加速 3 到 4 倍。
4. **Lookahead decoding（Fu 2024）。** 用 Jacobi 迭代，完全不需要草稿模型，屬於自我推測。用途較窄，但不依賴任何額外元件。

2026 年每一套生產級推論堆疊都預設出貨推測式解碼。vLLM、TensorRT-LLM、SGLang 與 llama.cpp 至少都支援原味 + EAGLE-2。

## 核心概念

### 核心演算法

給定一個驗證模型 `M_q` 與一個較便宜的草稿模型 `M_p`：

1. 令 `x_1..x_k` 為已經解碼出來的前綴。
2. **起草**：用 `M_p` 自迴歸地提出 `d_{k+1}, d_{k+2}, ..., d_{k+N}`，並得到草稿機率 `p_1..p_N`。
3. **平行驗證**：拿 `x_1..x_k, d_{k+1}, ..., d_{k+N}` 跑 `M_q` 一次，取得位置 `k+1..k+N+1` 的驗證機率 `q_1..q_{N+1}`。
4. **由左到右逐個接受／拒絕草稿詞元**：對每個 `i`，以機率 `min(1, q_i(d_i) / p_i(d_i))` 接受。
5. 在位置 `j` 第一次被拒絕時：從正規化後的「殘差」分布 `(q_j - p_j)_+` 取樣出 `t_j`。`j` 之後的所有草稿一律丟棄。
6. 若 `N` 個全部被接受：再從 `q_{N+1}` 多取樣一個詞元 `t_{N+1}`（免費附贈的紅利詞元）。

殘差分布這一招，正是讓輸出分布與 `M_q` 從頭自己取樣時完全一致的數學關鍵。

### 加速幅度由什麼決定

令 `α` 為每個草稿詞元的期望接受率，`c` 為草稿模型與驗證模型的成本比。以每一步來看：

- 天真的生成方式，每個詞元要呼叫大模型一次。
- 推測式在 `α` 高的時候，每 `(1 - α^{N+1}) / (1 - α) ≈ 1/(1-α)` 個詞元才呼叫大模型一次。

`α = 0.75`、`N = 5` 時的典型經驗法則：大模型的呼叫次數少 3 倍。草稿成本便宜 5 倍。牆鐘時間總共降到約 1/2.5。

**α 取決於：**

- 草稿模型逼近驗證模型的程度。同一個家族／同一份訓練資料，會顯著推高 α。
- 解碼策略。貪婪草稿對貪婪驗證：α 高。溫度取樣：較難吻合，接受率會下降。
- 任務類型。程式碼與結構化輸出接受得多（可預測性高）；自由發揮的創意寫作接受得少。

### Medusa —— 不用草稿模型的草稿

Medusa 把草稿模型換成驗證模型上額外的輸出頭。在位置 `t`：

```
shared trunk → hidden h_t
    ├── head_0: predict token at t+1  (standard LM head)
    ├── head_1: predict token at t+2
    ├── head_2: predict token at t+3
    ├── head_3: predict token at t+4
```

每個頭輸出自己的 logits。推論時你從每個頭取樣，得到一條候選序列，再用一次前向傳播、搭配樹狀注意力機制一次考慮所有候選續寫來驗證。

優點：不需要第二個模型。缺點：多了可訓練參數；需要一個監督式微調階段（約 10 億詞元）；接受率比配上好草稿模型的原味推測式略低一些。

### EAGLE —— 重用隱藏狀態換到更好的草稿

EAGLE-1/2/3（Li 等人，2024 到 2025）把草稿模型做成一個極小的 transformer（通常只有一層），吃進驗證模型最後一層的隱藏狀態。因為草稿看得到驗證模型的特徵表示，它的預測與驗證模型的輸出分布高度相關。接受率從原味的約 0.6 爬到 0.85 以上。

EAGLE-3（2025）加上了對候選續寫的樹狀搜尋。vLLM 與 SGLang 出貨時，就把 EAGLE-2/3 當成 Llama 3/4 與 Qwen 3 的預設推測路徑。

### KV 快取的來回舞步

驗證會把 `N` 個草稿詞元一次餵進驗證模型的一趟前向傳播，這會讓驗證模型的 KV 快取多長出 `N` 筆。如果其中有些草稿被拒絕，你必須把快取回捲到被接受的前綴長度。

生產級實作（vLLM 的 `--speculative-config`、TensorRT-LLM 的 LookaheadDecoder）用暫存 KV 緩衝區處理這件事：先寫進去，接受了才提交。概念上不難，但很瑣碎。

```figure
draft-verify-tokens
```

## 動手實作

請看 `code/main.py`。我們會實作推測式取樣的核心演算法（拒絕步驟 + 殘差分布），內容包括：

- 一個「大模型」，它是對一組手寫分布做確定性 softmax（這樣我們才能用解析的方式驗證接受率的數學）。
- 一個「草稿模型」，它是大模型的一個擾動版本。
- 一個接受／拒絕迴圈，產生與直接取樣相同的邊際分布。

### 步驟 1：拒絕步驟

```python
def accept_or_reject(q_prob, p_prob, draft_token, u):
    ratio = q_prob / p_prob if p_prob > 0 else float("inf")
    return u < min(1.0, ratio)
```

`u` 是一個均勻隨機數。`q_prob` 是驗證模型給這個草稿詞元的機率，`p_prob` 是草稿模型的機率。Leviathan 定理說的是：這個伯努利決定，加上被拒絕時從殘差分布取樣，會完整保住驗證模型的分布。

### 步驟 2：殘差分布

```python
def residual_dist(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    return [r / s for r in raw]
```

把 `p` 從 `q` 逐項減掉，負值夾到零，再重新正規化。每次被拒絕時就從這個分布取樣。

### 步驟 3：一次推測式步驟

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

接受 5 個 → 加 1 個紅利 → 一趟驗證前向傳播產出 6 個詞元。

### 步驟 4：量測接受率

在不同草稿品質等級下跑 10,000 次推測式步驟。畫出接受率對草稿分布與驗證分布之間 KL 散度的關係。你應該會看到一條乾淨的單調關係。

### 步驟 5：驗證分布等價性

實證上：推測式迴圈產出的詞元直方圖，應該與直接從驗證模型取樣得到的直方圖吻合。這就是 Leviathan 定理的實務版本。卡方檢定會確認兩者差距落在取樣誤差內。

## 框架應用

生產環境：

```bash
# vLLM with EAGLE
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "eagle", "model": "/models/llama-3.1-eagle-70b", "draft_tensor_parallel_size": 1, "num_speculative_tokens": 5}'

# vLLM with vanilla draft model
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --speculative-config '{"method": "draft_model", "model": "meta-llama/Llama-3.2-1B-Instruct", "num_speculative_tokens": 5}'
```

到 2026 年中，TensorRT-LLM 擁有最快的 Medusa 路徑。`faster-whisper` 則為 Whisper-large 包好了搭配小型草稿模型的推測式解碼。

**怎麼挑草稿：**

| 策略 | 什麼時候選 | 加速幅度 |
|----------|--------------|---------|
| 原味草稿模型（Llama 家族 1B/3B） | 快速做原型，不必訓練 | 1.8 到 2.3 倍 |
| Medusa 頭 | 你有辦法微調驗證模型 | 2 到 3 倍 |
| EAGLE-2 / 3 | 生產環境、追求極速 | 3 到 4 倍 |
| Lookahead | 不用草稿、不用訓練、不加參數 | 1.3 到 1.6 倍 |

**什麼時候不要用推測式解碼：**

- 單一序列只要生成 1 到 5 個詞元。開銷會蓋過收益。
- 極度創意／高溫度的取樣（α 會掉）。
- 記憶體吃緊的部署（草稿模型會多佔 VRAM）。

## 產出交付

請看 `outputs/skill-spec-decode-picker.md`。這項技能會為一個新的推論工作負載挑選推測式解碼策略（原味／Medusa／EAGLE／lookahead）與調校參數（N、草稿溫度）。

## 練習

1. **簡單。** 執行 `code/main.py`。在 50,000 個詞元上確認推測式產生的詞元分布，與驗證模型直接取樣的分布在卡方檢定 p > 0.05 的範圍內吻合。
2. **中等。** 對 `α = 0.5, 0.7, 0.85`，把加速幅度（每次大模型前向傳播產出的詞元數）畫成 `N` 的函式。找出每個 α 的最佳 `N`。（提示：每次驗證呼叫的期望詞元數 = `(1 - α^{N+1}) / (1 - α)`。）
3. **困難。** 實作一個迷你 Medusa：拿單元 14 的總結專案 GPT，加上 3 個額外的 LM head 來預測 t+2、t+3、t+4 位置。用多頭聯合損失在 tinyshakespeare 上訓練。把接受率拿去跟「把同一個模型截斷做成的原味草稿」比較。
4. **困難。** 實作回捲：從一段 10 個詞元的前綴 KV 快取開始，餵進 5 個草稿詞元，模擬在位置 3 被拒絕。確認下一輪迭代時，你的快取讀出來正好等於「前綴 + 前 2 個被接受的草稿」。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|-----------------------|
| 草稿模型 | 「便宜的那個」 | 提出候選詞元的較小模型；通常比驗證模型便宜 10 到 50 倍。 |
| 驗證模型 | 「大的那個」 | 我們要保住其分布的目標模型；每次推測式步驟跑一次。 |
| 接受率（α） | 「草稿猜對的頻率」 | 驗證模型接受草稿的逐詞元機率。典型值 0.7 到 0.9。 |
| 殘差分布 | 「被拒絕時的退路」 | 正規化後的 `(q - p)_+`；被拒絕時從它取樣，能保住驗證模型的分布。 |
| 紅利詞元 | 「免費的那一個」 | N 個草稿全部被接受時，從驗證模型下一步的分布再取樣一個。 |
| Medusa | 「不用草稿模型的推測式」 | 在驗證模型上加多個 LM head，平行預測 t+1..t+k 位置。 |
| EAGLE | 「吃隱藏狀態的草稿」 | 以驗證模型最後一層隱藏狀態為條件的極小 transformer 草稿模型。 |
| Lookahead decoding | 「Jacobi 迭代」 | 用不動點迭代做自我推測；不需要草稿模型。 |
| 樹狀注意力 | 「一次驗證多個候選」 | 分枝式的樹狀驗證，同時考慮數條草稿續寫。 |
| KV 回捲 | 「撤銷被拒絕的草稿」 | 暫存 KV 緩衝區；接受就提交，拒絕就丟掉。 |

## 延伸閱讀

- [Leviathan, Kalman, Matias (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) —— 核心演算法與等價性定理。
- [Chen et al. (2023). Accelerating Large Language Model Decoding with Speculative Sampling](https://arxiv.org/abs/2302.01318) —— 同期提出；伯努利拒絕的證明很乾淨。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) —— Medusa 論文；樹狀注意力驗證。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) —— EAGLE-1；以隱藏狀態為條件的草稿模型。
- [Li et al. (2024). EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees](https://arxiv.org/abs/2406.16858) —— EAGLE-2；動態樹深度。
- [Li et al. (2025). EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test](https://arxiv.org/abs/2503.01840) —— EAGLE-3。
- [Fu et al. (2024). Break the Sequential Dependency of LLM Inference Using Lookahead Decoding](https://arxiv.org/abs/2402.02057) —— lookahead，不用草稿模型的做法。
- [vLLM docs — Speculative Decoding](https://docs.vllm.ai/en/latest/features/spec_decode.html) —— 生產環境的標準參考，四種策略都接好了。
- [SafeAILab / EAGLE reference implementation](https://github.com/SafeAILab/EAGLE) —— EAGLE-1/2/3 的參考程式碼。
