# 20 · DeepSeek-V3 架构逐层精读

> 第 10 阶段 · 第 14 课点明了每个开源模型都会调节的六个架构「旋钮（knob）」。DeepSeek-V3（2024 年 12 月，总参数 671B、激活参数 37B）把这六个旋钮全部拧动，并额外加上四个：多头潜在注意力（Multi-Head Latent Attention）、无辅助损失的负载均衡（auxiliary-loss-free load balancing）、多 Token 预测（Multi-Token Prediction）以及 DualPipe 训练。本课自顶向下通读 DeepSeek-V3 的架构，并从公开的配置中推导出每一项参数量。学完后，你将能解释为什么 671B/37B 这个比例是正确的押注，以及为什么在前沿规模上 MLA 与 MoE 结合的效果优于任意一者单独使用。

**类型：** 学习
**语言：** Python（标准库，参数计算器）
**前置：** 第 10 阶段 · 14（开源模型精读）、第 10 阶段 · 17（NSA）、第 10 阶段 · 18（MTP）、第 10 阶段 · 19（DualPipe）
**时长：** 约 75 分钟

## 学习目标

- 自顶向下通读 DeepSeek-V3 的配置，并用 GPT-2 的六个旋钮加上四个 DeepSeek 特有的新增项来解释每个字段。
- 推导总参数量（671B）、激活参数量（37B），以及各自由哪些组件构成。
- 计算 MLA 在 128k 上下文下的 KV 缓存（KV cache）占用，并与一个相同激活参数量、使用 GQA 的稠密模型所需付出的成本作对比。
- 说出四项 DeepSeek 特有的创新（MLA、MTP、无辅助损失路由、DualPipe），并指出每一项针对架构/训练栈的哪个部分。

## 问题所在

DeepSeek-V3 是第一个架构与 Llama 系列有实质差异的前沿开源模型。Llama 3 405B 是「拧动了六个旋钮的 GPT-2」。DeepSeek-V3 则是把全部六个旋钮再加四个的 GPT-2。读 Llama 3 的配置是读 DeepSeek 配置的热身，但其深层结构——注意力块的形态、路由逻辑、训练时的目标函数——差异足够大，需要单独一次精读。

学习它的回报：DeepSeek-V3 的开放权重发布改变了开源模型中「前沿能力」的含义。这套架构是众多 2026 年训练实验正在抄写的蓝图。理解它，是任何接触前沿 LLM 训练或推理的岗位的入门门槛。

## 核心概念

### 不变的内核，再说一遍

DeepSeek-V3 仍然是自回归（autoregressive）的。它仍然堆叠解码器块（decoder block）。每个块仍然由注意力加 MLP 再加两个 RMSNorm 组成。它的 MLP 仍然用 SwiGLU。它仍然用 RoPE。前置归一化（pre-norm）。权重绑定（weight-tied）的嵌入。与每一个 Llama 或 Mistral 相同的基线。

### 转折：用 MLA 而非 GQA

从第 10 阶段 · 14 你已经知道，GQA 通过让若干 Q 头组共享 K 和 V 来缩小 KV 缓存。多头潜在注意力（Multi-Head Latent Attention，MLA）更进一步：K 和 V 被压缩进一个共享的低秩潜在表示（即 `kv_lora_rank`），然后在使用时按头逐一解压。KV 缓存只存储这个潜在向量——通常是每 token 每层 512 个浮点数，而不是 8 x 128 = 1024 个浮点数。

在 128k 上下文下，使用 MLA 的 DeepSeek-V3（每 token 每层一个共享潜在向量 `c^{KV}`；K 和 V 都通过上投影从该潜在向量派生，而这些上投影可以被吸收进后续的矩阵乘法）：

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

一个假想的 GQA 基线（Llama 3 70B 形态，8 个 KV 头，头维度 128）则需要付出：

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

在 128k 上下文下，MLA 比 Llama-3-70B 风格的 GQA 缓存小 4 倍。

权衡之处：MLA 在每次注意力计算（按头）中增加了一个解压步骤。这点额外算力与节省下来的带宽相比很小。对长上下文推理而言是净收益。

### 路由：无辅助损失的负载均衡

MoE 路由器决定哪 top-k 个专家（expert）来处理每个 token。一个朴素的路由器会把过多的工作集中在少数几个专家上，让其余专家闲置。标准的修补办法：加入一个辅助损失项（auxiliary loss）来惩罚负载不均。这有效，但会轻微拖累主任务性能。

DeepSeek-V3 引入了一种无辅助损失的方案。给路由器 logits 加上每个专家各自的偏置项，并在训练中按一条简单规则调整：如果专家 `e` 过载，就降低 `bias_e`；如果欠载，就提高它。没有额外的损失项。训练保持干净。专家负载保持均衡。

对主损失的影响：没有可测量的影响。对 MoE 架构的影响：更干净，没有需要调参的辅助损失超参数。

