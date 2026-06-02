# 投机解码与 EAGLE-3（Speculative Decoding and EAGLE-3）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Phase 7 · Lesson 16 把数学讲清楚了：Leviathan 拒绝采样规则能精确保留 verifier 的分布。本课换成 2026 年生产级投机解码的训练栈视角。EAGLE-3 把 draft 模型从「廉价近似」升级为「专门设计的小网络」——直接用 verifier 自己的 hidden state（隐藏状态）训练，再加上训练时的 test loop 来对齐训练分布与推理（inference）分布。结果：端到端 3× 到 6.5× 提速，chat 场景下每 token 的接受率超过 0.9，没有任何分布上的折衷。2026 年所有生产级推理栈都默认开它。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 7 · 16 (speculative decoding math), Phase 10 · 12 (inference optimization)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 用一句话写出 Leviathan 定理，并证明投机循环产生的样本与直接从 verifier 采样的分布完全一致。
- 走完这两年的演进：从原版投机解码（Leviathan 2023）到 EAGLE、EAGLE-2、EAGLE-3，准确说出每一步消除了什么限制。
- 根据接受率 `α` 与 draft/verifier 成本比 `c` 计算预期提速比，并为不同场景选出最优 draft 长度 `N`。
- 从零实现完整的投机循环：draft、verify、从残差分布拒绝采样、拒绝时回滚 KV cache、全部接受时发出 bonus token。

## 问题（The Problem）

70B 模型在 H100 上 autoregressive 解码大概每秒 35 个 token。GPU 远远没跑满。瓶颈是显存带宽：每输出一个 token，都要把 70B 权重从 HBM 搬出来、做一步运算、产出一个浮点数。计算单元大部分时间在闲着。

投机解码把这个问题转成一个你真能解决的吞吐问题。一个廉价的 draft 用 `N` 次小 forward pass 提议 `N` 个 token。verifier 在「prefix + 全部 `N` 个 draft」上跑一次。如果 verifier 在位置 `i` 处的分布与 draft 一致（一会儿讲精确含义），就接受；否则拒绝，并从残差分布里采一个修正 token。一次大模型 forward 就能产出最多 `N+1` 个被接受的 token，而不是只有一个。

关键定理来自 Leviathan, Kalman, Matias（ICML 2023）：输出分布与「直接从 verifier 采样」完全相同。不是近似一致，是完全一致。这正是投机解码能在生产上被接受的全部理由——它是一个纯粹的延迟（latency）优化，没有任何质量上的折衷。

Phase 7 · Lesson 16 给你的是数学。本课给你的是训练栈。一个好 draft 比一个廉价 draft 多带来 2× 的提速。EAGLE、EAGLE-2、EAGLE-3（Li et al., 2024–2025）把「draft = 同模型的小号版本」变成了一门精确的工程学科。2026 年的生产推理服务器默认就是 EAGLE-3。

## 概念（The Concept）

### 不变量：Leviathan 拒绝采样

设 `p(t)` 为 draft 在某 prefix 下对下一个 token 的分布，`q(t)` 为 verifier 的分布。采样一个 draft token `d ~ p`。以概率 `min(1, q(d) / p(d))` 接受。拒绝时则从残差分布 `(q - p)_+ / ||(q - p)_+||_1` 采样。最终样本服从 `q`。无论 `p` 多差都成立——`p` 越差，拒绝得越频繁，但输出依然精确。

把 `N` 次这样的调用串起来，对 `prefix + d_1 + ... + d_N` 用一次 verifier forward 就能搞定。verifier 同时返回 `q_1, q_2, ..., q_{N+1}`。从左到右遍历。在第一次拒绝的位置 `j`，从 `residual(q_j, p_j)` 采样并停止。如果全部接受，再从 `q_{N+1}` 多采一个 bonus token。

### 提速比由什么决定

设 `α` 为每个 draft token 的期望接受率，`c = cost(draft) / cost(verifier)` 为成本比。每次 verifier forward 期望接受的 token 数为：

