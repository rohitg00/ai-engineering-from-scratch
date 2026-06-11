# GANs — Generator vs Discriminator

> 古德费洛在2014年的技巧是完全跳过密度。两个网络。一个人制造假货。有人抓住了他们。他们战斗，直到赝品与真品无法区分为止。它不应该起作用。它通常不会。当它这样做时，样本仍然是文献中狭窄领域最尖锐的。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段3 · 02（Backprop）、阶段3 · 08（优化器）、阶段8 · 02（VAE）
** 时间：** ~75分钟

## The Problem

VAE会产生模糊样本，因为它们的SSE解码器损失对于 * 均值 * 图像来说是最佳的，并且许多看似合理的数字的均值是模糊数字。您想要的损失会奖励 * 可信度 *，而不是像素级接近任何一个目标。可信度没有封闭的形式。你必须学会它。

Goodfellow的想法：训练分类器“D（x）”来区分真实图像与赝品。训练生成器“G（z）”来愚弄“D”。“G”的损失信号是“D”目前认为的让某些东西看起来真实的东西。随着“G”的提高，该信号更新，追逐移动目标。如果两个网络融合，“G”无需写下“log p（x）”即可了解数据分布。

这是对抗训练。数学是一个极小极大游戏：

```
min_G max_D  E_real[log D(x)] + E_fake[log(1 - D(G(z)))]
```

2026年，GAN不再是SOTA产生者（扩散和流动匹配该王冠）。但StyleGAN 2/3仍然是有史以来最尖锐的面部模型，GAN鉴别器在扩散训练中被用作 * 知觉损失 *，对抗训练为快速一步蒸馏（SDXL-Turbo、SD 3-Turbo、RCM）提供动力，让您能够实时扩散。

## The Concept

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

** 生成器' G（z）'。**将噪音载体“z ~ N（0，I）”映射到样本“x”。解码器形状的网络（密集或转置conv）。

** 鉴别器' D（x）'。**将样本映射到纯量概率（或分数）。真的-1，假的-0。

** 损失。**两个交替更新：

- **Train ' D '：**' loss_D = -[ log D（x）+ log（1 - D（G（z）]'。实=1，假=0上的二元交叉熵。
- ** 火车' G '：**' loss_G = -log D（G（z））'。这是Goodfellow使用的 * 非饱和 * 形式（原始的“log（1 - D（G（z）”饱和并在“D”确信时消除梯度）。

** 训练循环。**一步D，一步G。重复.

** 为什么它有效。**如果“G”完全匹配“p_data”，那么“D”就不能比偶然更好，并在任何地方输出0.5;“G”不再获得梯度。均衡

** 为什么它会坏。**模式崩溃（“G”发现一个模式“D”无法分类并将其永久铸造）、梯度消失（“D”学习太快并且“log D”饱和）、训练不稳定（学习率、批量大小等等）。

## Variants that made GANs work

| 年 | 创新 | 修复 |
|------|------------|-----|
| 2015 | DCGAN | Conv/deconv，批处理规范，LeakyReLU -第一个稳定的架构。 |
| 2017 | WGAN、WGAN-GP | 用Wasserstein距离+梯度罚分替换BCE。修复消失渐变。 |
| 2017 | 谱归一化 | 利普希茨束缚了尤利西斯。2026年仍使用鉴别器。 |
| 2018 | 进步甘 | 先训练低分辨率，添加层次。首个兆像素结果。 |
| 2019 | StyleGAN /StyleGAN 2 | 映射网络+自适应实例规范。固定域照片现实主义的最新发展水平。 |
| 2021 | StyleGAN 3 | 无别名、描述等变--仍然是2026年面临的黄金标准。 |
| 2022 | 风格GAN-XL | 有条件的、阶级意识的、更大的规模。 |
| 2024 | R3 GAN | 以更强的正规化重塑品牌;在1024²上工作，无需任何技巧。 |

## Build It

' code/main.py '训练一个小型GAN进行1-D数据：两个高斯的混合。生成器和收件箱是单隐藏层MPP。我们手工实现向前、向后和极小极大循环。目标是查看两种关键失效模式（模式崩溃+消失梯度）发生的情况。

### Step 1: non-saturating loss

当D以高置信度将G的赝品归类为赝品时，香草Goodfellow损失“log（1 - D（G（z）”变为0。此时，G的梯度基本上为零-- G无法改善。非饱和形式'-log D（G（z））'具有相反的渐进线：当D确信时，它会爆炸，给G一个强信号。

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### Step 2: one discriminator step per generator step

```python
for step in range(steps):
    # train D
    real_batch = sample_real(batch_size)
    fake_batch = [G(z) for z in sample_noise(batch_size)]
    update_D(real_batch, fake_batch)

    # train G
    fake_batch = [G(z) for z in sample_noise(batch_size)]  # fresh fakes
    update_G(fake_batch)
```

G的新鲜赝品，否则渐变就过时了。

### Step 3: watch for mode collapse

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

典型症状：两种真实模式之一停止生成。收件箱停止纠正它，因为它从未被视为假货。

## Pitfalls

