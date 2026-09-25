# ControlNet、LoRA 与条件控制

> 仅靠文本是一种笨拙的控制信号。ControlNet 让你克隆一个预训练扩散模型，并用深度图、姿态骨架、涂鸦或边缘图像来引导它。LoRA 让你只需训练 1000 万个参数就能微调一个 20 亿参数的模型。两者结合，把 Stable Diffusion 从玩具变成了 2026 年每家机构都在使用的图像生产管线。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 8 · 07（Latent Diffusion）、Phase 10（LLMs from Scratch —— LoRA 基础）
**Time:** 约 75 分钟

## 问题所在

类似“一个穿红裙子的女人在繁忙的街道上遛狗”这样的提示词，无法告诉模型狗*在哪里*、女人*摆什么姿势*、街道*是什么透视角度*。文本大约只能固定指定一张图像所需信息的 10%。其余部分是视觉性的，无法用文字高效描述。

为每种信号（姿态、深度、canny、分割）都从头训练一个新的条件模型，代价高得让人却步。你想要的是：保持 26 亿参数的 SDXL 主干冻结，外挂一个小型侧网络来读取条件信息，并让它微调主干的中间特征。这就是 ControlNet。

你还想在不重新训练完整模型的情况下，教会模型新概念（你的脸、你的产品、你的风格）。你想要一个缩小 100 倍的增量。这就是 LoRA —— 插入现有注意力权重的低秩适配器。

ControlNet + LoRA + 文本 = 2026 年从业者的工具箱。大多数生产级图像管线会在 SDXL / SD3 / Flux 基础模型上叠加 2-5 个 LoRA、1-3 个 ControlNet，以及一个 IP-Adapter。

## 核心概念

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### ControlNet（Zhang et al., 2023）

取一个预训练的 SD。*克隆* U-Net 的编码器一半。冻结原始部分。训练克隆体接受一个额外的条件输入（边缘、深度、姿态）。通过*零卷积*跳跃连接（初始化为零的 1×1 卷积 —— 初始为恒等映射，学习一个增量）把克隆体连接回原始模型的解码器一半。

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

零卷积初始化意味着 ControlNet 起始时是恒等映射 —— 即使在训练前也无害。用标准扩散损失在 100 万个（提示词，条件，图像）三元组上训练。

每种模态的 ControlNet 以小型侧模型形式发布（SDXL 约 360M，SD 1.5 约 70M）。你可以在推理时组合它们：

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA（Hu et al., 2021）

对模型中的任意线性层 `W ∈ R^{d×d}`，冻结 `W` 并添加一个低秩增量：

```
W' = W + ΔW,  ΔW = B @ A,  A ∈ R^{r×d},  B ∈ R^{d×r}
```

其中 `r << d`。注意力层通常用秩 4-16，重度微调用秩 64-128。新增参数量为 `2 · d · r` 而非 `d²`。对于 SDXL 注意力层，当 `d=640`、`r=16` 时：每个适配器 2 万参数，而非 41 万 —— 缩减 20 倍。在整个模型范围内：一个 LoRA 通常为 20-200MB，而基础模型为 5GB。

推理时你可以缩放 LoRA：`W' = W + α · B @ A`。`α = 0.5-1.5` 是常规取值。多个 LoRA 以加法方式叠加（但需要注意它们会以非线性方式相互作用）。

### IP-Adapter（Ye et al., 2023）

一个微型适配器，接受*图像*作为条件（与文本并列）。使用 CLIP 图像编码器生成图像 token，并将它们与文本 token 一起注入交叉注意力。每个基础模型约 20MB。让你无需 LoRA 即可实现“以这张参考图的风格生成图像”。

## 可组合性矩阵

| 工具 | 控制内容 | 大小 | 适用场景 |
|------|------------------|------|-------------|
| ControlNet | 空间结构（姿态、深度、边缘） | 70-360MB | 精确布局、构图 |
| LoRA | 风格、主体、概念 | 20-200MB | 个性化、风格 |
| IP-Adapter | 来自参考图的风格或主体 | 20MB | 文字无法描述的外观 |
| Textual Inversion | 单个概念作为新 token | 10KB | 旧方案，大多已被 LoRA 取代 |
| DreamBooth | 对某主体做全量微调 | 2-5GB | 强身份保持，高算力 |
| T2I-Adapter | 更轻量的 ControlNet 替代 | 70MB | 边缘设备、推理预算受限 |

ControlNet ≈ 空间。LoRA ≈ 语义。两者都用。

```figure
v4-controlnet-zero
```

## 动手实现

`code/main.py` 在一维上模拟这两种机制：

1. **LoRA。** 一个预训练线性层 `W`。冻结它。训练一个低秩的 `B @ A`，使 `W + BA` 匹配一个目标线性层。证明 `r = 1` 就足以完美学会一个秩 1 的修正。

2. **ControlNet-lite。** 一个“冻结基础”预测器和一个读取额外信号的“侧网络”。侧网络的输出由一个初始化为零的可学习标量（我们的零卷积版本）门控。训练并观察该门控逐渐增大。

### 步骤 1：LoRA 数学

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### 步骤 2：零初始化侧网络

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

在第 0 步，输出与基础模型完全一致。训练早期只会缓慢更新 `gate` —— 不会发生灾难性漂移。

## 常见陷阱

