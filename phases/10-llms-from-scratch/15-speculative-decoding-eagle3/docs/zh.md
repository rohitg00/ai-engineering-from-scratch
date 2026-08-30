# 推测解码与 EAGLE-3

> 第 7 阶段 · 第 16 课证明了数学：Leviathan 拒绝规则精确地保留了验证器的分布。本课是 2026 年生产推测解码的训练栈视角。EAGLE-3 将草稿模型从廉价近似转变为基于验证器自身隐藏状态训练的目的构建微型网络，然后添加了一个训练时测试循环，对齐其训练和推理分布。结果：端到端加速 3× 到 6.5×，聊天场景每 token 接受率超过 0.9，无分布权衡。2026 年每个生产推理栈默认启用它。

**类型：** 构建
**语言：** Python（标准库）
**前置要求：** 第 7 阶段 · 16（推测解码数学），第 10 阶段 · 12（推理优化）
**时间：** ~75 分钟

## 学习目标

- 用一句话陈述 Leviathan 定理，并证明推测循环产生的样本与验证器同分布
- 走过从 vanilla 推测解码（Leviathan 2023）到 EAGLE、EAGLE-2 和 EAGLE-3 的两年演进，并说出每一步消除的确切限制
- 从接受率 `α` 和草稿-验证器成本比 `c` 计算预期加速，并为每个机制选择最优草稿长度 `N`
- 从零实现完整的推测循环：草稿、验证、从残差中拒绝采样、拒绝时回滚 KV 缓存、全接受时发出奖励 token

## 问题

在 70B 模型上的自回归解码在 H100 上可能以每秒 35 个 token 运行。GPU 远未饱和。内存带宽是天花板：每个 token 从 HBM 加载 70B 权重，做一步算术，产生一个浮点数。计算单元大多空闲。

推测解码将其转变为你可以实际解决的吞吐问题。一个廉价草稿在 `N` 次小前向传播中提议 `N` 个 token。验证器在前缀加所有 `N` 个草稿上运行一次。如果验证器在位置 `i` 的分布与草稿一致（在我们将精确化的统计意义上），我们接受；否则，我们拒绝并从残差分布中采样校正。一次大模型前向产生最多 `N+1` 个接受的 token，而非一个。

重要的定理是 Leviathan, Kalman, Matias（ICML 2023）：输出分布与直接从验证器采样产生的分布相同。不是近似。完全相同。这就是推测解码在生产中可接受的全部原因 —— 它是一个纯延迟优化，无质量权衡。

第 7 阶段 · 第 16 课给你的是数学。本课给你的是训练栈。一个好的草稿比廉价草稿价值 2 倍以上的加速。EAGLE、EAGLE-2 和 EAGLE-3（Li et al., 2024–2025）将"草稿 = 同一模型的更小版本"转变为精确的工程学科。2026 年生产推理服务器默认使用 EAGLE-3。

## 核心概念

### 不变量：Leviathan 拒绝采样

设 `p(t)` 为给定某个前缀时草稿对下一个 token 的分布，`q(t)` 为验证器的。从草稿采样 `d ~ p`。以概率 `min(1, q(d) / p(d))` 接受。拒绝时，从残差分布 `(q - p)_+ / ||(q - p)_+||_1` 采样。结果样本按 `q` 分布。无论 `p` 多差这都成立 —— 越差，拒绝越频繁，但输出保持精确。

将 `N` 个这样的调用背靠背堆叠，使用一次验证器前向传播在 `prefix + d_1 + ... + d_N` 上。验证器同时返回 `q_1, q_2, ..., q_{N+1}`。从左到右遍历。在位置 `j` 第一次拒绝时，从 `residual(q_j, p_j)` 采样并停止。全接受时，从 `q_{N+1}` 采样一个奖励 token。

### 什么决定加速

设 `α` 为每草稿 token 的预期接受率。设 `c = cost(draft) / cost(verifier)` 为成本比。每验证器前向传播的预期接受 token 数为：

```
E[accepted] = (1 - α^(N+1)) / (1 - α)
```

每接受 token 的预期总 wall 时间为 `(N * c + 1) / E[accepted]`。关于 `N` 最小化它，你就得到了甜点。对于 `α = 0.8, c = 0.05`：最优 `N` 约为 5–7，加速为 3.2×。对于 `α = 0.95, c = 0.02`：最优 `N` 约为 8–10，加速接近 5×。

单个最大的杠杆是 `α`。在固定 `N = 5` 下，从 `α = 0.6`（vanilla 草稿）到 `α = 0.9`（EAGLE-3）将你从每验证器前向 2.2 个预期接受 token 带到 4.1。相同的验证器近 2 倍更多吞吐。

### 两年演进

**Vanilla 推测（Leviathan, 2023）。** 草稿模型是同一家族独立训练的较小 LLM。易于接入，`α ≈ 0.6`，加速最多约 2×。

