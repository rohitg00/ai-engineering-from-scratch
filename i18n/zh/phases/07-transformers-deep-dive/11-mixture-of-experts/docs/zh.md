# 专家组合 (MoE)

> 密集的70B变压器会激活每个代币的每个参数. 671B MoE 激活每代币只有37B,并且在每个基准上都超过它.

**Type:** Build
**Languages:** Python, Rust
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## 问题

密集变压器的FLOP在推断时等于其参数数数量 (前进传输的2倍). 扩展密集模型,每个代币都支付了全部账单.到2024年,边界正在撞击计算墙:要更聪明,你需要每代币的FLOP数量呈指数.

专家组合打破了这个联系.$E$独立专家 + 选择路由器$k$标记的专家.$E \times \text{FFN size}$每代币的活跃参数 = $k \times \text{FFN size}$典型的2026配置:$E=256$现在$k=8$存储量量$E$计算规模$k$现在,我们要去.

2026年边界几乎完全是MoE:DeepSeek-V3 (671B总量 / 37B活跃),Mixtral 8×22B,Qwen2.5-MoE,Llama 4,Kimi K2,gpt-oss.在人工分析的独立领先榜单上,前10个开源模型都是MoE.

## 概念

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### 转换的FFN

密集变压器块:

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

门:

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

每个专家都是一个独立的FFN (通常是SwiGLU).路由器是一个单一的线性层.每个代币都选择了自己的代币.`k`专家们可以通过他们的输出来进行封闭的混合.

### 负载平衡问题

如果路由器通过专家3将90%的代币,其他专家就会饿死.

1. **Auxiliary load-balancing loss**根据专家使用的差异,加一个惩罚. 工作,但增加了一个超参数和第二个梯度信号.
2. **Expert capacity + token dropping**每个专家最多处理$C \times N/E$标记,过度标记跳过层. 损害质量.
3. **Auxiliary-loss-free balancing**通过"深度搜索" (DeepSeek-V3) 增加一个学习的专家偏见,改变路由器的顶级k选择.偏见在训练损失之外更新.没有罚款在主要目标.2024年大解锁.

对于每位专家,在每一步培训后,检查其使用是否超越目标或低于目标.`±γ`选择用途`scores + bias`专家使用的概率是原料`scores`没有变化. 脱离路由与表达.

### 共同的专家

根据 DeepSeek-V2/V3 的规定,专家分为 *共享*和 *路由*.每个代币都通过所有共享专家.路由专家通过顶级k 选出.共享专家捕获了共同知识;路由专家专业化. V3运行 1 个共享专家加上 256 个路由专家中最前8个.

### 精细粮食专家

经典MoE (GShard,Switch):每个专家的宽度就像一个完整的FFN. `E`只有小的 (864),`k`是小的 (12).

现代细粒度的MoE (DeepSeek-V3,Qwen-MoE):每个专家的尺寸较窄 (1/8FFN). $E$是大 (256+),$k$总参数相同,但组合规模更快. $\binom{256}{8} \approx 400$质量上升,延迟保持平稳.

### 成本概况

按标记,按层:

| Config | Active params / token | Total params |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B (dense) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MoE) | ~32B | 1T |

在执行过程中,DeepSeek-V3几乎在每个基准上击败了Llama 3 70B (密集).**fewer active FLOPs per token**更多参数 = 更多知识. 更多的活跃FLOPs = 更多的计算每代币.

### 捕获:记忆

所有专家都使用GPU,不管哪个是射击的.671B模型需要1.3TB的VRAM用于fp16权重.边界MoE部署需要专家平行性.

```figure
expert-routing
```

## 建立它

看到`code/main.py`纯的紧的MoE层,含有:

- `n_experts=8`光 (SwiGLU) 的专家 (每一个线性,说明)
- 顶级k=2路由
- 软max正常化的门重量
- 通过专家偏见进行无损辅助平衡

`code/main.rs`果版的数据和数据库是相同的.它只使用标准库.随机数字与Python不同,但打印的结论是相同的.

```bash
python3 code/main.py
rustc --edition 2021 -O code/main.rs -o /tmp/lesson && /tmp/lesson
```

### 步骤1:路由器

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

偏差影响选择,而不是门权重.这是DeepSeek-V3技巧.

### 步骤2:通过路由器运行100个代币

随着专家的射击频率的追踪.`-γ`对于过度使用的专家,`+γ`对于未使用的使用量),使用量在几次代中趋于均分布.

### 步骤3:参数数量比较

打印MoE配置的"密度相当" .深度搜索V3形: 256路由 + 1共享, 8 活跃,d_model=7168. 总参数数是眼睛. 活跃数量是密度Llama 3 70B的第七个.

## 用它

拥抱面部加载:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 产量推断:vLLM 支持MoE路由本地.SGLang 具有最快的专家平行路径.两者都自动处理顶级选项和专家平行.

**When to pick MoE:**
- 你想要以低的推断成本的标准质量.
- 你有VRAM/专家并行基础设施.
- 你的工作量是代币重 (聊天,代码) 而不是文本重 (长文档).

**When NOT to pick MoE:**
-  边缘部署 您为任何活跃的FLOP付出了全部存储费.
- 专家路由增加了总费用.
- 小型型号 (<7B) MoE的质量优势仅在计算门 (~6B活性参数) 以上.

## 运送它

看到`outputs/skill-moe-configurator.md`技能选择E,k和共享专家布局,以实现新的MoE参数预算,培训代币和部署目标.

## 运动

1. **Easy.**跑步`code/main.py`观察如何辅助免损失偏见更新平衡专家使用超过50次.
2. **Medium.**换取学习路由器以基于哈希的路由器 (确定性,没有学习). 进行质量和平衡比较.
3. **Hard.**实现GRPO类型的"推广匹配路由" (DeepSeek-V3.2技巧):记录专家在推断过程中发射的,在梯度计算过程中强迫相同的路由.测量玩具政策梯度设置的影响.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Expert | "One FFN among many" | An independent feed-forward network; parameters dedicated to a sparse slice of the FFN computation. |
| Router | "The gate" | A tiny linear layer that scores each token against each expert; top-k selection. |
| Top-k routing | "k active experts per token" | Each token's FFN computation goes through exactly k experts, weighted by gate. |
| Auxiliary loss | "Load-balance penalty" | Extra loss term that penalizes skewed expert usage. |
| Auxiliary-loss-free | "DeepSeek-V3's trick" | Balance via per-expert bias on the router's selection only; no extra gradient. |
| Shared expert | "Always on" | Extra expert through which every token passes; captures common knowledge. |
| Expert parallelism | "Shard by expert" | Distribute different experts to different GPUs; route tokens across the network. |
| Sparsity | "Active params < total params" | The ratio $k \times \text{expert size} / (E \times \text{expert size})$; 37/671 ≈ 5.5% for DeepSeek-V3. |

## 进一步阅读

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538)这个想法.
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961)开关,经典的MoE.
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088)混合物8×7B.
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) MLA + 无损辅助MoE + MTP.
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664)基于偏差的平衡纸.
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066)精细的+共享专家 分开本课的路由器使用.
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596)原始共享专家论文.
