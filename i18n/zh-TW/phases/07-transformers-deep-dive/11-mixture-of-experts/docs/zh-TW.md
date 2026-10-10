# 專家混合（Mixture of Experts，MoE）

> 稠密的 700 億 transformer，每個 token 都用到每一個參數。6710 億的 MoE 每個 token 只用到 370 億，而且在所有效能基準測試中都勝過它。稀疏（sparsity）是這十年最重要的縮放想法。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## The Problem｜問題

稠密 transformer 在推論（inference）時的 FLOPs，等於它的參數（parameter）數量（前向傳遞再乘 2）。把稠密模型放大，每個 token 都付全額。到 2024 年，前沿撞上運算牆：要明顯更聰明，每個 token 需要的 FLOPs 得指數上升。

專家混合把參數量和每個 token 的運算量拆開。把每個 FFN 換成 `E` 個獨立專家，加上一個路由器（router），每個 token 挑 `k` 個專家。參數總數 = `E × FFN_size`。每個 token 的活躍參數（active parameters） = `k × FFN_size`。2026 年的典型設定：`E=256`、`k=8`。儲存隨 `E` 縮放，運算隨 `k` 縮放。

2026 年的前沿幾乎全是 MoE：DeepSeek-V3（總共 6710 億／活躍 370 億）、Mixtral 8×22B、Qwen2.5-MoE、Llama 4、Kimi K2、gpt-oss。在 Artificial Analysis 的獨立排行榜上，開源前 10 名全是 MoE。

## The Concept｜核心概念

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### 把 FFN 換掉

稠密 transformer 區塊：

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

MoE 區塊：

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

每個專家都是獨立的 FFN（通常是 SwiGLU）。路由器是單一個線性層。每個 token 挑自己的 `k` 個專家，拿到它們輸出的閘控混合。

### 負載平衡（load balancing）的問題

如果路由器把 90% 的 token 送進專家 3，其他專家則可能閒置。試過三種修法：

1. **輔助的負載平衡損失**（Switch Transformer、Mixtral）。加一個和專家使用量變異成正比的懲罰。行得通，但多一個超參數（hyperparameter），也多第二個梯度（gradient）訊號。
2. **專家容量（expert capacity）加丟掉 token**（早期的 Switch）。每個專家最多處理 `C × N/E` 個 token；溢出去的 token 跳過這一層。傷品質。
3. **不靠輔助損失的平衡**（DeepSeek-V3）。加一個學來的、每個專家的偏置（bias），挪動路由器的 top-k 選擇。偏置在訓練損失（loss）之外更新。主目標上沒有懲罰。2024 年的大突破。

DeepSeek-V3 的做法：每個訓練步驟之後，對每個專家看它的使用量高於還是低於目標。把偏置推 `±γ`。選擇用的是 `scores + bias`。拿來做閘的專家機率是沒改過的原始 `scores`。把路由和表達拆開。

### 共用專家（shared experts）

DeepSeek-V2／V3 也把專家分成*共用*和*被路由*。每個 token 都經過所有共用專家。被路由的專家用 top-k 挑。共用專家學習共通知識；被路由的專家專精。V3 跑 1 個共用專家，加上 256 個被路由裡的前 8。

### 細粒度專家（fine-grained experts）

經典 MoE（GShard、Switch）：每個專家和完整 FFN 一樣寬。`E` 小（8 到 64），`k` 小（1 到 2）。

現代的細粒度 MoE（DeepSeek-V3、Qwen-MoE）：每個專家更窄（FFN 大小的 1/8）。`E` 大（256 以上），`k` 更大（8 以上）。參數總數一樣，但可用的專家組合數增加得快非常多。每個 token 可能的「專家」組合是 `C(256, 8) = 400 trillion`。品質上升，延遲（latency）持平。

### 成本輪廓

每個 token、每一層：

| 設定 | 每個 token 的活躍參數 | 參數總數 |
|--------|-----------------------|--------------|
| Mixtral 8×22B | 約 390 億 | 1410 億 |
| Llama 3 70B（稠密） | 700 億 | 700 億 |
| DeepSeek-V3 | 370 億 | 6710 億 |
| Kimi K2（MoE） | 約 320 億 | 1 兆 |

DeepSeek-V3 在幾乎每個效能基準測試上打贏稠密的 Llama 3 70B，而且每個 token 的活躍 FLOPs **更少**。參數更多 = 知識更多。活躍 FLOPs 更多 = 每個 token 的運算更多。MoE 把兩者拆開。

### 代價：記憶體（memory）

