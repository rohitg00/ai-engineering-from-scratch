# ControlNet、LoRA 与条件控制（Conditioning）

> 仅靠文字是一种笨拙的控制信号。ControlNet 让你克隆一个预训练扩散模型，并用深度图、姿态骨架、涂鸦或边缘图像来引导它。LoRA 让你通过训练 1000 万个参数来微调一个 20 亿参数的模型。两者结合，将 Stable Diffusion 从一个玩具变成了 2026 年每家机构都在使用的图像流水线。

**类型：** 构建
**语言：** Python
**前置要求：** 阶段 8 · 07（潜空间扩散），阶段 10（从头实现 LLM——作为 LoRA 的基础）
**时间：** 约 75 分钟

## 问题

像“一位身穿红裙的女人在繁忙街道上遛狗”这样的提示词无法告诉模型狗*在哪里*、女人是什么*姿势*、街道的*视角*如何。文本只能指定你所需图像信息的约 10%。其余部分是视觉的，无法用文字高效描述。

为每种信号（姿态、深度、边缘、分割）从头训练一个新条件模型是不可行的。你希望保持 2.6B 参数的 SDXL 骨干网络冻结，附加一个读取条件信号的小型侧网络，让它微调骨干网络的中间特征。这就是 ControlNet。

你还希望教会模型新概念（你的脸、你的产品、你的风格），而无需重新训练整个模型。你希望 delta 小 100 倍。这就是 LoRA——插入现有注意力权重的低秩适配器。

ControlNet + LoRA + 文本 = 2026 年实践者的工具包。大多数生产级图像流水线会在 SDXL/SD3/Flux 基础模型上叠加 2-5 个 LoRA、1-3 个 ControlNet 和一个 IP-Adapter。

## 概念

![ControlNet 克隆编码器；LoRA 添加低秩增量](../assets/controlnet-lora.svg)

### ControlNet（Zhang 等人，2023）

获取一个预训练的 SD。*克隆* U-Net 的编码器部分。冻结原始编码器。训练克隆版本接收额外的条件输入（边缘、深度、姿态）。通过*零卷积*跳跃连接（初始化为零的 1×1 卷积——开始时无操作，学习 delta）将克隆版本连接回原始编码器的解码器部分。

```
SD U-Net 解码器：... ← orig_enc_features + zero_conv(controlnet_enc(条件))
```

零卷积初始化意味着 ControlNet 一开始是恒等变换——即使在训练前也不会造成破坏。在 100 万个（提示词、条件、图像）三元组上使用标准扩散损失进行训练。

每种模态的 ControlNet 以小型侧模型发布（SDXL 约 360M，SD 1.5 约 70M）。你可以在推理时组合它们：

```
features += weight_a * control_a(深度) + weight_b * control_b(姿态)
```

### LoRA（Hu 等人，2021）

对于模型中任何线性层 `W ∈ R^{d×d}`，冻结 `W` 并添加一个低秩增量：

```
W' = W + ΔW,  ΔW = B @ A,  A ∈ R^{r×d},  B ∈ R^{d×r}
```

其中 `r << d`。注意力层通常用秩 4-16，重度微调用秩 64-128。新增参数量：`2 · d · r` 而不是 `d²`。对于 `d=640` 的 SDXL 注意力层，`r=16`：每个适配器 2 万参数，而不是 41 万——减少了 20 倍。在整个模型上：一个 LoRA 通常为 20-200MB，而基础模型为 5GB。

推理时你可以缩放 LoRA：`W' = W + α · B @ A`。`α = 0.5-1.5` 是正常范围。多个 LoRA 可以相加堆叠（通常的注意事项是它们会以非线性方式相互作用）。

### IP-Adapter（Ye 等人，2023）

一个微型适配器，接受*图像*作为条件（与文本一起）。使用 CLIP 图像编码器生成图像 token，并将其与文本 token 一起注入交叉注意力。每个基础模型约 20MB。它让你无需 LoRA 就能实现“以此参考图像的风格生成图像”。

## 组合性矩阵

