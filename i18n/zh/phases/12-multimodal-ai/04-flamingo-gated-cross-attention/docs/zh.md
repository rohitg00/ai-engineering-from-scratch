# 短枪VLM的闪电和关门交叉注意力

> 们都在想, 它显示,一个模型可以任意处理交织的图像,视频和文本序列. 模型可以在背景下学习, 通过三个例子 (图像,字幕) 组进行几次提示, 机制:关闭的跨注意层,插入了结的LLM现有层之间,具有从零开始的学习门,因此在初始化时保留了LLM的文本能力. 这一课程讲述了弗拉明戈的感知器复制样本和关闭的交叉注意力架构,

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, gated cross-attention + Perceiver resampler demo)
**Prerequisites:** Phase 12 · 03 (BLIP-2 Q-Former)
**Time:** ~120 minutes

## 学习目标

- 解释如何通过tanh(gate) = 0 保存结的LLM的文本能力.
- 通过感知器重新样本:N图像补丁 →K通过交叉注意力固定"隐藏"查询.
- 描述弗拉明戈如何处理交织的图像文本序列,并使用因果掩饰来尊重图像的放置.
- 复制几次多模式提示结构 (3个图像标题示例,然后是查询图像).

## 问题

通过BLIP-2将32个视觉代币输入到一个结的LLM的输入层中. 按一个提示,可以使用一个图像. 但如果您想用文字插入 *许多*图像,如"这里是图像A,标题它;这里是图像B,标题它;现在这里是图像C,标题它"? 专业学习的自我注意力需要在单个流程中处理图像代币和文字代币,

弗拉明戈的答案:不要改变LLM的输入流. 插入现有LLM区间的额外的跨注意层. 文字代币仍然像往常一样流出在LLM的因果自我注意力中. 在每几个LLM块之间,文字代币通过新的封闭层来交叉访问图像功能. 门 (初始化为零) 意味着在零步骤时,新层是无运作的 随着训练的进步,门户就打开,视觉信息开始流动.

弗拉明戈回答第二个问题:你如何处理每次提示的可变数量图像 (0, 1,或多个)? 感知器重样仪 是一个小的跨度注意力模块,它取出你拥有的任何数量的补丁,并产生每张图像的固定数量的视觉隐形代币. 随着图像数量增加,总数增加,但每个文本标志只读取一个图像的隐藏,所以任何单个文本标志在交叉关注中看到的东西,

## 概念

### 结的法定律师

弗拉明戈开始了冷的辛奇拉70B法师.所有70B重量都没有被触及.现有的文字自我注意和FFN正常运行.

### 感知器重新样本

对于每一个提示图片,ViT产生了$N$感知器的重样标记$K$固定可学习的潜伏 (Flamingo使用$K=64$) 每个复样器块是两个子步骤:

1. 交叉注意:$K$幕上幕$N$补丁代码 (Q来自隐藏,K/V来自补丁).
2. 自我注意力+FFN在隐藏中.

经过6个复样器块,输出是$K=64$视觉代币是dim1024的,无论 ViT产生了多少补丁. 224x224图像 (196补丁) 和 480x480图像 (900补丁) 都作为64个复样代币.

视频的重样采用时间:每个框架的补丁产生64个隐藏,而时间定位编码使模型能够区分$t=0$其他$t=N$完整的视频变成了$T \cdot 64$视觉代币.

### 门的跨度注意力

在每一个之间$M$结的 LLM (Flamingo使用)$M=4$),将新的关闭横向注意力区块插入:

```
x_after_llm_block = llm_block(x_before)
cross = cross_attn(x_after, resampler_output)
gated = tanh(alpha) * cross + x_after
x_before_next_block = gated
```

- `alpha`它们是可学习的,以零为初始的.
- `tanh(0) = 0`关闭分支的贡献为零.
- 作为`alpha`随着移动从零, 跨注意力贡献的增长顺利.
- 剩余连接意味着即使一个完全开放的门也不会覆盖LLM的文本表示;它只是在上面添加视觉信息.

这是一个最重要的设计选择:视觉调节是加值,关闭,在初始化时是零.一个步骤0的Flamingo是完美的文本输入的Chinchilla 70B.

### 面具的交叉注意力,用于交叉输入

在"<图片A>标签A <图片B>标签B <图片C> ?"这样的提示中,每个文本标签只应该看到序列中之前的图像.`t`仅仅使用图像的样本代币`i_t`在哪里`i_t`是位置前最新的图像`t`鱼选择了前一个. 鱼选择了前一个.

### 在环境中学习

弗拉明戈的提示看起来像:

```
<image1> A photo of a cat. <image2> A photo of a dog. <image3> A photo of a
```

模型看到完成模式并输出"鸟" (或图像3显示的任何东西).没有梯度步骤.冷的LLM的文本内学习能力通过关闭的交叉注意力.

### 培训数据

弗拉明戈训练了三个数据集:

1. 多模 MassiveWeb (M3W): 43万页面的图像和文本交织在一起,重建阅读顺序.
2. 图像文字对:ALIGN (1.8B对) 加上LTIP (312M对),总共约2.1B对.
3. 视频文本对 (VTP):27M短视频片段.

欧贝利克斯 (2023) 是互联网体的开放复制,Idefics,Idefics2和大多数开放的"像弗拉明戈"模型都在训练中.

### 开放和

