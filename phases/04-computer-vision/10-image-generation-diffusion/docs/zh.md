# 图像生成 — 扩散模型

> 扩散模型学习去噪。训练它从带噪图像中去除一点点噪声，反复反向进行一千次，你就得到了一个图像生成器。

**类型：** 构建
**语言：** Python
**前置条件：** 阶段4 第07课（U-Net），阶段1 第06课（概率），阶段3 第06课（优化器）
**时间：** ~75分钟

## 学习目标

- 推导前向加噪过程 `x_0 -> x_1 -> ... -> x_T`，并解释为什么闭合形式 `q(x_t | x_0)` 对任意t成立
- 实现DDPM风格的训练目标，回归每一步添加的噪声，以及一个从纯噪声反向走回图像的解码器
- 构建一个时间条件的U-Net（小到可以在CPU上训练），预测任何时间步的噪声
- 解释DDPM和DDIM采样的区别，以及各自何时适用（第23课深入覆盖flow matching和rectified flow）

## 问题

GAN一步生成：噪声进，图像出，一次前向传播。它们很快但训练困难。扩散模型迭代生成：从纯噪声开始，小步去噪，图像浮现。它们很慢但训练容易。在过去五年中，后者的属性占据了主导地位：任何小团队都可以训练扩散模型并获得合理的样本；GAN训练是一门需要多年失败运行才能掌握的技艺。

除了训练稳定性之外，扩散的迭代结构是解锁现代图像生成所有功能的关键：文本条件控制、图像修补、图像编辑、超分辨率、可控风格。采样循环的每一步都是注入新约束的地方。这个挂钩就是为什么Stable Diffusion、Imagen、DALL-E 3、Midjourney以及你将使用的每个可控图像模型都是基于扩散的。

本课构建最小的DDPM：前向加噪、反向去噪、训练循环。下一课（Stable Diffusion）将其与VAE、文本编码器和无分类器引导连接成一个生产系统。

## 概念

### 前向过程

取图像`x_0`。添加极少量的高斯噪声得到`x_1`。再添加一点点得到`x_2`。持续T步，直到`x_T`几乎与纯高斯噪声无法区分。

```
q(x_t | x_{t-1}) = N(x_t; sqrt(1 - beta_t) * x_{t-1},  beta_t * I)
```

`beta_t`是一个小的方差调度，通常在T=1000步上从0.0001到0.02线性变化。每一步略微缩小信号并注入新的噪声。

### 闭合形式跳跃

一步一步添加噪声是一个马尔可夫链，但数学可以折叠：你可以一步直接从`x_0`采样`x_t`。

```
定义 alpha_t = 1 - beta_t
定义 alpha_bar_t = prod_{s=1..t} alpha_s

那么：
  q(x_t | x_0) = N(x_t; sqrt(alpha_bar_t) * x_0,  (1 - alpha_bar_t) * I)

等价地：
  x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * epsilon
  其中 epsilon ~ N(0, I)
```

这个单一方程是整个扩散模型实用的全部原因。在训练期间，你选择一个随机的`t`，直接从`x_0`采样`x_t`，并一步完成训练——不需要模拟完整的马尔可夫链。

### 反向过程

前向过程是固定的。反向过程 `p(x_{t-1} | x_t)` 是神经网络学习的内容。扩散模型不直接预测`x_{t-1}`；它们预测在步骤t添加的噪声`epsilon`，然后数学推导出`x_{t-1}`。

```mermaid
flowchart LR
    X0["x_0<br/>(干净图像)"] --> Q1["q(x_t|x_0)<br/>添加噪声"]
    Q1 --> XT["x_t<br/>(带噪)"]
    XT --> MODEL["model(x_t, t)"]
    MODEL --> EPS["预测的 epsilon"]
    EPS --> LOSS["与真实epsilon<br/>的MSE"]

    XT -.->|采样| STEP["p(x_{t-1}|x_t)"]
    STEP -.-> XT1["x_{t-1}"]
    XT1 -.->|重复1000次| X0S["x_0 (采样结果)"]

    style X0 fill:#dcfce7,stroke:#16a34a
    style MODEL fill:#fef3c7,stroke:#d97706
    style LOSS fill:#fecaca,stroke:#dc2626
    style X0S fill:#dbeafe,stroke:#2563eb
```

