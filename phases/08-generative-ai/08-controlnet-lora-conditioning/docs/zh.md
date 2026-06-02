# ControlNet、LoRA 与条件控制

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 单靠文本是个笨拙的控制信号。ControlNet 让你克隆一个预训练好的 diffusion 模型，再用深度图、姿态骨架、涂鸦或边缘图来操纵它。LoRA 则让你只训练 1000 万个参数就能微调一个 20 亿参数的模型。两者合体，把 Stable Diffusion 从一个玩具变成了 2026 年每家创意机构都在用的图像 pipeline（流水线）。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 07 (Latent Diffusion), Phase 10 (LLMs from Scratch — for LoRA foundation)
**Time:** ~75 minutes

## 问题（The Problem）

一句 prompt：「一个穿红裙子的女人在繁忙街道上遛狗」——这没告诉模型狗在*哪里*、女人是*什么姿势*、街道是*什么视角*。文本大约只能锁定一张图所需信息的 10%。其余的都是视觉信息，没法用语言高效描述。

为每一种条件信号（pose、depth、canny、segmentation）从零训一个新的条件模型成本太高。你想要的是：让 26 亿参数的 SDXL 主干保持冻结，挂一个读取条件信号的小型旁路网络，让它去微调主干的中间特征。这就是 ControlNet。

你还想教模型一些新概念（你的脸、你的产品、你的画风），但又不想重新训练整个模型。你想要一个体积小 100 倍的 delta（增量）。这就是 LoRA——能插入现有 attention（注意力）权重的低秩适配器。

ControlNet + LoRA + text = 2026 年从业者的工具箱。大多数生产级的图像 pipeline 都是在 SDXL / SD3 / Flux 基座上叠 2-5 个 LoRA、1-3 个 ControlNet，再加一个 IP-Adapter。

## 概念（The Concept）

![ControlNet 克隆 encoder；LoRA 添加低秩 delta](../assets/controlnet-lora.svg)

### ControlNet（Zhang 等，2023）

拿一个预训练好的 SD。*克隆* U-Net 的 encoder 一半。冻结原版。训练这个克隆体接收一个额外的条件输入（边缘、深度、姿态）。再用 *zero-convolution*（零卷积）跳跃连接把克隆体接回原版的 decoder——zero-convolution 是初始化为零的 1×1 卷积，开始时是 no-op，逐步学一个 delta。

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

zero-conv 初始化意味着 ControlNet 一开始就是恒等映射——训练前都不会造成损害。然后用标准 diffusion 损失，在 100 万组（prompt、condition、image）三元组上训练。

按模态拆分的 ControlNet 都以小型旁路模型形式发布（SDXL 上约 360M，SD 1.5 上约 70M）。推理时可以组合：

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA（Hu 等，2021）

对模型里的任何线性层 `W ∈ R^{d×d}`，冻结 `W`，加一个低秩 delta：

```
W' = W + ΔW,  ΔW = B @ A,  A ∈ R^{r×d},  B ∈ R^{d×r}
```

`r << d`。attention 通常用秩 4-16，重度微调用秩 64-128。新增参数数量是 `2 · d · r`，而不是 `d²`。SDXL 的 attention 中 `d=640`、`r=16` 时：每个适配器 2 万参数，原本是 41 万——压缩 20 倍。整个模型层面：一个 LoRA 通常 20-200MB，对比基座的 5GB。

推理时可以缩放 LoRA：`W' = W + α · B @ A`。`α = 0.5-1.5` 是常态。多个 LoRA 可叠加（一般注意：它们之间会以非线性方式相互作用）。

### IP-Adapter（Ye 等，2023）

一个微型适配器，可以把*图像*作为条件输入（与文本并用）。它用 CLIP 图像 encoder 生成 image token，再把它们和文本 token 一起注入 cross-attention。每个基座模型大约 20MB。让你在不训 LoRA 的情况下，做出「按这张参考图的风格生成图像」的效果。

## 可组合性矩阵（Composability matrix）

| 工具 | 控制什么 | 大小 | 何时使用 |
|------|------------------|------|-------------|
| ControlNet | 空间结构（pose、depth、edges） | 70-360MB | 精确布局、构图 |
| LoRA | 风格、主体、概念 | 20-200MB | 个性化、画风 |
| IP-Adapter | 来自参考图的风格或主体 | 20MB | 文字描述不出那种感觉时 |
| Textual Inversion | 把单个概念学成一个新 token | 10KB | 老旧方案，基本被 LoRA 取代 |
| DreamBooth | 针对某主体的全量微调 | 2-5GB | 强身份保真、算力充足 |
| T2I-Adapter | 更轻量的 ControlNet 替代 | 70MB | 边缘设备、推理预算紧张 |

ControlNet ≈ 空间。LoRA ≈ 语义。两个一起用。

## 动手实现（Build It）

`code/main.py` 在 1 维上模拟两种机制：

1. **LoRA。** 一个预训练好的线性层 `W`。冻结它。训一个低秩 `B @ A`，让 `W + BA` 拟合一个目标线性层。展示 `r = 1` 就足以完美学到一个秩 1 校正。

2. **ControlNet-lite。** 一个「冻结基座」预测器 + 一个读取额外信号的「旁路网络」。旁路网络的输出由一个初始化为零的可学习标量门控（这就是我们这一版的 zero-conv）。训起来，看着这个 gate 慢慢爬升。

### Step 1: LoRA 数学

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### Step 2: 零初始化的旁路网络

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

第 0 步时输出和基座一模一样。早期训练会缓慢更新 `gate`——不会发生灾难性漂移。

## 坑（Pitfalls）

