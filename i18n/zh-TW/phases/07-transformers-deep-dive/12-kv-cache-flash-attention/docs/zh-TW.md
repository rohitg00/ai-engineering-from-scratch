# KV cache、Flash Attention 與推論調校

> 訓練是平行的、被 FLOP 卡住。推論是序列的、被記憶體（memory）卡住。瓶頸不同，手法不同。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 02 (Self-Attention), Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~75 minutes

## The Problem｜問題

樸素（naive）的自迴歸（autoregressive）解碼器，要生成 `N` 個 token 得做 `O(N²)` 的工作：每一步都對整個前綴重算注意力。4000 個 token 的回覆是 1600 萬次注意力運算，大多是多餘的。前綴 token 的每個隱藏狀態（hidden state）一旦算過就是確定的——你只需要拿新 token 的查詢，去對之前全部快取起來的鍵和值。

除此之外，注意力本身需要搬移大量資料。標準注意力會實體化出 N×N 的分數矩陣、N×d 的 softmax 輸出、N×d 的最終輸出——對 HBM 的讀寫太多。N 大於等於 2000 時，注意力先被記憶體卡住，才輪到被 FLOP 卡住。經典注意力核（kernel）把現代 GPU 的利用率壓低 4 到 10 倍。

兩項調校都來自 Dao 等人，讓前沿推論從「慢」變成「快」：

1. **KV cache。** 存每個前綴 token 的 K 和 V 向量。每個新 token 的注意力，是一個查詢對上快取的鍵。推論從 `O(N²)` 降成每個生成步驟 `O(N)`。
2. **Flash Attention。** 把注意力計算分塊（tiling），完整的 N×N 矩陣永遠不進 HBM。softmax 加矩陣乘法全在 SRAM 裡做。A100 上實際時間快 2 到 4 倍；H100 配 FP8 快 5 到 10 倍。

到 2026 年兩者都是標配。每一套正式環境（production）推論堆疊（vLLM、TensorRT-LLM、SGLang、llama.cpp）都預設這些技術已經就位。每個前沿模型出貨時都已啟用 Flash Attention。

## The Concept｜核心概念

![KV cache growth and Flash Attention tiling](../assets/kv-cache-flash-attn.svg)

### KV cache 的數學

每一個解碼器層、每一個 token、每一個頭：

```
bytes_per_token_per_layer = 2 * d_head * dtype_size
                          ^
                          K and V
```

70 億模型、32 層、32 個頭、d_head = 128、fp16：

```
per token per layer = 2 * 128 * 2 = 512 bytes
per token (32 layers) = 16 KB
per 32K context = 512 MB
```

Llama 3 70B（80 層、d_head = 128、分組查詢注意力（GQA）、8 個 KV 頭）：

```
per token per layer = 2 * 8 * 128 * 2 = 4096 bytes (4 KB)
per 32K context = 10.4 GB
```

那 10 GB 就是為什麼 Llama 3 70B 在 12.8 萬脈絡、批次（batch）大小為 1 時，光 KV cache 就要吃掉 40 GB A100 的大部分。

**GQA 大幅降低 KV cache 成本。** 64 個頭的 MHA 會是 32 GB。MLA 壓得更小。

調整維度，看快取大小怎麼動。把序列長度或批次往上推，看它多快衝過單張 GPU：

```figure
kv-cache-sizer
```

### Flash Attention——分塊手法

標準注意力：

```
S = Q @ K^T          (HBM read, N×N, HBM write)
P = softmax(S)       (HBM read, HBM write)
O = P @ V            (HBM read, HBM write)
```

三次 HBM 來回。H100 上 HBM 頻寬（bandwidth）是 3 TB/s；SRAM 是 30 TB/s。每次走 HBM，相對把東西留在晶片上，都慢 10 倍。

Flash Attention：

```
for each block of Q (tile size ~128 × 128):
    load Q_tile into SRAM
    for each block of K, V:
        load K_tile, V_tile into SRAM
        compute S_tile = Q_tile @ K_tile^T     (SRAM)
        running softmax aggregation             (SRAM)
        accumulate into O_tile                  (SRAM)
    write O_tile to HBM
```

每個區塊一次 HBM 來回。記憶體足跡從 `O(N²)` 降到 `O(N)`。反向傳播時重新計算部分前向傳遞的值，而不是把它們存起來——又是一次記憶體上的勝利。

**數值手法。** 跑動中的 softmax 跨區塊維持 `(max, sum)`，所以最後的正規化（normalization）是精確的。不是近似——Flash Attention 算出來和標準注意力輸出與一次計算完全相同（除了 fp16 不可結合）。