- **LoRA 强度过度。** `α = 2` 或 `α = 3` 是常见的“加强效果”的取巧手段，但会产生过度风格化 / 崩坏的输出。保持 `α ≤ 1.5`。
- **ControlNet 权重冲突。** 以权重 1.0 使用 Pose ControlNet 和权重 1.0 使用 Depth ControlNet 通常会过冲。权重之和 ≈ 1.0 是安全的默认值。
- **LoRA 用错基础模型。** SDXL LoRA 在 SD 1.5 上会静默失效，因为注意力维度不匹配。Diffusers 在 0.30+ 版本中会给出警告。
- **Textual Inversion 漂移。** 在一个检查点上训练的 token，换到另一个检查点上漂移严重。LoRA 的可移植性更好。
- **LoRA 权重合并与存储。** 你可以把 LoRA 烘焙进基础模型权重以加速推理（无需运行时加法），但会失去在运行时缩放 `α` 的能力。两个版本都保留。

## 实际应用

| 目标 | 2026 年管线 |
|------|---------------|
| 复现某品牌的艺术风格 | 用约 30 张精选图像训练秩 32 的 LoRA |
| 把我的脸放进生成的图像 | DreamBooth 或 LoRA + IP-Adapter-FaceID |
| 特定姿态 + 提示词 | ControlNet-Openpose + SDXL + 文本 |
| 深度感知构图 | ControlNet-Depth + SD3 |
| 参考图 + 提示词 | IP-Adapter + 文本 |
| 精确布局 | ControlNet-Scribble 或 ControlNet-Canny |
| 背景替换 | ControlNet-Seg + Inpainting（第 09 课） |
| 快速单步风格 | SDXL-Turbo 上的 LCM-LoRA |

## 上线部署

保存 `outputs/skill-sd-toolkit-composer.md`。该技能接受一个任务（输入资产：提示词、可选参考图、可选姿态、可选深度图、可选涂鸦），并输出工具栈、权重和可复现的种子协议。

## 练习

1. **简单。** 在 `code/main.py` 中，把 LoRA 秩 `r` 从 1 变到 4。秩为多少时 LoRA 能精确匹配一个秩 2 的目标增量？
2. **中等。** 在两个目标变换上分别训练两个 LoRA。同时加载它们并展示其加性相互作用。什么时候这种相互作用会打破线性性？
3. **困难。** 使用 diffusers 叠加：SDXL-base + Canny-ControlNet（权重 0.8）+ 一个风格 LoRA（α 0.8）+ IP-Adapter（权重 0.6）。随着叠加权重变化，测量 FID 与提示词符合度之间的权衡。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| ControlNet | “空间控制” | 克隆的编码器 + 零卷积跳跃连接；读取一张条件图像。 |
| Zero convolution | “起始为恒等映射” | 初始化为零的 1×1 卷积；ControlNet 起始为无操作。 |
| LoRA | “低秩适配器” | `W + B @ A`、`r << d`；参数量比全量微调少 100 倍。 |
| rank r | “那个旋钮” | LoRA 压缩；典型为 4-16，重度个性化用 64+。 |
| α | “LoRA 强度” | LoRA 增量的运行时缩放。 |
| IP-Adapter | “参考图” | 通过 CLIP 图像 token 实现的小型图像条件适配器。 |
| DreamBooth | “全量主体微调” | 用约 30 张某主体的图像训练完整模型。 |
| Textual Inversion | “新 token” | 只学习一个新的词嵌入；旧方案，大多已被取代。 |

## 生产提示：LoRA 热切换、ControlNet 通道与多租户服务

一个真实的文生图 SaaS 会在同一个基础检查点上服务数百个 LoRA 和十几个 ControlNet。这个服务问题非常类似于 LLM 的多租户（生产文献在 continuous batching 和 LoRAX / S-LoRA 下讨论了 LLM 的情形）：

- **LoRA 热切换，不要合并。** 把 `W' = W + α·B·A` 合并进基础模型可以使每步推理快约 3-5%，但会冻结 `α` 和基础模型。应将 LoRA 以秩 r 增量的形式热驻留在 VRAM 中；diffusers 提供 `pipe.load_lora_weights()` + `pipe.set_adapters([...], adapter_weights=[...])` 以支持按请求激活。切换成本是 `2 · d · r · num_layers` 权重 —— MB 级，亚秒级。
- **ControlNet 作为第二条注意力通道。** 克隆的编码器与基础模型并行运行。两个权重各为 1.0 的 ControlNet = 每步两次额外前向传播，而不是一次合并的传播。批处理大小余量会二次下降。为每个激活的 ControlNet 预算约 1.5 倍的步进成本。
- **量化 LoRA 也一样。** 如果你量化了基础模型（见第 07 课，8GB 上的 Flux），LoRA 增量也可以干净地量化到 8-bit 或 4-bit。QLoRA 风格的加载方式让你可以在 4-bit 的 Flux 基础上叠加 5-10 个 LoRA 而不会耗尽内存。

Flux 专属说明：Niels 的 Flux-on-8GB notebook 将基础模型量化到 4-bit；在该量化基础上以 `weight_name="pytorch_lora_weights.safetensors"` 叠加一个风格 LoRA（`pipe.load_lora_weights("user/style-lora")`）仍然可行。这是 2026 年大多数 SaaS 机构采用的方案。

## 延伸阅读

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) — ControlNet。
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) — LoRA（最初面向 LLM；后移植到扩散模型）。
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) — IP-Adapter。
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) — 更轻量的 ControlNet 替代方案。
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242) — DreamBooth。
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter docs](https://huggingface.co/docs/diffusers/training/controlnet) — 参考管线。