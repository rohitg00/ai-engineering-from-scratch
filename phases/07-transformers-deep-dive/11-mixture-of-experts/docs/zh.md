# 混合专家（Mixture of Experts, MoE）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个 70B 的 dense transformer 对每个 token 都要激活全部参数。一个 671B 的 MoE 每个 token 只激活 37B，却在每个 benchmark 上把它打趴下。Sparsity（稀疏性）是这十年最重要的扩展思想。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 05 (Full Transformer), Phase 7 · 07 (GPT)
**Time:** ~45 minutes

## 问题（The Problem）

一个 dense transformer 在 inference（推理）时的 FLOPs 等于其参数量（前向传播再乘以 2）。把 dense 模型放大，每个 token 都要付全额账单。到 2024 年前沿撞上了算力墙：要变得更聪明，每个 token 所需的 FLOPs 就得指数级增加。

混合专家（Mixture of Experts）打破了这层绑定。把每个 FFN 替换成 `E` 个独立的 expert（专家）+ 一个 router（路由器），每个 token 选 `k` 个 expert。总参数量 = `E × FFN_size`。每个 token 的活跃参数 = `k × FFN_size`。2026 年的典型配置：`E=256`，`k=8`。存储随 `E` 扩展，计算随 `k` 扩展。

2026 年的前沿几乎全是 MoE：DeepSeek-V3（671B 总 / 37B active）、Mixtral 8×22B、Qwen2.5-MoE、Llama 4、Kimi K2、gpt-oss。在 Artificial Analysis 的独立排行榜上，前 10 名开源模型清一色都是 MoE。

## 概念（The Concept）

![MoE 层：router 为每个 token 从 E 个 expert 中选 k 个](../assets/moe.svg)

### FFN 替换（The FFN swap）

Dense transformer block：

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

MoE block：

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

每个 expert 都是一个独立的 FFN（通常是 SwiGLU）。Router 是一个单线性层。每个 token 自己挑 `k` 个 expert，并得到这些 expert 输出的门控加权混合。

### 负载均衡问题（The load-balancing problem）

如果 router 把 90% 的 token 都送给 expert 3，其余 expert 就饿死了。已经有三种修复方法被尝试过：

1. **辅助负载均衡损失（Auxiliary load-balancing loss）**（Switch Transformer、Mixtral）。加一项与 expert 使用率方差成正比的惩罚。能用，但多了一个超参数和第二个梯度信号。
2. **Expert capacity + token dropping**（早期 Switch）。每个 expert 至多处理 `C × N/E` 个 token；溢出的 token 跳过本层。会损害质量。
3. **无辅助损失均衡（Auxiliary-loss-free balancing）**（DeepSeek-V3）。给每个 expert 加一个可学习的偏置，用来调整 router 的 top-k 选择。这个偏置在训练 loss 之外更新，对主目标没有任何惩罚。这是 2024 年的重大突破。

DeepSeek-V3 的做法：每一步训练之后，对每个 expert 检查它的使用率高于还是低于目标。把偏置按 `±γ` 微调。选择时用 `scores + bias`，但用于门控的 expert 概率仍然是原始的 `scores`，保持不变。把 routing（路由）和 expression（表达）解耦。

### 共享 expert（Shared experts）

DeepSeek-V2/V3 还把 expert 拆成 *shared*（共享）和 *routed*（路由）两类。每个 token 都会经过所有 shared expert；routed expert 通过 top-k 挑选。Shared expert 捕获通用知识，routed expert 做专门化。V3 跑 1 个 shared expert，加上 256 个 routed 中的 top-8。

### 细粒度 expert（Fine-grained experts）

经典 MoE（GShard、Switch）：每个 expert 和一个完整 FFN 一样宽。`E` 很小（8–64），`k` 也很小（1–2）。

现代细粒度 MoE（DeepSeek-V3、Qwen-MoE）：每个 expert 更窄（FFN 大小的 1/8）。`E` 很大（256+），`k` 也更大（8+）。总参数量相同，但组合数量增长得快得多。每个 token 有 `C(256, 8) = 400 万亿` 种可能的"expert 组合"。质量上升，延迟保持不变。

### 成本剖面（The cost profile）

按每个 token、每层算：

| 配置 | 每 token 活跃参数 | 总参数 |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B (dense) | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2 (MoE) | ~32B | 1T |

DeepSeek-V3 在几乎每个 benchmark 上都打败 Llama 3 70B（dense），而**每个 token 的活跃 FLOPs 还更少**。参数越多 = 知识越多。活跃 FLOPs 越多 = 每个 token 的算力越多。MoE 把这两件事解耦了。

### 代价：显存（The catch: memory）