**版本演進：**

| 版本 | 年份 | 關鍵改變 | 參考硬體上的加速比 |
|---------|------|-----------|-------------------------------|
| Flash 1 | 2022 | 分塊的 SRAM 核 | A100 上 2 倍 |
| Flash 2 | 2023 | 更好的平行、因果優先的順序 | A100 上 3 倍 |
| Flash 3 | 2024 | Hopper 的非同步、FP8 | H100 上 1.5 到 2 倍（FP16 大約 740 TFLOPs） |
| Flash 4 | 2026 | Blackwell 五階段管線（pipeline）、軟體 exp2 | 推論優先（一開始只有前向傳遞） |

Flash 4 發布時只有前向傳遞。訓練仍用 Flash 3。Flash 4 的 GQA 和 varlen 支援還在等（2026 年中）。

### 推測解碼（speculative decoding）——另一個延遲（latency）勝利

便宜模型提出 N 個 token。大模型平行驗證全部 N 個。如果驗證接受 k 個 token，你付 1 次大模型前向傳遞，換 k 次生成。程式碼和散文上典型的 k 是 3 到 5。

2026 年的預設：
- **EAGLE 2／Medusa。** 整合的草稿頭，共用驗證器的隱藏狀態（hidden state）。2 到 3 倍的加速比，品質不掉。
- **用草稿模型的推測解碼。** 消費級硬體上 2 到 4 倍的加速比。
- **Lookahead 解碼。** Jacobi 迭代；不需要草稿模型。小眾但免費。

### 連續批次（continuous batching）

經典的批次推論：等最慢的序列做完，再開始新的一批。短回覆提早結束時，GPU 閒置。

連續批次（最先在 Orca 出貨，現在 vLLM、TensorRT-LLM、SGLang 都有）：舊的一做完就把新請求換進批次。典型聊天工作負載的吞吐量（throughput）多 5 到 10 倍。

### PagedAttention——把 KV cache 當虛擬記憶體

vLLM 的代表功能。KV cache 以 16 個 token 的區塊配置；頁表把邏輯位置對到實體區塊。讓你在平行樣本之間共用 KV（集束搜尋（beam search）、平行取樣），為 prompt 快取熱切換前綴，並重整記憶體碎片（fragmentation）。相對單純的連續配置，吞吐量多 4 倍。

```figure
flash-attention-memory
```

## Build It｜動手實作

見 `code/main.py`。我們實作：

1. 單純的 `O(N²)` 增量解碼器。
2. `O(N)` 的 KV 快取解碼器。
3. 分塊 softmax，模擬 Flash Attention 的跑動最大值演算法（algorithm）。

### 步驟 1：KV cache

```python
class KVCache:
    def __init__(self, n_layers, n_heads, d_head):
        self.K = [[[] for _ in range(n_heads)] for _ in range(n_layers)]
        self.V = [[[] for _ in range(n_heads)] for _ in range(n_layers)]

    def append(self, layer, head, k, v):
        self.K[layer][head].append(k)
        self.V[layer][head].append(v)

    def read(self, layer, head):
        return self.K[layer][head], self.V[layer][head]
```

很單純：每層、每個頭的清單裡，每個 token 的 K、V 向量一直長。

### 步驟 2：分塊 softmax

```python
def tiled_softmax_dot(q, K, V, tile=4):
    """Flash-attention-style softmax(qK^T)V with running max/sum."""
    m = float("-inf")
    s = 0.0
    out = [0.0] * len(V[0])
    for start in range(0, len(K), tile):
        k_block = K[start:start + tile]
        v_block = V[start:start + tile]
        scores = [sum(qi * ki for qi, ki in zip(q, k)) for k in k_block]
        new_m = max(m, *scores)
        exp_old = math.exp(m - new_m) if m != float("-inf") else 0.0
        exp_new = [math.exp(sc - new_m) for sc in scores]
        s = s * exp_old + sum(exp_new)
        for j in range(len(out)):
            out[j] = out[j] * exp_old + sum(e * v[j] for e, v in zip(exp_new, v_block))
        m = new_m
    return [o / s for o in out]
```

和一次算完的 `softmax(qK) V` 輸出與一次計算完全相同，但任何時刻的工作集（working set）是一個 `tile × d_head` 區塊，不是完整的 `N × d_head`。

### 步驟 3：在 100 個 token 的生成上比較單純解碼和有快取的解碼

