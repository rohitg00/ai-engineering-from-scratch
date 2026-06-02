# DeepSeek-V3 架构走读

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 第 10 阶段第 14 课点出了每个开源模型都会调的六个架构旋钮。DeepSeek-V3（2024 年 12 月，总参数 671B、激活参数 37B）把这六个全部调了一遍，又额外加了四个：Multi-Head Latent Attention、auxiliary-loss-free 负载均衡、Multi-Token Prediction，以及 DualPipe 训练。本课从上到下读完 DeepSeek-V3 的架构，并从公开 config 推导出每一项参数量。读完之后你可以解释为什么 671B/37B 这个比例是正确的下注，以及为什么 MLA + MoE 合在一起在前沿位置上比单独用任何一个都更强。

**Type:** Learn
**Languages:** Python (stdlib, parameter calculator)
**Prerequisites:** Phase 10 · 14 (open-model walkthroughs), Phase 10 · 17 (NSA), Phase 10 · 18 (MTP), Phase 10 · 19 (DualPipe)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 从上到下读完 DeepSeek-V3 的 config，并用 GPT-2 的六个旋钮加上 DeepSeek 自己加的四项创新解释每个字段。
- 推导出总参数量（671B）、激活参数量（37B），以及各自由哪些组件贡献。
- 计算 MLA 在 128k context 下的 KV cache 占用，并与同等激活参数、采用 GQA 的 dense 模型比较。
- 说出四项 DeepSeek 专属创新（MLA、MTP、auxiliary-loss-free 路由、DualPipe），并指出每一项打的是架构 / 训练栈的哪一块。

## 问题（Problem）

DeepSeek-V3 是第一个架构与 Llama 家族有实质差异的前沿开源模型。Llama 3 405B 是「调过六个旋钮的 GPT-2」。DeepSeek-V3 是六个旋钮全调、再加四项创新的 GPT-2。读 Llama 3 的 config 是读 DeepSeek config 的热身，但深层结构——attention block 的形状、路由逻辑、训练时的目标函数——差别足够大，必须单开一篇走读。

学它的回报是：DeepSeek-V3 的开放权重发布改变了开源模型里「前沿能力」的定义。它的架构是 2026 年很多训练任务正在抄的蓝图。任何接触前沿 LLM 训练或 inference（推理）的角色，理解它都是基本盘。

## 概念（Concept）

### 不变的核心，再说一次

DeepSeek-V3 仍然是 autoregressive 的，仍然堆叠 decoder block，每个 block 仍然是 attention（注意力）加 MLP（多层感知机）加两个 RMSNorm。MLP 里仍然用 SwiGLU，仍然用 RoPE，pre-norm，权重共享的 embedding。和任何 Llama 或 Mistral 是同一个 baseline（基线）。

### 拐点：用 MLA 替代 GQA

从第 10 阶段第 14 课你已经知道 GQA 通过让多个 Q head 共享 K 和 V 来缩小 KV cache。Multi-Head Latent Attention（MLA，多头潜变量 attention）走得更远：K 和 V 被压缩到一个共享的低秩潜变量表示（即 `kv_lora_rank`），用时再按 head 解压。KV cache 里只存潜变量——通常是每 token 每层 512 个浮点，而不是 8 × 128 = 1024 个浮点。

在 128k context 下，DeepSeek-V3 用 MLA（每 token 每层一个共享潜变量 `c^{KV}`；K 和 V 都通过上投影从这个潜变量派生，而上投影矩阵可以被吸收进后续 matmul）：

```
kv_cache = num_layers * kv_lora_rank * max_seq_len * bytes_per_element
         = 61 * 512 * 131072 * 2
         = 7.6 GB
```

如果换成假想的 GQA 基线（Llama 3 70B 形状，8 个 KV head，head dim 128），代价是：

```
kv_cache = 2 * 61 * 8 * 128 * 131072 * 2
         = 30.5 GB
```

在 128k context 下，MLA 的 cache 比 Llama-3-70B 风格的 GQA cache 小 4 倍。

代价是：MLA 在每次 attention 计算（按 head）多加一步解压。这点额外算力相比省下来的带宽微不足道。长 context 推理上是净赚。

### 路由：auxiliary-loss-free 负载均衡

MoE 路由器决定哪 top-k 个 expert 处理每个 token。一个朴素的路由器会把太多活儿堆给少数几个 expert，其他 expert 闲着。标准修法：加一个辅助损失项惩罚负载不均衡。这能用，但会轻微拖累主任务表现。

DeepSeek-V3 引入了 auxiliary-loss-free（无辅助损失）方案。给每个 expert 加一个偏置项加到路由器 logits 上，训练中按一条简单规则调整：如果 expert `e` 过载，就把 `bias_e` 调小；如果欠载，就调大。不加额外的 loss 项，训练保持干净，expert 负载保持均衡。

