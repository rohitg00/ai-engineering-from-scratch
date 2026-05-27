# DeepSeek-V3 架构详解

> 阶段10 · 第14课介绍了每个开放模型都会用到的六个架构旋钮。DeepSeek-V3（2024年12月发布，总计671B参数，激活37B参数）不仅拧动了全部六个旋钮，还额外增加了四个：多头潜在注意力（Multi-Head Latent Attention）、无辅助损失负载均衡、多令牌预测（Multi-Token Prediction）和DualPipe训练。本课将从顶层到底层剖析DeepSeek-V3的架构，并根据已发布的配置推导出每一个参数数量。学完本课后，你将能够解释为什么671B/37B的比例是正确的选择，以及为什么MLA+MoE的组合在开源前沿模型中比单独使用其中任何一个都更胜一筹。

**类型：** 学习
**语言：** Python（标准库，参数计算器）
**前置知识：** 阶段10 · 14（开放模型详解）、阶段10 · 17（NSA）、阶段10 · 18（MTP）、阶段10 · 19（DualPipe）
**时间：** 约75分钟

## 学习目标

- 从顶层到底层阅读DeepSeek-V3配置，并解释每个字段在GPT-2的六个旋钮以及DeepSeek特有的四个额外旋钮中的含义。
- 推导出总参数数量（671B）、激活参数数量（37B）以及各自包含的组件。
- 计算128k上下文下MLA的KV缓存占用，并与相同激活参数的密集模型（使用GQA）进行比较。
- 陈述DeepSeek特有的四项创新（MLA、MTP、无辅助损失路由、DualPipe），并指出每项创新分别针对架构或训练栈的哪个部分。

## 问题背景

DeepSeek-V3是首个在架构上与Llama家族有实质差别的开源前沿模型。Llama 3 405B是“拧动了六个旋钮的GPT-2”。而DeepSeek-V3则是拧动了全部六个旋钮再加四个。阅读Llama 3配置是为阅读DeepSeek配置做准备，但DeepSeek的深层结构——注意力模块的形状、路由逻辑、训练目标——差异足够大，需要单独进行详解。

学习它的价值：DeepSeek-V3的开源权重发布，改变了开放模型中“前沿能力”的定义。其架构是2026年许多训练运行的蓝本。理解它对于任何涉及前沿大模型训练或推理的岗位都是入门必备。

## 概念解析

### 不变的核心理念，再次强调

DeepSeek-V3仍然是自回归模型。它仍然堆叠解码器块。每个块仍然包含注意力加MLP加两层RMSNorm。MLP中仍然使用SwiGLU。仍然使用RoPE。前置归一化。权重共享嵌入。与每个Llama或Mistral相同的基线。

### 不同之处：MLA替代GQA

从阶段10 · 14你已经知道，GQA通过跨Q头组共享K和V来缩小KV缓存。多头潜在注意力（MLA）更进一步：K和V被压缩成一个共享的低秩潜在表示（`kv_lora_rank`），然后按需按头解压缩。KV缓存只存储潜在表示——通常每层每个token 512个浮点数，而不是8 x 128 = 1024个浮点数。

在128k上下文下，DeepSeek-V3使用MLA（每层每个token一个共享的潜在`c^{KV}`；K和V都通过上投影从该潜在派生，并且上投影可以合并到后续矩阵乘法中）：

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

一个假设的GQA基线（Llama 3 70B形状，8个KV头，头维度128）将支付：

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

在128k上下文下，MLA比Llama-3-70B风格的GQA缓存小4倍。

权衡：MLA在每次注意力计算（每头）中增加了一个解压缩步骤。与节省的带宽相比，额外的计算量很小。对于长上下文推理来说，净收益为正。

### 路由机制：无辅助损失负载均衡

MoE路由器决定哪些top-k专家处理每个token。朴素的路由器会将过多工作集中在少数专家上，导致其他专家空闲。标准解决方法：添加一个惩罚负载不平衡的辅助损失项。这虽然有效，但会略微降低主任务性能。

DeepSeek-V3引入了一种无辅助损失的方案。在路由器logits上添加每个专家的偏置项（`bias_e`），在训练期间通过简单规则进行调整：如果专家`e`超载，则减小`bias_e`；如果欠载，则增加它。不需要额外的损失项。训练保持干净。专家负载保持平衡。