不管哪些專家真的被點到，所有專家都必須常駐 GPU。6710 億的模型，fp16 權重大約要 1.3 TB 的 VRAM。前沿 MoE 的部署（deployment）需要專家平行（expert parallelism）——把專家切到不同 GPU，token 路由過網路（network）。延遲被全對全通訊主導，不是矩陣乘法。

```figure
expert-routing
```

## Build It｜動手實作

見 `code/main.py`。純標準函式庫的精簡 MoE 層，有：

- `n_experts=8` 個有 SwiGLU 味道的專家（為了示意，每個只有一個線性層）
- top-k 為 2 的路由
- softmax 正規化的閘權重
- 用每個專家的偏置做不靠輔助損失的平衡

### 步驟 1：路由器

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # softmax over ORIGINAL scores of the chosen experts
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

偏置影響選擇，不影響閘的權重。這就是 DeepSeek-V3 的手法——偏置修正負載不均，卻不把模型的預測帶偏。

### 步驟 2：讓 100 個 token 走過路由器

追蹤哪些專家多常被點到。沒有偏置，使用量是歪的。有偏置更新迴圈（過度使用的專家 `-γ`，使用不足的 `+γ`），幾次迭代就收斂到均勻分布（distribution）。

### 步驟 3：參數數量的比較

印出一個 MoE 設定的「稠密等價」。DeepSeek-V3 的形狀：256 個被路由加 1 個共用、8 個活躍、d_model = 7168。參數總量相當驚人。活躍數是稠密 Llama 3 70B 的七分之一。

## Use It｜實際應用

HuggingFace 載入：

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 年的正式環境（production）推論：vLLM 原生支援 MoE 路由。SGLang 有最快的專家平行路徑。兩者都自動處理 top-k 選擇和專家平行。

**何時選 MoE：**
- 你要前沿品質，每個 token 的推論成本更低。
- 你有 VRAM／專家平行的基礎設施。
- 你的工作負載是 token 很多（聊天、程式碼），不是脈絡很長（長文件）。

**何時不要選 MoE：**
- 邊緣部署——任何活躍 FLOP 你都要付完整的儲存。
- 對延遲敏感的單使用者服務——專家路由加額外成本。
- 小模型（小於 70 億）——MoE 的品質優勢要過一個運算閾值才出現（大約 60 億活躍參數）。

## Ship It｜交付成果

見 `outputs/skill-moe-configurator.md`。這個 skill 依參數預算、訓練 token、部署目標，為新的 MoE 挑 E、k、和共用專家的配置。

## Exercises｜練習

1. **簡單。** 跑 `code/main.py`。看不靠輔助損失的偏置更新，怎麼在 50 次迭代裡把專家使用量拉平。
2. **中等。** 把學來的路由器換成雜湊路由器（確定性、不學習）。比品質和平衡。為什麼學來的路由器更好？
3. **困難。** 實作 GRPO 風格的「和 rollout 對上的路由」（DeepSeek-V3.2 的手法）：推論時記下哪些專家被點到，梯度計算時強制同一條路由。在玩具的策略梯度設定上量效果。

## Key Terms｜關鍵術語

| 術語 | 常見說法 | 實際意義 |
|------|-----------------|-----------------------|
| 專家 | 「很多 FFN 裡的一個」 | 獨立的前饋網路；參數專門給 FFN 計算裡稀疏的一片。 |
| 路由器 | 「那個閘」 | 小小的線性層，每個 token 對每個專家打分；top-k 選擇。 |
| Top-k 路由 | 「每個 token k 個活躍專家」 | 每個 token 的 FFN 正好走過 k 個專家，用閘加權。 |
| 輔助損失 | 「負載平衡的懲罰」 | 額外的損失項，懲罰專家使用量歪掉。 |
| 不靠輔助損失 | 「DeepSeek-V3 的手法」 | 只用每個專家的偏置來平衡路由器的選擇；沒有額外梯度。 |
| 共用專家 | 「永遠開著」 | 每個 token 都會經過的額外專家；學習共通知識。 |
| 專家平行 | 「按專家切」 | 不同專家放到不同 GPU；token 路由過網路。 |
| 稀疏 | 「活躍參數小於總參數」 | 比例是 `k × expert_size / (E × expert_size)`；DeepSeek-V3 是 37/671 ≈ 5.5%。 |

## Further Reading｜延伸閱讀

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538) ——那個想法。
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961) ——Switch，經典的 MoE。
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) ——Mixtral 8×7B。
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) ——MLA 加不靠輔助損失的 MoE 加 MTP。
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) ——以偏置做平衡的論文。
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) ——細粒度加共用專家的切分，這一課的路由器就是這樣。
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) ——最早的共用專家論文。