| 工具               | 控制的内容             | 大小       | 使用场景                         |
|-------------------|----------------------|-----------|--------------------------------|
| ControlNet        | 空间结构（姿态、深度、边缘） | 70-360MB  | 精确布局、构图                   |
| LoRA              | 风格、主体、概念        | 20-200MB  | 个性化、风格                     |
| IP-Adapter        | 来自参考图像的风格或主体  | 20MB      | 无法用文字描述外观               |
| 文本反转（Textual Inversion） | 单个概念作为新的 token | 10KB      | 遗留技术，大多已被 LoRA 替代      |
| DreamBooth        | 对主体进行全微调        | 2-5GB     | 强身份保持、高计算需求            |
| T2I-Adapter       | 更轻量的 ControlNet 替代方案 | 70MB      | 边缘设备、推理预算受限             |

ControlNet ≈ 空间控制。LoRA ≈ 语义控制。两者一起使用。

## 构建它

`code/main.py` 在一维上模拟了这两种机制：

1. **LoRA。** 一个预训练的线性层 `W`。冻结它。训练一个低秩 `B @ A`，使得 `W + BA` 匹配目标线性层。证明 `r = 1` 足以完美学习一个秩为 1 的修正。

2. **轻量版 ControlNet。** 一个“冻结的基础”预测器和一个读取额外信号的“侧网络”。侧网络的输出由一个初始化为零的可学习标量门控（我们版本的零卷积）。训练并观察门控逐渐增大。

### 步骤 1：LoRA 数学

```python
def lora(W, A, B, x, alpha=1.0):
    # W 被冻结；A、B 是可训练的低秩因子。
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### 步骤 2：零初始化侧网络

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate 初始化为 0
h = base(x) + gated
```

在第 0 步，输出与基础输出完全相同。早期训练会缓慢更新 `gate`——不会发生灾难性漂移。

## 陷阱

- **LoRA 过度缩放。** `α = 2` 或 `α = 3` 是一种常见的“让它更强”的 hack，会导致过度风格化/损坏的输出。保持 `α ≤ 1.5`。
- **ControlNet 权重冲突。** 同时使用权重 1.0 的姿态 ControlNet 和权重 1.0 的深度 ControlNet 通常会过冲。建议所有权重之和 ≈ 1.0。
- **在错误的基础模型上使用 LoRA。** 在 SD 1.5 上加载 SDXL LoRA 会静默失败，因为注意力维度不匹配。Diffusers 在 0.30+ 版本中会发出警告。
- **文本反转漂移。** 在一个 checkpoint 上训练得到的 token 在另一个 checkpoint 上会严重漂移。LoRA 更可移植。
- **LoRA 权重合并与存储。** 你可以将 LoRA 合并到基础模型权重中以加速推理（无需运行时加法），但会失去在运行时缩放 `α` 的能力。建议保留两个版本。

## 使用它

| 目标                           | 2026 年流水线                                    |
|-------------------------------|-------------------------------------------------|
| 复现品牌的艺术风格             | 在约 30 张精选图像上训练秩为 32 的 LoRA         |
| 将我的脸放入生成的图像中       | DreamBooth 或 LoRA + IP-Adapter-FaceID          |
| 特定姿态 + 提示词              | ControlNet-Openpose + SDXL + 文本               |
| 深度感知构图                   | ControlNet-Depth + SD3                          |
| 参考图像 + 提示词              | IP-Adapter + 文本                               |
| 精确布局                       | ControlNet-Scribble 或 ControlNet-Canny         |
| 背景替换                       | ControlNet-Seg + 修复（第 09 课）                |
| 快速 1 步风格生成              | 在 SDXL-Turbo 上使用 LCM-LoRA                   |

## 部署它

保存 `outputs/skill-sd-toolkit-composer.md`。技能获取任务（输入资产：提示词、可选的参考图像、可选的姿态、可选的深度、可选的涂鸦）并输出工具栈、权重以及可复现的种子协议。

## 练习

1. **简单。** 在 `code/main.py` 中，将 LoRA 秩 `r` 从 1 变化到 4。在哪个秩时 LoRA 能完全匹配一个秩为 2 的目标 delta？
2. **中等。** 分别训练两个 LoRA，对应两个目标变换。将它们一起加载并展示它们的加性交互。在什么情况下交互会打破线性？
3. **困难。** 使用 diffusers 堆叠：SDXL-base + Canny-ControlNet（权重 0.8）+ 一个风格 LoRA（α 0.8）+ IP-Adapter（权重 0.6）。随着堆叠权重的变化，测量 FID 与提示词遵从度之间的权衡。

