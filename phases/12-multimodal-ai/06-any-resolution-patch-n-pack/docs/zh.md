# 任意分辨率视觉：Patch-n'-Pack 与 NaFlex

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 真实世界的图片不是 224x224 的方块。小票是 9:16，图表是 16:9，医学影像可能是 4096x4096，手机截屏是 9:19.5。2024 年之前 VLM 的答案——把所有图都缩放到固定方形——直接丢掉了让 OCR、文档理解和高分辨率场景解析得以工作的信号。NaViT（Google，2023）证明了你可以把变分辨率的 patch 打包进同一个 transformer batch，配合 block-diagonal（块对角）mask 注意力。Qwen2-VL 的 M-RoPE（2024）干脆扔掉了绝对位置表。LLaVA-NeXT 的 AnyRes 把高分辨率图像切成 base + sub-image 的 tile 网格。SigLIP 2 的 NaFlex 变体（2025）现在已经是开源 VLM 想用单个 checkpoint 服务所有宽高比时的默认 encoder。本课从头到尾实现 patch-n'-pack。

**Type:** Build
**Languages:** Python (stdlib, patch packer + block-diagonal mask)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 12 · 05 (LLaVA)
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 把一个 batch 中变分辨率图像的 patch 打包成一条序列，并构建 block-diagonal attention mask。
- 在 AnyRes tiling（LLaVA-NeXT）、NaFlex（SigLIP 2）、M-RoPE（Qwen2-VL）之间为给定任务做选择。
- 为 OCR、图表、摄影计算 token 预算，且无需缩放。
- 说出方形 resize 的三种失败模式：文字被压扁、内容被裁掉、token 浪费在 padding 上。

## 问题（The Problem）

Transformer 期待一条序列。一个 batch 是一摞同长度的序列。如果你的图像是 224x224，那每次都得到 196 个 patch token，不需要 padding，搞定。在 224 上训练，在 224 上推理，再也不用想分辨率的事。

但世界并不配合。文档是竖版（8.5x11 英寸，约 2:3）。图表截屏是横版（16:9）。小票又高又窄（1:3）。医学影像是 2048x2048 起步甚至更大。手机截屏是 1170x2532（0.46:1）。

2024 年之前的三种选项以及为什么每种都不行：

1. Resize 到固定方形（224x224 或 336x336）。压扁会扭曲文字和人脸。下采样会毁掉图表标注和 OCR 内容。这是 LLaVA-1.5 之前的标准做法。
2. 裁剪到固定宽高比。你扔掉了图像大部分内容，而选择裁剪位置本身又是一个视觉问题。
3. Pad 到最长边。能修正扭曲，但对竖版图像有 50%+ 的 token 浪费在 padding 上。所有这些 pad token 还要付出二次方的 attention 代价。

2024-2025 的答案：让 transformer 直接吃图像原生分辨率的 patch，并想办法把异构的 batch 打包成一条序列，不浪费算力。

## 概念（The Concept）

### NaViT 与 patch-n'-pack

NaViT（Dehghani et al., 2023）是把这件事在大规模上跑通的论文。思路很机械：

1. 对 batch 里每张图，按选定的 patch size（比如 14）计算其原生 patch 网格。
2. 把每张图的 patch 展平成各自的变长序列。
3. 把所有图的 patch 拼接成 batch 的一条长序列。
4. 构建 block-diagonal attention mask，让图 A 的 patch 只能在图 A 内部做 attention。
5. 携带每个 patch 的位置信息（2D RoPE 或分数位置 embedding）。

一个 batch 里有三张图：336x336（576 个 token）、224x224（256 个 token）、448x336（768 个 token），合起来是一条 1600 token 的序列，配一张 1600x1600 的 block-diagonal mask。没有 padding，没有浪费算力。Transformer 处理任意宽高比。

NaViT 还在训练时引入了分数 patch dropping——在整个 batch 里随机丢掉 50% 的 patch——既起正则化作用又加速训练。SigLIP 2 继承了这一点。