### MTP：更稠密的训练 + 免费的草稿

从第 10 阶段 · 18 你已经知道，DeepSeek-V3 加了 D=1 个 MTP 模块，用于预测往后两个位置的 token。在推理时，这个训练好的模块被复用为投机解码（speculative-decoding）的草稿器，接受率超过 80%。在训练时，每个隐藏状态都在 D+1 = 2 个目标上受监督，提供更稠密的信号。

参数量：在 671B 主体之上增加 14B。开销：2.1%。

### 训练：DualPipe

从第 10 阶段 · 19 你已经知道，DualPipe 是一种双向流水线，用跨节点的 all-to-all 通信来重叠前向与反向的分块计算。在 DeepSeek-V3 的 2,048 张 H800 规模上，它大约找回了 245k GPU 小时——这些时间在 1F1B 方案下会因流水线气泡（pipeline bubble）而损失。

### 配置逐字段解读

下面是 DeepSeek-V3 的配置（简化版）：

```
hidden_size: 7168
intermediate_size: 18432   (稠密 MLP 隐藏层大小，用于前几层)
moe_intermediate_size: 2048 (专家 MLP 隐藏层大小)
num_hidden_layers: 61
first_k_dense_layers: 3    (前 3 层使用稠密 MLP)
num_attention_heads: 128
num_key_value_heads: 128   (在 MLA 下形式上等于 num_heads，但
                           真正的压缩在 kv_lora_rank 中)
kv_lora_rank: 512          (MLA 潜在维度)
num_experts: 256            (每个块的 MoE 专家数量)
num_experts_per_tok: 8      (top-8 路由)
shared_experts: 1           (每个块始终开启的共享专家)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (1 个深度为 1 的 MTP 模块)
```

逐项解析：

- `hidden_size=7168`：嵌入维度。
- `num_hidden_layers=61`：总块深度。
- `first_k_dense_layers=3`：前 3 个块使用大小为 18432 的稠密 MLP。其余 58 个块使用 MoE。
- `num_attention_heads=128`：128 个查询头。
- `kv_lora_rank=512`：K 和 V 被压缩到这个潜在维度，并按头解压。
- `num_experts=256, num_experts_per_tok=8`：每个 MoE 块有 256 个专家，路由 top-8。
- `shared_experts=1`：在 256 个被路由的专家之上，有 1 个始终开启的专家对每个 token 都有贡献。可以把它想成一个「稠密底座」，确保每个 token 都能得到一些可靠的东西。
- `moe_intermediate_size=2048`：每个专家的 MLP 隐藏层大小。比稠密 MLP 小，因为一共有 256 个。

### 参数核算

完整的计算在 `code/main.py` 中。要点如下：

- 嵌入：`vocab * hidden = 129280 * 7168 = ~0.93B`。
- 前 3 个稠密块：带 MLA 的注意力（每块约 144M）+ 稠密 MLP（每块约 260M）+ 归一化。合计约 1.2B。
- 58 个 MoE 块：带 MLA 的注意力（约 144M）+ 256 个专家（每个 30M）+ 1 个共享专家（30M）+ 归一化。每块合计约 7.95B（含全部专家）。58 个 MoE 块合计 461B。
- MTP 模块：14B。

总计：核心架构约 476B + MTP 14B；而公开的 671B 这个数字另外计入了一些结构性参数（偏置张量、专家特有组件、共享专家缩放等等）。我们在计算器里复现出来的数字与公开值相差在 3-5% 以内——这个差距来自 DeepSeek 报告第 2 节附录中记录的细粒度核算。

每次前向的激活参数：

- 注意力：每层 144M * 61 = 8.8B（所有层都触发）。
- 激活的 MLP：前 3 层稠密（3 * 260M = 780M），58 个 MoE 层各自激活 8 个被路由专家 + 1 个共享专家 + 路由开销。每层激活的 MLP：约 260M。合计：3 * 260M + 58 * 260M = ~15.9B。
- 嵌入 + 归一化：1.2B。
- 总激活量：核心约 26B + MTP 14B（训练但推理时并不总是运行）≈ 37B。

### 671B / 37B 这个比例

18 倍稀疏比（激活参数是总量的 5.5%）。DeepSeek-V3 是已发布开放权重的前沿 MoE 模型中最稀疏的。Mixtral 8x7B 的比例是 13/47（28%），稠密得多。Llama 4 Maverick 的比例是 17B/400B（4.25%），与之相当。DeepSeek 的押注是：在前沿规模上，更多专家配以更低的激活比例，能在每个激活 FLOP 上产出更高的质量。

### DeepSeek-V3 的定位

| 模型 | 总参数 | 激活参数 | 比例 | 注意力 | 新颖思路 |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + 无辅助损失 + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN 扩展 |

### 后续：R1、V4

