# 推测解码与 EAGLE

> 前沿 LLM 生成一个 token 需要对数十亿参数进行完整前向传递。该前向传递大量超额配置：大多数时候，小得多的模型可以正确猜测接下来的 3-5 个 token，而大模型只需要*验证*猜测。当猜测正确时，你以 1 个 token 的价格获得 5 个 token。推测解码（Leviathan 等人 2023）使这精确，而 EAGLE-3（2025）将接受率推至 ~4.5 个 token 每验证 —— 在匹配输出分布下 4-5x 加速。

**类型：** 构建
**语言：** Python（使用 numpy）
**前置要求：** 第 10 阶段第 12 课（推理优化），第 10 阶段第 04 课（预训练 Mini-GPT）
**时间：** ~75 分钟

## 问题

H100 上 70B 级模型的解码吞吐量通常为 40-80 token/秒。每个 token 需要完整前向传递从 HBM 读取所有模型权重。你无法在不改变输出的情况下使模型更小。你无法超过内存增加批大小。你卡住了 —— 除非你能让模型每次前向传递输出多于一个 token。

自回归生成看起来固有串行：`x_{t+1} = sample(p(· | x_{1:t}))`。但存在并发机会。如果你有一个廉价的预测器说"接下来的 4 个 token 可能是 [a, b, c, d]"，你可以在**大模型的单次前向传递**中验证所有 5 个位置并接受最长匹配前缀。

Leviathan, Kalai, Matias（2023，"Fast Inference from Transformers via Speculative Decoding"）通过巧妙的接受/拒绝规则使这精确，保留目标模型的采样分布。相同输出分布，2-4× 更快。

## 核心概念

### 双模型设置

- **目标模型** `M_p`：你想要样本的大、慢、高质量模型。分布：`p(x)`。
- **草稿模型** `M_q`：小、快、低质量模型。分布：`q(x)`。小 5-30×。

每步：

1. 草稿模型自回归提议 `K` 个 token：`x_1, x_2, ..., x_K ~ q`。
2. 目标模型对所有 `K+1` 位置并行运行一次前向传递，为每个提议 token 产生 `p(x_k)`。
3. 通过以下修改的拒绝采样规则从左到右接受/拒绝每个 token。接受最长匹配前缀。
4. 如果任何 token 被拒绝，从修正分布采样替换并停止。否则从 `p(· | x_1...x_K)` 采样一个奖励 token。

如果草稿与目标完美匹配，你每次目标前向获得 K+1 个 token。如果草稿在位置 1 错误，你只获得 1 个 token。

### 精确规则

推测解码**在分布上可证明等价于从 p 采样**。拒绝规则：

```
对于每个草稿 token x_t：
    r ~ Uniform(0, 1)
    if r < p(x_t) / q(x_t)：
        接受 x_t
    else：
        从残差采样替换：(p - q)+ / ||(p - q)+||_1
        停止
```

其中 `(p - q)+` 表示逐点差的正部。当草稿和目标一致（`p ≈ q`）时接受接近 1。当它们不一致时，残差分布被构造使整体样本仍然精确为 `p`。

**贪婪情况。** 对于 temperature=0 采样只需检查 `argmax(p) == x_t`。如果是，接受；如果不是，输出 `argmax(p)` 并停止。

### 预期加速

如果草稿模型的 token 级接受率为 `α`，每次目标前向传递产生的预期 token 为：

```
E[token] = (1 - α^{K+1}) / (1 - α)        # K = 草稿长度，α ∈ [0, 1]
```

在 `α = 0.8, K = 4`：`(1 - 0.8^5)/(1 - 0.8) = 3.36` 每前向 token。单次目标前向成本约为 `cost_q * K + cost_p`（K 草稿步骤加一次目标验证）。如果 `cost_p >> cost_q * K`，加速比为 `3.36× / 1 = 3.36×` 吞吐量。

唯一真正的参数是 `α`，它完全依赖草稿-目标对齐。好的草稿是一切。