### AnyRes（LLaVA-NeXT）

LLaVA-NeXT 的 AnyRes 是更务实的替代方案。给定一张高分辨率图像和一个固定的 encoder（CLIP 或 SigLIP 在 336），把图像切成 tile：

1. 从一组预定义的网格布局——(1x1)、(1x2)、(2x1)、(1x3)、(3x1)、(2x2) 等——里挑一个最匹配该图宽高比的。
2. 把整张图按该网格切成 tile，每个 tile 都是 336x336 的 crop。
3. 同时生成一张 thumbnail：把整张图缩放到 336x336，作为全局上下文 token。
4. 用冻结的 336-encoder 编码每个 tile。把所有 tile token + thumbnail token 拼接起来。

对于一张 672x672 的图、2x2 网格加 thumbnail：4 * 576 + 576 = 2880 个视觉 token。代价高但有效——LLM 同时看到局部细节和全局上下文。

当你的 encoder 被冻结且只支持一种分辨率时，AnyRes 是首选。它对大图会让 token 数爆炸（一张 1344x1344 的图在 4x4 网格下是 9216 + 576 ≈ 9800 个 token，几乎能填满 8k 的 LLM context）。

### M-RoPE（Qwen2-VL）

Qwen2-VL 引入了 Multimodal Rotary Position Embedding。不像 NaViT 用分数位置，也不像 AnyRes 切 tile 加 thumbnail，每个 patch 携带一个 3D 位置（temporal、height、width）。Query/key 的旋转处理任意 H、W 和时间长度。

M-RoPE 原生支持动态分辨率，无需重新训练。推理时你喂任意 HxW 的图，patch embedder 输出 H/14 x W/14 个 token，每个 token 拿到自己的 (t=0, r=row, c=col) 位置，RoPE 用对应的频率旋转 attention，搞定。Qwen2.5-VL 和 Qwen3-VL 沿用了这套方案。InternVL3 的 V2PE 也是同一思路，只是按模态用不同的编码方式。

不像 AnyRes，M-RoPE 在原生分辨率下是 O(H x W / P^2) 个 token——没有 tile 的乘性开销。不像 NaViT，它仍然假设一次 forward 只处理一张图。跨分辨率 batch 仍需在其上叠 patch-n'-pack。

### NaFlex（SigLIP 2）

NaFlex 是 SigLIP 2 checkpoint 的 native-flex 模式。一个模型在推理时服务多种序列长度（256、729、1024 token）。内部训练时用 NaViT 风格的 patch-n'-pack 加每个 patch 的绝对分数位置。卖点是：一个 checkpoint，按任务在推理时挑你的 token 预算。

语义任务（分类、检索）用 256 个 token。OCR 或图表理解用 1024 个 token。无需重新训练。

### 打包 mask

