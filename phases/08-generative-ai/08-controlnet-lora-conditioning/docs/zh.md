# 08 · ControlNet、LoRA 与条件控制

> 单凭文本是一种笨拙的控制信号。「ControlNet」让你克隆一个预训练扩散模型，并用深度图、姿态骨架、涂鸦或边缘图来引导它。「LoRA」让你只训练 1000 万个参数，就能微调一个 20 亿参数的模型。两者结合，把 Stable Diffusion 从玩具变成了 2026 年每家代理机构都在交付的图像生产管线。

**类型：** 构建（Build）
**语言：** Python
**前置：** 阶段 8 · 07（潜在扩散，Latent Diffusion）、阶段 10（从零构建大语言模型 LLM——为 LoRA 打基础）
**时长：** 约 75 分钟

## 问题所在

像「a woman in a red dress walking a dog on a busy street」这样的提示词，并没有告诉模型狗*在哪里*、女人*摆什么姿势*、街道*用什么视角*。文本只能锁定你想要指定的图像内容的约 10%，剩下的都是视觉信息，无法用文字高效描述。

为每一种信号（姿态、深度、Canny 边缘、分割）都从零训练一个全新的条件模型，代价高得离谱。你希望保持 26 亿参数的 SDXL 主干「冻结（frozen）」，挂上一个读取条件信息的小型旁路网络（side-network），让它去微调主干的中间特征。这就是 ControlNet。

你还希望在不重训整个模型的前提下，教会模型新概念（你的脸、你的产品、你的风格）。你想要一个小 100 倍的增量。这就是 LoRA——插入到现有注意力权重里的低秩适配器（low-rank adapter）。

ControlNet + LoRA + 文本 = 2026 年从业者的工具箱。多数生产级图像管线会在 SDXL / SD3 / Flux 基座之上叠加 2-5 个 LoRA、1-3 个 ControlNet，再加一个 IP-Adapter。

## 核心概念

〔图：ControlNet 克隆编码器，LoRA 添加低秩增量〕

### ControlNet（Zhang 等，2023）

取一个预训练的 SD，*克隆* U-Net 的编码器（encoder）那一半，冻结原始部分。训练这个克隆体，让它接受一个额外的条件输入（边缘、深度、姿态）。用*零卷积（zero-convolution）*跳跃连接（初始化为零的 1×1 卷积——一开始是恒等操作，随后学习一个增量）把克隆体接回原始模型的解码器（decoder）那一半。

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

零卷积初始化意味着 ControlNet 起始时就是恒等映射——即便训练前接上也无害。在 100 万条（提示词、条件、图像）三元组上，用标准扩散损失进行训练。

各模态的 ControlNet 以小型旁路模型形式发布（SDXL 约 360M，SD 1.5 约 70M）。你可以在推理时组合它们：

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA（Hu 等，2021）

对模型中任意线性层 `W ∈ R^{d×d}`，冻结 `W` 并加上一个低秩增量：

```
W' = W + ΔW,  ΔW = B @ A,  A ∈ R^{r×d},  B ∈ R^{d×r}
```

其中 `r << d`。注意力层常用秩（rank）4-16，重度微调用秩 64-128。新增参数数量为 `2 · d · r`，而非 `d²`。以 `d=640`、`r=16` 的 SDXL 注意力为例：每个适配器只需 20k 参数，而非 410k——缩减 20 倍。在整个模型上：一个 LoRA 通常为 20-200MB，而基座为 5GB。

推理时你可以缩放 LoRA：`W' = W + α · B @ A`。`α = 0.5-1.5` 是正常范围。多个 LoRA 可加性叠加（但要注意它们之间会以非线性方式相互作用这一惯常告诫）。

### IP-Adapter（Ye 等，2023）

一个微型适配器，接受一张*图像*作为条件（与文本并行）。它用 CLIP 图像编码器生成图像 token，与文本 token 一起注入到交叉注意力（cross-attention）中。每个基座模型约 20MB。它让你无需 LoRA 就能做到「按这张参考图的风格生成图像」。

