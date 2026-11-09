# 展示和分辨散的统一模型

> 输血混合连续和分离的表现. 显示 (Xie等同,2024年8月) 则是另一种方式:文字代币使用因果下一个代币预测,图像代币使用面具的分离传播, 两人都坐在一个变压器里, 结果将VQA,文字到图像,涂料和混合模式生成在一个背骨上统一,每个模式每一个代币,一个损失式 (下一个代币扩展到掩盖预测). 这一课标介绍了"Show-o"设计,为什么隐形分离散射是平行,几步的图像生成器,与转和Emu3有着对比.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, masked-discrete-diffusion sampler)
**Prerequisites:** Phase 12 · 13 (Transfusion)
**Time:** ~120 minutes

## 学习目标

- 解释掩盖的分离散射:掩盖代币的时间表,然后要求变压器恢复它们.
- 根据速度和质量,比较平行图像解码 (Show-o, MaskGIT) 与自动降低图像解码 (Chameleon, Emu3).
- 举个名称,Show-o在一个检查点处理的四项任务:文字生成,VQA,T2I,图像涂料.
- 选择一个掩盖时间表 (,线性,缩短) 并考虑其对样品质量的影响.

## 问题

输血的两损失训练工作,但具有更棘手的动态. 持续扩散损失在与分离NTP损失不同的数值尺度上生活.平衡损失权重是超参数搜索. 建筑是有效的,但复杂的.

展示-o的答案:保持两种模式分离 (如马里昂),但通过掩饰分离散射而不是连续生成平行图像.训练目标成为一个单一的掩饰代币预测,自然将下一个代币预测概括.

## 概念

### 面具的离散传播 (MaskGIT)

格IT的原始技巧是优雅的.从一个完全蒙面的图像开始 (每个代币都是特殊的图像).`<MASK>`在每一步,预测所有面具代币并行,然后保持最自信的预测,再重新掩盖其余. ~ 8-16 个代之后,所有代币都填写.每步需要揭开多少代币的时间表调整.

训练简单:从 [0, 1] 样本模拟一个掩盖比率,将其应用到图像的VQ代币,训练变压器恢复掩盖的代币. 正如BERT对文本所做的,扩展到图像生成.

### 展示:一个变压器,混合面具

展示将MaskGIT放进一个因果语言模型变压器.

- 文字代码:因果性 (标准的LLM).
- 图像代币:图像区块内完全双向 (因此,掩盖的代币可以在预测过程中看到其他图像代币).
- 文字对图像:文字与以前的图像相结合,图像与以前的文字相结合.

培训的替代者:
1. 标准NTP在文本序列上.
2. 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签
3. 面具的文本代码 (实际上只是NTP) 的图像 →文本.

统一的损失是交叉化.`<MASK>`代币,涵盖文字NTP (仅最后一个代币是"掩盖") 和图像掩盖传播 (随机子集是掩盖).

### 并行采样

显示-o在~1000 (每代币自行降低) 或~20 (传播) 代码的位置上生成16个步骤.在每个步骤上,并行预测所有隐藏代币; 提交顶部K自信; 重复.

进行比较:
- 马里昂/EMU3 (自行降低代币):N_代币前进传递,通常每张图像为1024-4096.
- 输血 (持续扩散):~20个步骤,每个步骤都通过一个完整的变压器.
- 显示 (掩盖的分离散射):~16个步骤,每个步骤都通过一个完整的变压器.

显示-o比相似规模模型的马里昂更快,大致与输血步骤数量相匹配,每步成本更低 (微妙的语音符与持续的MSE损失).

### 在一个检查点的任务

通过快速格式选择的推断支持四项任务:

- 文字生成:标准的自动退缩文字输出.
- 图像进来,短信出.
- 通过掩盖的分离传播输入文字,输出图像.
- 涂料:有一些隐藏的代币的图像,填写.

面具预测训练免费提供了涂料功能. 面具预测网格的一个区域, 输送其余部分加上文本提示, 预测面具预测.

### 掩盖时间表

按每一步揭开多少代币的时间表,决定了质量.

```math
\text{mask\_ratio}(t) = \cos\left(\frac{\pi t}{2T}\right) \qquad t = 0, \ldots, T
```

在步骤0,所有代币被掩盖 (比率为1.0).$T$太阳能是最重要的,但它是最重要的.

### 展示2

展示2 (2025后续, arXiv 2506.15564) 尺度展示:更大的LLM基础,更好的标记,更好的面具时间表.相同的建筑模式.

### 在Show-o坐的地方

在2026年分类:

- 微观代币+NTP:马龙,Emu3. 简单但缓慢的推断.
- 微观代币+隐藏的传播:Show-o,MaskGIT,LlamaGen,Muse.并行采样,仍然被代币器输掉.
- 持续+扩散:输血,MMDiT,DiT. 质量最高,训练更复杂.
- 在VLM中连续+流量匹配:JanusFlow,InternVL-U. 最新.

按任务选择:当您想要一个开放型号的T2I+涂料+VQA时,请选择;当质量至关重要时,并且您可以负担两损失的管道时,请输血.

```figure
masked-diffusion-unmask
```

## 用它

`code/main.py`模拟显示样本:

- 一个玩具网,包含16个VQ代币.
- 根据提示和目前未掩盖的代币预测登录的假变压器.
- 通过8个步骤进行并行面具样本采集,
- 打印中间状态 (面具模式演变) 和最后的代币.

运行它,看面具一步一步溶解.

## 运送它

这一课产生了`outputs/skill-unified-gen-model-picker.md`由于需要理解 (VQA,字幕) 和生成 (T2I,涂料) 的产品,需要对开放权重的限制,

## 运动

1. 假设在步骤0中,你将全部解开什么?

2. 涂料是免费的,如果涂料被掩盖的传播. 提出一种产品使用情况 (真实或假设),其中Show-o的涂料比专业模型更好.

3. 随机时间表与线性时间表:按T=8的步骤追踪每步未掩盖的代币数量.

4. 显示图像的512x512是1024个代币.$K=16384$模型发射$1024 \cdot \log_2(16384) = 14{,}336$稳定射输出512*512*24位 = 6,291,456位 (~768 KiB) 的原始像素.压缩比是什么,它买什么质量?

5. 如何使LlamaGen的类条件自动降低图像模型与Show-o的掩饰方法不同?

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Masked discrete diffusion | "MaskGIT-style" | Training to predict masked tokens; at inference, iteratively unmask the most-confident predictions |
| Cosine schedule | "Unmask schedule" | Decay of mask ratio over inference steps; concentrates confidence growth at mid-range |
| Parallel decoding | "All tokens at once" | Every step predicts the full sequence of masked tokens in one forward pass, then commits top-K |
| Hybrid attention | "Causal + bidirectional" | Mask that is causal over text tokens and bidirectional within image blocks |
| Inpainting | "Fill-in generation" | Condition on an image with some tokens masked, predict the missing ones; free from the training objective |
| Commitment rate | "Top-K per step" | How many tokens are declared "done" per iteration; controls inference vs quality trade-off |

## 进一步阅读

- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
- [Show-o2 (arXiv:2506.15564)](https://arxiv.org/abs/2506.15564)
- [Chang et al. — MaskGIT (arXiv:2202.04200)](https://arxiv.org/abs/2202.04200)
- [Sun et al. — LlamaGen (arXiv:2406.06525)](https://arxiv.org/abs/2406.06525)
- [Chang et al. — Muse (arXiv:2301.00704)](https://arxiv.org/abs/2301.00704)