### 训练损失

每个训练步骤：

1. 采样一张真实图像`x_0`。
2. 从[1, T]均匀采样一个时间步`t`。
3. 采样噪声`epsilon ~ N(0, I)`。
4. 计算`x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * epsilon`。
5. 用网络预测`epsilon_theta(x_t, t)`。
6. 最小化`|| epsilon - epsilon_theta(x_t, t) ||^2`。

就是这样。神经网络学会预测任何时间步的噪声。损失是MSE。没有对抗博弈，没有崩溃，没有振荡。

### 解码器（DDPM）

要生成：从`x_T ~ N(0, I)`开始，一步一步反向走。

```
for t = T, T-1, ..., 1:
    eps = model(x_t, t)
    x_{t-1} = (1 / sqrt(alpha_t)) * (x_t - (beta_t / sqrt(1 - alpha_bar_t)) * eps) + sqrt(beta_t) * z
    其中 z ~ N(0, I) 如果 t > 1，否则为 0
return x_0
```

关键在于，即使反向条件通常没有闭合形式，但对于这个特定的高斯前向过程，它是有闭合形式的。那些看起来很丑陋的系数是贝叶斯法则给出的结果。

### 为什么是1000步

前向噪声调度的选择使得每一步添加的噪声刚好足够，让反向步骤近似为高斯分布。步数太少，反向步骤远离高斯分布，网络无法很好地建模。步数太多，采样变得昂贵而收益递减。线性调度的T=1000是DDPM的默认值。

### DDIM：20倍更快的采样

训练相同。采样不同。DDIM（Song等人，2020）定义了一个确定性的反向过程，无需重新训练即可跳过时间步。使用DDIM在50步内采样提供了接近1000步DDPM的质量。每个生产系统都使用DDIM或更快的变体（DPM-Solver、Euler ancestral）。

### 时间条件控制

网络`epsilon_theta(x_t, t)`需要知道它在去噪哪个时间步。现代扩散模型通过正弦时间嵌入（与transformer中的位置编码相同思路）注入`t`，这些嵌入被添加到U-Net每个级别的特征图中。

```
t_embedding = sinusoidal(t)
feature_map += MLP(t_embedding)
```

没有时间条件控制，网络必须从图像本身猜测噪声水平，这虽然可行但样本效率低得多。

## 构建

### 第1步：噪声调度

```python
import torch

def linear_beta_schedule(T=1000, beta_start=1e-4, beta_end=2e-2):
    return torch.linspace(beta_start, beta_end, T)


def precompute_schedule(betas):
    alphas = 1.0 - betas
    alphas_cumprod = torch.cumprod(alphas, dim=0)
    return {
        "betas": betas,
        "alphas": alphas,
        "alphas_cumprod": alphas_cumprod,
        "sqrt_alphas_cumprod": torch.sqrt(alphas_cumprod),
        "sqrt_one_minus_alphas_cumprod": torch.sqrt(1.0 - alphas_cumprod),
        "sqrt_recip_alphas": torch.sqrt(1.0 / alphas),
    }

schedule = precompute_schedule(linear_beta_schedule(T=1000))
```

预先计算一次，在训练和采样期间按索引提取。

### 第2步：前向扩散（q_sample）

```python
def q_sample(x0, t, noise, schedule):
    sqrt_a = schedule["sqrt_alphas_cumprod"][t].view(-1, 1, 1, 1)
    sqrt_one_minus_a = schedule["sqrt_one_minus_alphas_cumprod"][t].view(-1, 1, 1, 1)
    return sqrt_a * x0 + sqrt_one_minus_a * noise
```

一行的闭合形式。`t`是一批时间步，batch中每张图像一个。

### 第3步：微小的带时间条件的U-Net

