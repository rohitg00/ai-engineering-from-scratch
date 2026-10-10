# 推測解碼與 EAGLE

> 頂尖 LLM 每生成一個 token，都需要在數百億參數上執行完整的前向傳遞。這種前向傳遞在硬體配置上是嚴重過剩的：多數情況下，小得多的模型就能正確猜出接下來的 3 到 5 個 token，而大模型只需負責「驗證」這個猜測。當猜測正確時，你相當於用 1 個 token 的成本換取了 5 個 token。推測解碼（speculative decoding，Leviathan 等人，2023 年）在數學上精確保證了這點，而 EAGLE-3（2025 年）則將每次驗證的接受率推升至約 4.5 個 token——在完全維持原輸出分布的前提下實現了 4 到 5 倍的加速。

**Type:** Build
**Languages:** Python (with numpy)
**Prerequisites:** Phase 10 Lesson 12 (Inference Optimization), Phase 10 Lesson 04 (Pre-training Mini-GPT)
**Time:** ~75 minutes

## The Problem｜問題

在 H100 上對 70B 級模型執行 decode，吞吐量通常只有每秒 40 到 80 個 token。每個 token 都需要執行完整的前向傳遞，從 HBM 讀取全部模型權重。在不改變輸出的前提下，你無法縮小模型；在記憶體限制下，你無法無限制擴大批次大小。你被徹底困住了——除非你能讓模型在單次前向傳遞中輸出超過一個 token。

自回歸生成表面上具有不可打破的循序性：`x_{t+1} = sample(p(· | x_{1:t}))`。但此處存在並行化的巨大機會。如果你有一個廉價的預測器，它能預測「接下來的 4 個 token 極可能是 [a, b, c, d]」，你就能在大模型的**單次前向傳遞**中一次性驗證全部 5 個位置，並接受最長匹配的前綴。

Leviathan、Kalai 與 Matias（2023 年，《Fast Inference from Transformers via Speculative Decoding》）透過精巧的接受／拒絕法則精確實現了這項設想，並嚴格保留了目標模型的抽樣分布。相同的輸出分布，速度快上 2 到 4 倍。

## The Concept｜核心概念

### 雙模型配置

- **目標模型（Target model）** `M_p`：你真正希望從中抽樣的大型、緩慢、高品質模型。機率分布為 `p(x)`。
- **草稿模型（Draft model）** `M_q`：體積小 5 到 30 倍、速度極快但品質較低的模型。機率分布為 `q(x)`。

每個步驟的流程：

1. 草稿模型自回歸提出 `K` 個候選 token：`x_1, x_2, ..., x_K ~ q`。
2. 目標模型在所有 `K+1` 個位置上平行執行「單次」前向傳遞，為每個候選 token 產出 `p(x_k)`。
3. 由左至右依據下述修正後的拒絕取樣法則（rejection sampling）接受／拒絕每個 token，接受最長匹配的前綴。
4. 若任一 token 被拒絕，從修正後的殘差分布（residual distribution）中抽樣替代 token 並立即停止；若全部接受，則從 `p(· | x_1...x_K)` 中免費抽樣一個額外贈送 token。

若草稿與目標模型完全吻合，每次目標模型前向傳遞可獲得 K+1 個 token；若草稿在位置 1 猜錯，你依然能獲得 1 個 token。

### 精確性保證法則

推測解碼在**機率分布上可嚴格證明等價於直接從 p 抽樣**。其拒絕法則如下：

```
For each drafted token x_t:
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t):
        accept x_t
    else:
        sample replacement from residual: (p - q)+ / ||(p - q)+||_1
        stop
```

其中 `(p - q)+` 代表逐點差值的正數部分。當草稿與目標一致（`p ≈ q`）時，接受率接近 1。當兩者產生分歧時，殘差分布的構造方式確保了整體抽樣分布依然嚴格等於 `p`。

**貪婪取樣情況。** 在溫度為 0 的貪婪取樣下，只需檢查 `argmax(p) == x_t`。若相等則接受；若不相等則輸出 `argmax(p)` 並立即停止。

### 預期加速比

若草稿模型在 token 層級的接受率為 `α`，每次目標模型前向傳遞所產出的預期 token 數量為：

```
E[tokens] = (1 - α^{K+1}) / (1 - α)        # K = draft length, α in [0, 1]
```

在 `α = 0.8, K = 4` 下：`(1 - 0.8^5)/(1 - 0.8) = 3.36` 個 token/前向傳遞。單次目標前向傳遞的成本約為 `cost_q * K + cost_p`（K 次草稿步驟加上一次目標驗證）。若 `cost_p >> cost_q * K`，吞吐量加速比即為 `3.36× / 1 = 3.36×`。

唯一的實質關鍵參數就是 `α`，它完全取決於草稿與目標之間的對齊程度。優質的草稿模型決定了一切。

### 訓練草稿模型：知識蒸餾（knowledge distillation）