对主 loss 的影响：测不出。对 MoE 架构的影响：更干净，少一个辅助损失的超参要调。

### MTP：更稠密的训练 + 免费 draft

从第 10 阶段第 18 课你已经知道 DeepSeek-V3 加了 D=1 的 MTP 模块，预测当前位置往后第 2 个 token。在 inference 时，训好的这个模块被复用为 speculative decoding 的 draft 模型，接受率超过 80%。在训练时，每个 hidden state 都要监督 D+1 = 2 个目标，提供更稠密的信号。

参数：在 671B 主体上多 14B。开销：2.1%。

### 训练：DualPipe

从第 10 阶段第 19 课你已经知道 DualPipe 是一种双向流水线，把前向 / 后向的 chunk 与跨节点的 all-to-all 通信重叠起来。在 DeepSeek-V3 的 2,048 张 H800 规模下，它大致挽回了 1F1B 会因 pipeline bubble 损失掉的约 245k GPU 小时。

### config 逐字段解读

下面是简化后的 DeepSeek-V3 config：

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

逐项拆解：

- `hidden_size=7168`：embedding 维度。
- `num_hidden_layers=61`：总 block 深度。
- `first_k_dense_layers=3`：前 3 个 block 用 size 18432 的 dense MLP，剩下 58 个用 MoE。
- `num_attention_heads=128`：128 个 query head。
- `kv_lora_rank=512`：K 和 V 被压到这个潜变量维度，再按 head 解压。
- `num_experts=256, num_experts_per_tok=8`：每个 MoE block 有 256 个 expert，路由 top-8。
- `shared_experts=1`：在 256 个被路由的 expert 之上，再加 1 个总是开的共享 expert，对每个 token 都贡献。把它想成「dense 兜底层」，保证每个 token 至少能拿到点稳定的输出。
- `moe_intermediate_size=2048`：每个 expert 的 MLP 隐藏层大小。比 dense MLP 小，因为有 256 个。

### 参数账目

完整计算在 `code/main.py` 里。要点：

- Embedding：`vocab * hidden = 129280 * 7168 = ~0.93B`。
- 前 3 个 dense block：用 MLA 的 attention（每 block ~144M）+ dense MLP（每 block ~260M）+ norm。合计约 1.2B。
- 58 个 MoE block：用 MLA 的 attention（~144M）+ 256 个 expert（每个 30M）+ 1 个共享 expert（30M）+ norm。每 block 含全部 expert 共 ~7.95B。58 个 MoE block 共 461B。
- MTP 模块：14B。

总和：核心架构 ~476B + MTP 14B；公开的 671B 数字另外计入了一些结构性参数（bias 张量、expert 专属组件、共享 expert 缩放等）。我们计算器复现的数字与公开值差 3–5%，差距来自 DeepSeek 报告第 2 章附录里更细粒度的账目。

每次前向激活的参数：

- Attention：每层 144M × 61 = 8.8B（所有层都触发）。
- MLP 激活：前 3 层 dense（3 × 260M = 780M），后 58 个 MoE 层每层激活 8 个被路由 expert + 1 个共享 expert + 路由开销。每层激活的 MLP 约 ~260M。合计：3 × 260M + 58 × 260M = ~15.9B。
- Embedding + norm：1.2B。
- 激活总计：核心约 26B + MTP 14B（训练时用，推理时不一定开）≈ 37B。

### 671B / 37B 的比例

18 倍稀疏比（激活参数占总参数 5.5%）。DeepSeek-V3 是已发布开源权重里最稀疏的前沿 MoE 模型。Mixtral 8x7B 的比例是 13/47（28%），稠得多。Llama 4 Maverick 的 17B/400B（4.25%）相当。DeepSeek 的下注是：在前沿规模上，更多 expert、更低激活率，能在每个激活 FLOP 上换出更高的质量。

### DeepSeek-V3 在格局里的位置

| Model | Total | Active | Ratio | Attention | Novel ideas |
|-------|------|-------|-------|-----------|-------------|
| Llama 3 70B | 70B | 70B | 100% | GQA 64/8 | — |
| Llama 4 Maverick | 400B | 17B | 4.25% | GQA | — |
| Mixtral 8x22B | 141B | 39B | 27% | GQA | — |
| DeepSeek V3 | 671B | 37B | 5.5% | MLA 512 | MLA + MTP + aux-free + DualPipe |
| Qwen 2.5 72B | 72B | 72B | 100% | GQA 64/8 | YaRN extension |

### 后续：R1、V4