- ** 辨别器太强。**将D的学习率削减2- 5倍，或添加实例/层噪音。如果D达到>95%的准确性，则G就死了。
- ** 生成器记忆模式。**将噪音添加到D输入、使用迷你批处理器层或切换到WGAN-GP。
- ** 批量规范泄露统计数据。**流经同一BN层的真实批次+假批次混合了它们的统计数据。改用实例规范或谱规范。
- ** 开始得分游戏。** DID和IS在低样本计数下存在噪音。评估时使用至少10 k个样本。
- ** 对于条件任务来说，一次性抽样是谎言。**您仍然需要CGM缩放、截断技巧和重新采样才能获得可用的输出。

## Use It

2026年GAN堆栈：

| 情况 | 接 |
|-----------|------|
| 真实的人脸，固定姿势 | StyleGAN 3（最尖锐、最小） |
| 动漫/风格化面孔 | StyleGAN-XL或稳定扩散LoRA |
| Image-to-Image translation | Pix 2 Pix/ CycleGAN（第8期· 04期）或Control Net（第8期· 08期） |
| 快速一步文本到图像 | 扩散的对抗蒸馏（SDXL-Turbo、SD 3-Turbo） |
| 扩散训练器内的知觉丧失 | 小GAN在图像作物上切换 |
| 任何多模式、开放式的 | 不要-使用扩散或流动匹配 |

GAN尖锐但狭窄。一旦您的域名打开--照片、任意文本提示、视频--切换到扩散。对抗技巧作为一个组成部分（知觉损失、蒸馏）而不是一个独立的生成器而存在。

## Ship It

保存“输出/skill-gan-debugger.md”。Skill处理失败的GAN运行（损失曲线、样本网格、数据集大小）并输出可能原因、一行修复和NPS协议的排序列表。

## Exercises

1. ** 简单。**使用股票设置运行' code/main.py&#39;。然后设置“D_LR = 5 * G_LR”并RST。G的损失以多快的速度崩溃为常数？
2. ** 中等。**将Goodfellow BCE损失替换为WGAN损失：“loss_D = E[D（假）] - E[D（真实）]'，“loss_G = -E[D（假）]'，并将D的权重剪辑为“[-0.01，0.01]'。训练更稳定吗？比较壁挂式收敛。
3. ** 很难。**将1-D示例扩展到2-D数据（环上8个高斯的混合）。跟踪生成器在步骤1 k、5 k、10 k捕获了8种模式中的多少种。实施小批量歧视和重新测量。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 发生器 | “G” | 噪音样本网络，“G：z-x '。 |
| 鉴别器 | “D” | 分类器“D：x-[0，1]”，真实与虚假。 |
| Minimax | “游戏” | 联合目标的“min_G max_D”。 |
| 非饱和损失 | “修复” | 对于G使用“-log D（G（z））”而不是“log（1 - D（G（z）”。 |
| 模式崩溃 | “G记住了一件事” | 尽管数据多种多样，Generator几乎没有产生不同的输出。 |
| WGAN | “沃瑟斯坦” | 将BCE替换为地球移动距离+梯度惩罚;更平滑的梯度。 |
| 谱范数 | “利普希茨伎俩” | 限制D的体重规范以限制其斜坡;稳定训练。 |
| StyleGAN | “有效的那个” | 映射网络+ AdaIN;同类最佳人脸识别，仍将在2026年推出。 |

## Production note: one-shot inference is GAN's lasting advantage

GAN不再在开放域生成的样本质量上获胜，但他们仍然在推理成本上获胜。在产生式推理文学词汇中，GAN有：

- ** 没有预填充，没有解码阶段。**单次“G（z）”向前传球。TTFT删除总延迟。
- ** 没有KV缓存压力。**唯一的状态是重量。批处理大小由激活内存（而不是缓存）限制。
- ** 琐碎的连续收件箱。**由于每个请求都采用相同的固定FLOP，因此服务器目标占用率处的静态批处理通常是最佳的。不需要飞行中调度器。

这就是为什么GAN蒸馏（SDXL-Turbo、SD 3-Turbo、ADD、RCM）成为2026年快速文本到图像的主导技术：它将20-50步的扩散管道合并为1-4个GAN式正向传递，同时保持扩散基地的分布。对抗性损失作为训练时间旋钮得以生存，将缓慢的发电机变成快速的发电机。

## Further Reading

- [Goodfellow等人（2014）。生成性对抗网络]（https：//arxiv.org/ab/1406.2661）-GAN的原始论文。
- [Radford等人（2015）。使用DCGAN的无监督表示学习]（https：//arxiv.org/ab/1511.06434）-第一个稳定的架构。
- [Arjovsky、Chintala、Bottou（2017）。Wasserstein GAN]（https：//arxiv.org/abs/1701.07875）- WGAN。
- [Miyato等人（2018）。GAN的光谱标准化]（https：//arxiv.org/ab/1802.05957）- SN。
- [卡拉斯等人（2020）。分析和改进StyleGAN的图像质量]（https：//arxiv.org/ab/1912.04958）-StyleGAN 2。
- [卡拉斯等人（2021）。无别名生成对抗网络]（https：//arxiv.org/ab/2106.12423）-StyleGAN 3。
- [绍尔等人（2023）。对抗扩散蒸馏]（https：//arxiv.org/abs/2311.17042）- SDXL-Turbo。
