# 11 · 专家混合（Mixture of Experts, MoE）

> 一个稠密的 70B Transformer 会为每个 token 激活全部参数。一个 671B 的 MoE 每个 token 只激活 37B，却在每项基准测试上都胜过它。稀疏性（sparsity）是这十年来最重要的扩展思想。

**类型：** 实践构建
**语言：** Python
**前置：** 阶段 7 · 05（完整 Transformer），阶段 7 · 07（GPT）
**时长：** 约 45 分钟

## 问题所在

稠密 Transformer 在推理时的浮点运算量（FLOPs）等于其参数量（前向传播时再乘以 2）。把一个稠密模型扩大，每个 token 都要支付全额账单。到 2024 年，前沿模型撞上了一堵算力墙：想要变得有意义地更聪明，每个 token 所需的 FLOPs 就要指数级增长。

专家混合打破了这种关联。把每个 FFN 替换为 `E` 个相互独立的专家（experts）外加一个为每个 token 挑选 `k` 个专家的路由器（router）。总参数量 = `E × FFN_size`。每个 token 的激活参数量 = `k × FFN_size`。2026 年的典型配置：`E=256`、`k=8`。存储随 `E` 扩展，算力随 `k` 扩展。

2026 年的前沿模型几乎全是 MoE：DeepSeek-V3（671B 总参 / 37B 激活）、Mixtral 8×22B、Qwen2.5-MoE、Llama 4、Kimi K2、gpt-oss。在 Artificial Analysis 的独立排行榜上，排名前 10 的开源模型全部都是 MoE。

## 核心概念

〔图：MoE 层——路由器为每个 token 从 E 个专家中选出 k 个〕

### FFN 的替换

稠密 Transformer 块：

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

MoE 块：

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # 为每个 token 从 E 个专家中挑选 k 个
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

每个专家都是一个独立的 FFN（通常是 SwiGLU）。路由器只是一个线性层。每个 token 挑选属于自己的 `k` 个专家，并得到这些专家输出经门控（gating）后的混合结果。

### 负载均衡问题

如果路由器把 90% 的 token 都送进 3 号专家，其余专家就会"挨饿"。人们尝试过三种修法：

1. **辅助负载均衡损失（auxiliary load-balancing loss）**（Switch Transformer、Mixtral）。加入一个与专家使用率方差成正比的惩罚项。有效，但引入了一个超参数和第二路梯度信号。
2. **专家容量 + token 丢弃（expert capacity + token dropping）**（早期 Switch）。每个专家最多处理 `C × N/E` 个 token；溢出的 token 跳过该层。会损害质量。
3. **无辅助损失均衡（auxiliary-loss-free balancing）**（DeepSeek-V3）。为每个专家加上一个可学习的偏置（bias），用以平移路由器的 top-k 选择。该偏置在训练损失之外更新，对主目标不施加任何惩罚。这是 2024 年的重大突破。

DeepSeek-V3 的做法：每个训练步之后，对每个专家，检查其使用率高于还是低于目标值，将偏置朝 `±γ` 方向轻推。选择时使用 `scores + bias`。而用于门控的专家概率仍是原始的 `scores`，保持不变。这就把路由（routing）与表达（expression）解耦了。

### 共享专家

DeepSeek-V2/V3 还把专家拆分为*共享专家（shared）*与*路由专家（routed）*。每个 token 都会经过所有共享专家。路由专家则通过 top-k 挑选。共享专家捕获通用知识；路由专家负责专门化。V3 配置为 1 个共享专家加上从 256 个路由专家中选出的 top-8。

### 细粒度专家

经典 MoE（GShard、Switch）：每个专家与一个完整 FFN 一样宽。`E` 较小（8–64），`k` 较小（1–2）。

现代细粒度 MoE（DeepSeek-V3、Qwen-MoE）：每个专家更窄（约为 FFN 的 1/8）。`E` 很大（256+），`k` 也更大（8+）。总参数量相同，但组合数增长得快得多。每个 token 有 `C(256, 8) = 400 万亿` 种可能的"专家"组合。质量上升，延迟保持不变。

### 成本概况

每 token、每层：

| 配置 | 每 token 激活参数 | 总参数 |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B（稠密） | 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2（MoE） | ~32B | 1T |

DeepSeek-V3 在几乎所有基准测试上都胜过 Llama 3 70B（稠密），同时**每 token 的激活 FLOPs 更少**。更多参数 = 更多知识。更多激活 FLOPs = 每 token 更多算力。MoE 把两者解耦了。

### 代价：显存

无论哪些专家被触发，所有专家都常驻 GPU。一个 671B 模型的 fp16 权重需要约 1.3 TB 显存（VRAM）。前沿 MoE 的部署需要专家并行（expert parallelism）——把专家分片到多张 GPU 上，让 token 跨网络路由。延迟由全互联（all-to-all）通信主导，而非矩阵乘法。

