# 任意分辨率视觉：Patch-n'-Pack 与 NaFlex

> 真实图像并不是 224x224 的正方形。一张收据是 9:16，一张图表是 16:9，一张医学扫描可能是 4096x4096，一张手机截图是 9:19.5。2024 年之前的 VLM 方案——把所有图像缩放到固定的正方形——丢弃了让 OCR、文档理解和高分辨率场景解析得以奏效的信号。NaViT（Google，2023）证明了可以把变分辨率的 patch 打包进单个 transformer batch，并配合块对角掩码。Qwen2-VL 的 M-RoPE（2024）彻底抛弃了绝对位置表。LLaVA-NeXT 的 AnyRes 把高分辨率图像切成基础图 + 子图瓦片。SigLIP 2 的 NaFlex 变体（2025）如今是希望用单一 checkpoint 服务所有宽高比的开源 VLM 的默认编码器。本课将端到端实现 patch-n'-pack。

**Type:** Build
**Languages:** Python（标准库，patch 打包器 + 块对角掩码）
**Prerequisites:** Phase 12 · 01（ViT patches）、Phase 12 · 05（LLaVA）
**Time:** 约 120 分钟

## 学习目标

- 把一批变分辨率图像的 patch 打包成一个序列，并构建块对角注意力掩码。
- 针对给定任务在 AnyRes 分块（LLaVA-NeXT）、NaFlex（SigLIP 2）和 M-RoPE（Qwen2-VL）之间做出选择。
- 在不缩放的前提下为 OCR、图表和照片计算 token 预算。
- 说出正方形缩放的三种失败模式：文字被压扁、内容被裁掉、token 浪费在 padding 上。

## 问题所在

Transformer 期望一个序列。一个 batch 是相同长度的序列堆叠。如果你的图像都是 224x224，那么每次都得到 196 个 patch token，不需要 padding，任务完成。以 224 训练，以 224 推理，再也不用考虑分辨率。

但现实世界并不配合。文档是竖版（8.5x11 英寸，约 2:3）。图表截图是横版（16:9）。收据又高又细（1:3）。医学影像以 2048x2048 或更高分辨率交付。手机截图是 1170x2532（0.46:1）。

2024 年之前有三种选择，各自为何失败：

1. 缩放到固定正方形（224x224 或 336x336）。挤压会扭曲文字和人脸。降采样会破坏图表标签和 OCR 内容。LLaVA-1.5 之前的标准做法。
2. 裁剪到固定宽高比。你会丢掉图像的大部分，而且选择裁剪位置本身就是一个视觉难题。
3. Padding 到最长边。解决了失真，但对竖版图像会浪费 50% 以上的 token 用于 padding。所有这些 pad token 带来二次方的注意力开销。

2024-2025 年的答案：让 transformer 在图像原生分辨率上直接处理 patch，并想办法把异构 batch 打包进一个序列而不浪费计算。

## 核心概念

### NaViT 与 patch-n'-pack

NaViT（Dehghani et al., 2023）是证明该方法可大规模工作的论文。思路是机械性的：

1. 对 batch 中的每张图像，在选定的 patch 尺寸（比如 14）下计算其原生 patch 网格。
2. 把每张图像的 patch 展平成各自的变长序列。
3. 把所有图像的 patch 拼接成 batch 的一个长序列。
4. 构建块对角注意力掩码，使图像 A 的 patch 只在图像 A 内部进行注意力。
5. 携带逐 patch 的位置信息（2D RoPE 或分数位置嵌入）。

三张分别为 336x336（576 token）、224x224（256 token）和 448x336（768 token）的图像变成一个 1600 token 的序列，配一个 1600x1600 的块对角掩码。没有 padding。没有浪费的计算。transformer 可以处理任意宽高比。

NaViT 还在训练时引入了分数式 patch 丢弃——在 batch 中随机丢弃 50% 的 patch——既起正则化作用又加速训练。SigLIP 2 继承了这一点。

