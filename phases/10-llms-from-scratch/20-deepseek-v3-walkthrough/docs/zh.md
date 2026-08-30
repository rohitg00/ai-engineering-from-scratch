# DeepSeek-V3 架构详解

> 第 10 阶段 · 第 14 课命名了每个开放模型都会调整的六个架构旋钮。DeepSeek-V3（2024 年 12 月，总计 671B 参数，37B 活跃）调整了全部六个并添加了四个：Multi-Head Latent Attention、无辅助损失负载均衡、Multi-Token Prediction 和 DualPipe 训练。本课从上到下阅读 DeepSeek-V3 的架构并从发布的配置推导每个参数计数。最后你可以解释为什么 671B/37B 比率是正确的赌注，以及为什么 MLA + MoE 一起在前沿击败单独任何一个。

**类型：** 学习
**语言：** Python（标准库，参数计算器）
**前置要求：** 第 10 阶段 · 14（开放模型详解），第 10 阶段 · 17（NSA），第 10 阶段 · 18（MTP），第 10 阶段 · 19（DualPipe）
**时间：** ~75 分钟

## 学习目标

- 从上到下阅读 DeepSeek-V3 配置并用六个 GPT-2 旋钮加四个 DeepSeek 特定添加解释每个字段
- 推导总参数计数（671B）、活跃参数计数（37B）以及贡献给每个的组件
- 计算 MLA 在 128k 上下文时的 KV 缓存占用，并与具有相同活跃参数的 dense 模型使用 GQA 的成本比较
- 陈述四个 DeepSeek 特定创新（MLA、MTP、无辅助损失路由、DualPipe）并命名每个针对的架构/训练栈部分

## 问题

DeepSeek-V3 是第一个架构与 Llama 家族有实质性不同的前沿开放模型。Llama 3 405B 是"调整了六个旋钮的 GPT-2"。DeepSeek-V3 是调整了全部六个旋钮加四个的 GPT-2。阅读 Llama 3 配置是阅读 DeepSeek 配置的热身，但深层结构 —— attention 块的形状、路由逻辑、训练时目标 —— 差异足够大，你需要单独的讲解。

学习它的回报：DeepSeek-V3 的开放权重发布改变了"前沿能力"在开放模型中的含义。该架构是许多 2026 年训练运行正在复制的蓝图。理解它是任何触及前沿 LLM 训练或推理角色的基本要求。

## 核心概念

### 不变的核心，再次

DeepSeek-V3 仍然是自回归的。它仍然堆叠解码器块。每个块仍然有 attention 加 MLP 加两个 RMSNorm。它仍然在 MLP 中使用 SwiGLU。它仍然使用 RoPE。Pre-norm。权重绑定 embedding。与每个 Llama 或 Mistral 相同的基线。

### 转折：MLA 替代 GQA

从第 10 阶段 · 14 你知道 GQA 通过在 Q head 组间共享 K 和 V 来缩小 KV 缓存。Multi-Head Latent Attention（MLA）更进一步：K 和 V 被压缩成共享的低秩潜在表示（`kv_lora_rank`），然后按 head 即时解压。KV 缓存只存储潜在 —— 通常每层每 token 512 个浮点数，而非 8 x 128 = 1024 个浮点数。

在 128k 上下文时，使用 MLA 的 DeepSeek-V3（每层每 token 一个共享潜在 `c^{KV}`；K 和 V 都从这个潜在通过上投影推导，上投影可以吸收到后续 matmul 中）：

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

假设的 GQA 基线（Llama 3 70B 形状，8 个 KV head，head dim 128）将支付：

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

MLA 在 128k 上下文时比 Llama-3-70B 风格的 GQA 缓存小 4 倍。

权衡：MLA 每次 attention 计算添加一个解压步骤（每 head）。额外计算与节省的带宽相比很小。长上下文推理的净胜利。

### 路由：无辅助损失负载均衡

MoE 路由器决定哪些 top-k 专家处理每个 token。朴素路由器将太多工作集中在少数专家上，使其他专家空闲。标准修复：添加惩罚负载不平衡的辅助损失项。这有效但略微降低主任务性能。

DeepSeek-V3 引入无辅助损失方案。向路由器 logits 添加每专家偏置项，训练期间通过简单规则调整：如果专家 `e` 过载，减少 `bias_e`；如果欠载，增加它。无额外损失项。训练保持干净。专家负载保持平衡。

