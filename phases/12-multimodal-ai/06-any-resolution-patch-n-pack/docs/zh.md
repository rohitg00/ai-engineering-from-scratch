# 任意分辨率视觉：Patch-n'-Pack 与 NaFlex

> 真实图像并非 224x224 的正方形。收据是 9:16，图表是 16:9，医学扫描可能是 4096x4096，手机截图是 9:19.5。2024 年前 VLM 的解决方案——将所有内容调整为固定正方形——丢弃了使 OCR、文档理解和高分辨率场景解析得以工作的信号。NaViT（Google，2023）表明，你可以使用块对角掩码将可变分辨率的 patch 打包到单个 transformer batch 中。Qwen2-VL 的 M-RoPE（2024）完全放弃了绝对位置表。LLaVA-NeXT 的 AnyRes 将高分辨率图像平铺成基础图像 + 子图像。SigLIP 2 的 NaFlex 变体（2025）现在是希望单个 checkpoint 服务所有纵横比的开源 VLM 的默认编码器。本课从头到尾实现 patch-n'-pack。

**类型：** Build
**语言：** Python（stdlib，patch packer + 块对角掩码）
**前置知识：** Phase 12 · 01（ViT patch），Phase 12 · 05（LLaVA）
**时间：** ~120 分钟

## 学习目标

- 将一批可变分辨率图像的 patch 打包到一个序列中，并构建块对角注意力掩码。
- 为给定任务在 AnyRes 平铺（LLaVA-NeXT）、NaFlex（SigLIP 2）和 M-RoPE（Qwen2-VL）之间做出选择。
- 计算 OCR、图表和摄影的 token 预算，无需调整大小。
- 说出正方形调整大小的三种失败模式：挤压文本、裁剪内容、在填充上浪费 token。

## 问题所在

Transformers 期望一个序列。Batch 是相同长度的序列堆栈。如果你的图像是 224x224，你每次都得到 196 个 patch token，无需填充，任务完成。在 224 上训练，在 224 上推理，再也不考虑分辨率。

世界并不配合。文档是纵向的（8.5x11 英寸，约 2:3）。图表截图是横向的（16:9）。收据又高又窄（1:3）。医学影像以 2048x2048 或更大尺寸传输。移动设备截图是 1170x2532（0.46:1）。

2024 年前的三个选项以及每个失败的原因：

1. 调整为固定正方形（224x224 或 336x336）。挤压会扭曲文本和面部。缩小会破坏图表标签和 OCR 内容。LLaVA-1.5 之前的标准做法。
2. 裁剪为固定纵横比。你丢弃了图像的大部分，而选择裁剪位置本身就是一个视觉问题。
3. 填充到最长边。修复了扭曲，但对于纵向图像在填充上浪费了 50%+ 的 token。所有这些填充 token 的二次注意力成本。

2024-2025 年的答案：让 transformer 以图像的原生分辨率摄入 patch，并弄清楚如何将异构 batch 打包到一个序列中而不浪费计算。

## 核心概念

### NaViT 和 patch-n'-pack

NaViT（Dehghani 等人，2023）是展示这在规模上有效的论文。这个想法是机械性的：

1. 对于 batch 中的每张图像，在选定的 patch size（比如 14）下计算其原生 patch 网格。
2. 将每张图像的 patch 展平为其自己的可变长度序列。
3. 将所有图像的 patch 拼接成一个 batch 的长序列。
4. 构建一个块对角注意力掩码，以便图像 A 的 patch 只在图像 A 内关注。
5. 携带每 patch 位置信息（2D RoPE 或分数位置嵌入）。

三个图像的 batch，336x336（576 token）、224x224（256 token）和 448x336（768 token），变成一个 1600-token 序列，带有 1600x1600 块对角掩码。没有填充。没有浪费计算。Transformer 处理任意纵横比。

