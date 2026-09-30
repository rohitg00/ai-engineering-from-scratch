# 推測式解碼與 EAGLE

> 前沿 LLM 每產生一個詞元，就得對數十億參數跑一次完整的前向傳播。這趟前向傳播嚴重供過於求：多數時候，一個小得多的模型就能猜對接下來 3 到 5 個詞元，大模型只需要*驗證*這個猜測。猜對的時候，你用一個詞元的代價拿到 5 個。推測式解碼（Leviathan 等人，2023）讓這件事變成精確的，而 EAGLE-3（2025）把接受率推到每次驗證約 4.5 個詞元 —— 在輸出分布不變的前提下加速 4 到 5 倍。

**類型：** 實作
**程式語言：** Python (with numpy)
**先修單元：** 階段 10 · 12（推論最佳化）、階段 10 · 04（預訓練 Mini-GPT）
**時間：** 約 75 分鐘

## 問題所在

70B 等級模型在 H100 上的解碼吞吐量，通常落在每秒 40 到 80 個詞元。每個詞元都要跑一次完整的前向傳播，把所有模型權重從 HBM 讀出來。你不能把模型改小，那會改變它的輸出；你也不能把 batch size 加大到超過記憶體。你被卡死了 —— 除非你能讓模型在一次前向傳播裡吐出不只一個詞元。

自迴歸生成看起來天生就是序列式的：`x_{t+1} = sample(p(· | x_{1:t}))`。但這裡有一個併行的機會。如果你有一個便宜的預測器告訴你「接下來 4 個詞元大概是 [a, b, c, d]」，你就能在**大模型的單一次前向傳播**裡驗證全部 5 個位置，並接受最長的吻合前綴。

Leviathan、Kalai、Matias（2023，"Fast Inference from Transformers via Speculative Decoding"）用一條巧妙的接受／拒絕規則讓這件事變得精確，而且保住驗證模型的取樣分布。同樣的輸出分布，快 2 到 4 倍。

## 核心概念

### 雙模型架構

- **驗證模型** `M_p`：又大又慢、品質高，也是你真正想要從中取樣的那個模型。分布為 `p(x)`。
- **草稿模型** `M_q`：小、快、品質較差。分布為 `q(x)`。小上 5 到 30 倍。

每一步：

1. 草稿模型自迴歸地提出 `K` 個詞元：`x_1, x_2, ..., x_K ~ q`。
2. 驗證模型用一次前向傳播平行處理全部 `K+1` 個位置，為每個被提出的詞元算出 `p(x_k)`。
3. 依下面那條改造過的拒絕取樣規則，由左往右逐一接受或拒絕。接受最長的吻合前綴。
4. 若有任何詞元被拒絕，就從修正後的分布取樣出替代詞元並停下。否則從 `p(· | x_1...x_K)` 取樣一個紅利詞元。

如果草稿與驗證模型完全吻合，每次驗證前向傳播就能拿到 K+1 個詞元。如果草稿在位置 1 就錯了，你只拿到 1 個。

### 精確性規則

推測式解碼**在分布上可證明等價於直接從 p 取樣**。拒絕規則是：

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

其中 `(p - q)+` 表示逐元素差值的正部。當草稿與驗證模型意見一致（`p ≈ q`）時，接受機率接近 1。當兩者不一致時，殘差分布的建構方式保證整體樣本仍然精確服從 `p`。

**貪婪情形。** temperature=0 的取樣只要檢查 `argmax(p) == x_t`。是就接受；不是就輸出 `argmax(p)` 並停下。

### 預期加速

若草稿模型的逐詞元接受率為 `α`，則每次驗證前向傳播的期望產出詞元數為：

```
E[tokens] = (1 - α^{K+1}) / (1 - α)        # K = draft length, α in [0, 1]
```

在 `α = 0.8, K = 4` 時：`(1 - 0.8^5)/(1 - 0.8) = 3.36`，每次前向傳播 3.36 個詞元。一次驗證前向傳播的成本大約是 `cost_q * K + cost_p`（K 步草稿加一次驗證）。若 `cost_p >> cost_q * K`，吞吐量的加速比就是 `3.36× / 1 = 3.36×`。

唯一真正的參數是 `α`，而它完全取決於草稿與驗證模型的對齊程度。好草稿就是一切。

### 訓練草稿：蒸餾

隨便抓一個小模型當草稿效果很差。標準做法是從驗證模型蒸餾：

