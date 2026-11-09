# 输血:一个变压器中的自动降低文字+扩散图像

> 马和Emu3都会投注于单独的代币. 它们有效,但量子化瓶可见 图像质量高原在连续空间扩散模型下面. 转血 (Meta, Zhou等同,2024年8月) 采取相反的选择:保持图像连续,完全放弃VQ-VAE,并训练一个变压器, 文字代币可以预测下一个代币. 图像补丁产生流量匹配/扩散损失. 两者都能达到相同的重量. 基于稳定扩散3 (MMDiT) 的架构是近亲的. 这一课上读了转论文, 构建了一个玩具两损训练器, 并追踪了一个变压器可以做这两项工作的注意力面具.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, two-loss trainer on MNIST-scale toy)
**Prerequisites:** Phase 12 · 11 (Chameleon), Phase 8 (Generative AI)
**Time:** ~180 minutes

## 学习目标

- 连接一个转换器,在一个脊椎上运行两个损失 (文字代币NTP,图像补丁上的扩散MSE).
- 解释为什么在图像补丁中双向注意力加上文本代币上的因果注意力是正确的面具选择.
- 对于计算,质量和代码复杂性,比较输血式 (连续图像,扩散损失) 和马龙式 (分辨式图像,NTP).
- 命名MMDiT的贡献:每个块的具体模式权重,残留流的共同关注.

## 问题

离散与连续图像代币辩论比LLM更老.连续表示 (原始像素,VAE隐藏) 保存细节.离散代币 (VQ指数) 适合变压器的本土词汇,但在量化步骤中丢失细节.

马里昂/Emu3是个分别的:一个损失,一个架构,但图像忠诚度被标记器质量限制.

扩散模型持续:图像质量非常优异,但与LLM的模型是独立的,噪音时间表工程复杂,并没有与文字生成的清洁集成.

输血问:我们可以有两者吗? 保持图像连续,仍然训练一个模型,使用两个损失成一个梯度步骤.

## 概念

### 两损的建筑

单个单独解码器变压器处理包含以下序列的序列:

- 文字代码 (从BPE词汇中分别).
- 图像补丁 (连续的16x16像素块通过线性嵌入投影到隐藏的暗色中,与ViT编码器的输入相同).
- `<image>`其他`</image>`标签标记连续补丁居住的地方.

输出每代币的两个头之一:

- 对于文本代码:词语logits头上的标准交叉.
- 对于图像补丁:在连续补丁上输出输出 预测每个补丁添加的噪音.

变压器体内流动的梯度同时提高了共享的重量.

### 注意面具:因果性文本+双向图像

文字代币必须是因果性的. 您不能让文字代币在未来的文本中进行处理,或者教师强制休息. 图像补丁,然而,代表一个快照;它们应该在同一图像区块内双向地对待彼此.

面具:

```
M[i, j] = 1 if:
  (i is text and j is text and j <= i)   # causal for text
  OR (i is image and j is image and same_image_block(i, j))   # bidirectional within image
  OR (i is text and j is image and j < i)   # text attends to images that closed before it
  OR (i is image and j is text and j < i_image_start)   # image attends to preceding text
```

作为一个区块三角形面具,用于训练和推断.

### 变压器内部的扩散损失

输出损失是标准的:添加噪音到图像补丁,要求模型预测噪音 (或清洁补丁,相等).输出版本使用流量匹配预测噪音到清洁的速度场.

在培训期间:
1. 对于每个图像补丁$x_0$随机时间步骤$t$现在,我们要去.
2. 样本噪音$\epsilon$计算$x_t = (1-t) \cdot x_0 + t \cdot \epsilon$(用于流量匹配的线性插射).
3. 变压器预测$v_\theta(x_t, t)$其他$\text{loss} = \mathop{\mathrm{MSE}}(v_\theta(x_t, t), \epsilon - x_0)$现在,我们要去.
4. 随着相同序列的文字 NTP 损失.

在推断下,生成是:
- 文字代码:标准的自动回归样本.
- 图像补丁:基于先前的文本代码的扩散样本循环 (典型的10-30步).

### 动机:稳定扩散3的变体

稳定扩散3 (Esser等,2024年3月) 与转移 (Transfusion) 的同时运输了MMDiT (多模扩散变压器).

MMDiT的主要区别:

