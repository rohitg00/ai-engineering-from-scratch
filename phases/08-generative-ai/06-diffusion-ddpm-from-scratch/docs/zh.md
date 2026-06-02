# Diffusion 模型 — 从零实现 DDPM

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Ho、Jain、Abbeel（2020）给整个领域端来了一份戒不掉的 recipe（配方）：用上千个小步把数据一点点加 noise 毁掉；训一个神经网络去预测这些 noise；inference（推理）时把过程倒过来跑。今天所有主流的图像、视频、3D、音乐模型都跑在这个循环上，顶多上面叠点 flow matching 或 consistency 之类的花活。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 3 · 02 (Backprop), Phase 8 · 02 (VAE)
**Time:** ~75 minutes

## 问题（The Problem）

你想要一个能从 `p_data(x)` 采样的 sampler。GAN 玩的 minimax 博弈经常发散；VAE 用 Gaussian decoder 出来的样本糊成一团。你真正想要的训练目标是：(a) 一个稳定的单一 loss（没有鞍点，也没有 minimax）；(b) 是 `log p(x)` 的下界（这样你就有 likelihood）；(c) 样本质量能打 SOTA。

Sohl-Dickstein 等人（2015）给出过理论答案：定义一个 Markov 链 `q(x_t | x_{t-1})`，逐步往里加 Gaussian noise，再训一条反向链 `p_θ(x_{t-1} | x_t)` 去 denoise（去噪）。Ho、Jain、Abbeel（2020）证明这个 loss 可以化简成一行——预测 noise——并把数学推导清理干净。在 2020 年这还是个奇技淫巧；2021 年它产出了 SOTA 样本；2022 年它变成了 Stable Diffusion；到了 2026 年，它已经是底层基质。

## 概念（The Concept）

![DDPM: forward noise, reverse denoise](../assets/ddpm.svg)

**前向过程 `q`。** 在 `T` 个小步里加 Gaussian noise。这套数学之所以能算下来，是因为有一个闭式解——把所有步累起来，结果还是 Gaussian：

```
q(x_t | x_0) = N( sqrt(α̅_t) · x_0,  (1 - α̅_t) · I )
```

其中 `α̅_t = ∏_{s=1..t} (1 - β_s)`，对应一组 schedule `β_t`。把 `β_t` 在 T=1000 步上从 1e-4 线性涨到 0.02，`x_T` 就近似服从 `N(0, I)`。

**反向过程 `p_θ`。** 训一个神经网络 `ε_θ(x_t, t)`，去预测「当时被加进去的 noise」。给定 `x_t`，按下式 denoise：

```
x_{t-1} = (1 / sqrt(α_t)) · ( x_t - (β_t / sqrt(1 - α̅_t)) · ε_θ(x_t, t) )  +  σ_t · z
```

其中 `σ_t` 取 `sqrt(β_t)` 或一个学出来的 variance（方差）。式子很丑，但纯粹是代数运算——就是从后验 `q(x_{t-1} | x_t, x_0)` 里反解出 `x_{t-1}`，再用 noise 预测出来的估计值替换掉 `x_0`。

**训练 loss。**

```
L_simple = E_{x_0, t, ε} [ || ε - ε_θ( sqrt(α̅_t) · x_0 + sqrt(1 - α̅_t) · ε,  t ) ||² ]
```

从数据里采一个 `x_0`，随机挑一个 `t`，采一个 `ε ~ N(0, I)`，用闭式解一步算出加噪后的 `x_t`，然后在 noise 上做回归。一个 loss，无 minimax，无 KL，无 reparameterization trick。

**采样。** 从 `x_T ~ N(0, I)` 出发，按反向步从 `t = T` 迭代到 `1`。完事。

## 为什么有效（Why it works）

三个直觉：

1. **Denoise 容易，generate 难。** 在 `t=T`，数据已经是纯 noise——网络要解的是个平凡问题；在 `t=0`，网络只要把几个像素清干净；在中间的 `t`，问题确实难，但所有 noise level 的梯度都流过同一组权重，等于多任务联训。

2. **披着 denoising 外衣的 score matching。** Vincent（2011）证明：预测 noise 等价于估计 `∇_x log q(x_t | x_0)`，也就是 *score*。反向 SDE 沿着这个 score 往密度梯度上方走——一次朝着高概率区域的引导式随机游走。