不论哪些 expert 实际触发，所有 expert 都得驻留在 GPU 上。一个 671B 的模型仅 fp16 权重就需要约 1.3 TB 显存。前沿 MoE 部署需要 expert parallelism（专家并行）——把 expert 切到不同 GPU 上，把 token 通过网络路由过去。延迟主要由 all-to-all 通信决定，而不是 matmul。

## 动手实现（Build It）

见 `code/main.py`。一个用纯标准库写的紧凑 MoE 层，包含：

- `n_experts=8` 个 SwiGLU 风格的 expert（每个仅一层 linear，仅作示例）
- top-k=2 路由
- softmax 归一化的 gating 权重
- 通过 per-expert 偏置实现的无辅助损失均衡

### Step 1：router

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

偏置只影响选择，不影响门控权重。这正是 DeepSeek-V3 的妙招——偏置纠正负载不均，但不会左右模型的预测。

### Step 2：让 100 个 token 跑一遍 router

跟踪每个 expert 触发的频次。没有偏置时，使用率会偏斜；加上偏置更新循环（过度使用的 expert `-γ`，使用不足的 `+γ`），使用率会在几轮迭代后收敛到均匀分布。

### Step 3：参数量对比

打印一个 MoE 配置的"dense 等价"参数量。按 DeepSeek-V3 的形状：256 routed + 1 shared，8 个 active，d_model=7168。总参数量看着吓人，活跃参数量却只有 dense Llama 3 70B 的七分之一。

## 用起来（Use It）

HuggingFace 加载：

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 年的生产级 inference：vLLM 原生支持 MoE 路由，SGLang 拥有最快的 expert-parallel 路径。两者都会自动处理 top-k 选择和 expert parallelism。

**何时选 MoE：**
- 你想要前沿级质量，但每 token 推理成本要更低。
- 你有足够的显存 / expert-parallel 基础设施。
- 你的工作负载偏 token 密集（聊天、代码），不是上下文密集（长文档）。

**何时不要选 MoE：**
- 边缘部署——任何活跃 FLOP 都得付出全部存储代价。
- 对延迟敏感的单用户服务——expert 路由会增加开销。
- 小模型（<7B）——MoE 的质量优势只在某个算力阈值（约 6B 活跃参数）之上才会出现。

## 上线部署（Ship It）

见 `outputs/skill-moe-configurator.md`。给定参数预算、训练 token 数和部署目标，这个 skill 会为新的 MoE 选择 E、k 以及 shared-expert 的布局。

## 练习（Exercises）

1. **简单。** 跑 `code/main.py`。看看无辅助损失的偏置更新是怎样在 50 次迭代里把 expert 使用率拉平的。
2. **中等。** 把可学习的 router 换成基于 hash 的 router（确定性的，不学习）。比较质量和均衡度。可学习的 router 为什么更好？
3. **困难。** 实现 GRPO 风格的"rollout-matched routing"（DeepSeek-V3.2 的招数）：在 inference 时记录哪些 expert 触发，在梯度计算时强制使用同样的路由。在一个玩具 policy-gradient 实验里测量它的效果。

## 关键术语（Key Terms）

| 术语 | 大家是这么说的 | 实际含义 |
|------|-----------------|-----------------------|
| Expert | "众多 FFN 中的一个" | 一个独立的前馈网络；专门负责 FFN 计算的某个稀疏切片的参数。 |
| Router | "门" | 一个微小的线性层，给每个 token 对每个 expert 打分；做 top-k 选择。 |
| Top-k routing | "每个 token 激活 k 个 expert" | 每个 token 的 FFN 计算恰好经过 k 个 expert，由 gate 加权。 |
| Auxiliary loss | "负载均衡惩罚" | 额外的损失项，惩罚 expert 使用率偏斜。 |
| Auxiliary-loss-free | "DeepSeek-V3 的招数" | 仅通过 router 选择阶段的 per-expert 偏置实现均衡；没有额外梯度。 |
| Shared expert | "永远在线" | 每个 token 都会经过的额外 expert；负责捕获通用知识。 |
| Expert parallelism | "按 expert 切片" | 把不同 expert 分布到不同 GPU 上，把 token 通过网络路由过去。 |
| Sparsity | "活跃参数 < 总参数" | 比例 `k × expert_size / (E × expert_size)`；DeepSeek-V3 是 37/671 ≈ 5.5%。 |

## 延伸阅读（Further Reading）

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538) —— 思想起源。
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961) —— Switch，经典 MoE。
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) —— Mixtral 8×7B。
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) —— MLA + 无辅助损失 MoE + MTP。
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) —— 基于偏置做均衡的论文。
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) —— 本课 router 所采用的细粒度 + 共享 expert 拆分方案。
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) —— shared-expert 的原始论文。