## 可组合性矩阵

| 工具 | 控制什么 | 大小 | 何时使用 |
|------|------------------|------|-------------|
| ControlNet | 空间结构（姿态、深度、边缘） | 70-360MB | 精确布局、构图 |
| LoRA | 风格、主体、概念 | 20-200MB | 个性化、风格 |
| IP-Adapter | 来自参考图的风格或主体 | 20MB | 没有文字能描述出那种观感 |
| Textual Inversion | 把单个概念作为一个新 token | 10KB | 遗留方案，大多已被 LoRA 取代 |
| DreamBooth | 针对某主体做完整微调 | 2-5GB | 强身份一致性、高算力 |
| T2I-Adapter | 更轻量的 ControlNet 替代品 | 70MB | 边缘设备、推理预算紧张 |

ControlNet ≈ 空间控制。LoRA ≈ 语义控制。两者并用。

## 动手构建

`code/main.py` 在一维上模拟这两种机制：

1. **LoRA。** 一个预训练线性层 `W`，冻结它。训练一个低秩的 `B @ A`，使得 `W + BA` 匹配一个目标线性层。展示 `r = 1` 就足以完美学习一个秩 1 的修正。

2. **ControlNet-lite。** 一个「冻结基座」预测器，和一个读取额外信号的「旁路网络」。旁路网络的输出由一个可学习标量门控，该标量初始化为零（这是我们版本的零卷积）。训练并观察门控逐步上升。

### 第 1 步：LoRA 数学

```python
def lora(W, A, B, x, alpha=1.0):
    # W 被冻结；A、B 是可训练的低秩因子。
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### 第 2 步：零初始化旁路网络

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate 初始化为 0
h = base(x) + gated
```

在第 0 步，输出与基座完全一致。早期训练会缓慢更新 `gate`——不会发生灾难性漂移。

## 常见坑

- **LoRA 缩放过头。** `α = 2` 或 `α = 3` 是常见的「让它更强一点」的偷懒做法，会产生过度风格化／崩坏的输出。保持 `α ≤ 1.5`。
- **ControlNet 权重冲突。** 把姿态 ControlNet 设为权重 1.0、深度 ControlNet 也设为权重 1.0，通常会过冲。权重之和 ≈ 1.0 是安全的默认值。
- **LoRA 用错基座。** SDXL 的 LoRA 在 SD 1.5 上会悄无声息地变成空操作，因为注意力维度不匹配。diffusers 在 0.30+ 会给出警告。
- **Textual Inversion 漂移。** 在某个检查点上训练的 token，换到另一个检查点上会严重漂移。LoRA 的可移植性更好。
- **LoRA 权重合并与存储。** 你可以把 LoRA 烘焙进基座模型权重以加快推理（运行时无需相加），但会失去在运行时缩放 `α` 的能力。两个版本都保留。

## 如何使用

| 目标 | 2026 年管线 |
|------|---------------|
| 复刻某品牌的美术风格 | 在约 30 张精选图像上以秩 32 训练的 LoRA |
| 把我的脸放进生成图像里 | DreamBooth，或 LoRA + IP-Adapter-FaceID |
| 指定姿态 + 提示词 | ControlNet-Openpose + SDXL + 文本 |
| 深度感知构图 | ControlNet-Depth + SD3 |
| 参考图 + 提示词 | IP-Adapter + 文本 |
| 精确布局 | ControlNet-Scribble 或 ControlNet-Canny |
| 背景替换 | ControlNet-Seg + 图像修复（Inpainting，第 09 课） |
| 快速单步出风格 | 在 SDXL-Turbo 上用 LCM-LoRA |

## 交付物

保存 `outputs/skill-sd-toolkit-composer.md`。该技能接收一个任务（输入素材：提示词、可选参考图、可选姿态、可选深度、可选涂鸦），输出工具栈、各项权重，以及一套可复现的种子（seed）协议。

## 练习

