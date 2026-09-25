# 推测解码与 EAGLE-3

> 第 7 阶段 · 第 16 课证明了其中的数学：Leviathan 拒绝规则精确地保持验证器的分布。本课程从训练栈的视角讲解 2026 年生产环境中的推测解码。EAGLE-3 把草稿模型从廉价的近似变成了一个专门构建的小型网络，它在验证器自身的隐藏状态上训练，随后加入了训练时测试循环，使其训练分布与推理分布对齐。结果是：端到端加速 3 倍至 6.5 倍，聊天场景下每 token 接受率高于 0.9，且没有任何分布上的折衷。2026 年的每一个生产级推理栈都默认内置它。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** 第 7 阶段 · 16(推测解码数学)，第 10 阶段 · 12(推理优化)
**Time:** 约 75 分钟

## 学习目标

- 用一句话陈述 Leviathan 定理，并证明推测循环产生的样本与验证器的分布完全相同。
- 梳理从朴素推测解码(Leviathan 2023)到 EAGLE、EAGLE-2、EAGLE-3 的两年演进过程，并说出每一步消除的确切限制。
- 根据接受率 `α` 和草稿与验证器的成本比 `c` 计算期望加速比，并为每种场景选择最优草稿长度 `N`。
- 从零实现完整的推测循环：草稿、验证、从残差分布中拒绝采样、拒绝时回滚 KV 缓存、全部接受时输出额外 bonus token。

## 问题所在

在 H100 上，70B 模型的自回归解码速度大约只有每秒 35 个 token。GPU 远未饱和。瓶颈是内存带宽：每生成一个 token 都要从 HBM 加载 70B 的权重，做一步算术，产出一个浮点数。计算单元大部分时间处于空闲状态。

推测解码把它变成一个你真正可以解决的吞吐量问题。一个廉价的草稿模型通过 `N` 次小型前向传播提出 `N` 个 token。验证器对前缀加上全部 `N` 个草稿只运行一次。如果验证器在位置 `i` 的分布与草稿一致(在我们将要精确定义的统计意义上)，就接受；否则拒绝，并从残差分布中采样一个修正 token。一次大模型前向传播最多可产出 `N+1` 个被接受的 token,而不是一个。

关键的定理来自 Leviathan、Kalman、Matias(ICML 2023):输出分布与直接从验证器采样所得到的分布完全相同。不是近似。是完全相同。这正是推测解码能够在生产环境中被接受的全部理由——它是一个纯粹降低延迟的优化，没有任何质量上的折衷。

第 7 阶段 · 第 16 课给了你数学。本课程给你的是训练栈。一个优秀的草稿模型比一个廉价的草稿模型多带来 2 倍的加速。EAGLE、EAGLE-2 和 EAGLE-3(Li et al., 2024–2025)把“草稿 = 同一模型的缩小版”变成了一门精确的工程学科。2026 年的生产级推理服务器默认使用 EAGLE-3。

## 核心概念

### 不变量：Leviathan 拒绝采样

设 `p(t)` 为草稿模型在给定某前缀时对下一个 token 的分布，`q(t)` 为验证器的分布。从草稿采样一个 token `d ~ p`。以概率 `min(1, q(d) / p(d))` 接受。若拒绝，则从残差分布 `(q - p)_+ / ||(q - p)_+||_1` 中采样。所得样本的分布为 `q`。这与 `p` 有多差无关——它越差，你拒绝得越频繁，但输出始终是精确的。

将 `N` 次这样的调用背靠背地堆叠起来，对 `prefix + d_1 + ... + d_N` 只做一次验证器前向传播。验证器同时返回 `q_1, q_2, ..., q_{N+1}`。从左到右遍历。在位置 `j` 第一次拒绝时，从 `residual(q_j, p_j)` 采样并停止。若全部接受，则从 `q_{N+1}` 采样一个额外的 bonus token。

### 什么决定加速比

