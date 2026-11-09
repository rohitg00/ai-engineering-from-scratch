# 流量匹配和调整流量

> 扩散模型采用20-50个样本采集步骤,因为它们从噪音到数据的曲线路径.流量匹配 (Lipman等人, 2023) 和正流量 (Liu等人, 2022) 训练直路径.直路径意味着更少的步骤意味着更快的推断.稳定扩散3,流量1.1,音频Craft 2都转向流量匹配在2024年.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 06 (DDPM), Phase 1 · Calculus
**Time:** ~45 minutes

## 问题

起的过程是从 起的步骤到步行.$\mathcal{N}(0, I)$现在我们要回来数据分布.DDIM将其分解成20-50个确定性步骤.你想要少的步骤理想情况下是一个.阻者是,解决反向过程的ODE是硬的;路径是曲线的.

如果您可以训练模型,使噪音到数据的路径是*直线*,$t=1$为了$t=0$流量匹配直接构建这个:定义直线插射从$x_1 \sim \mathcal{N}(0, I)$为了$x_0 \sim \text{data}$引进一个向量场$v_\theta(x, t)$为了匹配其时间衍生值,在推断中集成.

修改流程 (Liu 2022) 进一步:通过重新流程程序反复直线路径,从而产生逐步接近线性ODE. 经过两次重新流程反复,一个2步样本器与50步DDPM质量相匹配.

## 概念

![Flow matching: straight-line interpolation between noise and data](../assets/flow-matching.svg)

### 直线流量

定义:

```math
x_t = t \cdot x_1 + (1 - t) \cdot x_0, \quad t \in [0, 1]
```

在哪里$x_0 \sim \text{data}$其他$x_1 \sim \mathcal{N}(0, I)$沿着直线的时间衍生值是恒定的:

```math
\frac{dx_t}{dt} = x_1 - x_0
```

定义一个神经向量场$v_\theta(x_t, t)$并且将其训练成与此衍生品相匹配:

```math
L = \mathbb{E}_{x_0, x_1, t} \left\lVert v_\theta(x_t, t) - (x_1 - x_0) \right\rVert^2
```

这是**conditional flow matching**培训是无模拟的:你永远不会打开ODE.$(x_0, x_1, t)$后退.

### 采样

在推断时,将学习的向量场 *倒退* 集成在时间中:

```math
x_{t-\Delta t} = x_t - \Delta t \cdot v_\theta(x_t, t)
```

开始$x_1 \sim \mathcal{N}(0, I)$到,到.$t=0$现在,我们要去.

### 调整流量 (Liu 2022)

直线流程是有效的,但学习的路径是不直接的,因为很多$x_0$现在,我们可以把它映射到同一面.$x_1$调整流的反流步骤:

1. 列车流量模型$v_1$随机对配.
2. 样本N对$(x_1, x_0)$通过集成$v_1$其他$x_1$在它着陆之前$x_0$现在,我们要去.
3. 列车$v_2$由于这些对现在是"ODE-匹配",它们之间的直线插件是真正平坦的.
4. 复制.

在实践中,两次反流代将你带到近线性,使得2-4步推断.SDXL-Turbo,SD3-Turbo,LCM都是蒸的流量匹配模型.

### 为什么这在2024年赢得了图像

原因有三个:

1. **Simulation-free training**培训期间没有ODE,实施是无关紧要的.
2. **Better loss geometry**直路线具有一致的信号到噪音,而DDPM ε-loss在时间表边缘具有不良的SNR.
3. **Faster inference** SDXL-Turbo质量4-8步;一致性蒸1步.

## 流量匹配与DPM 确切的连接

流量与高斯定条件路径相匹配是散 *具有特定的噪音时间表*.$x_t = \alpha(t) x_0 + \sigma(t) x_1$时间表和流量匹配恢复了斯特拉托尼维奇修改的扩散$v = \alpha' \cdot x_0 - \sigma' \cdot x_1$两者对高斯路径的代数式等价.

流量匹配增加了什么:目标的清晰度 (平坦的速度),更清洁的损失,以及使用非高斯人插件进行实验的许可.

```figure
normalizing-flow
```

## 建立它

`code/main.py`实现1D流量匹配在两个模式的高斯混合物上.$v_\theta(x, t)$在推断时,将1,2,4和20个艾勒步骤整合起来,并比较样品质量.

### 步骤1:训练失败

```python
def train_step(x0, net, rng, lr):
    x1 = rng.gauss(0, 1)
    t = rng.random()
    x_t = t * x1 + (1 - t) * x0
    target = x1 - x0
    pred = net_forward(x_t, t)
    loss = (pred - target) ** 2
    # backprop + update
```

### 步骤2:多步骤推断

```python
def sample(net, num_steps):
    x = rng.gauss(0, 1)
    for i in range(num_steps):
        t = 1.0 - i / num_steps
        dt = 1.0 / num_steps
        x -= dt * net_forward(x, t)
    return x
```

### 步骤3:比较步骤数量

预计4步样本已经与20步质量相匹配,

## 陷

