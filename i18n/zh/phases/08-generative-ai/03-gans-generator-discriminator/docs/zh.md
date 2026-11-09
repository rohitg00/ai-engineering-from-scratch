# 发电机与区分器

> 2014年,Goodfellow的技巧是完全跳过密度.两个网络.一个制造假冒.一个抓住他们.他们战斗直到假冒是无法区分的真实.它不应该工作.它经常不会.当它做的时候,样本仍然是最尖的文学中,对于狭窄域.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 3 · 08 (Optimizers), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## 问题

由于它们的MSE解码器损失是*平均*图像的最佳,而许多可信数字的平均值是模糊的数字.你想要一个损失,以奖励*可信性*,而不是像素智能接近任何一个目标.可信性没有封闭形式.你必须学习它.

善良的想法:训练一个分类器$D(x)$让一个发电机训练一个发电机.$G(z)$愚蠢$D$输出信号$G$是什么都不一样$D$现在的信号是:$G$如果两个网络融合,$G$没有写下数据的分布.`log p(x)`现在,我们要去.

这是一场对抗训练.数学是一场最小级游戏:

```math
\min_G \max_D \; \mathbb{E}_{\text{real}}[\log D(x)] + \mathbb{E}_{\text{fake}}[\log(1 - D(G(z)))]
```

2026年,GAN不再是SOTA生成器 (扩散和流量匹配吞了那冠).但StyleGAN 2/3仍然是有史以来出货的最尖的面型,GAN歧视器被用于扩散训练中的感知损失,而对抗训练支持快速的1步蒸 (SDXL-Turbo,SD3-Turbo,LCM) 允许您出货实时扩散.

## 概念

![GAN training: generator and discriminator in minimax](../assets/gan.svg)

**Generator $G(z)$.**绘制一个噪音向量$z \sim \mathcal{N}(0, I)$给一个样本$\hat{x}$电脑系统的电脑系统.

**Discriminator $D(x)$.**绘制一个样本的échar概率 (或分数).真 → 1,假 → 0.

**Loss.**两次交替更新:

