# 多 token 预测（Multi-Token Prediction, MTP）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 从 GPT-2 到 Llama 3，每一个 autoregressive LLM 在每个位置都只训练一个损失：预测下一个 token。DeepSeek-V3 在每个位置加上了第二个损失：预测再下一个 token。这多出来的 14B 参数（在一个 671B 模型上）通过 gradient 流回主模型被蒸馏吸收，而训练好的 MTP head 在推理时被复用为 speculative-decoding 的 drafter（草稿生成器），接受率达到 80%+。生成 throughput（吞吐）提升 1.8×，几乎是白送。本课从 DeepSeek 技术报告里拆出 sequential MTP 模块，计算其 loss 与共享 head 的参数布局，并解释为什么 MTP 保留了因果链，而 Gloeckle 等人最初的 parallel MTP 却破坏了这条链。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 10 · 04（预训练一个 mini GPT）, Phase 10 · 15（speculative decoding）
**Time:** ~60 minutes

## 学习目标（Learning Objectives）

- 陈述 MTP 的训练目标，并推导出跨预测深度（prediction depth）的联合 loss。
- 解释 Gloeckle 等人（2024）的 parallel MTP head 与 DeepSeek-V3 的 sequential MTP 模块之间的差异，以及为什么 sequential 设计保留了因果链。
- 计算在预训练（pretraining）流程里加入 MTP 模块所带来的参数与显存开销。
- 从零实现一个 MTP 模块：共享 embedding、按深度的 transformer block、投影矩阵，以及共享的输出 head。

## 问题（The Problem）

下一个 token 预测是 LLM 训练的标准目标。每个 hidden state 只被监督去预测一件事：紧接着的那个 token。这其实是一个意外地弱的信号。一段序列里大部分信息都跨越不止一个 token——结构、连贯性、事实性、算术流程。模型只能靠在万亿级 token 上累积许多单 token 信号去慢慢学。

MTP 抛出的问题是：如果让每个 hidden state 同时被监督去预测多个未来 token 呢？Gloeckle 等人（Meta，2024）证明了这能涨点。他们的实现是在主干（backbone）顶上摞几个独立的输出 head，每个 head 预测一个不同的偏移。并行、简单，但所有 head 看到的是同一个 hidden state，没有任何层级化的细化——而且这些预测之间不构成因果链，因此无法用于 speculative decoding。

DeepSeek-V3（2024 年 12 月）把 MTP 重新设计成 sequential 模块，在每个预测深度上都保留了因果链。模型先从 `h_i^(0)` 预测 `t+1`，然后用一个新的 hidden state `h_i^(1)`（由 `h_i^(0)` 与 `E(t+1)` embedding 组合而来）预测 `t+2`，以此类推。每个深度都是一个独立的小 transformer block。共享的 embedding 与共享的输出 head 让参数开销保持温和。在 DeepSeek-V3 这个规模上，671B 主模型权重之上，所有 MTP 模块加起来多了 14B 参数。这 2% 的开销换来了更密的训练信号，**外加**推理时一个现成的 speculative-decoding 草稿。

本课从零搭建一个 MTP 模块和 D 个深度的 loss。数学很干净。实现 150 行。

## 概念（The Concept）

### sequential MTP 的配方（recipe，配方）

DeepSeek-V3 在主模型顶上加了 `D` 个 MTP 模块。每个模块 `k`（`k = 1..D`）预测深度 `k` 处的 token——也就是给定到位置 `i` 的前缀，预测 `t_{i+k}`。

模块 `k` 由以下部件组成：

- 一个 transformer block `T_k`，自带 attention（注意力）和 MLP（多层感知机）。
- 一个投影矩阵 `M_k`，把上一深度的 hidden state 和下一深度 ground-truth token 的 embedding 组合起来。
- 共享的 embedding `E`（与主模型相同）。
- 共享的输出 head `Out`（与主模型相同）。

训练时，对到位置 `i` 的前缀，每个深度的 hidden state 是：

```
h_i^(0) = main model backbone at position i
h_i^(k) = T_k( M_k * concat(RMSNorm(h_i^(k-1)), RMSNorm(E(t_{i+k}))) )   for k >= 1
```

每个深度的预测是：

```
logits_{i+k} = Out(h_i^(k-1))   for k = 1..D
```

每个深度的 loss 是相对于 ground-truth `t_{i+k}` 的交叉熵：

```
L_k = CE(logits_{i+k}, t_{i+k})
```

跨深度的联合 loss：

```
L_MTP = (lambda / D) * sum_{k=1..D} L_k
```

`lambda` 是一个小的加权因子——DeepSeek-V3 在训练前 10% 用 0.3，之后改用 0.1。总训练 loss 是 `L_main + L_MTP`。

### 为什么是 sequential，而不是 parallel

Gloeckle 最初的 parallel MTP 有 D 个输出 head，每个都直接作用在 `h_i^(0)` 上。每个 head 都从同一个主干 hidden state 预测 `t_{i+k}`。这能正常训练，但各个预测彼此之间没有条件关系。你没法用 `head_1` 的输出去帮 `head_2`——这些 head 是并行触发的。