1. 挑一個小架構（70B 驗證模型配約 1B，7B 驗證模型配約 500M）。
2. 在大型文字語料上跑驗證模型，把它的下一詞元分布存起來。
3. 用 KL 散度對著驗證模型的分布訓練草稿（不是對著真實標註詞元訓練）。

結果：`α` 在程式碼上通常 0.6 到 0.8，在自然語言聊天上 0.7 到 0.85。生產環境加速 2 到 3 倍。

### EAGLE：樹狀起草 + 特徵重用

Li、Wei、Zhang、Zhang（2024，"EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"）注意到標準推測式解碼裡的兩處低效：

1. 草稿要跑 K 個序列步驟，每一步都是完整堆疊。但草稿其實可以重用驗證模型在最近一次驗證裡算出的特徵（隱藏狀態）—— 驗證模型早就算好了豐富的表徵，草稿卻在從零重新推導一遍。
2. 草稿輸出的是一條線性鏈。如果草稿能輸出一*棵*候選樹（每個節點多個猜測），驗證模型的單一次前向傳播就能透過樹狀注意力遮罩平行驗證多條候選路徑，再挑出被接受的最長分支。

EAGLE-1 的改動：

- 草稿輸入 = 驗證模型在位置 t 的最後一層隱藏狀態，而不是原始詞元。
- 草稿架構 = 1 層 transformer 解碼器層（不是另一個獨立的小模型）。
- 輸出 = 每層深度 K = 4 到 8 個候選的樹，深度 4 到 6。

EAGLE-2（2024）加上動態樹狀拓樸：草稿不確定的地方樹長得寬，有把握的地方保持窄。在不增加驗證成本的前提下拉高 `α_effective`。

EAGLE-3（Li 等人，2025，"EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"）拿掉了對固定頂層特徵的依賴，並改用一種新的「測試時模擬」損失來訓練草稿 —— 草稿是在吻合驗證模型測試時分布的輸出上訓練的，而不是在 teacher-forced 的訓練分布上。接受率從 0.75（EAGLE-2）升到 0.82（EAGLE-3），每次驗證的平均詞元數從 3.0 升到 4.5。

### 樹狀注意力驗證

當草稿輸出一棵樹，驗證模型會用一張**樹狀注意力遮罩**在單一次前向傳播裡驗證它 —— 那是一張編碼樹狀拓樸而非純粹單線的因果遮罩。每個詞元只注意到它在樹中的祖先。驗證那一趟仍然只是一次前向傳播、一次矩陣乘法；拓樸遮罩的代價只是多幾筆 KV 項目。

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

若 `a, b` 是互相競爭的第一個詞元候選，`c, d, e, f` 是第二個詞元候選，這六個位置會在一次前向傳播裡全部驗證完。輸出是任一條被接受路徑上的最長前綴。

### 什麼時候會贏，什麼時候不會

**會贏：**

- 文字可預測的聊天／續寫（程式碼、常見英文、結構化輸出）。`α` 很高。
- 解碼期間 GPU 算力閒置的場景（記憶體受限階段）。樹狀起草把用不到的 FLOPs 吃下來。

**會輸／沒有好處：**

- 高度隨機的輸出（高溫下的創意寫作）。`α` 會往 `1/|vocab|` 掉。
- 併發量非常高的批次服務 —— 批次本身已經把 FLOPs 填滿，留給樹狀驗證的空間不多。
- 非常小的驗證模型，草稿並不會比它小多少。

生產團隊回報的數字通常是：聊天上牆鐘加速 2 到 3 倍，程式碼生成 3 到 5 倍，創意寫作接近零。

```figure
speculative-decoding
```

## 動手實作

`code/main.py`：

- 一份參考用的 `speculative_decode(target, draft, prompt, K, temperature)`，實作了精確的拒絕規則，並驗證它保住了驗證模型的分布（對比單純的驗證模型取樣，經驗 KL < 0.01）。
- 一個 EAGLE 風格的樹狀起草器，用 top-p 分支建出深度為 K 的樹。
- 一個樹狀注意力遮罩建構器，產出驗證器需要的正確因果樣式。
- 一套接受率量測工具，在一個小型 LM 上跑這兩者（從 GPT-2-medium 驗證模型蒸餾出一個 GPT-2-small）。

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """One round of speculative decoding. Returns list of accepted tokens."""
    # 1. Draft K tokens
    draft_tokens = []
    q_probs = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_probs.append(probs[t])
        state = draft_step(state, t)

    # 2. Target computes p at every drafted position + 1 extra
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. Accept/reject left-to-right
    accepted = []
    for k, tok in enumerate(draft_tokens):
        r = np.random.uniform()
        if r < p_probs_all[k][tok] / q_probs[k]:
            accepted.append(tok)
        else:
            residual = np.maximum(p_probs_all[k] - q_probs[k], 0)
            residual /= residual.sum()
            accepted.append(np.random.choice(len(residual), p=residual))
            return accepted
    # 4. All K accepted → sample bonus token from target
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## 框架應用