## 动手构建

参见 `code/main.py`。一个用纯标准库实现的紧凑 MoE 层，包含：

- `n_experts=8` 个类 SwiGLU 专家（为便于演示，每个仅一层线性）
- top-k=2 路由
- softmax 归一化的门控权重
- 通过每专家偏置实现的无辅助损失均衡

### 第 1 步：路由器

```python
def route(hidden, W_router, top_k, bias):
    scores = [sum(h * w for h, w in zip(hidden, W_router[e])) for e in range(len(W_router))]
    biased = [s + b for s, b in zip(scores, bias)]
    top_idx = sorted(range(len(biased)), key=lambda i: -biased[i])[:top_k]
    # 对所选专家的原始（ORIGINAL）scores 做 softmax
    chosen = [scores[i] for i in top_idx]
    m = max(chosen)
    exps = [math.exp(c - m) for c in chosen]
    s = sum(exps)
    gates = [e / s for e in exps]
    return top_idx, gates
```

偏置影响选择，而不影响门控权重。这正是 DeepSeek-V3 的技巧——偏置修正负载不均衡，却不会左右模型的预测。

### 第 2 步：让 100 个 token 通过路由器

追踪各专家被触发的频率。没有偏置时，使用率是倾斜的。加入偏置更新循环（对过载专家用 `-γ`，对欠载专家用 `+γ`）后，使用率会在数次迭代内收敛到均匀分布。

### 第 3 步：参数量对比

打印某个 MoE 配置的"稠密等价"参数量。仿 DeepSeek-V3 形状：256 个路由专家 + 1 个共享专家，激活 8 个，d_model=7168。总参数量令人咋舌。而激活参数量仅为稠密 Llama 3 70B 的七分之一。

## 实际使用

HuggingFace 加载：

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 年的生产推理：vLLM 原生支持 MoE 路由。SGLang 拥有最快的专家并行路径。两者都会自动处理 top-k 选择与专家并行。

**何时选择 MoE：**
- 你想以更低的每 token 推理成本获得前沿质量。
- 你拥有相应的显存 / 专家并行基础设施。
- 你的工作负载是 token 密集型（聊天、代码），而非上下文密集型（长文档）。

**何时不要选择 MoE：**
- 边缘部署——你要为任何一次激活 FLOP 支付全额存储成本。
- 延迟敏感的单用户服务——专家路由会带来额外开销。
- 小模型（<7B）——MoE 的质量优势只在算力超过某个阈值（约 6B 激活参数）后才显现。

## 交付落地

参见 `outputs/skill-moe-configurator.md`。给定参数预算、训练 token 数与部署目标，该技能会为一个新的 MoE 挑选 E、k 以及共享专家布局。

## 练习

1. **简单。** 运行 `code/main.py`。观察无辅助损失偏置更新如何在 50 次迭代内让专家使用率趋于均衡。
2. **中等。** 用基于哈希的路由器（确定性、无学习）替换可学习路由器。比较质量与均衡性。为什么可学习路由器更好？
3. **困难。** 实现 GRPO 风格的"rollout 匹配路由"（DeepSeek-V3.2 的技巧）：记录推理时哪些专家被触发，在梯度计算时强制使用相同的路由。在一个玩具级策略梯度（policy-gradient）设置上测量其影响。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| Expert（专家） | "众多 FFN 中的一个" | 一个独立的前馈网络；为 FFN 计算的某个稀疏切片所专用的参数。 |
| Router（路由器） | "门" | 一个微小的线性层，为每个 token 对每个专家打分；做 top-k 选择。 |
| Top-k routing（top-k 路由） | "每 token k 个激活专家" | 每个 token 的 FFN 计算恰好经过 k 个专家，按门控加权。 |
| Auxiliary loss（辅助损失） | "负载均衡惩罚" | 惩罚专家使用率倾斜的额外损失项。 |
| Auxiliary-loss-free（无辅助损失） | "DeepSeek-V3 的技巧" | 仅通过路由器选择上的每专家偏置实现均衡；无额外梯度。 |
| Shared expert（共享专家） | "始终开启" | 每个 token 都会经过的额外专家；捕获通用知识。 |
| Expert parallelism（专家并行） | "按专家分片" | 把不同专家分布到不同 GPU；让 token 跨网络路由。 |
| Sparsity（稀疏性） | "激活参数 < 总参数" | 比值 `k × expert_size / (E × expert_size)`；DeepSeek-V3 为 37/671 ≈ 5.5%。 |

## 延伸阅读

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538) —— 这个思想的起源。
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961) —— Switch，经典 MoE。
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) —— Mixtral 8×7B。
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) —— MLA + 无辅助损失 MoE + MTP。
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) —— 基于偏置的均衡论文。
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) —— 本课路由器所采用的细粒度 + 共享专家拆分方案。
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) —— 共享专家的原始论文。