### AnyRes（LLaVA-NeXT）

LLaVA-NeXT 的 AnyRes 是务实的选择。给定一张高分辨率图像和一个固定编码器（336 的 CLIP 或 SigLIP），把图像切块：

1. 从预定义集合中挑选最匹配图像宽高比的网格布局——(1x1)、(1x2)、(2x1)、(1x3)、(3x1)、(2x2) 等。
2. 将完整图像切进网格；每个瓦片变成一个 336x336 的裁剪。
3. 同时生成一张缩略图：整张图像缩放到 336x336，作为全局上下文 token。
4. 把每个瓦片送入冻结的 336 编码器。拼接瓦片 token + 缩略图 token。

一张 672x672 的图像按 2x2 网格加缩略图：4 * 576 + 576 = 2880 个视觉 token。昂贵但有效——LLM 同时看到局部细节和全局上下文。

当你的编码器被冻结且只支持单一分辨率时，AnyRes 是首选路线。它对大图像会使 token 数爆炸（一张 1344x1344 的图像按 4x4 网格是 9216 + 576 ≈ 9800 个 token，几乎占满 8k 的 LLM 上下文）。

### M-RoPE（Qwen2-VL）

Qwen2-VL 引入了多模态旋转位置编码。不同于 NaViT 的分数位置或 AnyRes 的瓦片加缩略图，每个 patch 携带一个 3D 位置（时间、高度、宽度）。query/key 的旋转可以处理任意的 H、W 和时间长度。

M-RoPE 原生支持动态分辨率而无需重训练。推理时你输入任意 HxW 图像，patch 嵌入器生成 H/14 x W/14 个 token，每个 token 获得其 (t=0, r=行, c=列) 的位置，RoPE 以正确的频率旋转注意力，完成。Qwen2.5-VL 和 Qwen3-VL 延续了这一设计。InternVL3 的 V2PE 是同样的思想，但按模态进行可变编码。

与 AnyRes 不同，M-RoPE 在原生分辨率下是 O(H x W / P^2) 个 token——没有乘法级的瓦片开销。与 NaViT 不同，它仍然期望每次前向只有一张图像。跨分辨率的 batching 仍需要在其之上叠加 patch-n'-pack。

### NaFlex（SigLIP 2）

NaFlex 是 SigLIP 2 checkpoint 的原生弹性模式。单个模型在推理时服务多种序列长度（256、729、1024 token）。内部在训练时使用 NaViT 式的 patch-n'-pack，并对每个 patch 使用绝对分数位置。卖点：一个 checkpoint，推理时按任务选择 token 预算。

对于语义任务（分类、检索），用 256 token。对于 OCR 或图表理解，用 1024 token。无需重训练。

### 打包掩码

