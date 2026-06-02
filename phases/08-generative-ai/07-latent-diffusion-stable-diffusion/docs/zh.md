# 潜空间扩散与 Stable Diffusion（Latent Diffusion & Stable Diffusion）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 在 512×512 像素空间里跑 diffusion 是一种算力上的「战争罪行」。Rombach 等人（2022）注意到：你并不需要 786k 维全部上阵才能生成一张图——只要够多的维度去捕捉语义结构，再交给一个独立 decoder 收拾剩下的细节就行。把 diffusion 跑在 VAE 的 latent 空间里——这一个想法，就是 Stable Diffusion。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 02 (VAE), Phase 8 · 06 (DDPM), Phase 7 · 09 (ViT)
**Time:** ~75 minutes

## 问题（The Problem）

在 512² 像素空间做 diffusion，意味着 U-Net 要在形状为 `[B, 3, 512, 512]` 的张量上运行。一个 500M 参数的 U-Net，每个采样步约 100 GFLOPS。50 步就是每张图 5 TFLOPS。再乘以十亿张训练图像，账单荒谬到没法看。

这些 FLOPs 大部分都花在「把人眼几乎察觉不到的细节硬塞过网络」——那些高频纹理本来就可以被一个有损 VAE 压掉。Rombach 的想法是：把 VAE 训一次（*第一阶段*），冻住，然后把 diffusion 完全放进 4 通道、64×64 的 latent 空间里跑（*第二阶段*）。U-Net 还是同一个 U-Net，但像素只剩 1/16，质量相当的前提下 FLOPs 降到约 1/64。

这就是 Stable Diffusion 的配方（recipe / 配方）。SD 1.x / 2.x 用 860M 的 U-Net 跑在 `64×64×4` 的 latents 上，SDXL 用 2.6B 的 U-Net 跑在 `128×128×4` 上，SD3 把 U-Net 换成了 Diffusion Transformer（DiT）+ flow matching。Flux.1-dev（Black Forest Labs，2024）则是 12B 参数的 DiT-MMDiT。它们全部跑在同一套两阶段底座上。

## 概念（The Concept）

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**两个阶段，分开训练。**

1. **Stage 1 — VAE。** Encoder `E(x) → z`，decoder `D(z) → x`。压缩目标：每个空间轴下采样 8×，再调通道数，让 latent 总尺寸约为像素数的 1/16。损失 = 重建（L1 + LPIPS perceptual）+ KL（KL 权重很小，因为我们并不需要从 `z` 里精确采样，没必要逼它太接近高斯）。通常还会加对抗损失，让解码出的图更锐利。

2. **Stage 2 — 在 `z` 上做 diffusion。** 把 `z = E(x_real)` 当作数据。训练一个 U-Net（或 DiT）去给 `z_t` 去噪。推理时：先用 diffusion 采样 `z_0`，再 `x = D(z_0)`。

**文本条件（Text conditioning）。** 多两个组件。一个冻住的文本 encoder（SD 1.x 用 CLIP-L，SD 2/XL 用 CLIP-L+OpenCLIP-G，SD3 和 Flux 用 T5-XXL）。一个 cross-attention 注入：每个 U-Net block 接 `[Q = image features, K = V = text tokens]` 把文本混进来。这些 token 是文本影响图像的唯一通道。

**损失函数和 Lesson 06 完全一样。** 还是 DDPM / flow matching 在噪声上的 MSE。你只是换了数据域。

## 架构变体（Architecture variants）

| Model | Year | Backbone | Latent shape | Text encoder | Params |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | Distilled | 128×128×4 | same | 1-4 step sampling |
| SD3 | 2024 | MMDiT (multimodal DiT) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT distilled | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 step |

趋势很清楚：U-Net 让位给 DiT（在 latent patches 上的 transformer），文本 encoder 越做越大（T5 的 prompt 跟随能力强于 CLIP），latent 通道数也在涨（4 → 16 给了更多细节余量）。

## 动手实现（Build It）

`code/main.py` 在 Lesson 06 的 DDPM 之上叠了一个玩具版的一维「VAE」（identity encoder + decoder，只为演示；真实 VAE 是个卷积网络），并加上了带 classifier-free guidance 的类别条件。它要展示的核心点是：同一套 diffusion 损失，无论是跑在原始一维数值上，还是跑在编码后的值上，都成立。

### Step 1: encoder/decoder

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

真实 VAE 有训练好的权重。从教学角度，这个线性映射已经足够说明 diffusion 是在 `z` 上工作的，根本不在乎原始数据空间长什么样。

### Step 2: 在 `z` 空间里做 diffusion

跟 Lesson 06 是同一个 DDPM。网络看到的数据是 `z = E(x)`。采样出 `z_0` 后，用 `D(z_0)` 解码。

### Step 3: classifier-free guidance

训练时，10% 的概率把类别标签丢掉（替换成 null token）。推理时同时算 `ε_cond` 和 `ε_uncond`，再：

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

`w = 0` = 无引导（多样性最大），`w = 3` = 默认值，`w = 7+` = 饱和 / 过锐。

### Step 4: 文本条件（概念，不写代码）

把类别标签换成一个冻住的文本 encoder 的输出。把 text embedding 通过 cross-attention 喂给 U-Net：

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

这就是「类别条件 diffusion 模型」和「Stable Diffusion」之间唯一的本质差异。

## 易踩的坑（Pitfalls）