### 训练草稿：蒸馏

随机小模型制作差的草稿。标准配方是从目标蒸馏：

1. 选择小型架构（70B 目标约 1B，7B 目标约 500M）。
2. 在大型文本语料库上运行目标模型；存储其 next-token 分布。
3. 用 KL 散度针对目标分布训练草稿（而非针对 ground-truth token）。

结果：`α` 通常在代码上 0.6-0.8，自然语言聊天上 0.7-0.85。生产中加速 2-3×。

### EAGLE：树草稿 + 特征重用

Li, Wei, Zhang, Zhang（2024，"EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty"）观察到标准推测解码中的两个低效：

1. 草稿执行 K 串行步骤，每个全栈。但草稿可以重用目标最近验证的特征（隐藏状态）— 目标已经计算了草稿从头重新推导的丰富表示。
2. 草稿输出线性链。如果草稿可以输出*树*候选（每个节点多个猜测），目标单次前向传递可以通过树 attention mask 并行验证多个候选路径，并选择最长接受分支。

EAGLE-1 改变：
- 草稿输入 = 位置 t 的目标最终隐藏状态，非原始 token。
- 草稿架构 = 1 个 transformer 解码器层（非单独小模型）。
- 输出 = 每深度 K = 4-8 候选，深度 4-6 的树。

EAGLE-2（2024）添加动态树拓扑：树在草稿不确定处变宽，在自信处保持窄。提高 `α_effective` 而不增加验证成本。

EAGLE-3（Li 等人 2025，"EAGLE-3: Scaling up Inference Acceleration of Large Language Models via Training-Time Test"）移除固定顶层特征依赖并用新的"测试时模拟"损失训练草稿 —— 草稿在与目标测试时分布匹配而非教师强制训练分布的输出上训练。接受率从 0.75（EAGLE-2）升至 0.82（EAGLE-3），且每验证平均 token 从 3.0 到 4.5。

### 树 Attention 验证

当草稿输出树时，目标模型在单次前向传递中使用**树 attention mask**验证它 —— 编码树拓扑而非纯线的因果 mask。每个 token 只 attend 其在树中的祖先。验证传递仍然是一次前向，一次 matmul；拓扑 mask 只花费几个额外 KV 条目。

```
        root
       /    \
      a      b
     / \    / \
    c  d   e   f
```

如果 `a, b` 是竞争的首 token 候选且 `c, d, e, f` 是次 token 候选，所有六个位置在一次前向传递中验证。输出是沿任何接受路径的最长前缀。

### 何时赢，何时不

**赢：**
- 聊天/补全有可预测文本（代码、常见英语、结构化输出）。`α` 高。
- 解码期间有未使用 GPU 计算的设置（内存受限阶段）。树草稿使用可用 FLOP。

**输/无赢：**
- 高随机输出（高温创意写作）。`α` 降至 `1/|vocab|`。
- 非常高并发的批服务 —— 批处理已经填满 FLOP，树验证空间小。
- 非常小的目标模型，草稿小不了多少。

生产商店通常报告聊天上 2-3× 挂钟加速，代码生成上 3-5×，创意写作上接近零。

## 构建

`code/main.py`：

- 参考 `speculative_decode(target, draft, prompt, K, temperature)`，实现精确拒绝规则并验证它保留目标分布（经验 KL < 0.01 vs 纯目标采样）。
- EAGLE 风格树草稿器，构建深度 K 树，top-p 分支。
- 树 attention mask 构建器，为验证器产生正确因果模式。
- 接受率工具，在微型 LM 上运行两者（从 GPT-2-medium 目标蒸馏一个 GPT-2-small）。

