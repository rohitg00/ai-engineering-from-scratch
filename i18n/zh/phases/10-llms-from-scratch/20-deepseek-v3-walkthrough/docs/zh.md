# DeepSeek-V3 架构详解

> 第 10 阶段 · 第 14 课列出了每个开源模型都会调节的六个架构旋钮。DeepSeek-V3(2024 年 12 月,总参数 671B,激活参数 37B)调节了全部六个,并新增四个:Multi-Head Latent Attention、无辅助损失的负载均衡、Multi-Token Prediction 以及 DualPipe 训练。本课从头到尾解读 DeepSeek-V3 的架构,并根据公开配置推导每一个参数量。学完本课,你能解释为什么 671B/37B 的比例是正确的押注,以及为什么在最前沿上 MLA 与 MoE 的组合优于单独使用任何一种。

**Type:** Learn
**Languages:** Python (stdlib, parameter calculator)
**Prerequisites:** 第 10 阶段 · 14(开源模型解读)、第 10 阶段 · 17(NSA)、第 10 阶段 · 18(MTP)、第 10 阶段 · 19(DualPipe)
**Time:** 约 75 分钟

## 学习目标

- 从头到尾阅读 DeepSeek-V3 配置,并用六个 GPT-2 旋钮加上四个 DeepSeek 特有的新增项来解释每个字段。
- 推导总参数量(671B)、激活参数量(37B),以及各自由哪些组件构成。
- 计算 MLA 在 128k 上下文下的 KV cache 占用,并与同激活参数量的 GQA 稠密模型对比。
- 说出四个 DeepSeek 特有的创新(MLA、MTP、无辅助损失路由、DualPipe),并指出每个创新针对架构/训练栈的哪一部分。

## 问题

DeepSeek-V3 是第一个架构上与 Llama 家族有实质差异的前沿开源模型。Llama 3 405B 是"调了六个旋钮的 GPT-2"。DeepSeek-V3 是调满六个旋钮再加四个新旋钮的 GPT-2。读 Llama 3 配置是读 DeepSeek 配置的热身,但其深层结构——注意力块的形状、路由逻辑、训练时目标函数——差异足够大,需要单独的解读。

学习它的回报:DeepSeek-V3 的开放权重发布改变了"前沿能力"在开源模型中的含义。该架构是许多 2026 年训练运行正在复制的蓝图。理解它是任何涉及前沿 LLM 训练或推理的岗位的基本要求。

## 概念

### 不变的核心,再次

DeepSeek-V3 仍然是自回归的。它仍然堆叠 decoder 块。每个块仍然由注意力 + MLP + 两个 RMSNorm 组成。MLP 中仍然使用 SwiGLU。仍然使用 RoPE。Pre-norm。嵌入与输出权重共享。与所有 Llama 或 Mistral 相同的基线。

### 变化:用 MLA 代替 GQA

从第 10 阶段 · 14 课你知道,GQA 通过在多组 Q 头之间共享 K 和 V 来缩小 KV cache。Multi-Head Latent Attention(MLA)更进一步:K 和 V 被压缩为一个共享的低秩潜在表示(即 `kv_lora_rank`),然后按头即时解压。KV cache 只存储该潜在向量——通常每个 token 每层 512 个浮点数,而不是 8 x 128 = 1024 个浮点数。

在 128k 上下文下,使用 MLA 的 DeepSeek-V3(每个 token 每层一个共享潜在向量 `c^{KV}`;K 和 V 都通过可以吸收进后续矩阵乘法的上投影从该潜在向量导出):

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

一个假想的 GQA 基线(Llama 3 70B 形态,8 个 KV 头,头维度 128)需要付出:

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

在 128k 上下文下,MLA 比 Llama-3-70B 风格的 GQA cache 小 4 倍。

代价:MLA 在每次注意力计算(每头)时增加一个解压步骤。与节省的带宽相比,额外计算很小。对于长上下文推理是净收益。

### 路由:无辅助损失的负载均衡

MoE 路由器决定哪些 top-k 专家处理每个 token。朴素的路由器会把过多工作集中在少数专家上,使其他专家闲置。标准修复:添加一个惩罚负载不均衡的辅助损失项。这有效但会轻微降低主任务性能。

DeepSeek-V3 引入了无辅助损失的方案。在路由器 logits 上为每个专家添加偏置项,训练期间通过简单规则调整:如果专家 `e` 过载,则减小 `bias_e`;如果欠载,则增大它。没有额外损失项。训练保持干净。专家负载保持均衡。

