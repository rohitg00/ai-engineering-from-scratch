# Qwen-VL 家族与动态 FPS 视频

> Qwen-VL 家族——Qwen-VL(2023)、Qwen2-VL(2024)、Qwen2.5-VL(2025)、Qwen3-VL(2025)——是 2026 年最具影响力的开源视觉-语言模型谱系。每一代都做出了一项决定性的架构押注，而开源生态的其他部分在十二个月内纷纷效仿：通过 M-RoPE 实现原生动态分辨率、带绝对时间对齐的动态 FPS 采样、ViT 中的窗口注意力，以及结构化的智能体输出格式。到 Qwen3-VL 时，这套配方已经稳定：一个接受原生宽高比输入的 2D-RoPE-ViT 编码器、一个接入大型 Qwen3 语言底座的 MLP 投影层，以及把 OCR、grounding 和智能体行为作为一等目标加以强调的训练阶段。本课按时间顺序解读这一家族，让你理解每个旋钮为何处于它现在的位置。

**Type:** Learn
**Languages:** Python (stdlib, M-RoPE encoder + dynamic-FPS sampler)
**Prerequisites:** Phase 12 · 06 (patch-n'-pack)
**Time:** ~120 分钟

## 学习目标

- 计算 M-RoPE 的三轴旋转(时间、高度、宽度)，并解释为什么三者缺一不可。
- 为一段视频选择动态 FPS 采样策略，并推理每秒 token 数与事件检测准确率之间的权衡。
- 按顺序说出 Qwen-VL 四代升级，以及每一代实现了什么。
- 接入 Qwen2.5-VL 风格的 JSON 智能体输出格式，并从 VLM 响应中解析结构化工具调用。

## 问题

Qwen-VL 于 2023 年 8 月发布，是对 LLaVA-1.5 和 BLIP-2 的直接回应。Qwen 团队瞄准的差距有三个：分辨率、视频和结构化输出。

分辨率：LLaVA-1.5 以 336x336 运行。对照片尚可，对中文发票或密集的电子表格截图毫无用处。Qwen-VL 的第一项创新是 448x448 分辨率和带 grounding 的边界框输出，让模型能够指向事物。

视频：Video-LLaMA 叠加逐帧编码器并喂给 LLM。这对短视频有效，对时间轴本身才是信号的多分钟视频则无效。Qwen 团队想要一个理解时间的单一编码器。

结构化输出：LLaVA 输出自由格式文本。智能体需要 JSON。Qwen-VL 在显式 JSON 输出格式上训练，包括以文本形式表示的边界框坐标。

Qwen-VL 的每一代都在扩展这三个轴之一。

## 概念

### Qwen-VL(2023 年 8 月)

第一代：OpenCLIP ViT-bigG/14 作为编码器(2.5B 参数)、与 LLama 兼容的 Q-Former(1 步、256 个查询)、Qwen-7B 底座。贡献：

- 448x448 分辨率(当时开源 VLM 的 SOTA)。
- Grounding:在带显式坐标 token 输出的图文对上训练。"The cat is at <box>(112, 204), (280, 344)</box>"。
- 从一开始就是中英双语训练。

当时的基准：英语上与 GPT-4V 相当，中文上占优。grounding 监督才是真正的头条。

### Qwen2-VL(2024 年 9 月)—— M-RoPE 与原生分辨率

Qwen2-VL 用原生动态分辨率的 ViT 编码器取代了固定分辨率 + Q-Former 的堆叠。关键变化：

- 原生动态分辨率。ViT 接受任何可被 28 整除的 HxW(patch 14 加 2x 空间合并)。一张 1120x672(40x24 个合并后 patch)的图像产生 960 个视觉 token。不缩放、不切分、不缩略图。
- M-RoPE(Multimodal RoPE)。每个 token 携带 3D 位置 (t, h, w) 而非 1D。对图像 t=0,对视频 t = frame_index。RoPE 按每个轴一个频率旋转 query/key 向量。没有位置嵌入表。
- MLP 投影层。去掉 Q-Former;对合并后的 patch token 使用 2 层 MLP。
- 动态 FPS 视频。默认以 1-2 FPS 采样视频，但模型接受任意帧数。

结果：Qwen2-VL-7B 在多个多模态基准上与 GPT-4o 持平，并在 DocVQA 上胜出(94.5 对 88.4)。架构改变才是决定性的一步。

### Qwen2.5-VL(2025 年 2 月)—— 动态 FPS + 绝对时间

Qwen2.5-VL 的重大转变在于视频。动态 FPS 不只是“需要时采样更多帧”。论文将其形式化为：

- 绝对时间 token。不用位置索引(第 0、1、2 帧……),而是用真实时间戳。"At 0:04, the cat jumps." 模型看到与帧 token 交错出现的 `<time>0.04</time>` token。
- 动态 FPS。慢节奏画面以 1 FPS 采样，动作场景 4+ FPS。由用户或训练者选择；M-RoPE 自适应。
- ViT 中的窗口注意力。空间注意力被窗口化(块内局部)以提高吞吐；每隔几层做一次全局注意力。
- 显式 JSON 输出格式。在工具调用数据上训练："{\"tool\": \"click\", \"coords\": [380, 220]}"。开箱即用即可做智能体。
- MRoPE-v2 缩放。位置随最大输入尺寸缩放，因此 10 分钟的视频不会耗尽频率范围。

基准：Qwen2.5-VL-72B 在大多数视频基准上击败 GPT-4o,在文档上与 Gemini 2.0 持平，并为 GUI grounding 创下开源模型 SOTA(ScreenSpot:84% 准确率，GPT-4o 为 38%)。

### Qwen3-VL(2025 年 11 月)

Qwen3-VL 是一次巩固而非重塑的渐进升级：更大的 LLM 底座(Qwen3-72B)、扩大的训练数据、改进的 OCR,以及通过 Qwen3 "thinking mode" 实现的更强推理。ViT 和 M-RoPE 保持不变。论文的重点是数据与训练改进，而非架构。

这一谱系的启示：到 2025 年，Qwen-VL 架构已经稳定。后续的世代是在扩展算力和数据，而非原语。

### M-RoPE 的数学

经典 RoPE 使用成对坐标，按位置 `m` 旋转维度为 `d` 的 query `q`:

```
q_rot[2i]   = q[2i]   * cos(m * theta_i) - q[2i+1] * sin(m * theta_i)
q_rot[2i+1] = q[2i]   * sin(m * theta_i) + q[2i+1] * cos(m * theta_i)
theta_i     = 10000^(-2i/d)
```

M-RoPE 将隐藏维度切分为三个波段。设 `d = 96`。把 32 维分配给时间、32 维给高度、32 维给宽度。每个波段按自己的轴位置旋转。位于 (t=5, h=10, w=20) 的 patch 在其三个波段上分别应用旋转 `R_t(5)`、`R_h(10)`、`R_w(20)`。

文本 token 使用 `t = text_index, h = 0, w = 0`(或某个归一化选择)，保持兼容性。视频帧使用 `t = frame_time, h = row, w = col`。单张图像使用 `t = 0`。

好处：一个位置编码即可处理文本、图像和视频，无需分支代码或不同的位置表。

### 动态 FPS 采样逻辑

给定时长为 `T` 秒的视频和目标 token 预算 `B`:

1. 计算你能负担的最大 FPS:`fps_max = B / (T * tokens_per_frame)`。
2. 从 `{1, 2, 4, 8}` 中选择一个满足 `fps <= fps_max` 的目标 FPS。
3. 若运动剧烈(光流启发式或用户显式要求)，选择更高 FPS。若运动平缓，选择更低。
4. 以所选 FPS 均匀采样；在帧之间插入 `<time>t</time>` token。

Qwen2.5-VL 隐式训练了这一逻辑；推理时用户通过 `fps` 参数控制。一段 60 秒的动作序列，4 FPS、每帧 81 个 token = 19440 个 token,在 32k 上下文中可以容纳。

### 结构化智能体输出

Qwen2.5-VL 的智能体训练显式瞄准结构化工具调用：

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

解析是确定性的：对模型输出做 JSON.parse。相比之下，自由格式的 "click at (1024, 512)" 需要正则表达式和歧义处理。这一转变正是 Qwen2.5-VL 的 ScreenSpot 分数从 Qwen2-VL 的 55% 跃升至 84% 的原因。

```figure
mm-mrope-axes
```

## 动手使用

`code/main.py` 实现了：

- 对混合文本、图像 patch 和视频帧的打包序列进行 M-RoPE 位置计算。
- 动态 FPS 采样器：给定 (duration, budget, motion_level),选择 FPS 并输出帧时间戳。
- 一个玩具级的 Qwen2.5-VL JSON 输出解析器，可处理带坐标字段的工具调用响应。

运行它，然后在一段 5 分钟的视频上把固定 FPS 换成动态 FPS,体会其中的差别。

## 交付

本课产出 `outputs/skill-qwen-vl-pipeline-designer.md`。给定一个视频任务(监控、智能体、动作识别、无障碍)，它输出 Qwen2.5-VL 配置(帧预算、FPS 策略、窗口注意力标志、智能体输出模式)以及延迟估计。每当你为视频产品部署 Qwen-VL 家族模型时，都使用它。

## 练习

1. 为位于 (t=3, h=5, w=7)、隐藏维度 48(每波段 16,base theta 10000)的 patch 计算 M-RoPE 旋转。给出每个波段中前三对的旋转角度。

2. 一段 10 分钟、以 1 FPS 采样的监控录像产生多少帧？在 384 分辨率、3x 池化下，总共多少 token?Qwen2.5-VL 默认的 32k 上下文能容纳吗？

3. 为一段 30 秒的网球对打、一段 30 秒的食谱演示和一段 30 秒的 UI 智能体录制分别选择 FPS。用动态 FPS 逻辑为每个选择给出理由。

4. Qwen2.5-VL 完全去掉了 Q-Former。为什么简单的 MLP 在 2025 年可行，而在 2023 年不行？(提示：数据规模和编码器质量。)

5. 将三个 Qwen2.5-VL JSON 工具调用输出解析为 Python 字典。格式错误的 JSON 会导致什么失败？Qwen cookbook 推荐什么恢复策略？

## 关键术语

| 术语 | 人们怎么说 | 它实际是什么 |
|------|-----------------|------------------------|
| M-RoPE | "Multimodal RoPE" | 在隐藏维度中划分时间、高度、宽度波段的 3D 旋转位置编码 |
| Dynamic FPS | "智能采样" | 根据运动、时长和 token 预算为每个视频选择的帧采样率 |
| Absolute time token | "时间戳 token" | 交错在序列中的 `<time>t</time>`,让模型看到的是实际秒数而非帧索引 |
| Window attention | "局部注意力" | 为提速而限制在小窗口内的空间自注意力；周期性地加入全局注意力 |
| Structured agent output | "JSON 模式" | 训练数据监督，教会 VLM 输出带坐标和工具名、可被解析的 JSON |
| min_pixels / max_pixels | "分辨率界限" | Qwen2.5-VL 的按请求控制项，约束总像素数，从而约束 token 数 |
| Grounding | "指哪打哪" | 以文本 token 形式输出边界框坐标；自 Qwen-VL v1 起就有 |

## 延伸阅读

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)