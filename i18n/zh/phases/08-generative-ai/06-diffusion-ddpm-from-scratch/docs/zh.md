# 从零开始的DDPM

> 霍,贾因,阿贝尔 (2020) 给了该领域一个无法停止的食谱. 用千个小步骤的噪音摧毁数据.训练一个神经网络来预测噪音.在推断时逆转过程.今天每个主流图像,视频,3D和音乐模型都运行在这个循环上,可能是上层上有流量匹配或一致性技巧.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## 问题

你想要一个样本器$p_{\text{data}}(x)$们玩的是一个常常分的最小量游戏.VAE从高斯解码器中产生模糊的样本.你真正想要的是一个训练目标, (a) 只有一个稳定的损失 (没有杆点,没有最小量), (b) 只有一个低边界.$\log p(x)$(所以你有可能性),和 (c) 与SOTA质量相匹配的样本.

定义一个马科夫链.$q(x_t \mid x_{t-1})$逐渐增加了高斯噪音,并引发了反向链.$p_\theta(x_{t-1} \mid x_t)$霍,贾因,阿贝尔 (2020) 表明损失可以简化为一行 预测噪音 并清理数学.在2020年,这是一个好奇心.在2021年,它生产了最先进的样本.在2022年,它成为稳定分散.在2026年,它是基板.

## 概念

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**Forward process $q$.**加入高斯噪音$T$关闭形式是数学易于处理的原因是累积步骤也是高斯式的:

```math
q(x_t \mid x_0) = \mathcal{N}\left( \sqrt{\bar{\alpha}_t} \cdot x_0, (1 - \bar{\alpha}_t) \cdot I \right)
```

在哪里$\bar\alpha_t = \prod_{s=1}^{t} (1 - \beta_s)$时间表$\beta_t$选择$\beta_t$从1e-4到0.02直线上过$T=1000$步骤和$x_T$平均值$\mathcal{N}(0, I)$现在,我们要去.

**Reverse process $p_\theta$.**学习一个神经网络$\epsilon_\theta(x_t, t)$由于声增加,$x_t$标签:

```math
x_{t-1} = \frac{1}{\sqrt{\alpha_t}} \cdot \left( x_t - \frac{\beta_t}{\sqrt{1 - \bar{\alpha}_t}} \cdot \epsilon_\theta(x_t, t) \right) + \sigma_t \cdot z
```

在哪里$\sigma_t$是否是$\sqrt{\beta_t}$虽然这个表达式很丑,但它只是代数,$x_{t-1}$由于后部$q(x_{t-1} \mid x_t, x_0)$替代$x_0$预测噪音预测的情况.

**Training loss.**

```math
L_{\text{simple}} = \mathbb{E}_{x_0, t, \epsilon} \left[ \left\lVert \epsilon - \epsilon_\theta\left( \sqrt{\bar{\alpha}_t} \cdot x_0 + \sqrt{1 - \bar{\alpha}_t} \cdot \epsilon, t \right) \right\rVert^2 \right]
```

样本$x_0$从数据中,选择一个随机的$t$样本$\epsilon \sim \mathcal{N}(0, I)$计算噪音$x_t$通过闭式形式,然后退出噪音. 一次输,没有最小值,没有KL,没有重设.

**Sampling.**开始$x_T \sim \mathcal{N}(0, I)$复制反向步骤$t = T$完成了.

## 为什么它能有效

只有三个直觉:

1. **Denoising is easy; generating is hard.**在$t=T$网络必须解决一个微不足道的问题.$t=0$网络只需要清理几个像素.$t$网络的度是相同的,从每个噪音水平流动的.

2. **Score matching in disguise.**讯 (2011) 证明,预测噪音与估计等等.$\nabla_x \log q(x_t \mid x_0)$逆SDE使用这个分数来走上密度梯度,向高概率区域进行指导的随机走路.

3. **The ELBO reduces to simple MSE.**随着DDPM的参数化,这些KL术语简化为MSE在噪音预测上,具有特定的系数;Ho降低了系数 (称之为"简单"损失) 和质量 *改善*.

```figure
diffusion-denoise
```

## 建立它

`code/main.py`网络是一个小的 MLP,它需要一个$(x_t, t)$训练是单线损失. 样本测试反转链.

### 步骤1:前进时间表 (封闭表格)

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### 步骤2: 样本`x_t`在一个射击中

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### 步骤3:一个训练步骤

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### 步骤4:反向采样

```python
def sample(model, alpha_bars, T, rng):
    x = rng.gauss(0, 1)
    for t in range(T - 1, -1, -1):
        eps_hat = model_forward(model, x, t)
        beta_t = 1 - alphas[t]
        x = (x - beta_t / math.sqrt(1 - alpha_bars[t]) * eps_hat) / math.sqrt(alphas[t])
        if t > 0:
            x += math.sqrt(beta_t) * rng.gauss(0, 1)
    return x
```

对于一个40个时间步骤和24个单位的MLP的1D问题,这在200个时代中学习了两种模式的混合物.

## 时间定制

网络需要知道它正在指定的时间步骤.