DeepSeek-V3 的 sequential 设计则是用 `h_i^(k-1)` 加上真实下一 token embedding `E(t_{i+k})` 来构造 `h_i^(k)`。这样就保留了因果链：要预测 `t_{i+k+1}`，深度 `k+1` 的模块就能看到 `t_{i+k}` 的内容。这在结构上与一个 autoregressive decoder 消费自己输出的过程完全一致——这使得 MTP 模块可以直接当作 speculative-decoding 的 drafter 来用。

推理时：把 `h_i^(k-1)` 和起草出来的 `t_{i+k}` 喂进模块 `k+1`，得到对 `t_{i+k+1}` 的预测。重复。这正是一种 EAGLE 风格的草稿，只不过把训练好的 MTP 模块当作草稿网络。DeepSeek-V3 报告：第一个 MTP 模块的接受率达到 80%+，整体加速约 1.8×。

### 参数账（Parameter accounting）

对于 hidden 维度为 `h`、词表大小为 `V` 的模型：

- 主模型：数十亿参数，外加一个大小为 `V * h` 的输出 head。
- 共享输出 head：复用主模型的 head。零额外参数。
- 共享 embedding：复用主模型的 embedding。零额外参数。
- 每个 MTP 模块：
  - 投影 `M_k`：`(2h) * h = 2h^2`。
  - Transformer block `T_k`：attention（多头 attention 约 `4h^2`）加 MLP（SwiGLU 比例 8/3 时通常 `8h^2`）。每个 block 约 `12h^2`。

每个模块多出来的总额：`~14h^2`。对 DeepSeek-V3 的 `h = 7168`，D = 1 个模块：纸面上 `~14 * 7168^2 = ~720M` 参数。DeepSeek-V3 报告的是 14B——差距主要来自 MTP 模块里的专家层也是 MoE。

### speculative-decoding 的回报

预训练时，MTP 模块把训练拖慢约 10%（多了一次前向计算，多了一份 loss）。回报有两块：

1. 更密的训练信号。每个 hidden state 都看到 D+1 个监督目标。在 MMLU、GSM8K、MATH、HumanEval 上的实测效果：在 DeepSeek-V3 的消融实验（ablation，消融）里都能稳定带来几个百分点的提升。

2. 推理时白送一个 speculative decoding 草稿。MTP 模块本来就被训练去预测接下来的几个 token。把它复用成草稿网络，接受率能达到 80%+。在这个水平上，N=3 或 N=5 的 spec decoding 能带来 1.8× 的吞吐。10% 的训练时长开销，第一次跑推理就把账还清了。

### 与 EAGLE 的关系

EAGLE 是在预训练**之后**单独训练一个小的草稿模型。MTP 则是把草稿烤进预训练里。两条路径在接受率上殊途同归，但流程不一样：

| 维度 | EAGLE-3 | MTP（DeepSeek-V3） |
|------|---------|--------------------|
| 何时训练 | 预训练之后 | 预训练期间 |
| 是否兼容已有权重 | 是 | 否（需要重训） |
| 草稿参数 | 1-2 层 transformer | 1 个 transformer block + 投影 |
| 接受率 | 0.88-0.92 | 深度 1 处 0.80+ |
| 加速之外的收益 | 仅 speculative decoding | 更密训练信号 + 加速 |

## 动手实现（Build It）

`code/main.py` 端到端地搭一个 MTP 模块：共享 embedding、投影、transformer block、共享输出 head。然后在一个简短的合成序列上算出每个深度的交叉熵 loss，并按组件打印参数计数。一个 32 token 的玩具词表能让数字保持可读。

### Step 1：共享 embedding 表

一张 `vocab_size x hidden` 的表，被主模型以及每个 MTP 模块在每个深度共用。不是第二份拷贝——字面意义上就是同一个张量。

### Step 2：每个深度的组合

```python
def combine(prev_hidden, next_token_embed, M_k):
    # concat along feature dim, then project down to hidden
    concat = rms_norm(prev_hidden) + rms_norm(next_token_embed)  # vector addition stand-in
    projected = matvec(M_k, concat)
    return projected
```

真正的 DeepSeek-V3 会把两个经 RMSNorm 处理的向量拼接成 `[2h]`，再用一个 `h x 2h` 的矩阵投影。玩具版为了 stdlib 的简洁性用了向量加法替代。

### Step 3：深度 k 处的 transformer block

self-attention 加 MLP。在玩具里，一层线性 attention block 加一个 SwiGLU MLP，让结构清晰可见，又不依赖 numpy。

### Step 4：共享输出 head

复用主模型的输出投影。在词表上得到 logits。

### Step 5：每个深度的 loss

softmax(logits) 对偏移 `k` 处 ground-truth token 的交叉熵。用 `lambda / D` 缩放因子在各深度间汇总。

### Step 6：参数账

打印总参数数、共享部分（embedding、head）的参数数、每模块的额外参数数。展示 MTP 额外参数与主模型规模的比值。