```
E[accepted] = (1 - α^(N+1)) / (1 - α)
```

每个被接受 token 的预期总挂钟时间为 `(N * c + 1) / E[accepted]`。对 `N` 求最小值就能拿到甜区。`α = 0.8, c = 0.05` 时：最优 `N` 大约 5–7，提速比 3.2×。`α = 0.95, c = 0.02` 时：最优 `N` 大约 8–10，提速比能冲到 5×。

最大的杠杆是 `α`。在 `N = 5` 固定的条件下，从 `α = 0.6`（原版 draft）提到 `α = 0.9`（EAGLE-3），每次 verifier forward 期望接受的 token 数从 2.2 涨到 4.1。同样的 verifier，吞吐近乎翻倍。

### 两年演进

**原版 speculative（Leviathan, 2023）。** Draft 模型是同家族独立训练的小一号 LLM。接线简单，`α ≈ 0.6`，最多 2× 提速。

**EAGLE-1（Li et al., 2024）。** Draft 是一个极小的 transformer——一般一两层——它把 verifier 最后一层的 hidden state 作为输入，直接预测下一个 token。因为 draft 看到了 verifier 的特征表示，分布更接近 verifier。`α` 升到 0.7–0.8。

**EAGLE-2（Li et al., 2024）。** 加入动态 draft tree：不再提议单条长 `N` 的序列，而是提议一棵候选小树，verifier 用一次 forward（tree attention）给所有节点打分，再走概率最高的那条路径。每步 draft 长度变成自适应的。沿被接受路径的每 token `α` 升到 0.85 以上。

**EAGLE-3（Li et al., 2025, NeurIPS）。** 又改了两点。第一，彻底丢掉 feature-prediction 损失——EAGLE-1/2 训练 draft 去匹配 verifier 的 hidden state，这样数据再多也帮不了多少。EAGLE-3 直接用 token 预测来训练。第二，training-time test（TTT）：在 draft 训练时，把 draft 自己上一步的预测作为输入再喂回去，跨多步进行，正是它在 inference 时的运作方式。这样训练分布和测试分布就对齐了，误差不再累积。实测提速：chat 场景最高 6.5×，H100 上 SGLang batch 64 吞吐提升 38%。

### KV cache 回滚

verify 一次性把 verifier 的 KV cache 扩充 `N` 项。如果在位置 `j` 拒绝，则 `j-1` 之后的 cache 内容就是错的。常见两种实现：写到 scratch buffer、接受时再 commit（vLLM、TensorRT-LLM）；或者保留物理 KV cache 加一个逻辑长度，拒绝时截断。无论哪种，回滚成本都是「每层每头若干字节」，相比 forward pass 可忽略不计。

EAGLE-2 的 tree search 里，verifier 用一个尊重树拓扑的非因果（non-causal）mask 跑 attention。工程上有点琐碎，但计算就是带自定义 mask 的标准 flash-attention 调用。

### 2026 年的 draft 架构

| 策略 | Draft 类型 | `α` | 提速 | 训练成本 |
|----------|-----------|-----|---------|---------------|
| Vanilla | 独立的小 LLM | 0.55-0.70 | 1.8-2.3× | 无（复用现有小模型） |
| Medusa | verifier 上加额外 LM head | 0.65-0.75 | 2-3× | ~1B SFT token |
| EAGLE-1 | 1 层 transformer，输入 hidden state | 0.70-0.80 | 2.5-3× | ~60B token |
| EAGLE-2 | EAGLE-1 + 动态 draft tree | 0.80-0.88 | 3-4× | ~60B token |
| EAGLE-3 | 多层特征融合 + TTT | 0.88-0.92 | 3.5-6.5× | ~60-200B token |
| Lookahead | 没有 draft（Jacobi 迭代） | N/A | 1.3-1.6× | 无 |

