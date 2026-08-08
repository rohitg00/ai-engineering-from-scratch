# 多 Token 预测（MTP）

> 从 GPT-2 到 Llama 3 的每个自回归 LLM 在每个位置上训练一个损失：预测下一个 token。DeepSeek-V3 在每个位置上添加了第二个损失：预测再下一个 token。额外的 14B 参数（在 671B 模型上）通过梯度流蒸馏回主模型，训练好的 MTP head 在推理时被重新用作推测解码草稿，接受率超过 80%。1.8× 生成吞吐量免费获得。本课从 DeepSeek 技术报告构建顺序 MTP 模块，计算损失和共享 head 参数布局，并解释为什么 MTP 保持因果链而 Gloeckle 等人的原始并行 MTP 打破了它。

**类型：** 构建
**语言：** Python（标准库）
**前置要求：** 第 10 阶段 · 04（预训练 mini GPT），第 10 阶段 · 15（推测解码）
**时间：** ~60 分钟

## 学习目标

- 陈述 MTP 训练目标并推导跨预测深度的联合损失
- 解释 Gloeckle 等人的并行 MTP head（2024）与 DeepSeek-V3 的顺序 MTP 模块之间的区别，以及为什么顺序设计保留因果链
- 计算向预训练运行添加 MTP 模块的参数和内存开销
- 从零实现一个 MTP 模块：共享 embedding、每深度 transformer block、投影和共享输出 head

## 问题

Next-token 预测是标准 LLM 训练目标。每个隐藏状态被监督预测恰好一件事：紧随其后的 token。这是一个令人惊讶的弱信号。序列中大多数信息延伸超过一个 token —— 结构、连贯性、事实性、算术流。模型必须通过数万亿 token 上累积许多单 token 信号来学习这些。

MTP 问：如果每个隐藏状态被监督同时预测多个未来 token 会怎样？Gloeckle 等人（Meta, 2024）展示了这有帮助。他们的实现在骨干上放置了几个独立输出 head，每个预测不同的偏移。并行、简单，但 head 看到相同的隐藏状态而没有任何层次细化 —— 且预测不因果链式连接，所以它们不能用于推测解码。

DeepSeek-V3（2024 年 12 月）将 MTP 重新设计为在每个预测深度保持因果链的顺序模块。模型从 `h_i^(0)` 预测 `t+1`，然后从新的隐藏状态 `h_i^(1)` 预测 `t+2`，该状态将 `h_i^(0)` 与 `E(t+1)` embedding 结合，依此类推。每个深度是它自己的小型 transformer block。共享 embedding 和共享输出 head 保持参数开销适度。在 DeepSeek-V3 的规模上，671B 主模型权重之上 MTP 模块有 14B 额外参数。这 2% 的开销购买了更密集的训练信号 AND 推理时现成的推测解码草稿。

本课从零构建单个 MTP 模块和 D 深度损失。数学很整洁。实现是 150 行。

## 核心概念

### 顺序 MTP 配方

DeepSeek-V3 在主模型之上添加 `D` 个 MTP 模块。每个模块 `k`（对于 `k = 1..D`）预测深度 `k` 的 token —— 即给定前缀到位置 `i` 的 `t_{i+k}`。

模块 `k` 包括：

- 具有自己 attention 和 MLP 的 transformer block `T_k`。
- 投影矩阵 `M_k`，将前深度的隐藏状态与下一深度的 ground-truth token 的 embedding 结合。
- 共享 embedding `E`（与主模型相同）。
- 共享输出 head `Out`（与主模型相同）。

训练时，对于前缀到位置 `i`，每深度隐藏状态为：

```
h_i^(0) = 主模型骨干在位置 i
h_i^(k) = T_k( M_k * concat(RMSNorm(h_i^(k-1)), RMSNorm(E(t_{i+k}))) )   for k >= 1
```

每深度预测为：

```
logits_{i+k} = Out(h_i^(k-1))   for k = 1..D
```

每深度损失是针对 ground-truth `t_{i+k}` 的交叉熵：

```
L_k = CE(logits_{i+k}, t_{i+k})
```

跨深度的联合损失：

```
L_MTP = (lambda / D) * sum_{k=1..D} L_k
```

`lambda` 是小的加权因子 —— DeepSeek-V3 在前 10% 训练中使用 0.3，之后使用 0.1。总训练损失是 `L_main + L_MTP`。

### 为什么顺序而非并行

Gloeckle 的原始并行 MTP 有 D 个输出 head，每个直接应用于 `h_i^(0)`。每个 head 从相同的骨干隐藏状态预测 `t_{i+k}`。这训练良好，但预测不相互条件化。你无法使用 `head_1` 的输出帮助 `head_2` —— head 并行触发。