NaViT 还引入了训练期间的分数 patch 丢弃——在 batch 中随机丢弃 50% 的 patch——这既正则化又加速训练。SigLIP 2 继承了这一点。

### AnyRes（LLaVA-NeXT）

LLaVA-NeXT 的 AnyRes 是务实的替代方案。给定高分辨率图像和固定编码器（CLIP 或 SigLIP 在 336），平铺图像：

1. 从预定义集合中选择网格布局——(1x1)、(1x2)、(2x1)、(1x3)、(3x1)、(2x2) 等——最适合图像的纵横比。
2. 将完整图像平铺到网格中；每个 tile 变成 336x336 裁剪。
3. 还生成一个缩略图：整个图像调整为 336x336 作为全局上下文 token。
4. 通过冻结的 336 编码器编码每个 tile。拼接 tile token + 缩略图 token。

对于 672x672 图像，2x2 网格加缩略图：4 * 576 + 576 = 2880 视觉 token。昂贵但有效——LLM 同时看到局部细节和全局上下文。

AnyRes 是当你的编码器冻结且仅支持一种分辨率时的首选路线。对于大图像，token 数量爆炸（1344x1344 图像在 4x4 网格下是 9216 + 576 ≈ 9800 token，填满了大部分 8k LLM 上下文）。

### M-RoPE（Qwen2-VL）

Qwen2-VL 引入了多模态旋转位置嵌入。不是 NaViT 的分数位置或 AnyRes 的 tile-and-thumbnail，每个 patch 携带 3D 位置（时间、高度、宽度）。Query/key 旋转处理任意的 H、W 和时间长度。

M-RoPE 无需重新训练即可提供原生动态分辨率。推理时你喂入任何 HxW 图像，patch embedder 产生 H/14 x W/14 token，每个 token 获得其 (t=0, r=行, c=列) 位置，RoPE 以正确频率旋转注意力，完成。Qwen2.5-VL 和 Qwen3-VL 继续这样做。InternVL3 的 V2PE 是相同想法，每个模态可变编码。

与 AnyRes 不同，M-RoPE 在原生分辨率下是 O(H x W / P^2) token——没有乘法 tile 开销。与 NaViT 不同，它仍然期望每次前向传播一个图像。跨分辨率 batch 仍然需要在顶部进行 patch-n'-pack。

### NaFlex（SigLIP 2）

NaFlex 是 SigLIP 2 checkpoint 的原生灵活模式。单个模型在推理时服务多种序列长度（256、729、1024 token）。它在内部使用 NaViT 风格的 patch-n'-pack 进行训练，并为每个 patch 使用绝对分数位置。卖点：一个 checkpoint，根据任务在推理时选择你的 token 预算。

对于语义任务（分类、检索），256 token。对于 OCR 或图表理解，1024 token。无需重新训练。

### 打包掩码