- **Sinusoidal embedding.**像变压器定位编码.$\text{embed}(t) = [\sin(t/\omega_0), \cos(t/\omega_0), \sin(t/\omega_1), \ldots]$通过一个MLP,播出到网络.
- **Film / group-norm conditioning.**项目嵌入每个区块的每道尺度/偏差 (FiLM).

我们的玩具代码使用了突状 → 缩写.

## 陷

- **Schedule matters a lot.**线性$\beta$根据DDPM默认的规则,但Cosine时间表 (尼乔尔和达里瓦尔,2021) 为相同的计算提供了更好的FID.
- **Timestep embedding is fragile.**通过原始$t$像浮动机一样,它适用于玩具1-D,但对于图像来说是失败的;总是使用适当的嵌入.
- **V-prediction vs ε-prediction.**对于狭窄的制度 (非常小或非常大),$\epsilon$信号噪音差.V预测 ($v = \alpha \cdot \epsilon - \sigma \cdot x$) 较稳定;SDXL,SD3和Flux使用它.
- **Classifier-free guidance.**在推断时,计算条件和无条件的两个$\epsilon$现在$\epsilon_{\text{cfg}} = (1 + w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$随着$w \approx 3\text{-}7$课第8课中包括.
- **1000 steps is a lot.**生产使用DDIM (20-50步骤),DPM-Solver (10-20步骤),或蒸 (1-4步骤).

## 用它

| Role | Typical stack in 2026 |
|------|-----------------------|
| Image pixel-space diffusion (small, toy) | DDPM + U-Net |
| Image latent diffusion | VAE encoder + U-Net or DiT (Lesson 07) |
| Video latent diffusion | Spatiotemporal DiT (Sora, Veo, WAN) |
| Audio latent diffusion | Encodec + diffusion transformer |
| Science (molecules, proteins, physics) | Equivariant diffusion (EDM, RFdiffusion, AlphaFold3) |

流量匹配 (课3) 是2024-2026年通常以推理速度赢得相同质量的竞争者.

## 运送它

保存`outputs/skill-diffusion-trainer.md`技能采用数据集+计算预算和输出:时间表 (线性/可西因/西格莫ид),预测目标 (ε/v/x),步骤数量,指导尺度,样本组和评估协议.

## 运动

1. **Easy.**改变T从40到10`code/main.py`样品质量 (输出视觉历史图) 如何降低?
2. **Medium.**转换从 ε 预测到 v 预测.再推出反向步骤.
3. **Hard.**添加无类别指导. 类标签上的条件 $c \in \lbrace 0, 1 \rbrace$培训期间,并在采样时间使用时,将其降低10%的时间$\epsilon = (1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$测量条件模式的击中率$w = 0, 1, 3, 7$现在,我们要去.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Forward process | "Adding noise" | Fixed Markov chain $q(x_t \mid x_{t-1})$ that destroys the data. |
| Reverse process | "Denoising" | Learned chain $p_\theta(x_{t-1} \mid x_t)$ that reconstructs the data. |
| β schedule | "The noise ladder" | Per-step variance; linear, cosine, or sigmoid. |
| α̅ | "Alpha bar" | Cumulative product $\prod (1 - \beta)$; gives closed-form $x_t$ from $x_0$. |
| Simple loss | "MSE on noise" | $\lVert \epsilon - \epsilon_\theta(x_t, t) \rVert^2$; all variational derivations collapse to this. |
| ε-prediction | "Predict noise" | Output is the noise added; standard DDPM. |
| V-prediction | "Predict velocity" | Output is $\alpha \cdot \epsilon - \sigma \cdot x$; better conditioning across t. |
| DDPM | "The paper" | Ho et al. 2020; linear β, 1000 steps, U-Net. |
| DDIM | "Deterministic sampler" | Non-Markov sampler, 20-50 steps, same training objective. |
| Classifier-free guidance | "CFG" | Mix conditional and unconditional noise predictions to amplify conditioning. |

## 产品注:扩散推断是一个步数问题

根据DDPM的文件,T=1000反向步骤.在生产中没有人运行.每一个真正的推断堆都选择了三个策略中的一个,每个都清洁地绘制了生产框架的"延迟来自哪里":

1. **Faster sampler, same model.**通过换反循环,训练有素的 $\epsilon_\theta$减速延迟20-50倍.
2. **Distillation.**训练学生以更少的步骤与教师匹配:渐进式蒸 (2 → 1),一致性模型 (任意 → 1-4),LCM,SDXL-Turbo,SD3-Turbo. 降低延迟另一个 5-10 ×,需要重新训练.
3. **Caching and compilation.** `torch.compile(unet, mode="reduce-overhead")`光RT-LLM的扩散后端,`xformers`减速速度为2x,堆积1和2

对于生产传播服务器,预算对话与生产文献描述的LLC相同:延迟是`num_steps × step_cost + VAE_decode`通过率是`batch_size × (num_steps × step_cost)^-1`图像生成是从用户的角度来看"一次性"的,因此,TTFT是小的 (一步);TPOT相当于全响应时间.

## 进一步阅读

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585)                               
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239)    
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) DDIM,少了步骤.
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672)代数时间表,学习变异.
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233)分类指导
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598)   
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364)统一的标记,最清洁的食谱.
