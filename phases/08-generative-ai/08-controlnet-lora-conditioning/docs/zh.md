# ControlNet, LoRA & Conditioning

> 单独使用文本是一个笨拙的控制信号。Control Net允许您克隆预先训练的扩散模型，并使用深度图、姿势骨架、涂鸦或边缘图像来操纵它。LoRA允许您通过训练1000万个参数来微调2B参数模型。他们共同将Stable Distance从一个玩具变成了2026年的形象管道，并在每个机构提供。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 第8阶段· 07（潜在扩散）、第10阶段（Scratch的LLM-用于LoRA基金会）
** 时间：** ~75分钟

## The Problem

像“一个穿红裙子的女人在繁忙的街道上遛狗”这样的提示不会给模特提供有关 * 狗在哪里 *、* 女人处于什么姿势 * 或 * 街道的视角 * 的信息。文本固定了指定图像所需内容的约10%。其余的是视觉上的，无法用言语有效地描述。

针对每个信号（姿势、深度、精明、分割）从头开始训练新的条件模型是令人望而却步的。您想要保持2. 6 B-param SDXL主干冻结，连接一个读取条件处理的小侧网络，并让它推动主干的中间功能。那就是控制网。

您还想在不重新训练完整模特的情况下教授模特新概念（你的脸、你的产品、你的风格）。您需要一个小100倍的Delta。这就是LoRA --插入现有注意力权重的低级适配器。

Control Net + LoRA + text = 2026年从业者工具包。大多数生产图像管道层为2-5个LoRA、1-3个Control Nets和一个位于SDXL /SD 3/ Flux底座之上的IP适配器。

## The Concept

![ControlNet clones the encoder; LoRA adds low-rank deltas](../assets/controlnet-lora.svg)

### ControlNet (Zhang et al., 2023)

接受预先训练的SD。* 克隆 * U-Net的编码器一半。冻结原件。训练克隆人接受额外的条件输入（边缘、深度、姿势）。使用 * 零卷积 * 跳过连接将克隆连接回原始的解码器一半（将1 x 1 convs初始化为零-作为无操作开始，学习增量）。

```
SD U-Net decoder:   ... ← orig_enc_features + zero_conv(controlnet_enc(condition))
```

Zero-conv initit意味着控制网络从身份开始-即使在训练之前也没有伤害。1 M（提示、条件、图像）上的训练是标准扩散损失的三倍。

按模式控制Nets作为小号侧模型发货（SDXL约360 M，SD 1.5约70 M）。您可以在推理时将它们组合起来：

```
features += weight_a * control_a(depth) + weight_b * control_b(pose)
```

### LoRA (Hu et al., 2021)

对于模型中的任何线性层“W ei R^{d x d}”，冻结“W”并添加低阶增量：

```
W' = W + ΔW,  ΔW = B @ A,  A ∈ R^{r×d},  B ∈ R^{d×r}
```

带有' r << d '。4-16级是注意力的标准，64-128级是重微调的标准。新参数的数量：“2 · d · r”而不是“d²”。对于SDXL的注意力为“d=640”，“r=16”：每个适配器20 k个参数，而不是410 k-减少了20倍。整个模型中：LoRA通常为20- 200 MB，而基本为5 GB。

推断您可以扩展LoRA：“W”= W + a· B @ A '。“a = 0.5-1.5”是正常的。多个LoRA叠加叠加（通常需要注意的是它们以非线性方式相互作用）。

### IP-Adapter (Ye et al., 2023)

一个微型适配器，接受 * 图像 * 作为条件反射（与文本一起）。使用CLIP图像编码器生成图像令牌，将它们与文本令牌一起注入交叉注意。每个基本型号~ 20 MB。允许您在没有LoRA的情况下“以此参考的风格生成图像”。

## Composability matrix

| 工具 | 它控制什么 | 大小 | 何时使用 |
|------|------------------|------|-------------|
| ControlNet | 空间结构（姿势、深度、边缘） | 70- 360 MB | 精确的布局、构图 |
| Lora | 风格、主题、概念 | 20-200MB | 个性化、风格 |
| IP适配器 | 参考图像的风格或主题 | 20MB | 没有文字可以描述外观 |
| 文本倒置 | 单一概念作为新代币 | 10KB | Legacy，大部分被LoRA取代 |
| 梦想展位 | 对某个主题进行全面微调 | 2- 5 GB | 身份认同感强，计算能力强 |
| T2 I-适配器 | 更轻的ControlNet替代品 | 70MB | 边缘设备、推理预算 |

控制网络扩展空间。LoRA删除语义。两个都用。

## Build It

' code/main.py '在1-D上模拟了两种机制：

1. ** 洛拉。**预先训练的线性层“W”。冻结它。训练低级别“B @ A”，使“W + BA”匹配目标线性层。表明“r = 1”足以完美地学习1级纠正。

2. ** Control Net-Lite。**“冻结基础”预测器和读取额外信号的“侧网络”。侧网络的输出由初始化为零的可学习的纯量（我们的zero-conv版本）选通。训练并观看大门上升。

### Step 1: LoRA math

```python
def lora(W, A, B, x, alpha=1.0):
    # W is frozen; A, B are the trainable low-rank factors.
    return [W[i][j] * x[j] for i, j in ...] + alpha * (B @ (A @ x))
```

### Step 2: zero-init side network

```python
side_out = control_net(x, condition)
gated = gate * side_out  # gate initialized to 0
h = base(x) + gated
```

在第0步，输出与基本相同。早期训练缓慢更新“门”--没有灾难性的漂移。

## Pitfalls