- **Time parameterization.**流量匹配用途$t \in [0, 1]$随着$t=0$在数据上,$t=1$声. 声.$t \in [0, T]$随着$t=0$在数据上,$t=T$报纸总是错误的.
- **Schedule choice.**修改流程的直线是"流量匹配时间表",但可以使用共数或逻辑正常t样本 (SD3这样做) 来获得更好的规模覆盖.
- **Reflow cost.**通过一个数据集,我们可以通过一个数据集,然后再进行一个数据集.
- **Classifier-free guidance still applies.**换一个.$\epsilon$为了$v$在线性组合中: $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$现在,我们要去.

## 用它

| Use case | 2026 stack |
|----------|-----------|
| Text-to-image, best quality | Flow matching: SD3, Flux.1-dev |
| Text-to-image, 1-4 steps | Distilled flow matching: Flux.1-schnell, SD3-Turbo, SDXL-Turbo |
| Real-time inference | Consistency distillation from a flow-matched base (LCM, PCM) |
| Audio generation | Flow matching: Stable Audio 2.5, AudioCraft 2 |
| Video generation | Flow matching mixed with diffusion (Sora, Veo, Stable Video) |
| Science / physics (particle trajectories, molecules) | Flow matching + equivariant vector field |

任何一篇论文说2025-2026年"比扩散快"的时刻,

## 运送它

保存`outputs/skill-fm-tuner.md`技能采用了扩散式模型规范,并将其转换为与流量匹配的训练配置:时间表选择,时间样本分配 (均/逻辑正常),优化器,回流计划,目标步骤计数,评估协议.

## 运动

1. **Easy.**跑步`code/main.py`并且比较1步对20步的MSE对真实数据分布.
2. **Medium.**换成制服$t$采样到logit-normal (集中采样在t中).模型质量有没有改善?
3. **Hard.**执行一次反流代:生成对$(x_0, x_1)$通过整合第一种模型,将第二种模型训练在对子上,并进行一步的样品质量比较.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Flow matching | "Straight-line diffusion" | Train $v_\theta(x, t)$ to match $x_1 - x_0$ along an interpolant. |
| Rectified flow | "Reflow" | Iterative procedure that straightens learned flows. |
| Velocity field | "v_θ" | Output of the model — the direction to move $x_t$. |
| Straight-line interpolant | "The path" | $x_t = (1-t) \cdot x_0 + t \cdot x_1$; trivial target derivative. |
| Euler sampler | "1st order ODE solver" | Simplest integrator; works well when paths are straight. |
| Logit-normal t | "SD3 sampling" | Concentrate $t$ sampling toward mid-values where gradients are strongest. |
| Consistency distillation | "1-step sampler" | Train a student to map any $x_t$ directly to $x_0$. |
| CFG with velocity | "v-CFG" | $v_{\text{cfg}} = (1+w) v_{\text{cond}} - w v_{\text{uncond}}$; same trick, new variable. |

## 产品注释:Flux.1-schnell的流量最快

流量匹配的生产胜利是Flux.1-schnell 一个流量匹配的DT蒸到1-4推理步骤,同时保持Flux-dev级质量.尼尔的"Run Flux on an 8GB machine"笔记本书是参考部署配方:T5 + CLIP编码,量化MMDiT代号 (快速而不是 dev的50个步骤),VAE解码.成本计量:

| Variant | Steps | Latency at 1024² on L4 | Total FLOPs (relative) |
|---------|-------|------------------------|------------------------|
| Flux.1-dev (raw) | 50 | ~15 s | 1.0× |
| Flux.1-schnell | 4 | ~1.2 s | 0.08× (12× faster) |
| SDXL-base | 30 | ~4 s | 0.25× |
| SDXL-Lightning 2-step | 2 | ~0.3 s | 0.03× |

生产规则:**flow-matched base + distillation = the 2026 default for fast text-to-image.**每个主要供应商都运送这种组合:SD3-Turbo (SD3 +流量 +蒸),Flux-schnell (Flux-dev +直流直线),CogView-4-Flash.纯的扩散基地仅适用于传统检查站.

## 进一步阅读

- [Liu, Gong, Liu (2022). Flow Straight and Fast: Learning to Generate and Transfer Data with Rectified Flow](https://arxiv.org/abs/2209.03003)正流量
- [Lipman et al. (2023). Flow Matching for Generative Modeling](https://arxiv.org/abs/2210.02747)流量匹配
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3,在尺度上调整流量.
- [Albergo, Vanden-Eijnden (2023). Stochastic Interpolants](https://arxiv.org/abs/2303.08797)涵盖FM+传播的一般框架.
- [Song et al. (2023). Consistency Models](https://arxiv.org/abs/2303.01469) 1 步蒸/流.
- [Sauer et al. (2023). Adversarial Diffusion Distillation (SDXL-Turbo)](https://arxiv.org/abs/2311.17042)轮机变体
- [Black Forest Labs (2024). Flux.1 models](https://blackforestlabs.ai/announcing-black-forest-labs/)生产流量相匹配.