开放Flamingo (2023) 是开放的复制. 架构相同 (感知器重新样本 + 结LLaMA或MPT上的门横向注意力). 3B,4B,9B的检查点.由于LLM的基础较小,数据较少,质量落后于Flamingo.

Otter (2023) 基于OpenFlamingo,并调整了MIMIC-IT (多模式指令的数据集) 的指令,显示了关闭的跨重视功能,也用于指令后续.

### 后代

- 爱德艺2 / 爱德艺3:拥抱面的关闭跨度注意力谱系,逐渐变得更简单 (爱德艺2放弃了重新样本,以适应性聚合的直接补丁代币为好).
- 弗拉明戈到卡梅伦过渡:到2024年,许多团队转向早期融合 (课 12.11);在需要脊椎结结的生产中,弗拉明戈风格的门口交叉注意力仍然存在.
- 双子座的交叉输入:概念上继承了弗拉明戈的交叉格式灵活性,尽管确切的机制是专有的.

### 与BLIP-2的比较

| | BLIP-2 | Flamingo |
|---|---|---|
| Visual bridge | Q-Former once at input | Gated cross-attention at every M layers |
| Visual tokens | 32 per image | 64 per image per cross-attn layer |
| Frozen LLM | Yes | Yes |
| Few-shot in-context | Weak | Strong — the paper's centerpiece |
| Interleaved inputs | No native support | Yes, the design target |
| Training data | 130M pairs | ~2.1B pairs + 27M video clips + 43M interleaved pages |
| Parameter count | 188M trained | ~10B trained (cross-attn layers) |
| Compute | Days on 8 A100s | Weeks on thousands of TPUv4 |

选择BLIP-2以供单图像VQA在预算中,选择Flamingo/Idefics2以供交叉,少拍或多图像推理.

```figure
cross-attention-fusion
```

## 用它

`code/main.py`证明:

1. 通过36,假的补丁代币和8个可学习的隐藏符号 (纯的Python交叉注意力)
2. 通过一个关闭的跨度注意力步骤`alpha = 0`→输出等于输入 (LLM未变),然后`alpha = 2.0`视觉贡献混合.
3. 制作2D注意力面具的"图像1 (文本1) (图像2) (文本2) "序列.

## 运送它

这一课产生了`outputs/skill-gated-bridge-diagnostic.md`鉴于开放的VLM配置 (模拟器Y/N,跨接频率,门口方案),它识别了弗拉明戈系的元素并解释了结结策略.有用的调整为什么细调降低了文本性能 (答案:门口变得太宽太快).

## 运动

1. 计算Flamingo-9B的视觉参数数:9B LLM + 1.4B 关闭横跨注意力层 + 64M 复样仪.

2. 执行封闭的残留物`y = tanh(alpha) * cross + x`在 PyTorch 中,实验证明`alpha=0`现在`y==x`现在就在初步.

3. 阅读OpenFlamingo第3.2节 (arXiv:2308.01390) 关于当每个提示具有不同的图像数量时,他们如何处理多个图像.描述填充策略.

4. 弗拉明戈的跨度注意力面具为什么允许一个文本标志只关注*最最近的*前面图像而不是所有前面图像?

5. 在文本中,构建一个提示,为新的Flamingo变体构建4个"图像 →主对象颜色"的例子.随着您将示例数从0到8变化,描述预期的精确性模式.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Perceiver resampler | "Fixed-latent cross-attention" | Module that produces K fixed tokens from a variable number of input patches |
| Gated cross-attention | "Tanh-gated bridge" | Residual layer `y = tanh(alpha)*cross + x`, learnable alpha, init 0 |
| Interleaved input | "Mixed sequence" | Prompt format with images and text mixed freely in reading order |
| Frozen LLM | "No LLM gradients" | The text LLM's weights do not update; only resampler + cross-attn layers train |
| Few-shot | "In-context examples" | Give a few (image, answer) pairs in the prompt; model generalizes without finetuning |
| OBELICS | "Interleaved web corpus" | Open dataset of 141M web pages with images and text in reading order |
| Chinchilla | "70B frozen base" | Flamingo's frozen text LLM, from DeepMind's Chinchilla paper |
| Gate schedule | "How alpha moves" | The rate at which the cross-attention gate opens during training |
| Cross-attn frequency | "Every M layers" | How often a gated cross-attention block is inserted; Flamingo uses $M=4$ |
| OpenFlamingo | "Open reproduction" | MosaicML/LAION open checkpoint at 3-9B; architecture-identical to Flamingo |

## 进一步阅读

- [Alayrac et al. — Flamingo (arXiv:2204.14198)](https://arxiv.org/abs/2204.14198)原始的纸.
- [Awadalla et al. — OpenFlamingo (arXiv:2308.01390)](https://arxiv.org/abs/2308.01390)开放繁殖.
- [Laurençon et al. — OBELICS (arXiv:2306.16527)](https://arxiv.org/abs/2306.16527) 互联网体.
- [Jaegle et al. — Perceiver IO (arXiv:2107.14795)](https://arxiv.org/abs/2107.14795)一般的感知器架构.
- [Li et al. — Otter (arXiv:2305.03726)](https://arxiv.org/abs/2305.03726) 调节指令的弗拉明戈后裔.
- [Laurençon et al. — Idefics2 (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)现代化简化弗拉明戈方法.