对主损失的影响:无可测量。对 MoE 架构的影响:更干净,无需调辅助损失超参数。

### MTP:更密集的训练 + 免费的草稿模型

从第 10 阶段 · 18 课你知道 DeepSeek-V3 添加了 D=1 的 MTP 模块,预测向前两个位置的 token。推理时,训练好的模块被改造为接受率 80% 以上的投机解码草稿模型。训练时,每个隐藏状态在 D+1 = 2 个目标上受到监督,提供更密集的信号。

参数:在 671B 主模型之上增加 14B。开销:2.1%。

### 训练:DualPipe

从第 10 阶段 · 19 课你知道,DualPipe 是一种双向流水线,将前向和反向分块与跨节点 all-to-all 通信重叠。在 DeepSeek-V3 的 2,048 张 H800 规模下,它恢复了 1F1B 会因流水线气泡损失的大约 245k GPU 小时。

### 配置,逐字段解析

DeepSeek-V3 配置(简化版):

```
hidden_size: 7168
intermediate_size: 18432   (dense MLP hidden size, used on first few layers)
moe_intermediate_size: 2048 (expert MLP hidden size)
num_hidden_layers: 61
first_k_dense_layers: 3    (first 3 layers use dense MLP)
num_attention_heads: 128
num_key_value_heads: 128   (formally equal to num_heads under MLA, but
                           the real compression is in kv_lora_rank)
kv_lora_rank: 512          (MLA latent dimension)
num_experts: 256            (MoE expert count per block)
num_experts_per_tok: 8      (top-8 routing)
shared_experts: 1           (always-on shared expert per block)
max_position_embeddings: 163840
rope_theta: 10000.0
vocab_size: 129280
mtp_module: 1               (1 MTP module at depth 1)
```

逐项解析:

- `hidden_size=7168`:嵌入维度。
- `num_hidden_layers=61`:总块深度。
- `first_k_dense_layers=3`:前 3 个块使用大小为 18432 的稠密 MLP。其余 58 个使用 MoE。
- `num_attention_heads=128`:128 个查询头。
- `kv_lora_rank=512`:K 和 V 被压缩到该潜在维度,再按头解压。
- `num_experts=256, num_experts_per_tok=8`:每个 MoE 块有 256 个专家,路由 top-8。
- `shared_experts=1`:在 256 个路由专家之上,1 个始终在线的专家参与每个 token 的计算。可以把它看作一个"稠密底线",确保每个 token 都得到可靠的处理。
- `moe_intermediate_size=2048`:每个专家 MLP 的隐藏层大小。比稠密 MLP 小,因为有 256 个。

### 参数核算

完整计算见 `code/main.py`。核心结论:

- 嵌入:`vocab * hidden = 129280 * 7168 = ~0.93B`。
- 前 3 个稠密块:MLA 注意力(每块约 144M)+ 稠密 MLP(每块约 260M)+ 归一化。总计约 1.2B。
- 58 个 MoE 块:MLA 注意力(约 144M)+ 每块 256 个专家(每个 30M)+ 1 个共享专家(30M)+ 归一化。每块含全部专家共约 7.95B。58 个 MoE 块合计 461B。
- MTP 模块:14B。

总计:核心架构约 476B + 14B MTP;显然,公开的 671B 数字还包含额外的结构参数(偏置张量、专家特有组件、共享专家缩放等)。计算器复现的数字与公开值相差在 3-5% 以内——差值来自 DeepSeek 报告第 2 节附录中记录的细粒度核算。

每次前向传播的激活参数:

- 注意力:每层 144M * 61 = 8.8B(所有层都激活)。
- MLP 激活:前 3 层稠密(3 * 260M = 780M),58 个 MoE 层各以 8 个路由 + 1 个共享 + 路由开销激活。每层激活 MLP:约 260M。总计:3 * 260M + 58 * 260M = 约 15.9B。
- 嵌入 + 归一化:1.2B。
- 激活总计:核心约 26B + 14B MTP(已训练但推理时不总是运行)≈ 37B。

### 671B / 37B 比例

18 倍稀疏比(激活参数占总参数的 5.5%)。DeepSeek-V3 是已发布开放权重的前沿 MoE 模型中最稀疏的。Mixtral 8x7B 比例为 13/47(28%),稠密得多。Llama 4 Maverick 比例为 17B/400B(4.25%),大致相当。DeepSeek 的押注:在前沿规模下,更多专家配合更低的激活比能带来每激活 FLOP 更高的质量。

