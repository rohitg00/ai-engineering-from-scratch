# 隐形扩散和稳定的扩散

> 像素空间扩散在512×512图像上是一种计算战争罪行.Rombach等 (2022) 注意到,你不需要所有的786k维度来生成图像.你需要足够的 capturing语义结构,和一个独立的解码器.运行扩散在一个VAE的隐藏空间.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 8 · 02 (VAE), Phase 8 · 06 (DDPM), Phase 7 · 09 (ViT)
**Time:** ~75 minutes

## 问题

像素空间扩散在5122意味着U-Net运行在形状子上`[B, 3, 512, 512]`每个采样步骤为500万参数的U-Net的100GFLOPS.50步骤为每张图像的5 TFLOPS.

罗姆巴赫的想法是:训练一个VAE一次 (第一个阶段*),结它,并在4道64×64潜伏空间 (第二阶段*) 完全运行扩散.同样的U-Net.1/16的像素. ~64x少的FLOPs以获得相似的质量.

这就是稳定扩散的配方.SD1.x/2.x使用了860MU-Net`64×64×4` SDXL使用了2.6BU-网`128×128×4`通过SDD3来换换一个流量相匹配的U-Net,并使用一个流量变压器 (DiT).Flux.1-dev (黑森林实验室,2024) 运输了一个12B参数的DiT-MMDiT.所有运行在同一两个阶段的基板上.

## 概念

![Latent diffusion: VAE compression + diffusion in latent space](../assets/latent-diffusion.svg)

**Two stages, separately trained.**

1. **Stage 1 — VAE.**编码器$E(x) \to z$解码器$D(z) \to x$目标压缩:每个空间轴的下样本8倍 +调整道,使得潜伏总量为像素数量的1/16分之一.$z$由于我们不需要精确的样本$z$经常被训练,以对抗的损失,所以解码的图像是敏的.

2. **Stage 2 — diffusion on $z$.**治疗$z = E(x_{\text{real}})$训练一个U-Net (或DIT) 进行击$z_t$结果: 样本$z_0$通过传播,然后$x = D(z_0)$现在,我们要去.

**Text conditioning.**另外两个组件:一个结的文本编码器 (SD 1.x 的CLIP-L,SD 2/XL 的CLIP-L+OpenCLIP-G,SD 3 的T5-XXL 和Flux).`[Q = image features, K = V = text tokens]`标记是文字影响图像的唯一方式.

**The loss function is identical to Lesson 06.**它们是相同的 DDPM/流量,与噪音相匹配的 MSE.

## 建筑变体

| Model | Year | Backbone | Latent shape | Text encoder | Params |
|-------|------|----------|--------------|--------------|--------|
| SD 1.5 | 2022 | U-Net | 64×64×4 | CLIP-L (77 tokens) | 860M |
| SD 2.1 | 2022 | U-Net | 64×64×4 | OpenCLIP-H | 865M |
| SDXL | 2023 | U-Net + refiner | 128×128×4 | CLIP-L + OpenCLIP-G | 2.6B + 6.6B |
| SDXL-Turbo | 2023 | Distilled | 128×128×4 | same | 1-4 step sampling |
| SD3 | 2024 | MMDiT (multimodal DiT) | 128×128×16 | T5-XXL + CLIP-L + CLIP-G | 2B / 8B |
| Flux.1-dev | 2024 | MMDiT | 128×128×16 | T5-XXL + CLIP-L | 12B |
| Flux.1-schnell | 2024 | MMDiT distilled | 128×128×16 | T5-XXL + CLIP-L | 12B, 1-4 step |

趋势:用DIT (变压器在隐藏补丁上) 取代U-Net,扩大文本编码器 (T5比CIP快速遵守),增加隐藏频道 (4 → 16提供更多细节空间).

```figure
noise-schedule
```

## 建立它

`code/main.py`在第06课中,在DDPM上堆叠了一个1-D"VAE" (一个固定尺度为0.5的编码器,其正确逆向是解码器,为示范;一个真正的VAE将是一个 conv网) 并添加了无类型指导的类条件.它表明,无论你运行在原始1-D值或编码值.这是关键的见解.

### 步骤1:编码/解码

```python
def encode(x):    return x * 0.5          # toy "compression" to smaller scale
def decode(z):    return z * 2.0
```

对于教学来说,这个线性地图足以表明传播运作在$z$没有关心原始数据空间.

### 步骤2: 扩散在`z`- 空间

网络看到的数据是$z = E(x)$在抽样后$z_0$解码$D(z_0)$现在,我们要去.

### 步骤3:无分类器的指导

在训练期间, 10% 的时间放下课标 (用零代币代替).$\epsilon_{\text{cond}}$其他$\epsilon_{\text{uncond}}$接下来:

```python
eps_cfg = (1 + w) * eps_cond - w * eps_uncond
```

$w = 0$=没有指导 (完全多样性),$w = 3$   $w = 7+$和/过度.

### 步骤4:文本调节 (概念,不是代码)

通过交叉注意力输入嵌入式文本到 U-Net:

```python
h = h + CrossAttention(Q=h, K=text_embed, V=text_embed)
```

这就是类条件扩散模型和稳定扩散之间的唯一实质性区别.

## 陷