设 `α` 为每个草稿 token 的期望接受率。设 `c = cost(draft) / cost(verifier)` 为成本比。每次验证器前向传播的期望接受 token 数为：

```
E[accepted] = (1 - α^(N+1)) / (1 - α)
```

每个接受 token 的期望总耗时为 `(N * c + 1) / E[accepted]`。对 `N` 求最小值即可得到最佳点。当 `α = 0.8, c = 0.05` 时：最优 `N` 约为 5–7,加速比 3.2 倍。当 `α = 0.95, c = 0.02` 时：最优 `N` 约为 8–10,加速比接近 5 倍。

最大的单一杠杆是 `α`。在固定 `N = 5` 的情况下，从 `α = 0.6`(朴素草稿)提升到 `α = 0.9`(EAGLE-3),可以把每次验证器前向传播的期望接受 token 数从 2.2 提升到 4.1。同一个验证器，吞吐量接近翻倍。

### 两年演进历程

**朴素推测解码(Leviathan, 2023)。** 草稿模型是同一系列中独立训练的较小 LLM。易于搭建，`α ≈ 0.6`,加速比最好也只有 2 倍左右。

**EAGLE-1(Li et al., 2024)。** 草稿是一个微型 transformer——通常只有一两层——它以验证器最后一层的隐藏状态作为输入，直接预测下一个 token。由于草稿能看到验证器的特征表示，它的分布与验证器分布接近得多。`α` 提升到 0.7–0.8。

**EAGLE-2(Li et al., 2024)。** 增加了动态草稿树：不再提出单条长度为 `N` 的 token 序列，而是提出一棵候选树，在一次前向传播中用验证器为每个候选打分(tree attention),然后走概率最高的路径。草稿长度在每一步变为自适应。每条接受路径上的 token 的 `α` 提升到 0.85 以上。

**EAGLE-3(Li et al., 2025, NeurIPS)。** 又有两项改动。其一，完全去掉特征预测损失——EAGLE-1/2 训练草稿去匹配验证器的隐藏状态，这限制了数据带来的收益上限。EAGLE-3 直接在 token 预测上训练。其二，训练时测试(TTT):在草稿训练期间，把草稿自己此前的预测作为输入多步反馈进去，与它在推理时的运行方式完全一致。这使训练分布与测试分布对齐，并阻止了误差累积。实测加速比：聊天场景最高 6.5 倍，在 H100 上的 SGLang 中 batch 64 时吞吐量提升 38%。

### KV 缓存回滚

验证会在一次前向传播中把验证器的 KV 缓存扩展 `N` 个条目。如果拒绝发生在位置 `j`,那么位置 `j-1` 之后的缓存内容就是错误的了。两种常见实现：写入一个暂存缓冲区并在接受时提交(vLLM、TensorRT-LLM),或者维护一个物理 KV 缓存加一个逻辑长度，拒绝时截断。无论哪种方式，回滚的成本只是每层每头若干字节，相对于前向传播的成本可以忽略不计。

对于 EAGLE-2 的树搜索，验证器使用一个遵循树拓扑的非因果掩码执行注意力。工程实现比较繁琐，但计算本身只是一次带自定义掩码的标准 flash-attention 调用。

### 2026 年的草稿架构

| 策略 | 草稿类型 | `α` | 加速比 | 训练成本 |
|----------|-----------|-----|---------|---------------|
| 朴素 | 独立的小型 LLM | 0.55-0.70 | 1.8-2.3× | 无(复用现有小模型) |
| Medusa | 验证器上的额外 LM 头 | 0.65-0.75 | 2-3× | 约 1B SFT tokens |
| EAGLE-1 | 基于隐藏状态的单层 transformer | 0.70-0.80 | 2.5-3× | 约 60B tokens |
| EAGLE-2 | EAGLE-1 + 动态草稿树 | 0.80-0.88 | 3-4× | 约 60B tokens |
| EAGLE-3 | 多层特征融合 + TTT | 0.88-0.92 | 3.5-6.5× | 约 60-200B tokens |
| Lookahead | 无草稿(Jacobi 迭代) | N/A | 1.3-1.6× | 无 |