隨便找一個小模型當草稿往往效果欠佳。業界標準配方是從目標模型進行知識蒸餾：

1. 挑選小型架構（針對 70B 目標模型約配備 1B 草稿模型，針對 7B 目標模型約配備 500M 草稿模型）。
2. 在大規模文本語料庫上執行目標模型，儲存其下一個 token 的機率分布。
3. 以相對於目標模型分布的 KL 散度損失訓練草稿模型（而非針對真實標籤 token 訓練）。

成果：在程式碼任務上 `α` 通常為 0.6 到 0.8，在自然語言對話上則為 0.7 到 0.85，正式環境加速達 2 到 3 倍。

### EAGLE：樹狀推測與特徵複用

Li、Wei、Zhang、Zhang（2024 年，《EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty》）指出了標準推測解碼的兩大低效之處：

1. 草稿模型執行 K 次循序步驟，每次都是完整的神經網路運算。但草稿模型本可直接複用目標模型在上一次驗證中所計算出的特徵（隱藏狀態）——目標模型早已產出了極其豐富的語義表示，而草稿模型卻在從零重複推導。
2. 草稿模型僅輸出單一線性鏈。如果草稿能輸出候選「樹」（每個節點提供多個猜測），目標模型就能透過樹狀注意力遮罩在單次前向傳遞中平行驗證多條候選路徑，並挑選最長被接受的路徑。

EAGLE-1 的革新：
- 草稿輸入 = 目標模型在位置 t 的最終隱藏狀態，而非原始 token。
- 草稿架構 = 單層 transformer 解碼器（而非獨立的小型模型）。
- 輸出 = 每個深度 K = 4 到 8 個候選的樹，深度為 4 到 6。

EAGLE-2（2024 年）引入了動態樹拓撲結構：在草稿不確定處拓寬樹的分岔，在充滿信心處保持狹窄，在不增加驗證成本的前提下提高有效接受率 α_effective `α_effective`。

EAGLE-3（Li 等人，2025 年，《EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test》）移除了固定的頂層特徵依賴，改以「測試期模擬（test-time simulation）」損失進行訓練——草稿模型是在匹配目標模型測試期分布的輸出上受訓，而非教師強制（teacher forcing）的訓練分布。接受率從 0.75（EAGLE-2）躍升至 0.82（EAGLE-3），平均每次驗證產出的 token 數從 3.0 個提升至 4.5 個。

### 樹狀注意力驗證（Tree Attention Verification）

當草稿模型輸出樹狀結構時，目標模型透過**樹狀注意力遮罩（tree attention mask）**在單次前向傳遞中驗證它——該因果遮罩編碼了樹的拓撲結構而非純線性鏈條。每個 token 僅關注其在樹中的祖先節點。驗證傳遞依然只需單次前向矩陣乘法，只增加少量 KV 條目。

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

若 `a, b` 是相互競爭的第一個 token 候選，而 `c, d, e, f` 是第二個 token 候選，所有六個位置都在單次前向傳遞中被同時驗證。最終輸出為所有被接受路徑中最長的一條前綴。

### 何時勝出，何時無效

**勝出場景：**
- 文字可預測性高的對話／程式碼生成／結構化輸出。`α` 處於高位。
- 在 decode 期間 GPU 算力處於閒置狀態的場景（記憶體頻寬受限階段）。樹狀推測充分榨乾了閒置的 FLOPS。

**無效／落敗場景：**
- 高度隨機性的輸出（高溫度的創意寫作）。`α` 急跌至接近 `1/|vocab|`。
- 超高並行的批次服務——批次處理本身已填滿了 GPU 算力，沒有餘裕容納樹狀驗證。
- 目標模型本身極小，草稿模型相形之下沒有明顯體積優勢。

正式環境實測通常回報：對話任務取得 2 到 3 倍的實際耗時加速，程式碼生成取得 3 到 5 倍加速，而高隨機創意寫作則近乎無提升。

```figure
speculative-decoding
```

## Build It｜動手實作

完整程式碼請參閱 `code/main.py`：

- 基準 `speculative_decode(target, draft, prompt, K, temperature)`，實作精確拒絕法則並實證檢驗其嚴格保留目標分布（實測 KL < 0.01）。
- EAGLE 風格的樹狀草稿器，以 top-p 分岔建構深度為 K 的樹。
- 樹狀注意力遮罩建構器，為驗證模型產出正確的因果拓撲模式。
- 在微型語言模型上執行的接受率測試架構（從 GPT-2-medium 目標蒸餾出 GPT-2-small 草稿）。

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

## Use It｜實際應用

