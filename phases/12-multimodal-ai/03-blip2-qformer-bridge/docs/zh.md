# 从 CLIP 到 BLIP-2 —— Q-Former 作为模态桥

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> CLIP 把图像和文本对齐了，但它不会写 caption、不会回答问题、也撑不起对话。BLIP-2（Salesforce, 2023）用一个小巧的可训练桥解决了这件事：32 个可学习的 query 向量通过 cross-attention 在一个冻结的 ViT 特征上做注意力，再直接接进一个冻结的 LLM 的输入流。188M 参数的桥就把一颗 11B 的 LLM 接到了 ViT-g/14 上。从 MiniGPT-4、InstructBLIP，到 LLaVA 的各路亲戚，2026 年之前所有基于 adapter 的 VLM 都是它的后代。这一课会读 Q-Former 的架构、讲清它的两阶段训练，并搭一个玩具版本，把视觉 token 喂给一个冻结的文本 decoder。

**Type:** Build
**Languages:** Python (stdlib, cross-attention + learnable-query demo)
**Prerequisites:** Phase 12 · 02 (CLIP), Phase 7 (Transformers)
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 解释为什么在冻结视觉 encoder 与冻结 LLM 之间塞一个可训练瓶颈，比端到端微调（fine-tune）在成本和稳定性上都更划算。
- 实现一个 cross-attention 块：让一组固定的可学习 query 去 attend 外部图像特征。
- 走一遍 BLIP-2 的两阶段预训练（pretraining）：先做表示学习（ITC + ITM + ITG），再做生成学习（在冻结的 decoder 上做 LM loss）。
- 把 Q-Former 与 LLaVA 用的更朴素的 MLP projector 做对比，并论证什么情况下选哪个更合适。

## 问题（The Problem）

你手上有一个冻结的 ViT，每张图像产出 256 个 patch token，维度 1408。你还有一个冻结的 7B LLM，期望的 token embedding 维度是 4096。最直白的桥——一个从 1408 到 4096 的线性层——是能用，但把全部 256 个 patch token 喂进 LLM 上下文，等于每张图都额外吃掉 256 个 token。一个 batch 32 张图，光视觉模态就消耗掉 8192 个 token。

BLIP-2 提的问题是：能不能把 256 个 token 的图像表示压缩到少得多的 token 数（比如 32），同时还保留足够的信息让 LLM 写 caption、答问题、对图像做推理？而且能不能在不动两端冻结骨干的前提下训练这个桥，把训练成本压到只剩桥本身的参数量？

答案是：Q-Former。32 个可学习的「query」向量通过 cross-attention 去看 ViT 的 patch token，输出一个 32-token 的视觉摘要给 LLM 消费。整体 188M 参数。在碰 LLM 之前，先用 contrastive、matching 和生成式三种目标训练好。

## 概念（The Concept）

### 可学习 query（Learnable queries）

Q-Former 的核心戏法：与其让 LLM 的文本 token 去 attend 图像 patch，不如新引入一组 32 个可学习的 query 向量 `Q`，让 *它们* 去 attend 图像 patch。这些 query 是模型的参数——训练阶段被学出来，所有图像共用同样这 32 个 query。

cross-attention 之后，每个 query 就握着对图像的某种压缩摘要——「描述主体」「描述背景」「数物体」之类的。query 不会真的对应到具体语义标签上；它们学的是任何能让下游 loss 下降的编码方式。

### 架构（Architecture）

Q-Former 是一个小型 transformer（12 层，约 100M 参数），有两条路径：

1. Query path：32 个 query 向量先在自己之间做 self-attention，再对冻结 ViT 的 patch token 做 cross-attention，最后过 FFN。
2. Text path：一个类 BERT 的文本 encoder，与 query path 共享 self-attention 和 FFN 权重（weight）。Text path 上的 cross-attention 是关闭的。

训练时两条路径都跑。query 和文本通过共享的 self-attention 互相影响，这意味着 query 在需要的时候可以以文本为条件（ITM、ITG 任务就用得上）。在为 VLM 做交接（handoff）的推理（inference）阶段，只走 query 那一路，输出 32 个视觉 token。

### 两阶段训练（Two-stage training）

BLIP-2 分两个阶段做预训练：