- **VAE scale 不匹配。** SD 1.x 的 VAE 编码后会乘一个 scaling 常数（`scaling_factor ≈ 0.18215`）。忘了它，U-Net 训出来的 latents 方差会严重不对。每个 checkpoint 都自带这个常数。
- **Text encoder 静默挂掉。** SD3 需要 T5-XXL 且 token 数 >=128，自动 fallback 到 CLIP-only 是有损的。一定检查 `use_t5=True`，否则 prompt 跟随能力会暴跌。
- **混用 latent 空间。** SDXL、SD3、Flux 用的是不同的 VAE。在 SDXL latents 上训出的 LoRA 没法用到 SD3 上。Hugging Face diffusers 0.30+ 会直接拒绝加载不匹配的 checkpoint。
- **CFG 太高。** `w > 10` 会出饱和、油腻的图，过拟合 prompt 而牺牲多样性。甜点区是 `w = 3-7`。
- **Negative prompt 漏出去。** 空 negative prompt 会变成 null token；填了 negative prompt 会变成 `ε_uncond`。这俩不是一回事，有些 pipeline 会静默 default 到 null。

## 用起来（Use It）

2026 年的生产栈：

| Target | Recommended backbone |
|--------|----------------------|
| 窄域、有配对数据，从头训模型 | SDXL fine-tune（LoRA / full）——上线最快 |
| 开放域 text-to-image，开源权重 | Flux.1-dev（12B，Apache / 非商用）或 SD3.5-Large |
| 推理最快，开源权重 | Flux.1-schnell（1-4 步，Apache）或 SDXL-Lightning |
| Prompt 跟随最好，托管服务 | GPT-Image / DALL-E 3（仍在用）、Midjourney v7、Imagen 4 |
| 编辑流程 | Flux.1-Kontext（2024 年 12 月）——原生支持图 + 文输入 |
| 研究 / 基线 | SD 1.5——上古但研究最透 |

## 上线部署（Ship It）

存为 `outputs/skill-sd-prompter.md`。这个 skill 接收一个 text prompt + 目标风格，输出：模型 + checkpoint、CFG scale、sampler、negative prompt、分辨率、可选的 ControlNet/IP-Adapter 组合，以及逐步的 QA checklist。

## 练习（Exercises）

1. **简单。** 用 `code/main.py` 跑 guidance `w ∈ {0, 1, 3, 7, 15}`。记录每个类别的样本均值。`w` 取到多大时，类别均值开始偏离真实数据均值？
2. **中等。** 把玩具线性 encoder 换成一对带重建损失的 tanh-MLP encoder/decoder。在新的 latents 上重训 diffusion。样本质量有变化吗？
3. **困难。** 用 diffusers 起一套真正的 Stable Diffusion 推理：加载 `sdxl-base`，跑 30 步 Euler、CFG=7，计时。然后换成 `sdxl-turbo` + 4 步 + CFG=0。同一个主题，质量不同——描述变化以及为什么会变。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| First stage | "The VAE" | 训练好的 encoder/decoder 对；把 512² 压到 64²。 |
| Second stage | "The U-Net" | 在 latent 空间上的 diffusion 模型。 |
| CFG | "Guidance scale" | `(1+w)·ε_cond - w·ε_uncond`；调节条件强度。 |
| Null token | "Empty prompt embed" | 用于 `ε_uncond` 的无条件 embed。 |
| Cross-attention | "How text gets in" | 每个 U-Net block 把 text tokens 当 K 和 V 来 attend。 |
| DiT | "Diffusion Transformer" | 用一个跑在 latent patches 上的 transformer 替掉 U-Net；扩展性更好。 |
| MMDiT | "Multi-modal DiT" | SD3 的架构：文本和图像两条流做 joint attention。 |
| VAE scaling factor | "Magic number" | 把 latents 除以约 5.4，让 diffusion 在单位方差空间里工作。 |

## 工程实战：在 8GB 消费级 GPU 上跑 Flux-12B

参考 Flux 集成是「我只有消费级 GPU，能不能上线？」这个问题的标杆配方。诀窍就是把生产推理文献里那套老三样，套到一个 diffusion DiT 上：

1. **错峰加载（Staggered loading）。** Flux 有三个网络，根本不需要同时待在显存里：T5-XXL 文本 encoder（fp32 下约 10 GB）、CLIP-L（小）、12B 的 MMDiT，再加上 VAE。先编码 prompt，*删掉* encoder；加载 DiT、去噪、*删掉* DiT；加载 VAE、解码。8GB 的消费 GPU 一次只装得下一个阶段。
2. **bitsandbytes 的 4-bit 量化。** 在 T5 encoder 和 DiT 上都用 `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`。显存砍掉 8×，按 Aritra 的 benchmark（notebook 里有链接），text-to-image 场景下质量损失几乎不可感。
3. **CPU offload。** `pipe.enable_model_cpu_offload()` 会在每次 forward 推进时自动在 CPU 和 GPU 之间换模块。延迟（latency）增加 10-20%，但能让 pipeline 至少能跑起来。

显存账是这么算的：`10 GB T5 / 8 = 1.25 GB` 量化后；`12 B params × 0.5 bytes = ~6 GB` 量化后的 DiT，再加激活值。用 stas00 的话讲，这是 TP=1 推理的极端边界——没有模型并行、量化吃满。生产环境你会在 H100 上跑 TP=2 或 TP=4；但单台开发笔记本，这就是配方。

## 延伸阅读（Further Reading）

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752) — Stable Diffusion。
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) — SDXL。
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748) — DiT。
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) — SD3、MMDiT。
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598) — CFG。
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/) — Flux.1 系列。
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index) — 上述每一个 checkpoint 的参考实现。