- **VAE-scale mismatch.**SD 1.x VAE 具有扩展常数 (`scaling_factor ≈ 0.18215`无线网络在隐藏的变量上,每一个检查站都会发送一个.
- **Text encoder silently wrong.** SD3需要 T5-XXL 具有128 个代币,而回归到CLIP 只有损失.`use_t5=True`或是快速的忠诚坑.
- **Mixing latent spaces.**SDXL,SD3,Flux都使用不同的VAE. SDXL隐藏器训练的LoRA不会在SD3上工作.
- **CFG too high.** `w > 10`色的图像,以多样性为代价,`w = 3-7`现在,我们要去.
- **Negative prompts leaking.**空负提示变成零符号;填写的负提示变成了 $\epsilon_{\text{uncond}}$它们不同,有些管道默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默默

## 用它

2026年生产堆:

| Target | Recommended backbone |
|--------|----------------------|
| Narrow domain, paired data, training a model from scratch | SDXL fine-tune (LoRA / full) — fastest to ship |
| Open-domain text-to-image, open weights | Flux.1-dev (12B, Apache / non-commercial) or SD3.5-Large |
| Fastest inference, open weights | Flux.1-schnell (1-4 step, Apache) or SDXL-Lightning |
| Best prompt adherence, hosted | GPT-Image / DALL-E 3 (still), Midjourney v7, Imagen 4 |
| Edit workflows | Flux.1-Kontext (Dec 2024) — natively accepts image + text |
| Research, baseline | SD 1.5 — ancient but well-studied |

## 运送它

保存`outputs/skill-sd-prompter.md`技能采用文本提示+目标风格和输出:模型+检查点,CFG尺度,样本,负提示,分辨率,可选的ControlNet/IP-Adapter组合以及每步的QA检查清单.

## 运动

1. **Easy.**跑步`code/main.py`带着指导$w \in \lbrace 0, 1, 3, 7, 15 \rbrace$按类别记录平均样本.$w$类型的意思是否超出了实际数据的意思?
2. **Medium.**换取一个TANH-MLP编码器/解码器对,重建损失.重新训练扩散新潜伏.样品质量有没有改变?
3. **Hard.**设置一个真正的稳定射推理,使用射器:负载 `sdxl-base`现在切换到 ,然后再切换到`sdxl-turbo`描述了什么发生了变化以及为什么.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| First stage | "The VAE" | Trained encoder/decoder pair; compresses 512² to 64². |
| Second stage | "The U-Net" | Diffusion model over the latent space. |
| CFG | "Guidance scale" | $(1+w) \cdot \epsilon_{\text{cond}} - w \cdot \epsilon_{\text{uncond}}$; tunes conditioning strength. |
| Null token | "Empty prompt embed" | Unconditional embed used for $\epsilon_{\text{uncond}}$. |
| Cross-attention | "How text gets in" | Each U-Net block attends to text tokens as K and V. |
| DiT | "Diffusion Transformer" | Replace U-Net with a transformer over latent patches; scales better. |
| MMDiT | "Multi-modal DiT" | SD3's architecture: text and image streams with joint attention. |
| VAE scaling factor | "Magic number" | Divides latents by ~5.4 so diffusion operates in unit-variance space. |

## 产品说明:运行Flux-12B在8GB消费者GPU上

参考流程集成是"我有一个消费者GPU,我可以运送吗?"的正规配方.

1. **Staggered loading.**流程有四个网络,在VRAM中永远不需要共存:T5-XXL文本编码器 (fp32中约10GB),CLIP-L (小),12BMMDiT和VAE.首先编码提示, *删除*编码器,加载diT,删除, *删除*diT,加载VAE,解码.消费者8GBGPU只适用于一次一个阶段.
2. **4-bit quantization via bitsandbytes.** `BitsAndBytesConfig(load_in_4bit=True, bnb_4bit_compute_dtype=torch.bfloat16)`在T5编码器和DiT上. 减8×的内存,对Aritra的基准指标 (笔记本中链接) 显示文字到图像的质量下降是不可见的.
3. **CPU offload.** `pipe.enable_model_cpu_offload()`随着每个前进传递的过程,自动交换CPU和GPU之间的模块. 增加10-20%的延迟,但使管道完全运行.

记忆会计是:`10 GB T5 / 8 = 1.25 GB`量化`12 B params × 0.5 bytes = ~6 GB`在 stas00 术语中,这是TP=1推理的极端端,没有模型平行性,最大的量化.

## 进一步阅读

- [Rombach et al. (2022). High-Resolution Image Synthesis with Latent Diffusion Models](https://arxiv.org/abs/2112.10752)稳定扩散.
- [Podell et al. (2023). SDXL: Improving Latent Diffusion Models for High-Resolution Image Synthesis](https://arxiv.org/abs/2307.01952) SDXL
- [Peebles & Xie (2023). Scalable Diffusion Models with Transformers (DiT)](https://arxiv.org/abs/2212.09748)  
- [Esser et al. (2024). Scaling Rectified Flow Transformers for High-Resolution Image Synthesis](https://arxiv.org/abs/2403.03206) SD3,MMDiT
- [Ho & Salimans (2022). Classifier-Free Diffusion Guidance](https://arxiv.org/abs/2207.12598)   
- [Labs (2024). Flux.1 — Black Forest Labs announcement](https://blackforestlabs.ai/announcing-black-forest-labs/)流动1.家族
- [Hugging Face Diffusers docs](https://huggingface.co/docs/diffusers/index)对上述每一个检查点进行参考实施.