- **Train $D$:** $\text{loss}_D = -[ \log D(x) + \log(1 - D(G(z))) ]$双向交叉值在真=1,假=0.
- **Train $G$:** $\text{loss}_G = -\log D(G(z))$这是Goodfellow使用的 *不和的*形式 (原始$\log(1 - D(G(z)))$化和杀死梯度时$D$对于其他国家,

**Training loop.**一步走$D$现在,我们要做一个好事.$G$复制.

**Why it works.**如果$G$非常合适$p_{\text{data}}$现在$D$没有机会, 没有机会, 没有机会.$G$没有任何梯度,平衡.

**Why it breaks.**模式崩 ($G$找到一个模式$D$它们的度变化,$D$学习得太快,$\log D$培训不稳定性 (学习率,批量,任何东西).

## 让GAN工作的变体

| Year | Innovation | Fix |
|------|------------|-----|
| 2015 | DCGAN | Conv/deconv, batch norm, LeakyReLU — the first stable architecture. |
| 2017 | WGAN, WGAN-GP | Replace BCE with Wasserstein distance + gradient penalty. Fixes vanishing gradient. |
| 2017 | Spectral normalization | Lipschitz-bound the discriminator. Still used in 2026 discriminators. |
| 2018 | Progressive GAN | Train low-res first, add layers. First megapixel results. |
| 2019 | StyleGAN / StyleGAN2 | Mapping network + adaptive instance norm. State of the art for fixed-domain photorealism. |
| 2021 | StyleGAN3 | Alias-free, translation-equivariant — still the face gold standard in 2026. |
| 2022 | StyleGAN-XL | Conditional, class-aware, larger scale. |
| 2024 | R3GAN | Rebrands with stronger regularization; works on 1024² without tricks. |

```figure
gan-minimax
```

## 建立它

`code/main.py`导电和分辨器是单层隐藏MLP.我们手动执行前进,后退和最小x循环.目标是看到两个关键故障模式 (模式崩 +消失梯度) 发生.

### 步骤1:不和损失

瓦尼莉的好友失去了$\log(1 - D(G(z)))$在这个时候,G的梯度基本上是零  G不能改善.非和形式$-\log D(G(z))$它们在D自信时爆炸,给G一个强烈的信号.

```python
def g_loss(d_fake):
    # maximize log D(G(z))  <=>  minimize -log D(G(z))
    return -sum(math.log(max(p, 1e-8)) for p in d_fake) / len(d_fake)
```

### 步骤2:每一个生成器步骤的一个歧视步骤

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

对于G来说,新鲜的假冒,否则梯度是陈旧的.

### 步骤3: 警模式崩

```python
if step % 200 == 0:
    samples = [G(z) for z in sample_noise(500)]
    mode_a = sum(1 for s in samples if s < 0)
    mode_b = 500 - mode_a
    if min(mode_a, mode_b) < 50:
        print("  [!] mode collapse: one mode is starved")
```

法症状:两个真正的模式中的一个停止生成. 歧视者停止纠正它,因为它从来没有被视为假的.

## 陷

- **Discriminator too strong.**如果D达到95%以上的准确度,G就死了.
- **Generator memorizes a mode.**加入噪音到D输入,使用微批量区分器层,或切换到WGAN-GP.
- **Batch norm leaking statistics.**实际批量+假批量通过同一BN层流动混合他们的统计数据.
- **Inception-score gaming.**在低样本数量时,FID和IS有噪音.在 eval时使用≥10k样本.
- **One-shot sampling is a lie for conditional tasks.**你仍然需要CFG尺度,切割技巧,再采样才能得到可用的输出.

## 用它

根据"2026年"的GAN堆:

| Situation | Pick |
|-----------|------|
| Photoreal human faces, fixed pose | StyleGAN3 (sharpest, smallest) |
| Anime / stylized faces | StyleGAN-XL or Stable Diffusion LoRA |
| Image-to-image translation | Pix2Pix / CycleGAN (Phase 8 · 04) or ControlNet (Phase 8 · 08) |
| Fast 1-step text-to-image | Adversarial distillation of diffusion (SDXL-Turbo, SD3-Turbo) |
| Perceptual loss inside a diffusion trainer | Small GAN discriminator on image crops |
| Anything multi-modal, open-ended | Don't — use diffusion or flow matching |

网页的数据源是很简单的,但很窄的.一旦您的域名打开了照片,任意的文本提示,视频转向扩散.

## 运送它

保存`outputs/skill-gan-debugger.md`技能采用一个失败的GAN运行 (损失曲线,样本格格,数据集大小) 并输出了排列可能原因列表,一线修复和重复运行协议.

## 运动

1. **Easy.**跑步`code/main.py`根据股票设置.`D_LR = 5 * G_LR`几快G的损失会崩到恒定?
2. **Medium.**取代Goodfellow BCE损失的WGAN损失: $\text{loss}_D = \mathbb{E}[D(\text{fake})] - \mathbb{E}[D(\text{real})]$现在$\text{loss}_G = -\mathbb{E}[D(\text{fake})]$子 D 的重量到`[-0.01, 0.01]`训练是否更稳定?
3. **Hard.**扩展1D示例到2D数据 (环上混合8个高西安).追踪发电机在1k,5k,10k步骤中捕获了8种模式中的多少种.实施微批次差异和重新测量.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Generator | "G" | Noise-to-sample network, `G: z → x̂`. |
| Discriminator | "D" | Classifier `D: x → [0, 1]`, real vs fake. |
| Minimax | "The game" | $\min_G \max_D$ of a joint objective. |
| Non-saturating loss | "The fix" | Use $-\log D(G(z))$ for G instead of $\log(1 - D(G(z)))$. |
| Mode collapse | "G memorized one thing" | Generator produces few distinct outputs despite diverse data. |
| WGAN | "Wasserstein" | Replace BCE with Earth-Mover distance + gradient penalty; smoother gradient. |
| Spectral norm | "Lipschitz trick" | Constrain D's weight norms to bound its slope; stabilizes training. |
| StyleGAN | "The one that works" | Mapping network + AdaIN; best-in-class for faces, still in 2026. |

## 产品说明:一次性推断是GAN的持久优势

在生产-推理文献词汇中,一个GAN有:

- **No prefill, no decode stages.**一个单身的$G(z)$预测时间:
- **No KV-cache pressure.**只有重量,批量量由激活内存限制,而不是缓存.
- **Trivial continuous batching.**由于每个请求都采用相同的固定FLOP,因此在服务器的目标占用量上静态批量通常是最佳的.

这就是为什么GAN蒸 (SDXL-Turbo,SD3-Turbo,ADD,LCM) 是2026年快速文字到图像的主导技术:它将20-50步的扩散管道分解成1-4步GAN式前进通道,同时保持了扩散基的分布.对抗损失作为将慢发电器转化为快速发电器的训练时间.

## 进一步阅读

- [Goodfellow et al. (2014). Generative Adversarial Nets](https://arxiv.org/abs/1406.2661)原始的GAN纸.
- [Radford et al. (2015). Unsupervised Representation Learning with DCGAN](https://arxiv.org/abs/1511.06434)第一种稳定的建筑.
- [Arjovsky, Chintala, Bottou (2017). Wasserstein GAN](https://arxiv.org/abs/1701.07875)  
- [Miyato et al. (2018). Spectral Normalization for GANs](https://arxiv.org/abs/1802.05957) SN
- [Karras et al. (2020). Analyzing and Improving the Image Quality of StyleGAN](https://arxiv.org/abs/1912.04958)    
- [Karras et al. (2021). Alias-Free Generative Adversarial Networks](https://arxiv.org/abs/2106.12423)    
- [Sauer et al. (2023). Adversarial Diffusion Distillation](https://arxiv.org/abs/2311.17042)SDXL-Turbo.