1. **简单。** 在 `code/main.py` 中，把 LoRA 的秩 `r` 从 1 变到 4。在哪个秩下，LoRA 能精确匹配一个秩 2 的目标增量？
2. **中等。** 在两个目标变换上分别训练两个 LoRA。把它们一起加载，展示其可加性的相互作用。在什么情况下，这种相互作用会破坏线性？
3. **困难。** 用 diffusers 叠加：SDXL-base + Canny-ControlNet（权重 0.8）+ 一个风格 LoRA（α 0.8）+ IP-Adapter（权重 0.6）。在各项栈权重变化时，测量 FID 与提示词遵循度之间的权衡。

## 关键术语

| 术语 | 人们怎么说 | 它实际是什么 |
|------|-----------------|-----------------------|
| ControlNet | 「空间控制」 | 克隆编码器 + 零卷积跳跃连接；读取一张条件图像。 |
| 零卷积（Zero convolution） | 「起始即恒等」 | 初始化为零的 1×1 卷积；ControlNet 起始为空操作。 |
| LoRA | 「低秩适配器」 | `W + B @ A`，`r << d`；参数比完整微调少 100 倍。 |
| 秩 r（rank r） | 「那个旋钮」 | LoRA 的压缩程度；常用 4-16，重度个性化用 64+。 |
| α | 「LoRA 强度」 | LoRA 增量在运行时的缩放系数。 |
| IP-Adapter | 「参考图像」 | 通过 CLIP 图像 token 做小型图像条件控制的适配器。 |
| DreamBooth | 「完整主体微调」 | 在某主体约 30 张图像上训练整个模型。 |
| Textual Inversion | 「新 token」 | 仅学习一个新的词嵌入；遗留方案，大多已被取代。 |

## 生产笔记：LoRA 热插拔、ControlNet 通道、多租户服务

一个真实的文生图 SaaS 会在同一个基座检查点之上服务数百个 LoRA 和十几个 ControlNet。这一服务问题与 LLM 多租户非常相似（生产文献中，LLM 这一情形归在连续批处理与 LoRAX / S-LoRA 之下）：

- **热插拔 LoRA，不要合并。** 把 `W' = W + α·B·A` 合并进基座，能让每步推理快约 3-5%，但会冻结 `α` 和基座。把 LoRA 作为秩 r 的增量热驻留在显存里；diffusers 暴露了 `pipe.load_lora_weights()` + `pipe.set_adapters([...], adapter_weights=[...])`，用于按请求逐个激活。切换成本就是 `2 · d · r · num_layers` 个权重——MB 量级、亚秒级。
- **ControlNet 作为第二条注意力通道。** 克隆出的编码器与基座并行运行。两个权重均为 1.0 的 ControlNet = 每步多出两次前向，而非一次合并的前向。批大小（batch-size）余量呈二次方下降。每激活一个 ControlNet，按约 1.5 倍的每步成本来预算。
- **LoRA 也可以量化。** 如果你把基座量化了（见第 07 课，8GB 上的 Flux），LoRA 增量也能干净地量化到 8-bit 或 4-bit。QLoRA 风格的加载方式让你能在一个 4-bit Flux 基座之上叠加 5-10 个 LoRA 而不爆显存。

Flux 专属：Niels 的「Flux-on-8GB」notebook 把基座量化到 4-bit；在该量化基座上以 `weight_name="pytorch_lora_weights.safetensors"` 叠加一个风格 LoRA（`pipe.load_lora_weights("user/style-lora")`）依然可行。这正是 2026 年大多数 SaaS 代理机构在交付的配方。

## 延伸阅读

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543)——ControlNet。
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685)——LoRA（最初为 LLM 提出；可移植到扩散模型）。
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721)——IP-Adapter。
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453)——比 ControlNet 更轻量的替代品。
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242)——DreamBooth。
- [HuggingFace Diffusers——ControlNet / LoRA / IP-Adapter 文档](https://huggingface.co/docs/diffusers/training/controlnet)——参考管线。