3. **ELBO 化简成简单的 MSE。** 完整的 variational lower bound 每个 timestep 都有一个 KL 项。在 DDPM 的参数化下，这些 KL 项化简成「带特定系数的 noise 预测 MSE」；Ho 把系数全部丢掉（管这叫 "simple" loss），质量反而 *变好了*。

## 动手实现（Build It）

`code/main.py` 实现了一个一维 DDPM。数据是双峰混合分布。「网络」是一个小 MLP，输入 `(x_t, t)`，输出预测的 noise。训练就是那一行 loss。采样就是反向链迭代。

### 第一步：前向 schedule（闭式解）

```python
betas = [1e-4 + (0.02 - 1e-4) * t / (T - 1) for t in range(T)]
alphas = [1 - b for b in betas]
alpha_bars = []
cum = 1.0
for a in alphas:
    cum *= a
    alpha_bars.append(cum)
```

### 第二步：一步采出 `x_t`

```python
def forward_sample(x0, t, alpha_bars, rng):
    a_bar = alpha_bars[t]
    eps = rng.gauss(0, 1)
    x_t = math.sqrt(a_bar) * x0 + math.sqrt(1 - a_bar) * eps
    return x_t, eps
```

### 第三步：单步训练

```python
def train_step(x0, model, alpha_bars, rng):
    t = rng.randrange(T)
    x_t, eps = forward_sample(x0, t, alpha_bars, rng)
    eps_hat = model_forward(model, x_t, t)
    loss = (eps - eps_hat) ** 2
    return loss, gradient_step(model, ...)
```

### 第四步：反向采样

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

对一个一维问题，T 取 40、MLP 用 24 个 unit，大约 200 epoch 就能学到双峰混合分布。

## 时间条件（Time conditioning）

网络得知道自己当前在 denoise 哪一步。两种标准做法：

- **Sinusoidal embedding。** 类似 transformer 的位置编码：`embed(t) = [sin(t/ω_0), cos(t/ω_0), sin(t/ω_1), ...]`，过一个 MLP 后广播进网络。
- **FiLM / group-norm 条件化。** 把 embedding 投影成每个 channel 的 scale/bias（FiLM），在每个 block 里注入。

我们这份玩具代码用的是 sinusoidal → concat。生产级 U-Net 用的是 FiLM。

## 坑（Pitfalls）

- **Schedule 影响特别大。** 线性 `β` 是 DDPM 的默认值，但 cosine schedule（Nichol & Dhariwal, 2021）在同等算力下能拿到更好的 FID。质量上不去就换 schedule。
- **Timestep embedding 很脆。** 把原始 `t` 当浮点数直接塞进去，对一维玩具没事，对图像就崩；务必用正经的 embedding。
- **V-prediction vs ε-prediction。** 在极端区间（极小或极大的 t），`ε` 的信噪比很差。V-prediction（`v = α·ε - σ·x`）更稳；SDXL、SD3、Flux 都用它。
- **Classifier-free guidance。** 推理时同时算条件和无条件 `ε`，再 `ε_cfg = (1 + w) · ε_cond - w · ε_uncond`，`w ≈ 3-7`。Lesson 08 会讲。
- **1000 步太多了。** 生产环境用 DDIM（20-50 步）、DPM-Solver（10-20 步）或 distillation（蒸馏，1-4 步）。见 Lesson 12。

## 用起来（Use It）

| 角色 | 2026 年的典型技术栈 |
|------|-----------------------|
| 像素空间图像 diffusion（小模型 / 玩具） | DDPM + U-Net |
| Latent 空间图像 diffusion | VAE encoder + U-Net 或 DiT（Lesson 07） |
| Latent 空间视频 diffusion | 时空 DiT（Sora、Veo、WAN） |
| Latent 空间音频 diffusion | Encodec + diffusion transformer |
| 科学（分子、蛋白质、物理） | 等变 diffusion（EDM、RFdiffusion、AlphaFold3） |

Diffusion 是通用的生成式骨架。Flow matching（Lesson 13）是 2024-2026 的对手，在同等质量下推理速度通常更胜一筹。

## 上线部署（Ship It）

保存 `outputs/skill-diffusion-trainer.md`。这个 skill 接收数据集 + 算力预算，输出：schedule（linear / cosine / sigmoid）、预测目标（ε / v / x）、步数、guidance scale、sampler 家族、以及一份 eval（评估）协议。

## 练习（Exercises）