DeepSeek-V3 的顺序设计从 `h_i^(k-1)` 加上实际 next-token embedding `E(t_{i+k})` 构建 `h_i^(k)`。这保留因果链：要预测 `t_{i+k+1}`，深度 `k+1` 的模块看到 `t_{i+k}` 处有什么。这在结构上与自回归解码器消耗自己输出的方式相同 —— 使 MTP 模块直接可用作推测解码草稿。

推理时：将 `h_i^(k-1)` 和草稿的 `t_{i+k}` 喂入模块 `k+1`，获得 `t_{i+k+1}` 的预测。重复。这正是 EAGLE 风格的草稿，使用训练的 MTP 模块作为草稿网络。DeepSeek-V3 报告第一个 MTP 模块上 80%+ 接受率和 ~1.8× 加速。

### 参数核算

对于隐藏 `h` 和词汇 `V` 的模型：

- 主模型：数十亿参数，加一个大小为 `V * h` 的输出 head。
- 共享输出 head：重用主模型的 head。无额外参数。
- 共享 embedding：重用主模型的 embedding。无额外参数。
- 每 MTP 模块：
  - 投影 `M_k`：`(2h) * h = 2h^2`。
  - Transformer block `T_k`：attention（MHA 为 `4h^2`）加 MLP（SwiGLU 比例 8/3 时通常为 `8h^2`）。每 block 约 `12h^2`。

每模块总计额外：`~14h^2`。对于 DeepSeek-V3 的 `h = 7168`，D = 1 模块：纸上 `~14 * 7168^2 = ~720M` 参数。DeepSeek-V3 报告 14B —— 差异主要是 MTP 模块中的专家层也是 MoE。

### 推测解码回报

预训练期间，MTP 模块使训练减慢约 10%（更多前向计算，额外损失）。回报是双重的：

1. 更密集的训练信号。每个隐藏状态看到 D+1 监督目标。在 MMLU、GSM8K、MATH、HumanEval 上的测量效果：DeepSeek-V3 的消融中一致的几个百分点改进。

2. 推理时免费的推测解码草稿。MTP 模块已经训练预测接下来的几个 token。重新用作草稿网络，它交付 80%+ 接受率。在该水平，N=3 或 N=5 的 spec 解码给出 1.8× 吞吐量。10% 的训练时成本在第一次推理时就回本。

### 与 EAGLE 的关系

EAGLE 在预训练后单独训练小型草稿模型。MTP 将草稿烘焙到预训练中。两种方法收敛到相似的接受率，但通过不同的流水线：

| 维度 | EAGLE-3 | MTP（DeepSeek-V3） |
|-----------|---------|------------------|
| 何时训练 | 预训练后 | 预训练期间 |
| 与现有权重向后兼容 | 是 | 否（需要重新训练） |
| 草稿参数 | 1-2 个 transformer 层 | 1 个 transformer block + 投影 |
| 接受率 | 0.88-0.92 | 深度 1 时 0.80+ |
| 超越加速的收益 | 仅推测解码 | 更密集训练信号 + 加速 |

## 构建

`code/main.py` 端到端构建单个 MTP 模块：共享 embedding、投影、transformer block、共享输出 head。然后计算短合成序列上的每深度交叉熵损失并打印按组件的参数计数。32 token 的玩具词汇保持数字可读。

### 步骤 1：共享 embedding 表

单个 `vocab_size x hidden` 表被主模型 AND 每深度每个 MTP 模块使用。不是第二份 —— 字面上是相同的张量。

### 步骤 2：每深度组合

```python
def combine(prev_hidden, next_token_embed, M_k):
    # 沿特征维度 concat，然后投影到 hidden
    concat = rms_norm(prev_hidden) + rms_norm(next_token_embed)  # 向量加法替代
    projected = matvec(M_k, concat)
    return projected
```

真实 DeepSeek-V3 将两个 RMSNormed 向量 concat 到 `[2h]` 并用 `h x 2h` 矩阵投影。玩具为 stdlib 简洁使用向量加法。

### 步骤 3：深度 k 的 transformer block

Self-attention 加 MLP。在玩具中，单层线性 attention block 和 SwiGLU MLP 保持结构可见而不使用 numpy。

### 步骤 4：共享输出 head

重用主模型的输出投影。词汇上的 logits。

### 步骤 5：每深度损失

Softmax(logits) 对偏移 `k` 处 ground-truth token 的交叉熵。用 `lambda / D` 缩放因子跨深度聚合。

### 步骤 6：参数核算

打印总参数计数、共享（embedding、head）计数和每模块额外计数。显示 MTP 额外与主模型大小的比率。

## 使用它