2026 年生产环境：vLLM 和 SGLang 在有 EAGLE-3 时默认走它，否则走 EAGLE-2。TensorRT-LLM 上 Meta 与 NVIDIA 公开模型的 Medusa 路径最快。llama.cpp 给 CPU 部署提供原版 draft。

## 动手实现（Build It）

见 `code/main.py`。这是完整的 Leviathan 投机循环，零件齐全：长度 `N` 的 draft、verifier 并行 pass、按位置拒绝、残差采样、bonus token、KV 回滚，还有「输出分布与直接从 `q` 采样一致」的实测验证。

### 第 1 步：拒绝规则

```python
def accept(q_prob, p_prob, u):
    if p_prob <= 0:
        return True
    return u < min(1.0, q_prob / p_prob)
```

### 第 2 步：残差分布

```python
def residual(q, p):
    raw = [max(0.0, qi - pi) for qi, pi in zip(q, p)]
    s = sum(raw)
    if s == 0:
        return list(q)
    return [r / s for r in raw]
```

### 第 3 步：完整一步投机

`spec_step` 函数从 `p` draft 出 `N` 个 token，然后用一次并行 `q` 评估全部验证。对每个 draft token 应用拒绝规则，第一次拒绝时从残差里采修正。如果全部接受，就再从 `q_{N+1}` 发出 bonus token。

### 第 4 步：KV 回滚记账

模拟器为每个 worker 维护一个逻辑 `kv_length`。接受 `k` 个 draft 时，`kv_length += k`。在位置 `j` 拒绝时，cache 已经写到 `j` 之后了，但逻辑长度被设置为 `prefix_length + j + 1`——即修正 token 的下一位。后续读取按逻辑长度截断。

### 第 5 步：Leviathan 校验

跑 50,000 步投机。统计被接受 token 的实测分布。再跑 50,000 次直接从 `q` 采样作对照。卡方统计量应当远低于临界值。定理在实践里成立。

### 第 6 步：提速比 vs. α

通过对 `p` 相对 `q` 施加不同幅度的扰动来扫一遍 draft 质量。测出 `α`，再把「每次 verifier 调用期望接受的 token 数」画成 `α` 与 `N` 的函数。代码会打印一张表，展示 EAGLE-3 量级的 draft 质量（`α ≈ 0.9`）能解锁每次 verifier 调用 4–5 个 token。

## 用起来（Use It）

生产级 `vllm serve` 配合 EAGLE-3：

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct \
  --speculative-config '{
    "model": "yuhuili/EAGLE3-LLaMA3.3-Instruct-70B",
    "num_speculative_tokens": 5,
    "method": "eagle3"
  }'