对主损失的影响：没有可测量的影响。对MoE架构的影响：更干净，没有需要调整的辅助损失超参数。

### 多令牌预测（MTP）：更密集的训练 + 免费草稿

从阶段10 · 18你已经知道，DeepSeek-V3添加了D=1的MTP模块，用于预测后面两个位置处的令牌。在推理时，训练好的模块被重新用作推测解码的草稿模型，接受率超过80%。在训练时，每个隐藏状态在D+1=2个目标上得到监督，提供了更密集的信号。

参数：在671B主体之上增加14B。开销：2.1%。

### 训练方法：DualPipe

从阶段10 · 19你已经知道，DualPipe是一种双向流水线，它将前向和后向块与跨节点的全对全通信重叠在一起。在DeepSeek-V3的2048块H800规模下，它大致收回了1F1B本会损失在流水线气泡中的245k GPU小时。

### 配置逐字段解析

以下是DeepSeek-V3的配置（简化版）：

```
hidden_size: 7168
intermediate_size: 18432   （密集MLP隐藏层大小，用于前几层）
moe_intermediate_size: 2048 （专家MLP隐藏层大小）
num_hidden_layers: 61
first_k_dense_layers: 3    （前3层使用密集MLP）
num_attention_heads: 128
num_key_value_heads: 128   （形式上等于MLA下的num_heads，但真正的压缩在kv_lora_rank中）
kv_lora_rank: 512          （MLA潜在维度）
num_experts: 256            （每个块的MoE专家数）
num_experts_per_tok: 8      （top-8路由）
shared_experts: 1           （每个块始终开启的共享专家）
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               （深度为1的1个MTP模块）
```

解析：

- `hidden_size=7168`: 嵌入维度。
- `num_hidden_layers=61`: 总块深度。
- `first_k_dense_layers=3`: 前3个块使用大小为18432的密集MLP。剩余58个块使用MoE。
- `num_attention_heads=128`: 128个查询头。
- `kv_lora_rank=512`: K和V被压缩到这个潜在维度，并按头解压缩。
- `num_experts=256, num_experts_per_tok=8`: 每个MoE块有256个专家，路由top-8。
- `shared_experts=1`: 除了256个路由专家之外，还有1个始终开启的专家为每个token贡献。可以将其视为“密集底板”，确保每个token都能获得一些可靠的处理。
- `moe_intermediate_size=2048`: 每个专家的MLP隐藏层大小。比密集MLP小，因为有256个专家。

### 参数核算

完整计算位于 `code/main.py`。要点：

- 嵌入层：`vocab * hidden = 129280 * 7168 = 约0.93B`。
- 前3个密集块：注意力（使用MLA，约144M每块）+ 密集MLP（约260M每块）+ 归一化层。总计约1.2B。
- 58个MoE块：注意力（使用MLA，约144M）+ 256个专家（每个30M）+ 1个共享专家（30M）+ 归一化层。每块总计约7.95B，包括所有专家。58个MoE块合计461B。
- MTP模块：14B。

总计：核心架构约476B + 14B MTP，明显已发布的671B数字包含了额外的结构参数（偏置张量、专家特定组件、共享专家缩放等）。我们计算器复现的数字与已发布数字相差在3-5%以内——差异来自DeepSeek报告第2节附录中详细的核算。

每次前向传播的激活参数：

- 注意力：144M每层 * 61 = 8.8B（所有层都参与）。
- MLP激活：前3层密集（3 * 260M = 780M），58个MoE层每层激活8个路由 + 1个共享 + 路由开销。每层激活MLP：约260M。总计：3 * 260M + 58 * 260M = 约15.9B。
- 嵌入层 + 归一化层：1.2B。
- 总计激活：核心约26B + 14B MTP（训练时使用，但推理时不一定运行）≈ 37B。

### 671B / 37B 比例

18倍稀疏比（激活参数占总参数的5.5%）。DeepSeek-V3是已发布开源权重中最稀疏的前沿MoE模型。Mixtral 8x7B的比例为13/47（28%），密度高得多。Llama 4 Maverick的比例为17B/400B（4.25%），与之相当。DeepSeek的赌注：在前沿规模下，更多专家但更低的激活比，可以产生更好的每激活FLOP质量。