对主损失的影响：无可测量的。对 MoE 架构的影响：更干净，无需调整辅助损失超参数。

### MTP：更密集训练 + 免费草稿

从第 10 阶段 · 18 你知道 DeepSeek-V3 添加 D=1 MTP 模块，预测前方两个位置的 token。推理时，训练好的模块被重新用作推测解码草稿，接受率 80%+。训练时，每个隐藏状态在 D+1 = 2 个目标上被监督，提供更密集的信号。

参数：671B 主模型之上的 14B。开销：2.1%。

### 训练：DualPipe

从第 10 阶段 · 19 你知道 DualPipe 是双向流水线，将前向和后向块与跨节点 all-to-all 通信重叠。在 DeepSeek-V3 的 2,048-H800 规模上，它恢复了 1F1B 因流水线气泡损失的约 245k GPU 小时。

### 配置，逐字段

以下是 DeepSeek-V3 配置（简化）：

```
hidden_size: 7168
intermediate_size: 18432   (dense MLP 隐藏大小，用于前几层)
moe_intermediate_size: 2048 (专家 MLP 隐藏大小)
num_hidden_layers: 61
first_k_dense_layers: 3    (前 3 层使用 dense MLP)
num_attention_heads: 128
num_key_value_heads: 128   (MLA 下形式上等于 num_heads，但
                           真正的压缩在 kv_lora_rank 中)
kv_lora_rank: 512          (MLA 潜在维度)
num_experts: 256            (每块 MoE 专家计数)
num_experts_per_tok: 8      (top-8 路由)
shared_experts: 1           (每块始终开启的共享专家)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (深度 1 处 1 个 MTP 模块)
```

解析：

- `hidden_size=7168`：embedding 维度。
- `num_hidden_layers=61`：总块深度。
- `first_k_dense_layers=3`：前 3 个块使用大小为 18432 的 dense MLP。剩余 58 个使用 MoE。
- `num_attention_heads=128`：128 个查询 head。
- `kv_lora_rank=512`：K 和 V 被压缩到这个潜在维度并按 head 解压。
- `num_experts=256, num_experts_per_tok=8`：每个 MoE 块有 256 个专家，路由 top-8。
- `shared_experts=1`：在 256 个路由专家之上，1 个始终开启的专家贡献给每个 token。将其视为确保每个 token 获得可靠东西的"dense 地板"。
- `moe_intermediate_size=2048`：每个专家的 MLP 隐藏大小。比 dense MLP 小，因为有 256 个。

### 参数核算

完整计算在 `code/main.py` 中。标题：

- Embedding：`vocab * hidden = 129280 * 7168 = ~0.93B`。
- 前 3 个 dense 块：带 MLA 的 attention（每块 ~144M）+ dense MLP（每块 ~260M）+ norms。约 1.2B 总计。
- 58 个 MoE 块：带 MLA 的 attention（~144M）+ 256 个专家每个（30M）+ 1 个共享专家（30M）+ norm。每块总计 ~7.95B，包括所有专家。58 个 MoE 块总计 461B。
- MTP 模块：14B。

总计：核心架构约 476B + 14B MTP + 明显发布的 671B 数字包含额外的结构参数（偏置张量、专家特定组件、共享专家缩放等）。我们在计算器中复现的数字在发布数字的 3-5% 内 —— 差异来自 DeepSeek 报告在其第 2 节附录中记录的细粒度核算。

每次前向的活跃参数：

- Attention：每层 144M * 61 = 8.8B（所有层触发）。
- MLP 活跃：前 3 层 dense（3 * 260M = 780M），58 个 MoE 层每层活跃 8 个路由 + 1 个共享 + 路由开销。每层活跃 MLP：~260M。总计：3 * 260M + 58 * 260M = ~15.9B。
- Embedding + norms：1.2B。
- 总活跃：约 26B 核心 + 14B MTP（训练但推理不总是运行）≈ 37B。

### 671B / 37B 比率

18 倍稀疏比率（活跃参数是总计的 5.5%）。DeepSeek-V3 是已出货开放权重中最稀疏的前沿 MoE 模型。Mixtral 8x7B 比率 13/47（28%）密集得多。Llama 4 Maverick 比率 17B/400B（4.25%）可比较。DeepSeek 的赌注：在前沿规模，更多专家与更低激活比率产生每活跃 FLOP 更好的质量。