```

H100 上 SGLang 配合 EAGLE-3 在 batch 64 时：相比 batch-64 原版解码大约多 1.38× 的吞吐，引自 EAGLE-3 论文。

什么时候上投机解码：

- 任何交互式 chat 场景，p50 延迟比峰值吞吐重要。
- 代码生成与结构化输出（JSON、SQL）。`α` 超过 0.9，因为目标分布高度可预测。
- 长文生成（数千 token）。摊销之后的提速一直在赚。

什么时候不上：

- 非常小的模型（< 3B）。draft 没比 verifier 便宜多少。
- 极小的 batch-1 CPU 部署。draft 模型的内存开销可能不划算。
- 极高温度的创意采样，`α` 会塌掉。

## 上线部署（Ship It）

本课产出 `outputs/skill-eagle3-tuner.md`。给定一个推理工作负载（模型、batch size、目标延迟、任务画像），它会推荐一种投机解码策略与调参（draft 家族、`N`、tree 深度、温度感知切换）。

## 练习（Exercises）

1. 跑 `code/main.py`。确认 Leviathan 分布检验在 50,000 个样本上的卡方统计量低于 95% 临界值。

2. 固定 `α = 0.9`、`c = 0.04`，扫 `N` 从 1 到 10。画出每次 verifier 调用的期望 token 数与每 token 实际挂钟时间。找出能最小化挂钟时间的 `N`。解释这条曲线的形状。

3. 改代码模拟 EAGLE-2 的 tree search：每步 draft 提议一棵 `[2, 2, 2]` 形状的树（八条候选路径）。verifier 跑一次，胜出的是被接受概率最高的那条路径。算出每个叶子节点的 `α` 与每次 verifier 调用的总 token 数。和等算力下的线性投机解码对比。

4. 实现一个支持两条并发序列的 batched KV 回滚模拟器。序列 A 全部接受；序列 B 在位置 2 拒绝。证明 `kv_length` 是按序列正确更新的，没有任何浪费的工作。

5. 读 EAGLE-3 论文第 4 节（Training-Time Test）。两句话解释为什么不带 TTT 的朴素 draft 训练会受 exposure bias 影响，以及为什么训练时把 draft 自己的预测喂回去能修复它。把它和 seq2seq 里的 scheduled-sampling 文献联系起来。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|----------------|------------------------|
| Leviathan rule | "min(1, q over p)" | 以 `min(1, q(d)/p(d))` 概率接受/拒绝的 Bernoulli 实验，配合拒绝时从残差采样，可精确保留 verifier 分布 |
| Residual distribution | "(q minus p) plus, normalized" | `(q - p)_+` 截断到零再归一——拒绝时正确的采样分布 |
| Acceptance rate α | "draft 多常猜对" | 拒绝规则下每 token 的期望 Bernoulli 成功概率；主导一切提速数学 |
| EAGLE-1 | "hidden-state draft" | 极小 transformer draft，以 verifier 最后一层 hidden state 作为条件（Li et al., 2024） |
| EAGLE-2 | "动态 draft tree" | EAGLE-1 + 一棵候选续写树，用一次 verifier pass 的 tree attention 打分 |
| EAGLE-3 | "training-time test" | 丢掉 feature-prediction 损失，直接用 token 预测训练，并在训练时把 draft 自己的输出喂回去 |
| Training-time test (TTT) | "exposure bias 修复" | 训练时让 draft autoregressive 跑，使训练与测试输入分布一致——scheduled sampling 的直接对应物 |
| KV rollback | "回退被拒的 draft" | 拒绝后把 verifier 的 KV cache 重置到「已接受 prefix 长度」的记账逻辑 |
| Bonus token | "白送的那一个" | 当 `N` 个 draft 全部接受时，再从 `q_{N+1}` 多采一个，verifier 没多花成本 |
| Tree attention | "一次验证多条候选" | 带尊重 draft 树拓扑的非因果 mask 的 attention；一次 forward pass 给树里每个节点算出 `q_i` |

## 延伸阅读（Further Reading）

- [Leviathan, Kalman, Matias — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192, ICML 2023)](https://arxiv.org/abs/2211.17192) — 奠基论文与等价性定理
- [Chen et al. — Accelerating Large Language Model Decoding with Speculative Sampling (arXiv:2302.01318)](https://arxiv.org/abs/2302.01318) — 同期独立提出，证明干净利落
- [Li et al. — EAGLE: Speculative Sampling Requires Rethinking Feature Uncertainty (arXiv:2401.15077)](https://arxiv.org/abs/2401.15077) — EAGLE-1，hidden state 条件 draft
- [Li et al. — EAGLE-2: Faster Inference of Language Models with Dynamic Draft Trees (arXiv:2406.16858)](https://arxiv.org/abs/2406.16858) — 动态 tree search
- [Li et al. — EAGLE-3: Scaling up Inference Acceleration via Training-Time Test (arXiv:2503.01840, NeurIPS 2025)](https://arxiv.org/abs/2503.01840) — 2026 年的生产默认
- [Cai et al. — Medusa: Multiple Decoding Heads (arXiv:2401.10774)](https://arxiv.org/abs/2401.10774) — 不靠 draft 的另一条路
- [vLLM Speculative Decoding documentation](https://docs.vllm.ai/en/latest/features/spec_decode.html) — 把所有策略都接好的生产级标杆参考