## 关键术语

| 术语                   | 人们通常说的                          | 实际含义                                                                 |
|-----------------------|-------------------------------------|------------------------------------------------------------------------|
| ControlNet            | “空间控制”                          | 克隆编码器 + 零卷积跳跃连接；读取条件图像。                                 |
| 零卷积（Zero convolution） | “从恒等开始”                       | 初始化为零的 1×1 卷积；ControlNet 开始时无操作。                           |
| LoRA                  | “低秩适配器”                         | `W + B @ A`，`r << d`；参数量比全微调少 100 倍。                         |
| 秩 r（rank r）         | “调节旋钮”                          | LoRA 压缩程度；典型值 4-16，重度个性化时 64 以上。                         |
| α                     | “LoRA 强度”                         | LoRA delta 的运行时缩放系数。                                             |
| IP-Adapter            | “参考图像”                           | 通过 CLIP-图像 token 的小型图像条件适配器。                                |
| DreamBooth            | “完全主体微调”                       | 在约 30 张主体图像上训练整个模型。                                        |
| 文本反转（Textual Inversion） | “新 token”                      | 仅学习一个新的词嵌入；遗留技术，大多已被替代。                             |

## 生产环境要点：LoRA 热切换、ControlNet 通道、多租户服务

一个真实的文本到图像 SaaS 服务会在同一个基础 checkpoint 上提供数百个 LoRA 和十几个 ControlNet。其服务问题与 LLM 的多租户非常相似（生产文献中在连续批处理和 LoRAX/S-LoRA 下介绍了 LLM 案例）：

- **热切换 LoRA，不要合并。** 将 `W' = W + α·B·A` 合并到基础模型中会使每步推理加速约 3-5%，但会冻结 `α` 和基础模型。将 LoRA 以秩 r 增量的形式保持在 VRAM 中；diffusers 通过 `pipe.load_lora_weights()` + `pipe.set_adapters([...], adapter_weights=[...])` 支持按请求激活。切换代价是 `2 · d · r · num_layers` 的权重——MB 级别，亚秒级。
- **ControlNet 作为第二个注意力通道。** 克隆的编码器与基础编码器并行运行。每个权重 1.0 的两个 ControlNet 意味着每一步有两次额外的前向传播，而不是一次合并的前向。批大小空间会二次下降。每个活跃的 ControlNet 大约额外消耗 1.5 倍的步骤成本。
- **量化 LoRA 同样可行。** 如果你已经量化了基础模型（见第 07 课，Flux 在 8GB 上运行），LoRA delta 也能干净地量化到 8-bit 或 4-bit。使用 QLoRA 风格的加载，你可以在 4-bit Flux 基础模型上堆叠 5-10 个 LoRA 而不会耗尽内存。

Flux 特例：Niels 的 Flux-on-8GB notebook 将基础模型量化到 4-bit；在该量化基础模型上通过 `pipe.load_lora_weights("user/style-lora")` 并在 `weight_name="pytorch_lora_weights.safetensors"` 下堆叠一个风格 LoRA 仍然有效。这就是大多数 SaaS 机构在 2026 年部署的配方。

## 延伸阅读

- [Zhang, Rao, Agrawala (2023). Adding Conditional Control to Text-to-Image Diffusion Models](https://arxiv.org/abs/2302.05543) — ControlNet.
- [Hu et al. (2021). LoRA: Low-Rank Adaptation of Large Language Models](https://arxiv.org/abs/2106.09685) — LoRA（最初用于 LLMs；移植到扩散模型）。
- [Ye et al. (2023). IP-Adapter: Text Compatible Image Prompt Adapter](https://arxiv.org/abs/2308.06721) — IP-Adapter.
- [Mou et al. (2023). T2I-Adapter: Learning Adapters to Dig Out More Controllable Ability](https://arxiv.org/abs/2302.08453) — ControlNet 的轻量级替代方案。
- [Ruiz et al. (2023). DreamBooth: Fine Tuning Text-to-Image Diffusion Models for Subject-Driven Generation](https://arxiv.org/abs/2208.12242) — DreamBooth.
- [HuggingFace Diffusers — ControlNet / LoRA / IP-Adapter 文档](https://huggingface.co/docs/diffusers/training/controlnet) — 参考流水线。