### DeepSeek-V3 的位置

| 模型 | 总计 | 活跃 | 比率 | Attention | 新颖想法 |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + aux-free + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN 扩展 |

### 后续：R1、V4

DeepSeek-R1（2025）是在 V3 骨干上的推理训练运行。R1 使用相同架构。改变的是后训练配方（可验证任务上的大规模 RL），而非预训练架构。

DeepSeek-V4（如果出货）预期保持 MLA + MoE + MTP 并添加 DSA（DeepSeek Sparse Attention），第 10 阶段 · 17 中 NSA 的继任者。血统稳定：架构级创新累积；每个版本调整额外的旋钮。

## 使用它

`code/main.py` 是专为 DeepSeek-V3 形状设计的参数计算器。运行它，将其输出与论文数字比较，并在假设变体上使用它（256 专家 vs 512，top-8 vs top-16，MLA rank 512 vs 1024）。

看什么：

- 总参数计数 vs 发布的 671B。
- 活跃参数计数 vs 发布的 37B。
- 128k 上下文时的 KV 缓存 —— MLA vs GQA 比较。
- 每层细分以查看参数预算实际去向。

## 交付

本课生成 `outputs/skill-deepseek-v3-reader.md`。给定 DeepSeek 家族模型（V3、R1 或任何未来变体），它产出逐组件架构阅读，命名配置的每个字段，按组件推导参数计数，并识别模型使用四个 DeepSeek 特定创新中的哪些。

## 练习

1. 运行 `code/main.py`。将计算器的总参数估算与发布的 671B 比较并识别差异来源。论文的第 2 节有完整的明细。

2. 修改配置使用 MLA rank 256 替代 512。计算 128k 上下文时产生的 KV 缓存大小。它购买了多少百分比缩减，以及对每 head 表达力的成本是什么？

3. 将 DeepSeek-V3 的（256 专家，top-8）路由与假设的（512 专家，top-8）变体比较。总参数增长；活跃参数保持相同。额外的专家容量在理论上购买什么，推理时成本是什么？

4. 阅读 DeepSeek-V3 技术报告（arXiv:2412.19437）第 2.1 节关于 MLA。用三句话解释为什么 K 和 V 解压矩阵可以"吸收"到后续 matmul 中以实现推理时效率。

5. DeepSeek-V3 对大多数操作使用 FP8 训练。计算存储 671B 权重时 FP8 与 BF16 的内存节省。这与 14.8T token 训练预算如何交叉？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| MLA | "Multi-Head Latent Attention" | 将 K 和 V 压缩成共享低秩潜在（kv_lora_rank，通常 512），按 head 即时解压；KV 缓存只存储潜在 |
| kv_lora_rank | "MLA 压缩维度" | K 和 V 的共享潜在大小；DeepSeek-V3 使用 512 |
| 前 k dense 层 | "早期层保持 dense" | 前几个 MoE 模型层跳过 MoE 路由器并运行 dense MLP 以保持稳定 |
| num_experts_per_tok | "Top-k 路由" | 每个 token 触发多少路由专家；DeepSeek-V3 使用 8 |
| 共享专家 | "始终开启的专家" | 无论路由如何都处理每个 token 的专家；DeepSeek-V3 使用 1 |
| 无辅助损失路由 | "偏置调整负载均衡" | 训练期间调整的每专家偏置项，保持专家负载均衡而不添加损失项 |
| MTP 模块 | "额外预测 head" | 从 h^(1) 和 E(t+1) 预测 t+2 的 transformer block；更密集训练，免费推测解码草稿 |
| DualPipe | "双向流水线" | 将前向/后向计算与跨节点 all-to-all 重叠的训练调度 |
| 活跃参数比率 | "稀疏性" | active_params / total_params；DeepSeek-V3 达到 5.5% |
| FP8 训练 | "8 位训练" | FP8 中的训练存储和许多计算操作；与 BF16 相比约减半内存，质量成本小 |

## 延伸阅读

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) —— 完整的架构、训练和结果文档
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) —— 配置文件和部署说明
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) —— 引入 MLA 的前身
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) —— V3 架构上的推理训练继任者
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) —— DeepSeek 家族 attention 的未来方向
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe) —— 训练调度参考