- **vLLM** 與 **SGLang** 原生提供完整的推測解碼支援。在 vLLM 中，向 `--speculative-config` 傳入包含 `method`、`model` 與 `num_speculative_tokens` 的 JSON 物件；EAGLE-3 設定為 `"method": "eagle3"`。
- **NVIDIA TensorRT-LLM** 原生支援 Medusa 與 EAGLE 樹。
- **開源參考草稿模型**：`Qwen/Qwen3-0.6B`（為 Qwen3-32B 擔任草稿）、`meta-llama/Llama-3.2-1B-Instruct`（為 Llama 3.x 70B 擔任草稿）。
- **Medusa 輸出頭**（Cai 等人，2024 年，《Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads》）：不再使用獨立草稿模型，而是在目標模型本身加上 K 個平行預測頭。部署更簡便，接受率略低於 EAGLE。

## Ship It｜交付成果

本課產出 `outputs/skill-speculative-tuning.md`——一個用於分析目標模型工作負載並精確決策的 skill：包含草稿模型選型、K（草稿長度）、樹寬度、溫度，以及何時應優雅退回純粹解碼。

## Exercises｜練習

1. 實作精確拒絕法則並進行實證檢驗。透過 `speculative_decode` 與純目標抽樣各執行 10,000 個樣本；計算兩種輸出分布之間的全變差距離（TV distance），數值應嚴格小於 0.01。

2. 計算加速比公式。給定固定的 `α` 與 `K`，繪製每次目標前向傳遞所產出的預期 token 數。找出在 α ∈ {0.5, 0.7, 0.9} 下的最佳 K。

3. 訓練一個微型草稿模型。取用 124M GPT-2 作為目標模型，在 1 億 token 上使用 KL 散度損失蒸餾出 30M GPT-2 草稿。在保留文字上測量 `α`，預期應達 0.6 到 0.7。

4. 實作 EAGLE 風格的樹狀推測。讓草稿模型在每個深度輸出 top-3 分岔，建構樹狀注意力遮罩，並驗證目標模型能正確接受最長被認可的路徑。

5. 測量失敗模式。在溫度為 1.5（高隨機性）下執行推測解碼，展示 α 如何崩潰，以及由於草稿開銷而導致演算法速度慢於純粹解碼。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|------------------------|
| 目標模型（Target model） | 「那個大模型」 | 你希望從中抽樣的高品質慢速模型（p 分布） |
| 草稿模型（Draft model） | 「猜測器」 | 體積小 5 到 30 倍的快速小型預測模型（q 分布） |
| K / 草稿長度 | 「往前猜幾步」 | 每次驗證傳遞中所推測猜測的 token 數量 |
| α / 接受率 | 「命中率」 | 每個 token 提案在拒絕法則下被認可接受的機率 |
| 精確拒絕法則 | 「接受測試」 | 比較 r < p/q 的機率檢驗，在拒絕時從殘差抽樣，數學上嚴格保留目標分布 |
| 殘差分布（Residual distribution） | 「校正後的 p-q」 | (p - q)+ / ||(p - q)+||_1，當草稿遭到拒絕時應從中抽樣的嚴格機率分布 |
| 樹狀推測（Tree drafting） | 「分岔猜測」 | 草稿模型輸出候選樹，由目標模型透過樹拓撲注意力遮罩在單次傳遞中並行驗證 |
| 樹狀注意力遮罩 | 「拓撲遮罩」 | 編碼樹結構的因果遮罩，確保每個節點僅能關注其祖先節點 |
| Medusa 輸出頭 | 「平行預測頭」 | 掛載在目標模型本身的 K 個額外預測頭；無需維護獨立草稿模型 |
| EAGLE 特徵複用 | 「隱藏狀態草稿」 | 草稿模型以目標模型最終隱藏狀態為輸入而非原始 token，大幅縮小草稿體積 |
| 測試期模擬損失 | 「EAGLE-3 訓練法」 | 訓練草稿模型去匹配目標模型測試期分布而非教師強制 |

## Further Reading｜延伸閱讀

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) ——推測解碼精確拒絕法則與理論加速比分析的開創性經典論文
- [Chen, Borgeaud, Irving et al., 2023 — "Accelerating Large Language Model Decoding with Speculative Sampling"](https://arxiv.org/abs/2302.01318) ——DeepMind 同期獨立發布的推測抽樣論文
- [Cai, Li, Geng, Wang, Wang, Zhu, Dao, 2024 — "Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"](https://arxiv.org/abs/2401.10774) ——無需獨立草稿模型的平行頭解碼替代方案
- [Li, Wei, Zhang, Zhang, 2024 — "EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"](https://arxiv.org/abs/2401.15077) ——特徵複用與樹狀推測突破
- [Li et al., 2024 — "EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees"](https://arxiv.org/abs/2406.16858) ——動態樹拓撲自適應結構
- [Li et al., 2025 — "EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"](https://arxiv.org/abs/2503.01840) ——訓練期測試模擬與分布對齊
- [Fu, Haotian, Peng et al., 2024 — "Break the Sequential Dependency of LLM Inference Using Lookahead Decoding"](https://arxiv.org/abs/2402.02057) ——Jacobi / Lookahead 解碼，無需預測模型的序列平行化替代路徑