```python
def speculative_step(p_target, q_draft, K, temperature=1.0):
    """一轮推测解码。返回接受的 token 列表。"""
    # 1. 草稿 K 个 token
    draft_tokens = []
    q_probs = []
    state = draft_state_init()
    for _ in range(K):
        probs = softmax(q_draft(state) / temperature)
        t = np.random.choice(len(probs), p=probs)
        draft_tokens.append(t)
        q_probs.append(probs[t])
        state = draft_step(state, t)

    # 2. 目标在每个草稿位置 + 1 额外位置计算 p
    p_probs_all = target_forward_batched(p_target, draft_tokens, temperature)

    # 3. 从左到右接受/拒绝
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
    # 4. 所有 K 接受 → 从目标采样奖励 token
    accepted.append(np.random.choice(len(p_probs_all[-1]), p=p_probs_all[-1]))
    return accepted
```

## 使用它

- **vLLM** 和 **SGLang** 出货一级推测解码。标志：`--speculative_model`, `--num_speculative_tokens`。通过 `--spec_decoding_algorithm eagle` 标志支持 EAGLE-2/3。
- **NVIDIA TensorRT-LLM** 原生支持 Medusa 和 EAGLE 树。
- **参考草稿模型**：`Qwen/Qwen3-0.6B-spec`（Qwen3-32B 的草稿），`meta-llama/Llama-3.2-1B-Instruct-spec`（70B 的草稿）。
- **Medusa head**（Cai 等人 2024，"Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads"）：替代草稿模型，向目标本身添加 K 并行预测 head。部署更简单，接受率略低于 EAGLE。

## 交付

本课生成 `outputs/skill-speculative-tuning.md` —— 分析目标模型工作负载并选择的技能：草稿模型、K（草稿长度）、树宽度、温度，以及何时回退到纯解码。

## 练习

1. 实现精确拒绝规则并经验验证它。通过 `speculative_decode` 和纯目标采样运行 10K 样本；计算两个输出分布之间的 TV 距离。应 < 0.01。

2. 计算加速公式。给定固定 `α` 和 `K`，绘制每次目标前向的预期 token。找到 α ∈ {0.5, 0.7, 0.9} 的最优 K。

3. 训练微型草稿。取 124M GPT-2 目标并在 100M token 上用 KL 损失蒸馏 30M GPT-2 草稿。在 held-out 文本上测量 `α`。预期：0.6-0.7。

4. 实现 EAGLE 风格树草稿。替代链，让草稿在每深度输出 top-3 分支。构建树 attention mask。验证目标接受最长正确分支。

5. 测量失败模式。在 temperature=1.5（高随机性）下运行推测解码。显示 α 崩溃且算法由于草稿开销比纯解码慢。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| 目标模型 | "大模型" | 你想要样本的慢、高质量模型（p 分布） |
| 草稿模型 | "推测器" | 小、快预测器（q 分布）；小 5-30x |
| K / 草稿长度 | "前瞻" | 每次验证传递推测的 token 数 |
| α / 接受率 | "命中率" | 草稿提议被接受的每 token 概率 |
| 精确拒绝规则 | "接受测试" | 保留目标分布的 r < p/q 比较 |
| 残差分布 | "修正的 p-q" | (p - q)+ / ||(p - q)+||_1，拒绝时从中采样的分布 |
| 树草稿 | "分支推测" | 草稿输出候选树，单次传递通过树结构 attention mask 验证 |
| 树 attention mask | "拓扑 mask" | 编码树拓扑的因果 mask，每个节点只 attend 其祖先 |
| Medusa head | "并行 head" | 目标本身上的 K 个额外预测 head；无单独草稿模型 |
| EAGLE 特征重用 | "隐藏状态草稿" | 草稿输入是目标最后隐藏状态，非原始 token，缩小草稿 |
| 测试时模拟损失 | "EAGLE-3 训练" | 在与目标测试时分布匹配的输出上训练草稿，非教师强制 |

## 延伸阅读

- [Leviathan, Kalai, Matias, 2023 — "Fast Inference from Transformers via Speculative Decoding"](https://arxiv.org/abs/2211.17192) —— 精确拒绝规则和理论加速分析