**EAGLE-1（Li et al., 2024）。** 草稿是一个微型 transformer —— 通常一到两层 —— 以验证器的最后一层隐藏状态为输入并直接预测下一个 token。因为草稿看到验证器的特征表示，其分布更接近验证器的。`α` 攀升到 0.7–0.8。

**EAGLE-2（Li et al., 2024）。** 添加动态草稿树：而非提议单个 `N` token 序列，提议一小树候选，用一次前向传播（树 attention）为每个评分，并遍历最高概率路径。草稿长度每步自适应。每接受路径 token 的 `α` 攀升超过 0.85。

**EAGLE-3（Li et al., 2025, NeurIPS）。** 两个更多改动。首先，完全放弃特征预测损失 —— EAGLE-1/2 训练草稿匹配验证器的隐藏状态，这限制了数据帮助的程度。EAGLE-3 直接在 token 预测上训练。其次，训练时测试（TTT）：在草稿训练期间，将草稿自己的先前预测作为输入在多个步骤中反馈，与它在推理时的操作方式相同。这对齐训练和测试分布并阻止错误累积。测量加速：聊天场景最高 6.5×，H100 上 SGLang batch 64 时吞吐提升 38%。

### KV 缓存回滚

验证将验证器的 KV 缓存一次扩展 `N` 个条目。如果在位置 `j` 拒绝，位置 `j-1` 之后的缓存内容现在错误。两种常见实现：写入暂存缓冲区并在接受时提交（vLLM、TensorRT-LLM），或保持物理 KV 缓存加逻辑长度并在拒绝时截断。无论哪种方式，回滚成本是每层每 head 的字节，与前向传播成本相比可忽略。

对于 EAGLE-2 树搜索，验证器用尊重树拓扑的非因果 mask 运行 attention。工程上繁琐但计算是带有自定义 mask 的标准 flash-attention 调用。

### 2026 年草稿架构

| 策略 | 草稿类型 | `α` | 加速 | 训练成本 |
|----------|-----------|-----|---------|---------------|
| Vanilla | 独立小 LLM | 0.55-0.70 | 1.8-2.3× | 无（复用现有小模型） |
| Medusa | 验证器上的额外 LM head | 0.65-0.75 | 2-3× | ~1B SFT token |
| EAGLE-1 | 隐藏状态上的 1 层 transformer | 0.70-0.80 | 2.5-3× | ~60B token |
| EAGLE-2 | EAGLE-1 + 动态草稿树 | 0.80-0.88 | 3-4× | ~60B token |
| EAGLE-3 | 多层特征融合 + TTT | 0.88-0.92 | 3.5-6.5× | ~60-200B token |
| Lookahead | 无草稿（Jacobi 迭代） | N/A | 1.3-1.6× | 无 |

2026 年生产中：vLLM 和 SGLang 在可用时默认使用 EAGLE-3，否则使用 EAGLE-2。TensorRT-LLM 对 Meta 和 NVIDIA 公共模型有最快的 Medusa 路径。llama.cpp 为 CPU 部署提供 vanilla 草稿。

## 构建

见 `code/main.py`。这是带有所有部分的完整 Leviathan 推测循环：N 草稿、验证器并行传播、每位置拒绝、残差采样、奖励 token、KV 回滚，以及输出分布与直接从 `q` 采样匹配的实证验证。

### 步骤 1：拒绝规则

```python
def accept(q_prob, p_prob, u):
    if p_prob <= 0:
        return True
    return u < min(1.0, q_prob / p_prob)
```

### 步骤 2：残差分布

```python
def residual(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0:
        return list(q)
    return [r / s for r in raw]
```

### 步骤 3：完整推测步骤

`spec_step` 函数从 `p` 草稿 `N` 个 token，然后在一次并行 `q` 评估中验证所有。对于每个草稿 token 应用拒绝规则，第一次拒绝时从残差采样校正。如果全部接受，从 `q_{N+1}` 发出奖励 token。

### 步骤 4：KV 回滚簿记

模拟器跟踪每个 worker 的逻辑 `kv_length`。接受 `k` 个草稿时，`kv_length += k`。在位置 `j` 拒绝时，缓存已写入超过 `j`，但逻辑长度设为 `prefix_length + j + 1` —— 校正 token 之后一个。后续读取截断到逻辑长度。

### 步骤 5：Leviathan 检查

运行 50,000 推测步骤。计数接受 token 的经验分布。与 50,000 个直接从 `q` 的样本比较。卡方统计量应远低于临界值。定理在实践中通过。

### 步骤 6：加速 vs. α

通过在不同幅度上扰动 `p` 远离 `q` 来扫描草稿质量。测量 `α`，然后绘制每验证器调用的预期 token 作为 `α` 和 `N` 的函数。代码打印表格展示 EAGLE-3 级草稿质量（`α ≈ 0.9`）如何解锁每验证器调用 4–5 个 token。

## 使用它

生产级 `vllm serve` 带 EAGLE-3：

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct \
  --speculative-config '{
    "model": "yuhuili/EAGLE3-LLaMA3.3-Instruct-70B",
    "num_speculative_tokens": 5,
    "method": "eagle3"
  }'