DeepSeek-R1（2025）是在 V3 主干上做的推理训练任务。R1 用的是同一套架构。变的是后训练 recipe（在可验证任务上做大规模 RL），不是预训练架构。

DeepSeek-V4（如果发布）预计会保留 MLA + MoE + MTP，并加入 DSA（DeepSeek Sparse Attention）——也就是第 10 阶段第 17 课讲的 NSA 的后继。整个家族的脉络是稳定的：架构层面的创新一层层累积，每个版本再多调几个旋钮。

## 用起来（Use It）

`code/main.py` 是为 DeepSeek-V3 形状定制的参数计算器。运行它，把它输出的数字和论文里的数字对照，再用它跑几个假想变体（256 expert vs 512、top-8 vs top-16、MLA rank 512 vs 1024）。

要看的几件事：

- 总参数量 vs 公开的 671B。
- 激活参数量 vs 公开的 37B。
- 128k context 下的 KV cache——MLA vs GQA 的对照。
- 逐层拆分，看参数预算到底花在了哪里。

## 上线部署（Ship It）

本课产出 `outputs/skill-deepseek-v3-reader.md`。给一个 DeepSeek 家族的模型（V3、R1，或任何未来的变体），它能产出一份逐组件的架构走读：命名 config 中每个字段，按组件推导参数量，并标出该模型用了四项 DeepSeek 专属创新中的哪几项。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。把计算器估出来的总参数量和公开的 671B 对照，找出差距来自哪里。论文第 2 章里有完整的逐项账目。

2. 把 config 里的 MLA rank 从 512 改成 256。算一下 128k context 下 KV cache 的大小。这能省下百分之多少？以每个 head 表达力的什么代价换来的？

3. 把 DeepSeek-V3 的（256 expert，top-8）路由和假想的（512 expert，top-8）变体比较。总参数量增加，激活参数量不变。理论上多出来的 expert 容量买到了什么？在 inference 时它的代价是什么？

4. 读一遍 DeepSeek-V3 技术报告（arXiv:2412.19437）第 2.1 节关于 MLA 的部分。用三句话解释为什么 K 和 V 的解压矩阵在 inference 时可以「吸收」进后续的 matmul，从而提升效率。

5. DeepSeek-V3 大部分操作用 FP8 训练。算一下用 FP8 vs BF16 存 671B 权重的内存节省。这又如何与 14.8T token 的训练预算交叉影响？

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MLA | "Multi-Head Latent Attention" | 把 K 和 V 压缩到一个共享低秩潜变量（kv_lora_rank，通常 512），按 head 现场解压；KV cache 只存这个潜变量 |
| kv_lora_rank | "MLA compression dim" | K 和 V 共享潜变量的维度；DeepSeek-V3 用 512 |
| First k dense layers | "Early layers stay dense" | MoE 模型的前几层跳过 MoE 路由器，跑 dense MLP，以保稳定 |
| num_experts_per_tok | "Top-k routing" | 每个 token 触发多少个被路由的 expert；DeepSeek-V3 用 8 |
| Shared experts | "Always-on experts" | 不走路由、对每个 token 都触发的 expert；DeepSeek-V3 用 1 |
| Auxiliary-loss-free routing | "Bias-adjusted load balance" | 训练中调整每个 expert 的偏置项以保持负载均衡，不加额外的 loss 项 |
| MTP module | "Extra prediction head" | 一个 transformer block，从 h^(1) 和 E(t+1) 预测 t+2；训练更稠密，推理时白送一个 speculative decoding draft |
| DualPipe | "Bidirectional pipeline" | 一种把前向 / 后向计算与跨节点 all-to-all 重叠的训练调度 |
| Active parameter ratio | "Sparsity" | active_params / total_params；DeepSeek-V3 是 5.5% |
| FP8 training | "8-bit training" | 用 FP8 存权重并跑很多计算操作；相比 BF16 大致省一半内存，质量代价很小 |

## 延伸阅读（Further Reading）

- [DeepSeek-AI — DeepSeek-V3 Technical Report (arXiv:2412.19437)](https://arxiv.org/abs/2412.19437) — 完整的架构、训练与结果文档
- [DeepSeek-V3 model card on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-V3) — config 文件与部署说明
- [DeepSeek-V2 paper (arXiv:2405.04434)](https://arxiv.org/abs/2405.04434) — 引入 MLA 的前作
- [DeepSeek-R1 paper (arXiv:2501.12948)](https://arxiv.org/abs/2501.12948) — 在 V3 架构上做的推理训练后继版
- [Native Sparse Attention (arXiv:2502.11089)](https://arxiv.org/abs/2502.11089) — DeepSeek 家族 attention 的未来方向
- [DualPipe repository](https://github.com/deepseek-ai/DualPipe) — 训练调度的参考实现