- 每块的特式重量.每个变压器块对文本代币和图像补丁有单独的Q,K,V和MLP重量.注意力是联合的 (跨式);其他一切都是特式的.
- 修改流程训练. 特定的流程匹配变体,已知采样和比DDPM更简单的数学.
- 转移纸质尺度为7B.

两者都以相同的核心理念相结合:一个变压器在文字上运行NTP,而在连续图像表示上运行扩散.

### 为什么这比马龙风格更好

图像生成中连续传播和分离NTP之间的质量差距可测量.

- 在7B参数,比FID上的同样尺寸的马龙风格模型3-5分.
- 没有需要代币器培训 图像编码器更简单 (直线投影到隐藏,与ViT的输入层相同).
- 推理可以对象补丁表示,而非自行降低的图像代币.

缺点:输血是一种双损模型,使训练动态变得更加棘手.减肥需要调整.NTP和扩散之间的时间表不匹配可能导致一个头主导.

### 什么是下游

简斯-普罗 (课 12.15) 通过分离视觉编码器来理解和生成一个,VQ用于另一个,同时共享变压器体.Show-o (课 12.14) 换取分散式扩散 (掩盖预测). 统一代家族在转化后迅速分支.

封闭的生产模型可以使用本土的图像,但它们的架构并未被公布,所以把任何这样的说法视为猜测.

```figure
cfg-guidance-scale
```

## 用它

`code/main.py`在一个小的MNIST类似的问题上构建了一个玩具输血:

- 文字标题是描述一个数字 (0-9) 的短整数序列.
- 图像是4×4字节的网格.
- 配重线性投影的对作为变压器替代;文字的NTP损失,噪音的补丁的MSE损失.
- 训练循环交换了两个损失,注意力面具是明确的.
- 面具演示印出一个文本,图像,文本序列的区块三角形注意力模式.生成不会运行:一个真正的样本器会按代币解码文本代币,然后在许多步骤中删除图像补丁,因为下面的练习会计.

转变器是一个玩具. 两损管道,注意力面具的构建,

## 运送它

这一课产生了`outputs/skill-two-loss-trainer-designer.md`鉴于新的多模式培训任务 (文字+图像,文字+音频,文字+视频),它设计了两损失时间表 (减肥量,面具形状,共享与具体模式的区块) 并标出了实施风险.

## 运动

1. 输血型模型训练70%的文字代币和30%的图像补丁.图像扩散损失是大小的文字NTP损失的10倍.

2. 执行一个序列的块三角形面具: `[T, T, <image>, P, P, P, P, </image>, T]`每个输入都标记为0或1.

3. 换器的重量是多少? 换器的重量是多少?

4. 生成:给出一个文本提示,模型运行NTP为50个代币,然后击中`<image>`通过20个指标步骤,在256个补丁上进行了扩散.

5. 阅读SD3论文第3节. 描述了调整流量,以及为什么它比DDPM更少的推断步骤相近.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Two-loss training | "NTP + diffusion" | A single transformer optimizes both cross-entropy on text tokens and MSE on continuous image patches in the same gradient step |
| Flow matching | "Rectified flow" | Diffusion variant that predicts a velocity field from noise to clean data; simpler math than DDPM |
| MMDiT | "Multimodal DiT" | Stable Diffusion 3's architecture: joint attention, modality-specific MLPs and norms |
| Block-triangular mask | "Causal text + bidirectional image" | Attention mask that is causal across text but bidirectional within image regions |
| Continuous image representation | "No VQ" | Image patches as real-valued vectors, not integer codebook indices |
| Velocity prediction | "v-parameterization" | Network output is the velocity field between noise and data, not the noise itself |

## 进一步阅读

- [Zhou et al. — Transfusion (arXiv:2408.11039)](https://arxiv.org/abs/2408.11039)
- [Esser et al. — Stable Diffusion 3 / MMDiT (arXiv:2403.03206)](https://arxiv.org/abs/2403.03206)
- [Peebles & Xie — DiT (arXiv:2212.09748)](https://arxiv.org/abs/2212.09748)
- [Zhao et al. — MonoFormer (arXiv:2409.16280)](https://arxiv.org/abs/2409.16280)
- [Xie et al. — Show-o (arXiv:2408.12528)](https://arxiv.org/abs/2408.12528)
