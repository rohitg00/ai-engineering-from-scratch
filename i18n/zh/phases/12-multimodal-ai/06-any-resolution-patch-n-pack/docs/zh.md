# 任何分辨率的视觉:补丁和纳弗莱克斯

> 实际的图像不是224x224平方. 一份收据是1:3;一个图表是16:9,一个医疗扫描可能是4096x4096,一个移动屏幕截图是9:19.5. 之前2024 VLM 答案将所有东西大小化成一个固定的平方, 抛弃了使 OCR,文档理解和高分辨率场景解析工作的信号. 纳维特 (谷歌,2023) 显示,你可以用区块斜面掩盖将可变分辨率的补丁包装成一个变压器批量. 文2-VL的M-RoPE (2024) 完全放弃了绝对位置表. 拉瓦-下XT的AnyRes将高分辨率图像构成一个基层+子图像. 现在,SigLIP 2的NaFlex变体 (2025) 是开放的VLM的默认编码器,需要一个检查点来服务于每个方面比例. 这一课将"补丁"的应用到最后.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, patch packer + block-diagonal mask)
**Prerequisites:** Phase 12 · 01 (ViT patches), Phase 12 · 05 (LLaVA)
**Time:** ~120 minutes

## 学习目标

- 包装一批可变分辨率的图像的补丁,
- 选择给定的任务的AnyRes (LLaVA-NeXT),NaFlex (SigLIP 2) 和M-RoPE (Qwen2-VL) 之间.
- 计算OCR,图表和摄影代币预算,而不需要调整尺寸.
- 给出四方形尺寸的三个失败模式:压缩的文本,剪切的内容,在填充上浪费的代币.

## 问题

变压器预计一个序列. 一批是一个长度相同的序列. 如果你的图像是224x224,你每次得到196个补丁代币,不需要填充,工作完成. 列车在224,推断在224,再也不会考虑分辨率.

图片截图是景观 (16:9).收据是高的和薄的 (1:3).医疗成像船在2048x2048或更大.移动设备截图是1170x2532 (0.46:1).

两种2024年前的选择,

1. 缩小到固定方形 (224x224或 336x336). 鱼扭曲了文字和面孔. 低尺度破坏了图标和OCR内容.
2. 现在,我们需要一个小小的图像,
3. 片在最长的侧面. 修复扭曲,但浪费50%以上的代币在片图像.

答案是:让变压器吃到图像原始分辨率的补丁,

## 概念

### 和补丁包

纳维特 (Dehghani等, 2023) 是这篇论文显示了这种工作在规模上.

1. 对于每一个批量图像,计算其原始补丁格格在选择的补丁尺寸 (例如 14).
2. 调整每个图像的补丁,
3. 连接所有图像的补丁,
4. 构建一个块斜角的注意力面具,以便图像A的补丁只在图像A内.
5. 携带每件补丁位置信息 (2D RoPE或分数位置嵌入).

组合3个图像的336x336 (576代币),224x224 (256代币) 和448x336 (768代币) 成为一个1600代币序列,使用 1600x1600块角面膜.没有填充.没有浪费计算.变压器处理任意的视角比例.

纳维特还引入了训练期间的分片降落, 在训练期间随机降低50%的补丁, 这既规范了训练,也加速了训练. SigLIP 2继承了这一点.

### 任何Res (LLaVA-NeXT)

由于高分辨率图像和固定编码器 (CLIP或SigLIP在336),图像的:

1. 从预定义的集合中选出一个格格布局 (1x1), (1x2), (2x1), (1x3), (3x1), (2x2),等最适合图像的视角比.
2. 整整幅图片被成网格,每块变成336x336的收获.
3. 作为全球文本代码,整幅图像的尺寸改为336x336.
4. 通过冷的336编码器编码每个, 连接片代币+缩影代币.

对于2x2格格式和缩写图像的672x672图像: 4 * 576 + 576 = 2880 视觉代币.昂贵但有效的LLM可以看到当地细节和全球背景.

任何Res是当你的编码器被结时选择的路线,并且只支持一个分辨率.它会爆炸于大型图像的代币数量 (在4x4格格里的1344x1344图像是9216 + 576 ≈ 9800代币,在任何文本到达之前,它会溢出8k LLM文本).

### 子 (子)

文2-VL引入了多模旋转位置嵌入.而不是NaViT的分数位置或AnyRes的和缩影图,每个补丁都具有3D位置 (时间,高度,宽度).查询/键旋转处理任意H,W和时间长.

根据M-RoPE的原始动态分辨率,并没有重新训练.在推断时,您将任何HxW图像输送到,补丁嵌入器产生H/14 x W/14代币,每个代币都得到其 (t=0,r=row,c=col) 位置,RoPE将注意力转移到正确的频率,完成.Qwen2.5-VL和Qwen3-VL继续这样做.InternVL3的V2PE是相同的想法,每个模式的可变编码.

与AnyRes不同的是,M-RoPE是$O(H \times W / P^2)$没有乘积片的上层费用.与NaViT不同,它仍然预期每前进单个图像.跨分辨率的批量仍然需要补丁包在顶部.

### 纳弗莱克斯 (SigLIP 2)