块对角掩码是大多数实现 stumble 的地方。对于长度 `N_total` 覆盖图像 `i=0..B-1` 且长度为 `n_i` 的打包序列，形状为 `(N_total, N_total)` 的掩码 `M` 在两个索引落在同一图像的块内时为 1，否则为 0。你可以从累积长度列表构建它：

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff 存在 b 使得 offsets[b] <= i < offsets[b+1] 且 offsets[b] <= j < offsets[b+1]
```

这在 PyTorch 中是一行代码，使用 `torch.block_diag` 或显式 gather。FlashAttention 的可变长度路径（`cu_seqlens`）完全跳过掩码，直接使用累积长度张量在序列内关注——对于典型 batch 比密集掩码快约 10 倍。

### Token 预算

按任务选择策略：

- OCR / 文档：1024-4096 token。SigLIP 2 NaFlex 在 1024，或 AnyRes 3x3 + 缩略图。
- 图表和 UI：384-448 原生分辨率下 729-1024 token。Qwen2.5-VL 动态分辨率带最大像素上限。
- 自然照片：256-576 token 足够。下游 LLM 看到足够内容。在内容密度高的地方为 token 付费。
- 视频：空间池化后每帧 64-128 token，2-8 FPS。第 12.17 课涵盖此内容。

2026 年生产规则：选择每任务最大像素上限，在该上限内以原生纵横比编码，打包 batch，跳过填充。Qwen2.5-VL 暴露 `min_pixels` 和 `max_pixels` 正是为此旋钮。

## 使用它

`code/main.py` 为具有整数像素坐标的异构图像 batch 实现 patch-n'-pack。它：

- 获取 (H, W) 图像尺寸列表。
- 在 patch size 14 下计算每张图像的 patch 序列长度。
- 将它们打包到一个总长度 `sum(n_i)` 的序列中。
- 构建块对角注意力掩码（密集，为清晰起见）。
- 比较打包成本 vs 正方形调整大小和 AnyRes 平铺。
- 打印混合 batch（收据、图表、截图、照片）的 token 预算表。

运行它。输出的数字是每个 2026 年开源 VLM 使用 patch-n'-pack 的原因。

## 交付它

本课产出 `outputs/skill-resolution-budget-planner.md`。给定混合纵横比工作负载（OCR、图表、照片、视频帧）和总 token 预算，它选择正确的策略（NaFlex、AnyRes、M-RoPE 或固定正方形）并发出每请求配置。在为产品调整 VLM 大小时使用此技能——它防止无声的 10 倍 token 爆炸杀死延迟预算。

## 练习

1. 收据是 600x1500（1:2.5）。在 patch size 14 下，原生分辨率多少 token？正方形调整到 336 后多少？哪个在实践中损失更多 OCR 准确率？

2. 为四个长度 256、576、729、1024 的图像 batch 构建块对角掩码。验证注意力矩阵是 2585x2585，且恰好有 `256^2 + 576^2 + 729^2 + 1024^2` 个非零条目。

3. 对于 1792x896 图像在 patch 14 下，比较：(a) 正方形调整到 336 然后编码，(b) AnyRes 2x1 + 缩略图，(c) M-RoPE 原生。哪个使用最少 token？哪个保留最多细节？

4. 实现分数 patch 丢弃：给定打包序列，均匀随机丢弃 50% 的 token，并相应更新块对角掩码。测量掩码稀疏度变化。

5. 阅读 Qwen2-VL 论文（arXiv:2409.12191）第 3.2 节。用两句话描述 `min_pixels` 和 `max_pixels` 控制什么以及为什么两个边界都重要。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Patch-n'-pack | "NaViT 风格打包" | 将不同图像的可变长度 patch 序列拼接到一个 batch 维度中 |
| 块对角掩码 | "打包掩码" | 将每张图像的 patch 限制为只关注自身、不关注包中邻居的注意力掩码 |
| AnyRes | "LLaVA-NeXT 平铺" | 将高分辨率图像分割成固定大小瓦片网格加全局缩略图；用固定编码器编码每个瓦片 |
| NaFlex | "SigLIP 2 原生灵活" | 单个 SigLIP 2 checkpoint，在推理时服务 256/729/1024 token 预算，无需重新训练 |
| M-RoPE | "多模态 RoPE" | 3D 旋转位置编码（时间、行、列），处理任意 H、W、T，无需位置表 |
| cu_seqlens | "FlashAttention 打包" | FlashAttention 可变长度路径使用的累积长度张量，替代密集块对角掩码 |
| min_pixels / max_pixels | "分辨率边界" | Qwen2.5-VL 每请求旋钮，在非常小或非常大的输入上限制 token 数量 |
| 视觉 token 预算 | "每张图像多少 token" | 每张图像发出的 patch token 粗略计数；设置 LLM 的 prompt 预算和注意力成本 |

## 延伸阅读

- [Dehghani et al. — Patch n' Pack: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon et al. — What matters when building vision-language models? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