MTP 集成到 DeepSeek-V3（2024 年 12 月）和 DeepSeek-R1 系列中。推理时：

- DeepSeek 自己的服务栈开箱即用将 MTP 模块用作推测解码器。
- 截至 2026 年 4 月，vLLM 和 SGLang 有 DeepSeek-V3 MTP 的集成路径。
- AMD 的 ROCm SGLang 教程展示了特定的 MTP 推测解码配置，在 V3 checkpoint 上测量到 1.8× 加速。

何时在新预训练运行中使用 MTP：

- 你控制完整预训练流水线并想存储更密集的训练信号。
- 你知道你将以规模服务模型并想要免费的推测解码。
- 你的隐藏大小至少为 4096。在 1B 规模开销伤害大于收益帮助。

何时不使用：

- 微调现有的预训练 dense 模型。MTP 模块未训练。
- 你想要干净基线来比较的研究模型。MTP 改变架构。

## 交付

本课生成 `outputs/skill-mtp-planner.md`。给定预训练运行规范（模型大小、数据、计算），它返回集成 MTP 的计划：深度数 D、`lambda` 调度、内存开销和推理时推测解码接线。

## 练习

1. 运行 `code/main.py`。显示每深度损失随合成信号增强而单调下降。修改合成使用固定模式并验证深度 1 和深度 2 损失都收敛。

2. 计算 D=1 MTP 模块的 dense 70B 模型（隐藏 8192，80 层）的参数开销。与 DeepSeek-V3 报告的 14B 开销比较。解释为什么 DeepSeek 的数字更高：MTP transformer block 继承相同的 MoE 结构，膨胀每模块参数计数。

3. 在玩具中实现 D=2：添加第二个 MTP 模块，取 h^(1) 并预测 `t_{i+2}`。验证联合损失和参数核算与 DeepSeek 论文的方程 19-21 匹配。

4. 将玩具切换到并行 MTP（Gloeckle 风格）：在主隐藏状态上添加 D 个输出 head，每个预测不同偏移。测量在相同合成信号上每深度损失与顺序版本的比较。顺序版本应为 k > 1 产生更低的深度 k 损失，因为它条件化于中间预测。

5. 将训练的 MTP 模块用作 EAGLE 风格草稿：推理时调用模块 k 提议 `t_{i+k}`。测量这些草稿 token 对主模型预测在 held-out 序列上的接受率。如果你在玩具上达到 50%+，你就复现了 MTP 作为草稿的实证特性。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| MTP 模块 | "额外损失块" | 预测主模型前方 `k` 个位置 token 的小型 transformer block 加投影 |
| 预测深度 | "哪个偏移" | 整数 `k`，模块 `k` 给定前缀到位置 `i` 预测 `t_{i+k}` |
| 并行 MTP | "Gloeckle 风格" | 相同骨干隐藏状态上的 D 个独立 head，无条件链 |
| 顺序 MTP | "DeepSeek-V3 风格" | 每个模块条件化于前深度的隐藏状态加下一 token 的 embedding；保留因果链 |
| 共享输出 head | "重用主 head" | MTP 模块调用主模型的 LM head，非单独输出投影 |
| 共享 embedding | "重用主表" | 相同的词汇 embedding 表到处使用；无重复参数 |
| 投影矩阵 M_k | "组合隐藏 + 下一 token" | 将前隐藏状态和目标 token embedding 折叠到下一深度输入的 `h x 2h` 线性层 |
| 联合损失 L_MTP | "平均额外损失" | 每深度交叉熵损失的算术平均，按 `lambda` 缩放 |
| 深度 1 接受率 | "MTP 草稿多经常对" | D=1 MTP 模块的 top-1 预测等于主模型 top-1 预测的比率；DeepSeek-V3 上 80%+ |
| Lambda 加权 | "额外损失重要性" | 每深度缩放因子；DeepSeek-V3 训练开始时 0.3，之后 0.1 |

## 延伸阅读

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) —— 完整顺序 MTP 描述（第 2.2 节），包括联合损失方程和推理时 1.8× 加速
- [Gloeckle et al. — Better & Faster Large Language Models via Multi-token Prediction (arXiv:2404.19737)](https://arxiv.org/abs/2404.19737) —— DeepSeek 设计改进的并行 MTP 基线
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) —— 685B 总计（671B 主模型 + 14B MTP），部署说明
- [Leviathan et al. — Fast Inference from Transformers via Speculative Decoding (arXiv:2211.17192)](https://arxiv.org/abs/2211.17192) —— MTP 适配的推测解码框架
- [Li et al. — EAGLE-3 (arXiv:2503.01840)](https://arxiv.org/abs/2503.01840) —— EAGLE 的 2025 草稿架构，MTP 竞争的对手