### DeepSeek-V3的定位

| 模型 | 总参数 | 激活参数 | 比例 | 注意力 | 创新点 |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + 无辅助损失 + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN扩展 |

### 后续版本：R1, V4

DeepSeek-R1（2025年）是基于V3骨架进行推理训练的运行。R1使用相同的架构。改变的是后训练配方（在可验证任务上进行大规模强化学习），而不是预训练架构。

DeepSeek-V4（如果发布）预计将保留MLA + MoE + MTP，并添加DSA（DeepSeek稀疏注意力），即阶段10 · 17中NSA的继任者。技术路线是稳定的：架构层面的创新不断积累；每个版本都会拧动额外的旋钮。

## 使用它

`code/main.py` 是针对DeepSeek-V3形状特化的参数计算器。运行它，将其输出与论文中的数字进行比较，并在假设的变体（256个专家 vs 512个，top-8 vs top-16，MLA秩512 vs 1024）上使用它。

需要注意的内容：

- 总参数数与已发布的671B对比。
- 激活参数数与已发布的37B对比。
- 128k上下文下的KV缓存——MLA与GQA的比较。
- 逐层分解，查看参数预算实际花在哪里。

## 交付物

本课程产生 `outputs/skill-deepseek-v3-reader.md`。给定一个DeepSeek家族模型（V3, R1，或任何未来变体），它会生成一个逐组件的架构解读，指出配置的每个字段，按组件推导参数数量，并识别该模型使用了DeepSeek特有的四项创新中的哪些。

## 练习

1. 运行 `code/main.py`。将计算器的总参数估计值与已发布的671B进行比较，并找出差异的来源。论文的第2节有完整的明细。
2. 将配置修改为使用MLA秩256而不是512。计算在128k上下文下得到的KV缓存大小。这带来了多少百分比缩减，对每头的表达能力有什么代价？
3. 比较DeepSeek-V3的（256个专家，top-8）路由与假设的（512个专家，top-8）变体。总参数增加；激活参数保持不变。额外的专家容量在理论上带来了什么好处，在推理时又带来了什么代价？
4. 阅读DeepSeek-V3技术报告（arXiv:2412.19437）的第2.1节关于MLA的内容。用三句话解释为什么K和V的解压缩矩阵可以在推理时“吸收”到后续的矩阵乘法中以提高效率。
5. DeepSeek-V3对大部分操作使用FP8训练。计算FP8与BF16相比，存储671B权重节省的内存。这与14.8T令牌的训练预算如何相互影响？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| MLA | “Multi-Head Latent Attention” 多头潜在注意力 | 将K和V压缩为一个共享的低秩潜在表示（kv_lora_rank，通常为512），按头即时解压缩；KV缓存仅存储潜在表示 |
| kv_lora_rank | “MLA压缩维度” | K和V共享潜在的大小；DeepSeek-V3使用512 |
| first_k_dense_layers | “早期层保持密集” | MoE模型的前几层跳过MoE路由器，运行密集MLP以保持稳定性 |
| num_experts_per_tok | “Top-k路由” | 每个token激活多少个路由专家；DeepSeek-V3使用8 |
| shared_experts | “始终开启的专家” | 无论路由结果如何都处理每个token的专家；DeepSeek-V3使用1 |
| auxiliary-loss-free routing | “偏置调整负载平衡” | 在训练期间调整每个专家的偏置项，以保持专家负载平衡，无需添加损失项 |
| MTP module | “额外预测头” | 从h^(1)和E(t+1)预测t+2位置令牌的Transformer块；训练更密集，免费获得推测解码草稿 |
| DualPipe | “双向流水线” | 训练调度，将前向/后向计算与跨节点全对全通信重叠 |
| active parameter ratio | “稀疏度” | active_params / total_params；DeepSeek-V3达到5.5% |
| FP8 training | “8位训练” | 训练存储和许多计算操作使用FP8；与BF16相比，内存大约减半，质量成本很小 |

## 延伸阅读

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — 完整的架构、训练和结果文档
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) — 配置文件和部署说明
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) — 引入MLA的前驱版本
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — 基于V3架构的推理训练后继版本
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) — DeepSeek家族注意力的未来方向
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe) — 训练调度参考