- ** 过度扩展LoRA。**“a = 2”或“a = 3”是一种常见的“让它更强大”黑客，会产生过于风格化/破碎的输出。保持“a ''。
- ** 控制净权重冲突。**使用权重为1.0的Pose Control Net和权重为1.0的Depth Control Net通常会过度。权重和ð1.0是安全默认值。
- **LoRA找错了基地。** SDXL LoRA在SD 1.5上默默不操作，因为注意力维度不匹配。扩散器将在0.30+内发出警告。
- ** 文本倒置漂移。**在一个检查站训练的代币在另一个检查站上严重漂移。LoRA更便携。
- **LoRA权重合并和存储。**您可以将LoRA烘焙到基本模型权重中以实现更快的推理（无需运行时添加），但您将失去在运行时缩放“a”的能力。保留两个版本。

## Use It

| 目标 | 2026年管道 |
|------|---------------|
| 再现品牌的艺术风格 | LoRA对约30张排名32的策展图像进行训练 |
| 将我的脸放入生成的图像中 | DreamBooth或LoRA + IP适配器-FaceID |
| 特定姿势+提示 | Control Net-Openpose + SDXL +文本 |
| 深度感知构图 | 控制网络深度+SD 3 |
| 参考+提示 | IP适配器+文本 |
| 精确布局 | Control Net-Scribble或Control Net-Canny |
| 背景替换 | ControlNet-Seg +修复（第09课） |
| 快速一步风格 | SDXL-Turbo上的LCM-LoRA |

## Ship It

保存“输出/skill-sd-toolkit-composer.md”。Skill接受一个任务（输入资源：提示、可选参考图像、可选姿势、可选深度、可选涂鸦），并输出工具堆栈、权重和可重现的种子协议。

## Exercises

1. ** 简单。**在“code/main.py”中，将LoRA等级“r”从1更改为4。LoRA在什么级别上与2级目标Delta完全匹配？
2. ** 中等。**在两个目标转换上训练两个单独的LoRA。将它们加载在一起并显示它们的相加相互作用。相互作用何时会打破线性？
3. ** 很难。**使用扩散器堆叠：SDXL-base + Canny-Control Net（重量0.8）+风格LoRA（a0.8）+IP-适配器（重量0.6）。随着堆栈重量的变化，测量DID与预算遵守性的权衡。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| ControlNet | “空间控制” | 克隆编码器+ zero-conv跳过;读取条件反射图像。 |
| 零卷积 | “从身份开始” | 1 x 1 conv初始化为零; ControlNet以无操作方式启动。 |
| Lora | “低级适配器” | ' W + B @ A '，' r << d ';参数比完整微调少100倍。 |
| 秩r | “旋钮” | LoRA压缩; 4-16典型，64+用于重度个性化。 |
| α | “LoRA实力” | LoRA三角洲的扩展。 |
| IP适配器 | “参考图像” | 通过CLIP图像令牌的小型图像调节适配器。 |
| 梦想展位 | “全主题微调” | 在某个主题的~30张图像上训练完整模型。 |
| 文本倒置 | “新代币” | 仅学习新单词嵌入;遗产，大部分被替换。 |

## Production note: LoRA swaps, ControlNet lanes, multi-tenant serving

真正的文本到图像SaaS通过同一基本检查点为数百个LoRA和十几个Control Net提供服务。服务问题看起来很像LLM多租户（制作文献涵盖了连续RST和LoRAX / S-LoRA下的LLM案例）：

- ** 热交换LoRA，不合并。**将“W”= W + a·B·A '合并到碱基中，每步推理速度可提高约3-5%，但会冻结“a '和碱基。将LoRA保持在VRAM中的热状态，作为rank-r增量;扩散器暴露' pipe. put_lora_weights（）'+' pipe.set_adapters（[.]，adapter_weights=[.]）'用于按请求激活。互换成本是“2 · d · r · num_layers”权重-MB规模，次秒。
- ** 控制网络作为第二注意通道。**克隆的编码器与底座并行运行。两个每个重量为1.0的Control Net =每步额外两次向前传递，而不是一次合并传递。批量大小的裕度呈二次下降。每个活动控制网络的预算约为1.5倍步骤成本。
- ** 也量化了LoRA。**如果您量化基本（请参阅第07课，8 GB上的Flux），LoRA delta也会干净地量化为8位或4位。QLoRA风格的加载可以让您在4位Flux Base上堆叠5-10个LoRA，而不会耗尽内存。

通量特定：Niels的Flux-on-8 GB笔记本将底座量化为4位;在' weight_Name=' pytorch_lora_weights.safetensors '处的量化底座上堆叠样式LoRA（'）'仍然有效。这是大多数SaaS机构在2026年推出的食谱。

## Further Reading

- [Zhang，Rao，Agrawala（2023）。将条件控制添加到文本到图像扩散模型]（https：//arxiv.org/ab/2302.05543）- ControlNet。
- [Hu等人（2021）。LoRA：大型语言模型的低等级适应]（https：//arxiv.org/ab/2106.09685）- LoRA（最初用于LLM;移植到扩散）。
- [Ye等人（2023）。IP-适配器：文本兼容图像提示适配器]（https：//arxiv.org/ab/2308.06721）-IP-适配器。
- [Mou等人（2023）。T2 I-适配器：学习适配器，挖掘更多可控能力]（https：//arxiv.org/abs/2302.08453）-更轻的控制Net替代品。
- [Ruiz等人（2023）。DreamBooth：微调用于主题驱动生成的文本到图像扩散模型]（https：//arxiv.org/ab/2208.12242）- DreamBooth。
- [HuggingFace扩散器- ControlNet / LoRA /IP-Adaptator docs]（https：//huggingface.co/docs/diffusers/training/controlnet）-参考管道。