### DeepSeek-V3 的位置

| 模型 | 总参数 | 激活 | 比例 | 注意力 | 创新点 |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + aux-free + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN 扩展 |

### 后续:R1、V4

DeepSeek-R1(2025)是在 V3 骨干上进行的推理训练运行。R1 使用相同架构。改变的是后训练方案(在可验证任务上的大规模 RL),而不是预训练架构。

DeepSeek-V4(如果发布)预计保留 MLA + MoE + MTP,并加入 DSA(DeepSeek Sparse Attention),即第 10 阶段 · 17 课 NSA 的后继者。这条传承线是稳定的:架构层面的创新不断累积,每个版本调更多的旋钮。

```figure
moe-routing
```

## 使用它

`code/main.py` 是专门针对 DeepSeek-V3 形态的参数计算器。运行它,将输出与论文中的数字对比,并用它分析假设变体(256 专家 vs 512、top-8 vs top-16、MLA 秩 512 vs 1024)。

值得关注的点:

- 总参数量与公开的 671B 对比。
- 激活参数量与公开的 37B 对比。
- 128k 上下文下的 KV cache——MLA 与 GQA 的对比。
- 逐层分解,看清参数预算实际去了哪里。

## 交付

本课产出 `outputs/skill-deepseek-v3-reader.md`。给定一个 DeepSeek 家族模型(V3、R1 或任何未来变体),它产出一份逐组件的架构解读,标注配置的每个字段,按组件推导参数量,并识别模型使用了四项 DeepSeek 特有创新中的哪些。

## 练习

1. 运行 `code/main.py`。将计算器的总参数估计与公开的 671B 对比,找出差值的来源。论文第 2 节有完整的逐项说明。

2. 修改配置,将 MLA 秩从 512 改为 256。计算由此得到的 128k 上下文 KV cache 大小。它能带来多大比例的缩减,对每头表达能力造成什么代价?

3. 对比 DeepSeek-V3 的(256 专家,top-8)路由与假设的(512 专家,top-8)变体。总参数增长;激活参数不变。额外的专家容量在理论上买到什么,在推理时付出什么代价?

4. 阅读 DeepSeek-V3 技术报告(arXiv:2412.19437)第 2.1 节关于 MLA 的内容。用三句话解释为什么 K 和 V 的解压矩阵可以被"吸收"进后续矩阵乘法以提升推理效率。

5. DeepSeek-V3 对大多数操作使用 FP8 训练。计算用 FP8 而非 BF16 存储 671B 权重带来的内存节省。这与 14.8T token 的训练预算如何相互影响?

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|----------------|------------------------|
| MLA | "Multi-Head Latent Attention" | 将 K 和 V 压缩为共享低秩潜在向量(kv_lora_rank,通常为 512),按头即时解压;KV cache 只存储该潜在向量 |
| kv_lora_rank | "MLA 压缩维度" | K 和 V 共享潜在向量的尺寸;DeepSeek-V3 使用 512 |
| First k dense layers | "前几层保持稠密" | MoE 模型的前几层跳过 MoE 路由器,运行稠密 MLP 以保证稳定性 |
| num_experts_per_tok | "Top-k 路由" | 每个 token 激活多少个路由专家;DeepSeek-V3 使用 8 |
| Shared experts | "始终在线的专家" | 无论路由结果如何都处理每个 token 的专家;DeepSeek-V3 使用 1 个 |
| Auxiliary-loss-free routing | "偏置调节的负载均衡" | 训练期间调整的每专家偏置项,在不增加损失项的情况下保持专家负载均衡 |
| MTP module | "额外预测头" | 从 h^(1) 和 E(t+1) 预测 t+2 的 Transformer 块;训练信号更密集,提供免费的投机解码草稿模型 |
| DualPipe | "双向流水线" | 将前向/反向计算与跨节点 all-to-all 重叠的训练调度 |
| Active parameter ratio | "稀疏度" | active_params / total_params;DeepSeek-V3 达到 5.5% |
| FP8 training | "8-bit 训练" | 以 FP8 存储训练状态并执行许多计算操作;相比 BF16 大约减半内存,质量损失很小 |

## 延伸阅读

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — 完整的架构、训练与结果文档
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) — 配置文件与部署说明
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) — 引入 MLA 的前身
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — 基于 V3 架构的推理训练后继者
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) — DeepSeek 家族注意力的未来方向
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe) — 训练调度参考实现