Stage 1：表示学习（不带 LLM）。三个 loss：
- ITC（image-text contrastive，图文对比）：CLIP 风格的对比损失，作用在池化后的 query token 与文本 CLS token 之间。
- ITM（image-text matching，图文匹配）：二分类——这张图和这段文本到底匹不匹配？走难负例挖掘。
- ITG（image-grounded text generation，图像条件文本生成）：以 query 为条件，在文本上做因果 LM head。逼着 query 编码出可以被解码成文本的内容。

只有 Q-Former 在训。ViT 冻结，LLM 不参与。

Stage 2：生成学习。挂上一个冻结的 LLM（OPT-2.7B 或 Flan-T5-XL 之类）。通过一个小的线性层把 32 个 query 输出投影到 LLM 的 embedding 维度，prepend 到文本 prompt 之前。只在「prompt + 图像 + caption」拼起来的序列上训练那个线性投影层 + Q-Former 的 LM loss。

第二阶段做完，Q-Former + 投影层就是完整的视觉 adapter。推理流程：图像 → ViT → Q-Former → 线性投影 → prepend 到文本 → 冻结的 LLM 输出结果。

### 参数账（Parameter economics）

BLIP-2 用 ViT-g/14（1.1B，冻结）+ OPT-6.7B（6.7B，冻结）+ Q-Former（188M，训练）= 整体 8B，训练 188M。光 Q-Former 大约只占整栈参数的 2.4%。训练成本也跟着这个比例走：几张 A100 跑几天，而不是端到端跑几周。

质量上：BLIP-2 在 zero-shot VQA 上追平甚至打过 Flamingo-80B，体量却小了 50 倍。这桥真能打。

### InstructBLIP 与指令感知的 Q-Former

InstructBLIP（2023）给 Q-Former 多接了一个输入：指令文本本身。在做 cross-attention 的时候，query 现在能同时看见图像 patch 和指令。query 就可以按指令分化（「数车」「描述氛围」），而不是只学一份固定的摘要。在 held-out 任务上 benchmark 有提升。

### MiniGPT-4 与「只训 projector」的路线

MiniGPT-4 留下了 Q-Former，但只训最后那个输出线性投影，其他全冻。便宜归便宜，代价是质量——里面的 query 是 BLIP-2 的，不是你的。适合快速迭代，但不是最佳架构。

### 为什么 LLaVA 走得更朴素

LLaVA（2023，Lesson 12.05）干脆把 Q-Former 换成了一个朴素的 2 层 MLP，把每个 ViT patch token 都投影到 LLM 空间——24x24 的 grid 一共 576 个 token，全喂给 LLM。压缩更差，但好处是 LLM 能直接对原始 patch 做 attention。当时这做法挺有争议；到了 2023 年下半年它反而成了主流，因为视觉指令数据（LLaVA-Instruct-150k）证明：MLP 是可以训出来、足以保留足够信号的。代价是：LLaVA 的上下文填得更快，但它天然能扩展到多图和视频。

到 2026 年，这个领域分成了两派：在 token 预算紧张的场景（长视频、多图）下 Q-Former 还活着；在追求每个 token 原始质量的场景下，MLP projector 占主导。

### Gated cross-attention：祖师爷 Flamingo

Flamingo（Lesson 12.04）比 BLIP-2 更早，用的也是 cross-attention 这套主意，但它是在冻结 LLM 的每一层都插，而不是只做一座单一的桥。BLIP-2 证明了你只在输入层压一次也照样能行。Gemini 和 Idefics 把两路都收了：interleaved 输入 token 加上可选的 gated cross-attention 来支持 in-context few-shot。

### 2026 年的后代谱系

- Q-Former：BLIP-2、InstructBLIP、MiniGPT-4，以及大多数视频-语言模型（出于 token 预算考虑）。
- Perceiver resampler：Flamingo 的变体（Lesson 12.04）；Idefics 系列、Eagle、OmniMAE。
- MLP projector：LLaVA、LLaVA-NeXT、LLaVA-OneVision、Cambrian-1。
- Attention pool：VILA、PaliGemma。

四种都是合法选项。决定怎么选的关键问题是：你是受 token 预算约束，还是受单 token 质量约束。

## 用起来（Use It）

`code/main.py` 用 stdlib 搭了一个 Q-Former 风格的 cross-attention：

1. 模拟 256 个图像 patch token（维度 128）。
2. 实例化 32 个可学习 query（维度 128）。
3. 跑 scaled-dot-product cross-attention（Q 来自 query，K/V 来自 patch）。
4. 通过一个线性层投影到 LLM-dim（512）。
5. 输出 32 个可直接喂给 LLM 的视觉 token。