块对角掩码是大多数实现出问题的地方。对于一个长度为 `N_total`、覆盖图像 `i=0..B-1`、长度为 `n_i` 的打包序列，形状为 `(N_total, N_total)` 的掩码 `M` 在两个下标落在同一图像块内时为 1，否则为 0。你可以用累积长度列表来构建它：

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff there exists b where offsets[b] <= i < offsets[b+1] and offsets[b] <= j < offsets[b+1]
```

在 PyTorch 里用 `torch.block_diag` 或显式 gather 就是一行代码。FlashAttention 的变长路径（`cu_seqlens`）完全跳过掩码，直接用累积长度张量在序列内部做注意力——对典型 batch 比稠密掩码快约 10 倍。

### Token 预算

按任务选择策略：

- OCR / 文档：1024-4096 token。SigLIP 2 NaFlex 用 1024，或 AnyRes 3x3 + 缩略图。
- 图表和 UI：384-448 原生分辨率下 729-1024 token。Qwen2.5-VL 动态分辨率并设置最大像素上限。
- 自然照片：256-576 token 就够了。下游 LLM 看到的信息已足够。把 token 花在内容密度高的地方。
- 视频：空间池化后每帧 64-128 token，2-8 FPS。第 12.17 课会讲。

2026 年的生产规则：按任务设定最大像素上限，在该上限内以原生宽高比编码，打包 batch，跳过 padding。Qwen2.5-VL 正是为此提供了 `min_pixels` 和 `max_pixels` 这两个旋钮。

```figure
mm-patch-n-pack
```

## 使用它

`code/main.py` 为一批带整数像素坐标的异构图像实现 patch-n'-pack。它：

- 接收一个 (H, W) 图像尺寸列表。
- 在 patch 尺寸 14 下计算每张图像的 patch 序列长度。
- 把它们打包成一个总长度为 `sum(n_i)` 的序列。
- 构建块对角注意力掩码（为清晰起见使用稠密形式）。
- 对比打包开销与正方形缩放及 AnyRes 分块。
- 为一个混合 batch（收据、图表、截图、照片）打印 token 预算表。

运行它。输出的数字正是 2026 年每个开源 VLM 都使用 patch-n'-pack 的原因。

## 上线它

本课产出 `outputs/skill-resolution-budget-planner.md`。给定一个混合宽高比的工作负载（OCR、图表、照片、视频帧）和总 token 预算，它会选择合适的策略（NaFlex、AnyRes、M-RoPE 或固定正方形），并为每个请求输出配置。当你为产品做 VLM 规格规划时使用这个技能——它可以避免那种悄悄吃掉 10 倍 token、毁掉延迟预算的膨胀。

## 练习

1. 一张收据是 600x1500（1:2.5）。在 patch 尺寸 14 下，原生分辨率有多少 token？缩放到 336 的正方形后有多少？实践中哪种方式损失更多 OCR 准确率？

2. 为一批长度分别为 256、576、729、1024 的四张图像构建块对角掩码。验证注意力矩阵是 2585x2585，并且恰好有 `256^2 + 576^2 + 729^2 + 1024^2` 个非零元素。

3. 对一张 1792x896 的图像（patch 14）进行比较：(a) 缩放到 336 正方形后编码，(b) AnyRes 2x1 + 缩略图，(c) 原生 M-RoPE。哪种使用的 token 最少？哪种保留的细节最多？

4. 实现分数式 patch 丢弃：给定一个打包序列，均匀随机丢弃 50% 的 token，并相应更新块对角掩码。测量掩码稀疏度的变化。

5. 阅读 Qwen2-VL 论文（arXiv:2409.12191）第 3.2 节。用两句话描述 `min_pixels` 和 `max_pixels` 各自控制什么，以及为什么两个界限都重要。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Patch-n'-pack | "NaViT 式打包" | 把来自不同图像的变长 patch 序列沿 batch 维拼接成一个序列 |
| 块对角掩码 | "打包掩码" | 一种注意力掩码，限定每张图像的 patch 只在自身内部做注意力，不与包内相邻图像交互 |
| AnyRes | "LLaVA-NeXT 分块" | 把高分辨率图像切成固定尺寸瓦片组成的网格，外加一张全局缩略图；用固定编码器编码每个瓦片 |
| NaFlex | "SigLIP 2 原生弹性" | 单个 SigLIP 2 checkpoint，在推理时无需重训练即可服务 256/729/1024-token 预算 |
| M-RoPE | "多模态 RoPE" | 3D 旋转位置编码（时间、行、列），无需位置表即可处理任意 H、W、T |
| cu_seqlens | "FlashAttention 打包" | FlashAttention varlen 路径使用的累积长度张量，替代稠密的块对角掩码 |
| min_pixels / max_pixels | "分辨率界限" | Qwen2.5-VL 的逐请求旋钮，为极小或极大输入的 token 数设上限 |
| 视觉 token 预算 | "每张图多少 token" | 每张图像产生的 patch token 的粗略数量；决定 LLM 的 prompt 预算和注意力开销 |

## 延伸阅读

- [Dehghani et al. — Patch n' Pack: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon et al. — What matters when building vision-language models? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)