Block-diagonal mask 是大多数实现栽跟头的地方。对一个总长 `N_total`、覆盖图像 `i=0..B-1`、每张长度为 `n_i` 的打包序列，形状为 `(N_total, N_total)` 的 mask `M` 在两个下标都落在同一图像的 block 内时为 1，否则为 0。可以用累计长度列表来构建：

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff there exists b where offsets[b] <= i < offsets[b+1] and offsets[b] <= j < offsets[b+1]
```

在 PyTorch 里这就是一行——用 `torch.block_diag` 或显式 gather。FlashAttention 的变长路径（`cu_seqlens`）干脆跳过 mask，直接用累计长度张量在序列内部做 attention——对典型 batch 比稠密 mask 快约 10 倍。

### Token 预算

按任务挑策略：

- OCR / 文档：1024-4096 个 token。SigLIP 2 NaFlex 在 1024，或者 AnyRes 3x3 + thumbnail。
- 图表和 UI：384-448 原生分辨率下 729-1024 个 token。Qwen2.5-VL 动态分辨率配合 max pixels cap。
- 自然照片：256-576 个 token 就够。下游 LLM 看到的足够多。把 token 花在内容密度高的地方。
- 视频：空间池化后每帧 64-128 个 token，2-8 FPS。第 12.17 课会讲。

2026 年的生产经验：按任务设一个 max-pixels 上限，按原生宽高比编码到该上限以内，打包整个 batch，跳过 padding。Qwen2.5-VL 暴露的 `min_pixels` 和 `max_pixels` 正是这个旋钮。

## 用起来（Use It）

`code/main.py` 用整数像素坐标为一个异构图像 batch 实现 patch-n'-pack。它：

- 接收一份 (H, W) 图像尺寸列表。
- 在 patch size 14 下计算每张图的 patch 序列长度。
- 把它们打包成一条总长 `sum(n_i)` 的序列。
- 构建 block-diagonal attention mask（稠密版，便于讲清楚）。
- 比较打包成本与方形 resize、AnyRes tiling 的成本。
- 为一个混合 batch（小票、图表、截屏、照片）打印 token 预算表。

跑一下。出来的数字就是为什么 2026 年每一款开源 VLM 都在用 patch-n'-pack 的原因。

## 上线部署（Ship It）

本课产出 `outputs/skill-resolution-budget-planner.md`。给定一个混合宽高比的工作负载（OCR、图表、照片、视频帧）和一个总 token 预算，它会挑出正确的策略（NaFlex、AnyRes、M-RoPE 或固定方形），并输出每次请求的配置。当你为一个产品给 VLM 估算尺寸时使用这个 skill——它能避免那种悄无声息把延迟预算干爆的 10 倍 token 膨胀。

## 练习（Exercises）

1. 一张 600x1500（1:2.5）的小票。在 patch size 14 下，原生分辨率有多少 token？方形 resize 到 336 之后又是多少？实际中哪种损失更多 OCR 准确率？

2. 为一个 batch（四张图，长度分别为 256、576、729、1024）构建 block-diagonal mask。验证 attention 矩阵是 2585x2585，且非零项恰好为 `256^2 + 576^2 + 729^2 + 1024^2` 个。

3. 对一张 1792x896、patch 14 的图，比较：(a) 方形 resize 到 336 再编码、(b) AnyRes 2x1 + thumbnail、(c) M-RoPE 在原生分辨率下。哪个用的 token 最少？哪个保留了最多细节？

4. 实现分数 patch dropping：给定一条打包序列，按均匀分布随机丢掉 50% 的 token，并相应更新 block-diagonal mask。测量 mask 稀疏度的变化。

5. 阅读 Qwen2-VL 论文（arXiv:2409.12191）的第 3.2 节。用两句话描述 `min_pixels` 和 `max_pixels` 控制什么、为什么两端都重要。

## 关键术语（Key Terms）

| 术语 | 别人怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Patch-n'-pack | "NaViT-style packing" | 把不同图像的变长 patch 序列拼接到同一个 batch 维度 |
| Block-diagonal mask | "Packing mask" | 限制每张图的 patch 只在自身内部做 attention，不跨图的 attention mask |
| AnyRes | "LLaVA-NeXT tiling" | 把高分辨率图像切成固定尺寸 tile 的网格再加一张全局 thumbnail；用固定 encoder 编码每个 tile |
| NaFlex | "SigLIP 2 native-flex" | 单个 SigLIP 2 checkpoint，在推理时服务 256/729/1024 token 预算，无需重新训练 |
| M-RoPE | "Multimodal RoPE" | 3D 旋转位置编码（time、row、column），无需位置表即可处理任意 H、W、T |
| cu_seqlens | "FlashAttention packing" | FlashAttention 变长路径使用的累计长度张量，替代稠密的 block-diagonal mask |
| min_pixels / max_pixels | "Resolution bounds" | Qwen2.5-VL 的每次请求旋钮，给极小或极大输入的 token 数封顶 |
| Visual token budget | "How many tokens per image" | 每张图发出的 patch token 大致数量；决定 LLM 的 prompt 预算和 attention 代价 |

## 延伸阅读（Further Reading）

- [Dehghani et al. — Patch n' Pack: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon et al. — What matters when building vision-language models? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