全部数学都是纯 Python（向量上的嵌套循环）。玩具级别但形状正确。注意力权重矩阵会被打印出来，你可以看到每个 query 都从哪些 patch 上抽了多少。

## 上线部署（Ship It）

本课的产物是 `outputs/skill-modality-bridge-picker.md`。给定一个目标 VLM 配置（视觉 encoder 的 token 数、LLM 上下文预算、部署约束、质量目标），它会推荐用 Q-Former、MLP 还是 Perceiver resampler，并给一段简短理由 + 每种桥的参数量估算。

## 练习（Exercises）

1. 用 PyTorch 实现 cross-attention 块。验证：32 个 query、256 个 key/value 的情况下，注意力权重矩阵是 32 x 256，softmax 之后每行和为 1。

2. BLIP-2 stage 1 的 Q-Former 同时跑三个 loss：ITC、ITM、ITG。用伪代码写出每个 loss 的 forward 签名。哪一个需要文本 encoder path 处于激活状态？

3. 比较参数量：Q-Former（12 层，hidden 768）vs 一个 2 层 MLP projector（1408 → 4096，两层）。LLM 规模到多大时，188M 的 Q-Former 成本能在训练效率上回本？

4. 读 BLIP-2 论文（arXiv:2301.12597）3.2 节关于 Q-Former 初始化的部分。解释为什么从 BERT-base 初始化（而不是随机）可以加速收敛。

5. 一个 10 分钟的视频，按 1 FPS 抽到 60 帧，分别按（Q-Former → 32 tokens/frame）和（MLP projector → 576 tokens/frame）算每帧 token 成本。哪一种能塞进 128k token 的 LLM context window？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Q-Former | "Querying transformer" | 一个小型 transformer，带 32 个可学习 query 向量，对冻结 ViT 特征做 cross-attention |
| Learnable queries | "视觉端的 soft prompt" | 一组固定参数，承担 cross-attention 中 query 那一侧的角色；按模型学一次，所有输入共用 |
| Cross-attention | "Q 在这边，K/V 在那边" | query、key、value 来自不同来源的 attention；query 就是这样从 ViT patch 中抽信息的 |
| ITC | "Image-text contrastive" | CLIP 风格的 loss，作用在 Q-Former 池化后的 query 与文本 CLS 之间 |
| ITM | "Image-text matching" | 在难负例挖掘后的图文对上做二分类；逼 query 学会分辨细粒度的不匹配 |
| ITG | "Image-grounded text generation" | 因果 LM loss，文本以 query 为条件被生成；逼 query 编码出可被解码为文本的内容 |
| 两阶段预训练 | "先表示再生成" | Stage 1 单训 Q-Former（ITC/ITM/ITG）；Stage 2 挂上冻结的 LLM，只训投影层 + Q-Former |
| 冻结骨干（Frozen backbone） | "别 fine-tune 它" | 视觉 encoder 和 LLM 的权重全部固定；只有桥在训 |
| 投影头（Projection head） | "线性投到 LLM 维度" | 最后一个线性层，把 Q-Former 输出映射到 LLM 的 embedding 维度 |
| Perceiver resampler | "Flamingo 那个版本" | 类似的可学习 query cross-attention，但 Flamingo 把它放进每一层，而不是作为一座单一的桥 |

## 延伸阅读（Further Reading）

- [Li et al. — BLIP-2 (arXiv:2301.12597)](https://arxiv.org/abs/2301.12597) —— 核心论文。
- [Li et al. — BLIP (arXiv:2201.12086)](https://arxiv.org/abs/2201.12086) —— 前作，ITC/ITM/ITG 三件套的发源地。
- [Li et al. — ALBEF (arXiv:2107.07651)](https://arxiv.org/abs/2107.07651) —— "align before fuse"，stage 1 训练在概念上的祖先。
- [Dai et al. — InstructBLIP (arXiv:2305.06500)](https://arxiv.org/abs/2305.06500) —— 指令感知的 Q-Former。
- [Zhu et al. — MiniGPT-4 (arXiv:2304.10592)](https://arxiv.org/abs/2304.10592) —— 只训 projector 的路线。
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795) —— 可学习 query cross-attention 的通用架构。