NaFlex是SigLIP 2检查点的本土柔性模式.单个模型在推断时提供多个序列长度 (256,729,1024个代币).内部使用NaViT式的补丁-n'-pack在训练期间和每个补丁的绝对分数位置.销售点:一个检查点,根据任务推断选择你的代币预算.

对于一个语义任务 (分类,检索), 256 个代币.对于 OCR 或图表理解, 1024 个代币.没有重训.

### 包装面具

对于一个包装的长度序列,`N_total`覆盖图像`i=0..B-1`长度`n_i`面具`M`形状`(N_total, N_total)`如果两个指数都属于同一图像的区块,则是1.

```
offsets = [0, n_0, n_0+n_1, ..., N_total]
M[i, j] = 1 iff there exists b where offsets[b] <= i < offsets[b+1] and offsets[b] <= j < offsets[b+1]
```

这是一个字符串在 PyTorch `torch.block_diag`闪电注意力的变量长度路径 (`cu_seqlens`) 完全跳过面具,并使用累积长度子直接在序列中进行处理,比典型批量密集面具快10倍.

### 代币预算

根据任务来选择你的策略:

- 标签: 1024-4096 代币. SigLIP 2 NaFlex 在 1024,或 AnyRes 3x3 + 缩影图.
- 图表和UI:729-1024代币在384-448本地.Qwen2.5VL动态分辨率,最大像素封闭.
- 自然照片:256-576个代币是可以的.下游的LLM看到足够的.付钱为内容密度高的代币.
- 视频:空间聚合后每幅64-128个代币,2-8FPS. 12.17课程涵盖了这一点.

根据2026年生产规则:选择每任务的最大像素盖,以原始的角度编码到该盖,包装批量,然后跳过填充.`min_pixels`其他`max_pixels`对于这个点而言.

```figure
mm-patch-n-pack
```

## 用它

`code/main.py`实现对整数像素坐标的异质图像批量进行补丁-n'-包. 它:

- 采用图像大小 (H,W) 的列表.
- 计算每个图像的补丁序列长度在补丁尺寸14
- 包装它们成一个总长度的序列`sum(n_i)`现在,我们要去.
- 构建区块斜角注意力面具 (密集,为了清晰度).
- 分析包装成本与方形尺寸和AnyRes的比较.
- 打印混合批量 (收件,图表,截图,照片) 的标志性预算表.

运行它. 掉下来的数字是每一个2026年开放的VLM使用补丁包的原因.

## 运送它

这一课产生了`outputs/skill-resolution-budget-planner.md`由于工作量与面积比重混合 (OCR,图表,照片,视频框架) 和共计代币预算,它选择了正确的策略 (NaFlex,AnyRes,M-RoPE或固定平方) 并发出每次请求配置. 使用这个技能,当您为产品进行VLM尺寸时,它可以防止沉默的10倍代币爆发,从而杀死延迟预算.

## 运动

1. 收据是600x1500 (1:2.5). 在补丁尺寸14时,有多少本地分辨率的代币?在336后,有多少代币?在实践中,哪个失去了更多的OCR准确性?

2. 构建一个分块图形面具,为一个分批4张图像,长度为256,576,729,1024.`256^2 + 576^2 + 729^2 + 1024^2`没有零的输入.

3. 对于14个补丁中的1792x896图像,比较: (a) 方形尺寸为336然后编码, (b) AnyRes 2x1 + 缩影图, (c) M-RoPE.哪个使用最少的代币?哪个保存最多的细节?

4. 执行分数补丁降落:给出一个包装序列,随机降低50%的代币,并根据此更新块 diagonal 面具. 测量面具的稀疏性变化.

5. 阅读Qwen2-VL论文的3.2节 (arXiv:2409.12191).`min_pixels`其他`max_pixels`控制和为什么两个界限都重要.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Patch-n'-pack | "NaViT-style packing" | Concatenate variable-length patch sequences from different images into one batch dimension |
| Block-diagonal mask | "Packing mask" | Attention mask that confines each image's patches to attend only to themselves, not neighbors in the pack |
| AnyRes | "LLaVA-NeXT tiling" | Split a high-res image into a grid of fixed-size tiles plus a global thumbnail; encode every tile with a fixed encoder |
| NaFlex | "SigLIP 2 native-flex" | Single SigLIP 2 checkpoint that serves 256/729/1024-token budgets at inference without retraining |
| M-RoPE | "Multimodal RoPE" | 3D rotary position encoding (time, row, column) that handles arbitrary H, W, T without position tables |
| cu_seqlens | "FlashAttention packing" | Cumulative-length tensor the FlashAttention varlen path uses instead of a dense block-diagonal mask |
| min_pixels / max_pixels | "Resolution bounds" | Qwen2.5-VL per-request knobs capping token count on very small or very large inputs |
| Visual token budget | "How many tokens per image" | Rough count of patch tokens emitted per image; sets the LLM's prompt budget and attention cost |

## 进一步阅读

- [Dehghani et al. — Patch n' Pack: NaViT (arXiv:2307.06304)](https://arxiv.org/abs/2307.06304)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Laurençon et al. — What matters when building vision-language models? (Idefics2, arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Tschannen et al. — SigLIP 2 (arXiv:2502.14786)](https://arxiv.org/abs/2502.14786)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