1. **简单。** 在 `code/main.py` 里把 T 从 40 改到 10。样本质量（输出的可视化直方图）会怎么退化？T 降到多少时双峰结构会塌掉？
2. **中等。** 把 ε-prediction 换成 v-prediction，重新推一遍反向步，比较最终样本质量。
3. **困难。** 加上 classifier-free guidance。在类标签 `c ∈ {0, 1}` 上做条件化，训练时 10% 概率把 `c` 丢掉，采样时用 `ε = (1+w)·ε_cond - w·ε_uncond`，测一下 `w = 0, 1, 3, 7` 时的「条件命中率」。

## 关键术语（Key Terms）

| 术语 | 大家平时怎么说 | 实际是什么 |
|------|-----------------|-----------------------|
| Forward process | "加噪" | 固定的 Markov 链 `q(x_t \| x_{t-1})`，把数据毁掉。 |
| Reverse process | "去噪" | 学出来的链 `p_θ(x_{t-1} \| x_t)`，把数据重建回来。 |
| β schedule | "噪声阶梯" | 每步的 variance（方差）；linear、cosine 或 sigmoid。 |
| α̅ | "Alpha bar" | 累积乘积 `∏(1 - β)`；让 `x_t` 能直接从 `x_0` 闭式得到。 |
| Simple loss | "对 noise 做 MSE" | `\|\|ε - ε_θ(x_t, t)\|\|²`；所有变分推导最后都塌成它。 |
| ε-prediction | "预测 noise" | 输出就是被加进去的 noise；标准 DDPM。 |
| V-prediction | "预测速度" | 输出是 `α·ε - σ·x`；跨 t 的 conditioning 更好。 |
| DDPM | "那篇论文" | Ho et al. 2020；linear β、1000 步、U-Net。 |
| DDIM | "确定性 sampler" | 非 Markov 的 sampler，20-50 步，训练目标和 DDPM 相同。 |
| Classifier-free guidance | "CFG" | 把条件和无条件的 noise 预测混起来，放大条件信号。 |

## 生产笔记：diffusion 推理是个步数问题（Production note: diffusion inference is a step-count problem）

DDPM 论文跑的是 T=1000 步反向链。生产环境没人这么上。所有真实推理栈都会在三种策略里挑一种——而每种都对应一种生产框架下「延迟从哪儿来」的描述方式：

1. **更快的 sampler，模型不变。** DDIM（20-50 步）、DPM-Solver++（10-20）、UniPC（8-16）。直接换掉反向循环，训好的 `ε_θ` 权重原样不动。延迟可降 20-50×。
2. **Distillation（蒸馏）。** 训一个 student（学生）模型在更少步里匹配 teacher（老师）：Progressive Distillation（2 → 1）、Consistency Model（任意 → 1-4）、LCM、SDXL-Turbo、SD3-Turbo。延迟再降 5-10×，但要重训。
3. **缓存和编译。** `torch.compile(unet, mode="reduce-overhead")`、TensorRT-LLM 的 diffusion 后端、`xformers` / SDPA attention、bf16 权重。每步延迟约降 2×，可与 (1)(2) 叠加。

对一台生产级 diffusion 服务器，预算账本和生产文献里描述 LLM 的框架一模一样：延迟 = `num_steps × step_cost + VAE_decode`，吞吐 = `batch_size × (num_steps × step_cost)^-1`。TTFT 很小（一步），TPOT 等价物就是整段响应时间——因为从用户视角看，图像生成是「一次性出图」的。

## 延伸阅读（Further Reading）

- [Sohl-Dickstein et al. (2015). Deep Unsupervised Learning using Nonequilibrium Thermodynamics](https://arxiv.org/abs/1503.03585) — 那篇 diffusion 论文，超前于时代。
- [Ho, Jain, Abbeel (2020). Denoising Diffusion Probabilistic Models](https://arxiv.org/abs/2006.11239) — DDPM。
- [Song, Meng, Ermon (2021). Denoising Diffusion Implicit Models](https://arxiv.org/abs/2010.02502) — DDIM，更少的步数。
- [Nichol & Dhariwal (2021). Improved DDPM](https://arxiv.org/abs/2102.09672) — cosine schedule、learned variance。
- [Dhariwal & Nichol (2021). Diffusion Models Beat GANs on Image Synthesis](https://arxiv.org/abs/2105.05233) — classifier guidance。
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) — CFG。
- [Karras et al. (2022). Elucidating the Design Space of Diffusion-Based Generative Models (EDM)](https://arxiv.org/abs/2206.00364) — 统一记号，最干净的 recipe。