## 用起来（Use It）

MTP 已集成进 DeepSeek-V3（2024 年 12 月）以及 DeepSeek-R1 系列。推理侧：

- DeepSeek 自家的 serving 栈开箱即用地把 MTP 模块当作 speculative decoder 用。
- vLLM 和 SGLang 截至 2026 年 4 月已有针对 DeepSeek-V3 MTP 的接入路径。
- AMD 的 ROCm SGLang 教程里给出了一份具体的 MTP speculative-decoding 配置，在 V3 checkpoint 上实测 1.8× 加速。

什么时候应该在新的预训练流程里用 MTP：

- 你掌控完整的预训练流水线，并且想把更密的训练信号攒进权重里。
- 你预期模型会大规模上线服务，想白嫖 speculative decoding。
- 你的 hidden size 至少 4096。在 1B 级别上，开销带来的伤害比收益还多。

什么时候不用：

- 在已有的预训练 dense 模型上做微调（fine-tune）。MTP 模块根本没训过。
- 想要一个干净 baseline（基准）来对照的研究类模型。MTP 改了架构。

## 上线部署（Ship It）

本课产出 `outputs/skill-mtp-planner.md`。给定一份预训练运行规格（模型规模、数据、算力），它返回一份 MTP 集成方案：深度数 D、`lambda` 调度、显存开销，以及推理时 speculative-decoding 的接线方式。

## 练习（Exercises）

1. 跑 `code/main.py`。展示随合成信号增强，每个深度的 loss 单调下降。把合成数据改成固定模式，验证深度 1 和深度 2 的 loss 都能收敛（convergence）。

2. 计算一个 dense 70B 模型（hidden 8192，80 层）在 D=1 个 MTP 模块下的参数开销。与 DeepSeek-V3 报告的 14B 开销对比。解释为什么 DeepSeek 的数字更高：MTP 的 transformer block 继承了同一套 MoE 结构，把每模块的参数量吹大了。

3. 在玩具里实现 D=2：再加一个 MTP 模块，吃 h^(1) 并预测 `t_{i+2}`。验证联合 loss 与参数账与 DeepSeek 论文里方程 19-21 一致。

4. 把玩具切到 parallel MTP（Gloeckle 风格）：在主模型 hidden state 顶上加 D 个输出 head，每个预测一个不同的偏移。在同一份合成信号上比较各深度的 loss 与 sequential 版的差异。sequential 版在 k > 1 处应当给出更低的深度-k loss，因为它会条件依赖于中间预测。

5. 把训练好的 MTP 模块当作 EAGLE 风格草稿用：推理时调用模块 k 来提议 `t_{i+k}`。在一段留出序列上度量这些草稿 token 相对主模型预测的接受率。如果你在玩具上能打到 50%+，那么你已经复现出了 MTP 当草稿这一经验性质。

## 关键术语（Key Terms）

| 术语 | 别人怎么说 | 实际含义 |
|------|------------|----------|
| MTP module | "额外 loss 块" | 一个小的 transformer block 加一个投影，用来预测主模型前方 `k` 个位置的 token |
| Prediction depth | "哪个偏移" | 整数 `k`，使得模块 `k` 从到位置 `i` 的前缀预测 `t_{i+k}` |
| Parallel MTP | "Gloeckle 风格" | 在同一个主干 hidden state 上挂 D 个独立 head，没有条件链 |
| Sequential MTP | "DeepSeek-V3 风格" | 每个模块都条件依赖于上一深度的 hidden state 加上下一 token 的 embedding；保留因果链 |
| Shared output head | "复用主 head" | MTP 模块直接调主模型的 LM head，不再单开一个输出投影 |
| Shared embedding | "复用主表" | 同一张词表 embedding 表在所有地方都用；没有重复参数 |
| Projection matrix M_k | "组合 hidden + 下一 token" | 一个 `h x 2h` 的线性层，把上一 hidden state 和目标 token 的 embedding 折进下一深度的输入 |
| Joint loss L_MTP | "平均后的额外 loss" | 各深度交叉熵 loss 的算术平均，再乘上 `lambda` |
| Acceptance rate at depth 1 | "MTP 草稿命中率" | D=1 的 MTP 模块的 top-1 预测与主模型 top-1 预测一致的比率；DeepSeek-V3 上达到 80%+ |
| Lambda weighting | "额外 loss 的权重" | 各深度的缩放因子；DeepSeek-V3 训练初期 0.3，之后 0.1 |

## 延伸阅读（Further Reading）

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — 完整的 sequential MTP 描述（第 2.2 节），包括联合 loss 方程与推理 1.8× 加速
- [Gloeckle et al. — Better & Faster Large Language Models via Multi-token Prediction (arXiv:2404.19737)](https://arxiv.org/abs/2404.19737) — DeepSeek 设计所改进的 parallel MTP baseline
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) — 总计 685B（671B 主 + 14B MTP），含部署说明
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) — MTP 所嵌入的 speculative-decoding 框架
- [Li et al. — EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) — EAGLE 2025 年的草稿架构，MTP 的对照对手