數注意力運算。單純：`O(N²)` = 5050。有快取：`O(N)` = 100。程式會把兩個都印出來。

## Use It｜實際應用

```python
# HuggingFace transformers auto-enables KV cache on decoder-only generate().
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(
    "meta-llama/Llama-3.2-3B",
    attn_implementation="flash_attention_2",  # use FA3 if Hopper
    torch_dtype="bfloat16",
)
# generate() uses KV cache automatically
```

正式環境的 vLLM：

```bash
pip install vllm
vllm serve meta-llama/Llama-3.1-70B-Instruct \
    --tensor-parallel-size 4 \
    --max-model-len 32768 \
    --enable-prefix-caching \
    --kv-cache-dtype fp8
```

跨請求的前綴快取（prefix caching）是 2026 年的大勝利——同一個系統 prompt、few-shot 範例、或長脈絡文件，跨呼叫重用 KV。對工具 prompt 一直重複的 agent 工作負載，前綴快取常常是 5 倍吞吐量。

## Ship It｜交付成果

見 `outputs/skill-inference-optimizer.md`。這個 skill 為新的推論部署（deployment）挑注意力實作、KV cache 策略、量化（quantization）、和推測解碼。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。確認樸素解碼器和有快取的解碼器輸出相同；注意運算次數的差。
2. **中等。** 實作前綴快取：給定 prompt P 和幾個補完，對 P 跑一次前向傳遞把 KV cache 填滿，再按每個補完分岔。量相對每次重新編碼 P 的加速比。
3. **困難。** 實作玩具 PagedAttention：KV cache 放在固定 16 個 token 的區塊，配空閒清單。序列結束就把區塊還回池子。模擬 1000 個長度不一的聊天補完。比記憶體碎片化和連續配置。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| KV cache | 「讓解碼變快的手法」 | 存每個前綴 token 的 K 和 V；新查詢對它們做注意力，不用重算。 |
| HBM | 「GPU 主記憶體」 | 高頻寬記憶體；H100 上 80 GB，B200 上 192 GB。頻寬大約 3 TB/s。 |
| SRAM | 「晶片上記憶體」 | 每個 SM 的快速記憶體，H100 上每個 SM 大約 256 KB。頻寬大約 30 TB/s。 |
| Flash Attention | 「分塊的注意力核」 | 算注意力時不把 N×N 實體化到 HBM。 |
| 連續批次 | 「不等的批次」 | 做完的序列換出去，新的換進來，不用把整批清掉。 |
| PagedAttention | 「vLLM 的招牌」 | KV cache 以固定區塊配置，配頁表；消掉碎片。 |
| 前綴快取 | 「重用長 prompt」 | 跨請求快取共用前綴的 KV；對 agent 是大的成本削減。 |
| 推測解碼 | 「草稿加驗證」 | 便宜的草稿模型提出 token；大模型一次過驗證 k 個。 |

## Further Reading｜延伸閱讀

- [Dao et al. (2022). FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness](https://arxiv.org/abs/2205.14135) ——Flash 1。
- [Dao (2023). FlashAttention-2: Faster Attention with Better Parallelism and Work Partitioning](https://arxiv.org/abs/2307.08691) ——Flash 2。
- [Shah et al. (2024). FlashAttention-3: Fast and Accurate Attention with Asynchrony and Low-precision](https://arxiv.org/abs/2407.08608) ——Flash 3。
- [FlashAttention-4 release notes (Dao-AILab, 2026)](https://github.com/Dao-AILab/flash-attention) ——Blackwell 五階段管線和軟體 exp2 手法；讀 repo README，看這一課提到的「只有前向傳遞」發布限制。
- [Kwon et al. (2023). Efficient Memory Management for Large Language Model Serving with PagedAttention](https://arxiv.org/abs/2309.06180) ——vLLM 論文。
- [Leviathan et al. (2023). Fast Inference from Transformers via Speculative Decoding](https://arxiv.org/abs/2211.17192) ——推測解碼。
- [Li et al. (2024). EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty](https://arxiv.org/abs/2401.15077) ——EAGLE-1／2 論文，整合草稿的做法，這一課引用的就是它。
- [Cai et al. (2024). Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads](https://arxiv.org/abs/2401.10774) ——和 EAGLE 一起提到的 Medusa 做法。
- [vLLM docs — PagedAttention](https://docs.vllm.ai/en/latest/design/kernel/paged_attention.html) ——16 個 token 區塊和頁表設計的標準深挖。