- **vLLM** 與 **SGLang** 都出貨了一級支援的推測式解碼。在 vLLM 裡，把一個含有 `method`、`model` 與 `num_speculative_tokens` 的 JSON 物件傳給 `--speculative-config`；EAGLE-3 就是 `"method": "eagle3"`。
- **NVIDIA TensorRT-LLM** 原生支援 Medusa 與 EAGLE 樹。
- **參考草稿模型**：`Qwen/Qwen3-0.6B`（替 Qwen3-32B 起草）、`meta-llama/Llama-3.2-1B-Instruct`（替 Llama 3.x 70B 起草）。
- **Medusa heads**（Cai 等人，2024，"Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"）：不用草稿模型，改成在驗證模型自己身上加 K 個平行的預測 head。部署比較簡單，接受率略低於 EAGLE。

## 產出交付

這一課會產出 `outputs/skill-speculative-tuning.md` —— 一個側寫驗證模型工作負載的技能，並替你選出：草稿模型、K（草稿長度）、樹寬、溫度，以及什麼時候該退回原味解碼。

## 練習

1. 實作精確的拒絕規則並用實證驗證它。分別用 `speculative_decode` 與單純的驗證模型取樣各跑 10K 個樣本，計算兩個輸出分布之間的 TV 距離。應該小於 0.01。

2. 算出加速公式。固定 `α` 與 `K`，畫出每次驗證前向傳播的期望詞元數。對 α ∈ {0.5, 0.7, 0.9} 找出最佳的 K。

3. 訓練一個極小的草稿。拿 124M 的 GPT-2 當驗證模型，用 KL 損失在 100M 詞元上蒸餾出一個 30M 的 GPT-2 草稿。在留出文本上量測 `α`。預期：0.6 到 0.7。

4. 實作 EAGLE 風格的樹狀起草。不要用鏈，改成讓草稿在每層深度輸出 top-3 分支。建出樹狀注意力遮罩。確認驗證模型接受的是最長的正確分支。

5. 量測失效模式。在 temperature=1.5（高隨機性）下跑推測式解碼。呈現 α 如何崩掉，以及演算法因為草稿開銷而比原味解碼更慢。

## 關鍵術語

| 術語 | 大家怎麼說 | 實際上是什麼 |
|------|-----------------|------------------------|
| 驗證模型 | 「那個大模型」 | 又慢又高品質、你真正想從中取樣的模型（p 分布） |
| 草稿模型 | 「投機者」 | 又小又快的預測器（q 分布）；小上 5 到 30 倍 |
| K／草稿長度 | 「往前看幾步」 | 每次驗證傳播所推測的詞元數量 |
| α／接受率 | 「命中率」 | 草稿提案被接受的逐詞元機率 |
| 精確拒絕規則 | 「接受檢定」 | r < p/q 的比較，保住驗證模型的分布 |
| 殘差分布 | 「修正過的 p-q」 | (p - q)+ / ||(p - q)+||_1，被拒絕時該取樣的分布 |
| 樹狀起草 | 「分支式推測」 | 草稿輸出一棵候選樹，用樹狀結構的注意力遮罩在一次傳播裡驗證完 |
| 樹狀注意力遮罩 | 「拓樸遮罩」 | 編碼樹狀拓樸的因果遮罩，讓每個節點只注意到自己的祖先 |
| Medusa heads | 「平行 head」 | 直接加在驗證模型上的 K 個額外預測 head；不需要獨立的草稿模型 |
| EAGLE 特徵重用 | 「吃隱藏狀態的草稿」 | 草稿的輸入是驗證模型最後一層隱藏狀態而非原始詞元，讓草稿得以縮小 |
| 測試時模擬損失 | 「EAGLE-3 的訓練法」 | 在吻合驗證模型測試時分布的輸出上訓練草稿，而不是 teacher forcing |

## 延伸閱讀

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) —— 精確拒絕規則與理論上的加速分析
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) —— DeepMind 同期的推測式取樣論文
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) —— 不用草稿模型的平行 head 替代方案
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) —— 特徵重用與樹狀起草
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) —— 動態樹狀拓樸
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) —— 訓練時與測試時的分布對齊
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) —— Jacobi／lookahead 解碼，不需要投機器的替代方案