```

H100 上 SGLang 带 EAGLE-3 在 batch 64：根据 EAGLE-3 论文，比 batch-64 vanilla 解码吞吐高约 1.38×。

何时使用推测解码：

- 任何 p50 延迟比峰值吞吐更重要的交互式聊天工作负载。
- 代码生成和结构化输出（JSON、SQL）。`α` 超过 0.9，因为目标分布高度可预测。
- 长文本生成（数千 token）。摊销加速持续支付。

何时不使用：

- 非常小的模型（< 3B）。草稿并不比验证器便宜多少。
- 极小的 batch-1 CPU 部署。草稿模型的内存开销可能不值得。
- `α` 崩溃的极高温创意采样。

## 交付

本课生成 `outputs/skill-eagle3-tuner.md`。给定推理工作负载（模型、batch size、目标延迟、任务画像），它推荐推测解码策略和调优参数（草稿家族、`N`、树深度、温度感知切换）。

## 练习

1. 运行 `code/main.py`。确认 Leviathan 分布检查上的卡方统计量在 50,000 个样本上保持在 95% 临界值以下。

2. 在 `α` 固定为 0.9 和 `c` 固定为 0.04 下，将 `N` 从 1 扫到 10。绘制每验证器调用的预期 token 和每 token 实际 wall 时间。找到最小化 wall 时间的 `N`。解释曲线的形状。

3. 修改代码以模拟 EAGLE-2 树搜索：每步，草稿提议形状为 `[2, 2, 2]` 的树（八条候选路径）。验证器运行一次，最高概率接受路径获胜。计算每叶子的 `α` 和每验证器调用的总 token。与等效计算的线性链推测解码比较。

4. 为两个并发序列实现 batch KV 回滚模拟器。序列 A 所有草稿接受；序列 B 在位置 2 拒绝。显示正确的 `kv_length` 每序列更新且没有工作浪费。

5. 阅读 EAGLE-3 论文的第 4 节（Training-Time Test）。用两句话解释为什么无 TTT 的朴素草稿训练遭受暴露偏差，以及为什么在训练期间将草稿自己的预测反馈给它修复了它。将其连接到 seq2seq 中的计划采样文献。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Leviathan 规则 | "min(1, q over p)" | 以概率 `min(1, q(d)/p(d))` 的 Bernoulli 接受/拒绝，拒绝时从残差采样，精确保留验证器分布 |
| 残差分布 | "(q 减 p) 正部，归一化" | `(q - p)_+` 在零处截断并重新归一化 —— 拒绝时从中采样的正确分布 |
| 接受率 α | "草稿多经常对" | 拒绝规则下的预期每 token Bernoulli 成功概率；控制所有加速数学 |
| EAGLE-1 | "隐藏状态草稿" | 以验证器最后一层隐藏状态为条件的微型 transformer 草稿（Li et al., 2024） |
| EAGLE-2 | "动态草稿树" | EAGLE-1 加候选延续树，用一次验证器传播中的树 attention 评分 |
| EAGLE-3 | "训练时测试" | 放弃特征预测损失，在草稿训练期间用草稿自己的输出训练直接 token 预测 |
| 训练时测试（TTT） | "暴露偏差修复" | 训练期间自回归运行草稿，使训练和测试输入分布匹配 —— 计划采样的直接类比 |
| KV 回滚 | "撤销拒绝的草稿" | 拒绝后将验证器的 KV 缓存重置为接受前缀长度的簿记 |
| 奖励 token | "免费的那个" | 当所有 `N` 草稿接受时，从 `q_{N+1}` 以无额外验证器成本采样一个额外 token |
| 树 attention | "一次验证多个候选" | 用尊重草稿树拓扑的非因果 mask 的 attention；一次前向传播计算树中每个节点的 `q_i` |

## 延伸阅读

- [Leviathan, Kalman, Matias — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192, ICML 2023)](https://arxiv.org/abs/2211.17192) —— 基础论文和等价定理
- [Chen et al. — Accelerating Large Language Model Decoding with Speculative Sampling (arXiv:2302.01318)](https://arxiv.org/abs/2302.01318) —— 并行的独立引入，证明简洁
- [Li et al. — EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) —— EAGLE-1，隐藏状态条件草稿
- [Li et al. — EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) —— 动态树搜索
- [Li et al. — EAGLE-3: Scaling up Inference Acceleration via Training-Time Test (arXiv:2503.01840, NeurIPS 2025)](https://arxiv.org/abs/2503.01840) —— 2026 年生产默认
- [Cai et al. — Medusa: Multiple Decoding Heads (arXiv:2401.10774)](https://arxiv.org/abs/2401.10774) —— 替代的无草稿方法
- [vLLM Speculative Decoding documentation](https://docs.vllm.ai/en/latest/features/spec_decode.html) —— 带有所有策略接入的经典生产参考