2026 年的生产环境：vLLM 和 SGLang 在可用时默认使用 EAGLE-3,否则使用 EAGLE-2。TensorRT-LLM 针对 Meta 和 NVIDIA 公开模型提供了最快的 Medusa 路径。llama.cpp 为 CPU 部署提供朴素草稿模型。

```figure
l5-spec-decode-eagle
```

## 动手构建

参见 `code/main.py`。这是完整的 Leviathan 推测循环，包含所有组件：N-token 草稿、验证器并行前向、逐位置拒绝、残差采样、bonus token、KV 回滚，以及验证输出分布与直接从 `q` 采样相吻合的实证检验。

### 步骤 1:拒绝规则

```python
def accept(q_prob, p_prob, u):
    if p_prob <= 0:
        return True
    return u < min(1.0, q_prob / p_prob)
```

### 步骤 2:残差分布

```python
def residual(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0:
        return list(q)
    return [r / s for r in raw]
```

### 步骤 3:一次完整的推测步骤

`spec_step` 函数从 `p` 草稿出 `N` 个 token,然后在一次并行 `q` 求值中验证全部草稿。对每个草稿 token 应用拒绝规则，在第一次拒绝时从残差中采样修正。若全部接受，则从 `q_{N+1}` 输出一个 bonus token。

### 步骤 4:KV 回滚记账

模拟器为每个 worker 跟踪一个逻辑 `kv_length`。当 `k` 个草稿全部接受时，`kv_length += k`。当拒绝发生在位置 `j` 时，缓存已经写到了 `j` 之后，但逻辑长度被设为 `prefix_length + j + 1`——即修正 token 之后的一个位置。后续读取会截断到逻辑长度。

### 步骤 5:Leviathan 检验

运行 50,000 次推测步骤。统计接受 token 的经验分布。与从 `q` 直接采样的 50,000 个样本进行比较。卡方统计量应远低于临界值。定理在实践中通过。

### 步骤 6:加速比与 α

通过以不同幅度扰动 `p` 使其偏离 `q` 来扫描草稿质量。测量 `α`,然后绘制每次验证器调用的期望 token 数随 `α` 和 `N` 变化的曲线。代码会打印一个表格，展示 EAGLE-3 级别的草稿质量(`α ≈ 0.9`)如何使每次验证器调用解锁 4–5 个 token。

## 使用

使用 EAGLE-3 的生产级 `vllm serve`:

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct \
  --speculative-config '{
    "model": "yuhuili/EAGLE3-LLaMA3.3-Instruct-70B",
    "num_speculative_tokens": 5,
    "method": "eagle3"
  }'