- **LoRA 缩放过头。** `α = 2` 或 `α = 3` 是常见的「让它更强」式偷懒做法，结果就是过度风格化／崩坏的输出。把 `α ≤ 1.5`。
- **ControlNet 权重冲突。** 一个 Pose ControlNet 用 1.0、一个 Depth ControlNet 也用 1.0，通常会过冲。权重之和 ≈ 1.0 是个安全默认值。
- **LoRA 用错了基座。** SDXL 的 LoRA 在 SD 1.5 上会静默失效，因为 attention 维度对不上。Diffusers 0.30+ 会发出警告。
- **Textual Inversion 漂移。** 在某个 checkpoint 上训出来的 token 换到另一个 checkpoint 漂移得很厉害。LoRA 的可移植性更好。
- **LoRA 权重合并与存储。** 你可以把 LoRA 烘焙进基座权重以加速推理（运行时不再加 delta），但也就失去了运行时缩放 `α` 的能力。两个版本都留着。

## 用起来（Use It）

| 目标 | 2026 年的 pipeline |
|------|---------------|
| 复刻一个品牌的画风 | 用 ~30 张精选图、rank 32 训一个 LoRA |
| 把我的脸放进生成图 | DreamBooth 或 LoRA + IP-Adapter-FaceID |
| 特定姿势 + prompt | ControlNet-Openpose + SDXL + text |
| 带深度感知的构图 | ControlNet-Depth + SD3 |
| 参考图 + prompt | IP-Adapter + text |
| 精确布局 | ControlNet-Scribble 或 ControlNet-Canny |
| 替换背景 | ControlNet-Seg + Inpainting（第 09 课） |
| 1 步出图的快速风格化 | SDXL-Turbo 上的 LCM-LoRA |

## 上线部署（Ship It）

保存到 `outputs/skill-sd-toolkit-composer.md`。这个 skill 接收一个任务（输入素材：prompt、可选参考图、可选 pose、可选 depth、可选 scribble），输出工具栈、权重以及一个可复现的随机种子协议。

## 练习（Exercises）

1. **简单。** 在 `code/main.py` 里，把 LoRA 的 rank `r` 从 1 调到 4。在哪个 rank 时 LoRA 能精确拟合一个 rank-2 的目标 delta？
2. **中等。** 在两个目标变换上分别训两个独立的 LoRA。把它们一起加载，展示它们的加性相互作用。这种相互作用在什么时候会偏离线性？
3. **困难。** 用 diffusers 叠：SDXL-base + Canny-ControlNet（权重 0.8）+ 一个风格 LoRA（α 0.8）+ IP-Adapter（权重 0.6）。测量随着栈中权重变化时，FID 与 prompt 贴合度之间的取舍曲线。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际是什么 |
|------|-----------------|-----------------------|
| ControlNet | 「空间控制」 | 克隆 encoder + zero-conv 跳连；读取一张条件图。 |
| Zero convolution | 「一开始是恒等」 | 初始化为零的 1×1 卷积；ControlNet 起步是 no-op。 |
| LoRA | 「低秩适配器」 | `W + B @ A`，`r << d`；参数量比全量微调少 100 倍。 |
| rank r | 「那个旋钮」 | LoRA 的压缩程度；典型 4-16，重度个性化用 64+。 |
| α | 「LoRA 强度」 | 运行时对 LoRA delta 的缩放系数。 |
| IP-Adapter | 「参考图」 | 通过 CLIP 图像 token 实现的小型图像条件适配器。 |
| DreamBooth | 「主体全量微调」 | 用某主体的 ~30 张图微调整个模型。 |
| Textual Inversion | 「新 token」 | 只学一个新词的 embedding；老方案，基本被取代。 |

## 生产备注：LoRA 热插拔、ControlNet 通道、多租户服务

一个真实的文生图 SaaS 在同一个基座 checkpoint 上要服务上百个 LoRA、十几个 ControlNet。这个服务问题和 LLM 多租户长得很像（生产文献里 LLM 那一侧的论述集中在 continuous batching 与 LoRAX / S-LoRA）：

- **LoRA 要热插拔，不要合并。** 把 `W' = W + α·B·A` 合进基座，每步推理大约能快 3-5%，但代价是冻死了 `α` 和基座。把 LoRA 当作秩 r 的 delta 在显存里热加载；diffusers 提供了 `pipe.load_lora_weights()` + `pipe.set_adapters([...], adapter_weights=[...])` 来做按请求级别的激活。换装代价就是 `2 · d · r · num_layers` 个权重——MB 级别，亚秒完成。
- **ControlNet 是第二条 attention 通道。** 克隆出来的 encoder 与基座并行跑。两个权重都为 1.0 的 ControlNet 意味着每步多 2 次额外前向，不是合并成 1 次。批大小余量随之以平方下降。每激活一个 ControlNet，预算大约 ×1.5 步成本。
- **LoRA 也能量化。** 如果你已经把基座量化了（见第 07 课，8GB 上跑 Flux），LoRA delta 也能干净地量化到 8-bit 或 4-bit。QLoRA 风格的加载方式让你能在 4-bit 的 Flux 基座上叠 5-10 个 LoRA 而不爆显存。

Flux 特定：Niels 的 Flux-on-8GB notebook 把基座量化到 4-bit；在那个量化基座上叠风格 LoRA（`pipe.load_lora_weights("user/style-lora")`，配合 `weight_name="pytorch_lora_weights.safetensors"`）依然能跑。这就是 2026 年大多数 SaaS 创意机构在用的 recipe（配方）。

## 延伸阅读（Further Reading）

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) — ControlNet 原文。
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) — LoRA（原本用于 LLM；后来移植到 diffusion）。
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) — IP-Adapter。
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) — 比 ControlNet 更轻量的替代方案。
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242) — DreamBooth。
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet) — 参考 pipeline。