```python
import torch.nn as nn
import torch.nn.functional as F
import math

def timestep_embedding(t, dim=64):
    half = dim // 2
    freqs = torch.exp(-math.log(10000) * torch.arange(half, device=t.device) / half)
    args = t[:, None].float() * freqs[None]
    emb = torch.cat([args.sin(), args.cos()], dim=-1)
    return emb


class TinyUNet(nn.Module):
    def __init__(self, img_channels=3, base=32, t_dim=64):
        super().__init__()
        self.t_mlp = nn.Sequential(
            nn.Linear(t_dim, base * 4),
            nn.SiLU(),
            nn.Linear(base * 4, base * 4),
        )
        self.t_dim = t_dim
        self.enc1 = nn.Conv2d(img_channels, base, 3, padding=1)
        self.enc2 = nn.Conv2d(base, base * 2, 4, stride=2, padding=1)
        self.mid = nn.Conv2d(base * 2, base * 2, 3, padding=1)
        self.dec1 = nn.ConvTranspose2d(base * 2, base, 4, stride=2, padding=1)
        self.dec2 = nn.Conv2d(base * 2, img_channels, 3, padding=1)
        self.time_proj = nn.Linear(base * 4, base * 2)

    def forward(self, x, t):
        t_emb = timestep_embedding(t, self.t_dim)
        t_emb = self.t_mlp(t_emb)
        t_proj = self.time_proj(t_emb)[:, :, None, None]

        h1 = F.silu(self.enc1(x))
        h2 = F.silu(self.enc2(h1)) + t_proj
        h3 = F.silu(self.mid(h2))
        d1 = F.silu(self.dec1(h3))
        d2 = torch.cat([d1, h1], dim=1)
        return self.dec2(d2)
```

两级U-Net，在瓶颈处注入时间条件。对真实图像增加深度和宽度。

### 第4步：训练循环

```python
def train_step(model, x0, schedule, optimizer, device, T=1000):
    model.train()
    x0 = x0.to(device)
    bs = x0.size(0)
    t = torch.randint(0, T, (bs,), device=device)
    noise = torch.randn_like(x0)
    x_t = q_sample(x0, t, noise, schedule)
    pred = model(x_t, t)
    loss = F.mse_loss(pred, noise)
    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
    return loss.item()
```

这就是完整的训练循环。没有GAN博弈，没有专门的损失，一次MSE调用。

### 第5步：解码器（DDPM）

```python
@torch.no_grad()
def sample(model, schedule, shape, T=1000, device="cpu"):
    model.eval()
    x = torch.randn(shape, device=device)
    betas = schedule["betas"].to(device)
    sqrt_one_minus_a = schedule["sqrt_one_minus_alphas_cumprod"].to(device)
    sqrt_recip_alphas = schedule["sqrt_recip_alphas"].to(device)

    for t in reversed(range(T)):
        t_batch = torch.full((shape[0],), t, dtype=torch.long, device=device)
        eps = model(x, t_batch)
        coef = betas[t] / sqrt_one_minus_a[t]
        mean = sqrt_recip_alphas[t] * (x - coef * eps)
        if t > 0:
            x = mean + torch.sqrt(betas[t]) * torch.randn_like(x)
        else:
            x = mean
    return x
```

1000次前向传播生成一批样本。在实际代码中，你会将其替换为DDIM 50步解码器。

### 第6步：DDIM解码器（确定性，约20倍更快）

```python
@torch.no_grad()
def sample_ddim(model, schedule, shape, steps=50, T=1000, device="cpu", eta=0.0):
    model.eval()
    x = torch.randn(shape, device=device)
    alphas_cumprod = schedule["alphas_cumprod"].to(device)

    ts = torch.linspace(T - 1, 0, steps + 1).long()
    for i in range(steps):
        t = ts[i]
        t_prev = ts[i + 1]
        t_batch = torch.full((shape[0],), t, dtype=torch.long, device=device)
        eps = model(x, t_batch)
        a_t = alphas_cumprod[t]
        a_prev = alphas_cumprod[t_prev] if t_prev >= 0 else torch.tensor(1.0, device=device)
        x0_pred = (x - torch.sqrt(1 - a_t) * eps) / torch.sqrt(a_t)
        sigma = eta * torch.sqrt((1 - a_prev) / (1 - a_t) * (1 - a_t / a_prev))
        dir_xt = torch.sqrt(1 - a_prev - sigma ** 2) * eps
        noise = sigma * torch.randn_like(x) if eta > 0 else 0
        x = torch.sqrt(a_prev) * x0_pred + dir_xt + noise
    return x
```