```

在 H100 上 batch 64 的 SGLang + EAGLE-3:根据 EAGLE-3 论文，吞吐量比 batch-64 朴素解码高约 1.38 倍。

何时使用推测解码：

- 任何 p50 延迟比峰值吞吐量更重要的交互式聊天工作负载。
- 代码生成和结构化输出(JSON、SQL)。`α` 高于 0.9,因为目标分布高度可预测。
- 长文本生成(数千 token)。摊销后的加速比持续有效。

何时不使用：

- 非常小的模型(< 3B)。草稿模型并不比验证器便宜多少。
- 极小的 batch-1 CPU 部署。草稿模型的内存开销可能不值得。
- 高温度的创造性采样，此时 `α` 会崩塌。

## 上线

本课程产出 `outputs/skill-eagle3-tuner.md`。给定一个推理工作负载(模型、batch size、目标延迟、任务特征)，它会推荐一种推测解码策略及调优参数(草稿模型系列、`N`、树深度、基于温度的动态切换)。

## 练习

1. 运行 `code/main.py`。确认 Leviathan 分布检验的卡方统计量在 50,000 个样本上保持在 95% 临界值以下。

2. 在 `α` 固定为 0.9、`c` 固定为 0.04 的情况下，将 `N` 从 1 扫描到 10。绘制每次验证器调用的期望 token 数和每 token 的实际耗时。找到使耗时最小的 `N`。解释曲线的形状。

3. 修改代码以模拟 EAGLE-2 树搜索：每一步草稿提出一棵形状为 `[2, 2, 2]` 的树(八条候选路径)。验证器运行一次，概率最高的被接受路径胜出。计算每个叶节点的 `α` 以及每次验证器调用的总 token 数。与同等计算量的线性链式推测解码进行比较。

4. 为两条并发序列实现一个批量 KV 回滚模拟器。序列 A 的所有草稿全部接受；序列 B 在位置 2 拒绝。证明每条序列都正确更新了 `kv_length`,且没有浪费任何计算。

5. 阅读 EAGLE-3 论文第 4 节(Training-Time Test)。用两句话解释为什么没有 TTT 的朴素草稿训练会受到曝光偏差(exposure bias)的影响，以及为什么在训练期间把草稿自己的预测喂回去能解决这个问题。将其与 seq2seq 中的 scheduled sampling 文献联系起来。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| Leviathan 规则 | "min(1, q over p)" | 以概率 `min(1, q(d)/p(d))` 做 Bernoulli 接受/拒绝；拒绝时从残差采样可精确保持验证器分布 |
| 残差分布 | "(q minus p) plus, normalized" | `(q - p)_+` 在零处截断并重新归一化——拒绝时应采样的正确分布 |
| 接受率 α | "草稿有多经常是对的" | 拒绝规则下的每 token 期望 Bernoulli 成功概率；决定所有加速比计算 |
| EAGLE-1 | "隐藏状态草稿" | 以验证器最后一层隐藏状态为条件的微型 transformer 草稿(Li et al., 2024) |
| EAGLE-2 | "动态草稿树" | EAGLE-1 加上一棵候选续写树，在验证器一次前向传播中用 tree attention 打分 |
| EAGLE-3 | "训练时测试" | 去掉特征预测损失，改为直接在 token 预测上训练，并在训练期间把草稿自己的输出喂回去 |
| 训练时测试(TTT) | "曝光偏差的修复" | 在训练期间让草稿以自回归方式运行，使训练与测试的输入分布一致——scheduled sampling 的直接对应物 |
| KV 回滚 | "撤销被拒绝的草稿" | 拒绝后将验证器的 KV 缓存重置为已接受前缀长度的记账操作 |
| Bonus token | "白送的那个" | 当全部 `N` 个草稿被接受时，从 `q_{N+1}` 额外采样一个，无需额外的验证器成本 |
| Tree attention | "一次验证多个候选" | 使用遵循草稿树拓扑的非因果掩码的注意力；一次前向传播即为树中每个节点计算 `q_i` |

## 延伸阅读

- [Leviathan, Kalman, Matias — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192, ICML 2023)](https://arxiv.org/abs/2211.17192) — 奠基性论文与等价性定理
- [Chen et al. — Accelerating Large Language Model Decoding with Speculative Sampling (arXiv:2302.01318)](https://arxiv.org/abs/2302.01318) — 同期的独立提出，并附有简洁的证明
- [Li et al. — EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) — EAGLE-1,基于隐藏状态条件的草稿
- [Li et al. — EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) — 动态树搜索
- [Li et al. — EAGLE-3: Scaling up Inference Acceleration via Training-Time Test (arXiv:2503.01840, NeurIPS 2025)](https://arxiv.org/abs/2503.01840) — 2026 年的生产默认方案
- [Cai et al. — Medusa: Multiple Decoding Heads (arXiv:2401.10774)](https://arxiv.org/abs/2401.10774) — 另一种免草稿的方法
- [vLLM Speculative Decoding documentation](https://docs.vllm.ai/en/latest/features/spec_decode.html) — 集成了所有策略的权威生产参考