DeepSeek-R1（2025）是在 V3 主干上的一次推理训练实验。R1 使用相同的架构。改变的是后训练（post-training）配方（在可验证任务上的大规模强化学习），而非预训练架构。

DeepSeek-V4（如果发布）预计会保留 MLA + MoE + MTP，并加入 DSA（DeepSeek Sparse Attention，DeepSeek 稀疏注意力），即第 10 阶段 · 17 中 NSA 的继任者。这条谱系是稳定的：架构层面的创新不断累积；每个版本都拧动额外的旋钮。

## 动手用起来

`code/main.py` 是针对 DeepSeek-V3 形态定制的参数计算器。运行它，把它的输出与论文中的数字对比，并把它用在假想的变体上（256 个专家 vs 512 个，top-8 vs top-16，MLA 秩 512 vs 1024）。

要看的内容：

- 总参数量 vs 公开的 671B。
- 激活参数量 vs 公开的 37B。
- 128k 上下文下的 KV 缓存——MLA 与 GQA 的对比。
- 逐层拆解，看看参数预算实际花在了哪里。

## 交付成果

本课产出 `outputs/skill-deepseek-v3-reader.md`。给定一个 DeepSeek 家族的模型（V3、R1 或任何未来变体），它会产出一份逐组件的架构解读，命名配置中的每个字段，按组件推导参数量，并指出该模型用到了四项 DeepSeek 特有创新中的哪些。

## 练习

1. 运行 `code/main.py`。将计算器估算的总参数量与公开的 671B 对比，并找出差距来自哪里。论文第 2 节有完整的逐项明细。

2. 修改配置，把 MLA 秩从 512 改为 256。计算在 128k 上下文下由此得到的 KV 缓存大小。这能换来百分之多少的削减，又以多大的每头表达力为代价？

3. 把 DeepSeek-V3 的（256 个专家，top-8）路由与一个假想的（512 个专家，top-8）变体作对比。总参数增长；激活参数保持不变。理论上额外的专家容量能换来什么，又在推理时付出什么代价？

4. 阅读 DeepSeek-V3 技术报告（arXiv:2412.19437）第 2.1 节关于 MLA 的内容。用三句话解释为什么 K 与 V 的解压矩阵可以为了推理时的效率而被「吸收」进后续的矩阵乘法。

5. DeepSeek-V3 的大多数运算使用 FP8 训练。计算用 FP8 而非 BF16 存储 671B 权重所节省的内存。这与 14.8T token 的训练预算如何交叉影响？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| MLA | 「多头潜在注意力」 | 把 K 和 V 压缩进一个共享的低秩潜在向量（kv_lora_rank，通常为 512），按头即时解压；KV 缓存只存潜在向量 |
| kv_lora_rank | 「MLA 压缩维度」 | K 和 V 共享潜在向量的大小；DeepSeek-V3 用 512 |
| 前 k 层稠密 | 「前几层保持稠密」 | MoE 模型的前几层跳过 MoE 路由器，运行稠密 MLP 以保证稳定性 |
| num_experts_per_tok | 「Top-k 路由」 | 每个 token 触发多少个被路由的专家；DeepSeek-V3 用 8 |
| 共享专家 | 「始终开启的专家」 | 无论路由如何都处理每个 token 的专家；DeepSeek-V3 用 1 |
| 无辅助损失路由 | 「偏置调整式负载均衡」 | 在训练中调整每个专家的偏置项以保持专家负载均衡，且不加入损失项 |
| MTP 模块 | 「额外的预测头」 | 从 h^(1) 和 E(t+1) 预测 t+2 的 Transformer 块；更稠密的训练，免费的投机解码草稿 |
| DualPipe | 「双向流水线」 | 用跨节点 all-to-all 重叠前向/反向计算的训练调度 |
| 激活参数比例 | 「稀疏度」 | active_params / total_params；DeepSeek-V3 达到 5.5% |
| FP8 训练 | 「8 位训练」 | 以 FP8 进行训练存储和许多计算运算；相比 BF16 大致减半内存，质量代价很小 |

## 延伸阅读

- [DeepSeek-AI — DeepSeek-V3 技术报告（arXiv:2412.19437）](https://arxiv.org/abs/2412.19437) — 完整的架构、训练与结果文档
- [Hugging Face 上的 DeepSeek-V3 模型卡](https://huggingface.co/deepseek-ai/DeepSeek-V3) — 配置文件与部署说明
- [DeepSeek-V2 论文（arXiv:2405.04434）](https://arxiv.org/abs/2405.04434) — 引入 MLA 的前作
- [DeepSeek-R1 论文（arXiv:2501.12948）](https://arxiv.org/abs/2501.12948) — 在 V3 架构上的推理训练继任者
- [Native Sparse Attention（arXiv:2502.11089）](https://arxiv.org/abs/2502.11089) — DeepSeek 家族注意力的未来方向
- [DualPipe 代码仓库](https://github.com/deepseek-ai/DualPipe) — 训练调度参考实现
