# 专家混合(Mixture of Experts,MoE)

> 一个稠密 70B Transformer 对每个 token 激活全部参数。一个 671B MoE 每个 token 只激活 37B,却在所有基准测试上胜出。稀疏化是这十年最重要的扩展思想。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 7 · 05(Full Transformer)、Phase 7 · 07(GPT)
**Time:** ~45 minutes

## 问题所在

一个稠密 Transformer 在推理时的 FLOPs 等于其参数量(前向传播乘以 2)。扩大稠密模型的规模,每个 token 都要支付全额代价。到 2024 年,前沿模型已撞上算力之墙:想让模型明显更聪明,就需要每个 token 的 FLOPs 呈指数级增长。

专家混合打破了这一关联。将每个 FFN 替换为 `E` 个独立专家 + 一个为每个 token 挑选 `k` 个专家的路由器。总参数 = `E × FFN_size`。每个 token 的激活参数 = `k × FFN_size`。典型的 2026 年配置:`E=256`、`k=8`。存储随 `E` 扩展,计算随 `k` 扩展。

2026 年的前沿几乎全是 MoE:DeepSeek-V3(671B 总参数 / 37B 激活)、Mixtral 8×22B、Qwen2.5-MoE、Llama 4、Kimi K2、gpt-oss。在 Artificial Analysis 的独立排行榜上,前 10 名开源模型全部是 MoE。

## 核心概念

![MoE layer: router selects k of E experts per token](../assets/moe.svg)

### FFN 替换

稠密 Transformer 块:

```
h = x + attn(norm(x))
h = h + FFN(norm(h))
```

MoE 块:

```
h = x + attn(norm(x))
scores = router(norm(h))              # (N_tokens, E)
top_k = argmax_k(scores)              # pick k of E per token
h = h + sum_{e in top_k}(
        gate(scores[e]) * Expert_e(norm(h))
    )
```

每个专家都是一个独立的 FFN(通常是 SwiGLU)。路由器是一个单独的线性层。每个 token 挑选自己的 `k` 个专家,并得到其输出的门控混合。

### 负载均衡问题

如果路由器把 90% 的 token 都送进专家 3,其他专家就会闲置。已有三种解决方案:

1. **辅助负载均衡损失**(Switch Transformer、Mixtral)。加入一个与专家使用方差成比例的惩罚项。有效,但增加了一个超参数和一路额外的梯度信号。
2. **专家容量 + token 丢弃**(早期 Switch)。每个专家最多处理 `C × N/E` 个 token;超出的 token 跳过该层。会损害质量。
3. **无辅助损失均衡**(DeepSeek-V3)。为每个专家增加一个可学习的偏置,用来偏移路由器的 top-k 选择。偏置在训练损失之外更新。不对主目标施加惩罚。这是 2024 年的重大突破。

DeepSeek-V3 的做法:每个训练步之后,对每个专家检查其使用率是高于还是低于目标。将偏置微调 `±γ`。选择使用 `scores + bias`。用于门控的专家概率则保持原始的 `scores` 不变。将路由与表达解耦。

### 共享专家

DeepSeek-V2/V3 还将专家分为*共享*和*路由*两类。每个 token 都经过所有共享专家。路由专家通过 top-k 挑选。共享专家捕获共同知识;路由专家负责专门化。V3 使用 1 个共享专家加上 256 个路由专家中的 top-8。

### 细粒度专家

经典 MoE(GShard、Switch):每个专家与一个完整 FFN 一样宽。`E` 较小(8–64),`k` 较小(1–2)。

现代细粒度 MoE(DeepSeek-V3、Qwen-MoE):每个专家更窄(FFN 大小的 1/8)。`E` 很大(256+),`k` 更大(8+)。总参数相同,但组合数增长快得多。每个 token 有 `C(256, 8) = 400 trillion` 种可能的“专家”组合。质量提升,延迟保持不变。

### 成本画像

每个 token、每层:

| 配置 | 激活参数 / token | 总参数 |
|--------|-----------------------|--------------|
| Mixtral 8×22B | ~39B | 141B |
| Llama 3 70B(稠密)| 70B | 70B |
| DeepSeek-V3 | 37B | 671B |
| Kimi K2(MoE)| ~32B | 1T |

DeepSeek-V3 在几乎所有基准测试上击败 Llama 3 70B(稠密),同时**每个 token 的激活 FLOPs 更少**。更多参数 = 更多知识。更多激活 FLOPs = 每个 token 更多计算。MoE 将二者解耦。

### 代价:显存

无论哪些专家被触发,所有专家都驻留在 GPU 上。一个 671B 模型的 fp16 权重需要约 1.3 TB 显存。前沿 MoE 部署需要专家并行——把专家分片到多个 GPU,token 跨网络路由。延迟主要由 all-to-all 通信决定,而非矩阵乘法。

```figure
expert-routing
```

## 动手构建

见 `code/main.py`。一个纯标准库实现的紧凑 MoE 层,包含:

- `n_experts=8` 个 SwiGLU 风格的专家(每个一个线性层,仅作演示)
- top-k=2 路由
- softmax 归一化的门控权重
- 通过每专家偏置实现的无辅助损失均衡

### 第 1 步:路由器

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

偏置影响选择,而不影响门控权重。这正是 DeepSeek-V3 的技巧——偏置修正负载不均衡,而不左右模型的预测。

### 第 2 步:让 100 个 token 通过路由器

统计哪些专家被触发、触发多少次。没有偏置时,使用率是偏斜的。加入偏置更新循环(对过度使用的专家 `-γ`,对使用不足的专家 `+γ`),几轮迭代后使用率会收敛到均匀分布。

### 第 3 步:参数量对比

打印某个 MoE 配置的“稠密等效值”。DeepSeek-V3 形状:256 路由 + 1 共享,8 个激活,d_model=7168。总参数量触目惊心。激活参数量只有稠密 Llama 3 70B 的七分之一。

## 使用

HuggingFace 加载:

```python
from transformers import AutoModelForCausalLM, AutoTokenizer
model = AutoModelForCausalLM.from_pretrained("mistralai/Mixtral-8x22B-v0.1")
```

2026 年生产级推理:vLLM 原生支持 MoE 路由。SGLang 拥有最快的专家并行路径。两者都会自动处理 top-k 选择和专家并行。

**何时选择 MoE:**
- 你想要前沿质量,同时降低每个 token 的推理成本。
- 你具备显存 / 专家并行基础设施。
- 你的工作负载是 token 密集型(聊天、代码)而非上下文密集型(长文档)。

**何时不选择 MoE:**
- 边缘部署——无论激活多少 FLOPs,你都要支付全部存储成本。
- 延迟敏感的单用户服务——专家路由带来额外开销。
- 小模型(<7B)——MoE 的质量优势只在超过某个算力阈值(约 6B 激活参数)后才显现。

## 上线

见 `outputs/skill-moe-configurator.md`。该技能会在给定参数预算、训练 token 数和部署目标的情况下,为新 MoE 选定 E、k 和共享专家布局。

## 练习

1. **简单。** 运行 `code/main.py`。观察无辅助损失偏置更新如何在 50 轮迭代中拉平专家使用率。
2. **中等。** 将可学习路由器替换为基于哈希的路由器(确定性、无学习)。比较质量和均衡度。为什么可学习路由器更好?
3. **困难。** 实现 GRPO 风格的“rollout 匹配路由”(DeepSeek-V3.2 技巧):记录推理时哪些专家被触发,并在梯度计算时强制使用相同路由。在一个玩具策略梯度设置中测量其效果。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 专家(Expert)| “众多 FFN 之一” | 一个独立的前馈网络;参数专属于 FFN 计算的一个稀疏切片。 |
| 路由器(Router)| “门控” | 一个微小的线性层,对每个 token 与每个专家打分;top-k 选择。 |
| Top-k 路由 | “每个 token k 个激活专家” | 每个 token 的 FFN 计算恰好经过 k 个专家,并按门控加权。 |
| 辅助损失 | “负载均衡惩罚” | 惩罚专家使用偏斜的额外损失项。 |
| 无辅助损失 | “DeepSeek-V3 的技巧” | 仅通过路由器选择上的每专家偏置实现均衡;无额外梯度。 |
| 共享专家 | “永远开启” | 每个 token 都经过的额外专家;捕获共同知识。 |
| 专家并行 | “按专家分片” | 将不同专家分布到不同 GPU;token 跨网络路由。 |
| 稀疏度 | “激活参数 < 总参数” | 比例 `k × expert_size / (E × expert_size)`;DeepSeek-V3 为 37/671 ≈ 5.5%。 |

## 延伸阅读

- [Shazeer et al. (2017). Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer](https://arxiv.org/abs/1701.06538) — 这一思想的起源。
- [Fedus, Zoph, Shazeer (2022). Switch Transformer: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity](https://arxiv.org/abs/2101.03961) — Switch,经典 MoE。
- [Jiang et al. (2024). Mixtral of Experts](https://arxiv.org/abs/2401.04088) — Mixtral 8×7B。
- [DeepSeek-AI (2024). DeepSeek-V3 Technical Report](https://arxiv.org/abs/2412.19437) — MLA + 无辅助损失 MoE + MTP。
- [Wang et al. (2024). Auxiliary-Loss-Free Load Balancing Strategy for Mixture-of-Experts](https://arxiv.org/abs/2408.15664) — 基于偏置的均衡论文。
- [Dai et al. (2024). DeepSeekMoE: Towards Ultimate Expert Specialization in Mixture-of-Experts Language Models](https://arxiv.org/abs/2401.06066) — 本课路由器使用的细粒度 + 共享专家拆分。
- [Kim et al. (2022). DeepSpeed-MoE: Advancing Mixture-of-Experts Inference and Training](https://arxiv.org/abs/2201.05596) — 最早的共享专家论文。