`eta=0`是完全确定性的（相同的噪声输入总是产生相同的输出）。`eta=1`恢复为DDPM。

## 使用

对于生产工作，使用`diffusers`：

```python
from diffusers import DDPMScheduler, UNet2DModel

unet = UNet2DModel(sample_size=32, in_channels=3, out_channels=3, layers_per_block=2)
scheduler = DDPMScheduler(num_train_timesteps=1000)
```

该库提供了现成的schedulers（DDPM、DDIM、DPM-Solver、Euler、Heun）、可配置的U-Net、文到图和图到图的pipelines，以及LoRA微调辅助工具。

对于研究，`k-diffusion`（Katherine Crowson）拥有最忠实的参考实现和最好的采样变体。

## 交付物

本课产出：

- `outputs/prompt-diffusion-sampler-picker.md` — 一个prompt，根据质量目标、延迟预算和条件控制类型选择DDPM / DDIM / DPM-Solver / Euler。
- `outputs/skill-noise-schedule-designer.md` — 一个技能，给定T和目标破坏程度产生线性、余弦或sigmoid beta调度，以及信噪比随时间变化的诊断图。

## 练习

1. **(简单)** 可视化前向过程：取一张图像，绘制`t in [0, 100, 250, 500, 750, 1000]`时的`x_t`。验证`x_1000`看起来像纯高斯噪声。
2. **(中等)** 在合成圆形数据集上训练TinyUNet 20个epoch并采样16个圆形。比较DDPM（1000步）和DDIM（50步）采样——它们从相同噪声种子产生的图像相似吗？
3. **(困难)** 实现余弦噪声调度（Nichol & Dhariwal, 2021）：`alpha_bar_t = cos^2((t/T + s) / (1 + s) * pi / 2)`。用线性和余弦调度训练相同的模型，并展示余弦在低步数下给出更好的样本。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|----------------|----------------------|
| Forward process | "随时间添加噪声" | 固定的马尔可夫链，在T步内将图像破坏为高斯噪声 |
| Reverse process | "逐步去噪" | 学习到的分布，从噪声反向走回图像 |
| Epsilon prediction | "预测噪声" | 训练目标：`epsilon_theta(x_t, t)` 预测在步骤t添加的噪声 |
| Beta schedule | "噪声量" | T个小的方差序列，定义每步进入多少噪声 |
| alpha_bar_t | "累积保留因子" | 到时间t为止(1 - beta_s)的乘积；t越大意味着剩余信号越少 |
| DDPM sampler | "祖先的、随机的" | 从条件高斯分布采样每个x_{t-1}；1000步 |
| DDIM sampler | "确定性的、快速的" | 将采样重写为确定性ODE；20-100步，质量相似 |
| Time conditioning | "告诉模型哪个t" | 注入U-Net的正弦嵌入t，使模型知道噪声水平 |

## 延伸阅读

- [Denoising Diffusion Probabilistic Models (Ho et al., 2020)](https://arxiv.org/abs/2006.11239) — 使扩散变得实用并在FID上击败GAN的论文
- [Improved DDPM (Nichol & Dhariwal, 2021)](https://arxiv.org/abs/2102.09672) — 余弦调度和v参数化
- [DDIM (Song, Meng, Ermon, 2020)](https://arxiv.org/abs/2010.02502) — 使实时推理成为可能的确定性采样器
- [Elucidating the Design Space of Diffusion (Karras et al., 2022)](https://arxiv.org/abs/2206.00364) — 每个扩散设计选择的统一视角；当前最佳参考
