# 09 · Qwen-VL 家族与动态 FPS 视频

> Qwen-VL 家族——Qwen-VL（2023）、Qwen2-VL（2024）、Qwen2.5-VL（2025）、Qwen3-VL（2025）——是 2026 年最具影响力的开源视觉语言模型谱系。每一代都押注了一个决定性的架构选择，而整个开源生态会在十二个月内将其复制：通过 M-RoPE 实现的原生动态分辨率（native dynamic resolution）、带绝对时间对齐的动态 FPS 采样（dynamic-FPS sampling）、ViT 中的窗口注意力（window attention），以及结构化的智能体（agent）输出格式。到 Qwen3-VL 时，这套配方已趋于稳定：一个采用 2D-RoPE 的 ViT 编码器、接受原生宽高比输入，一个把视觉特征投射到庞大 Qwen3 语言基座的 MLP 投影器（projector），以及把 OCR、定位（grounding）和智能体行为作为头等训练目标的训练阶段。本课按时间顺序解读这个家族，让你理解每一个旋钮为何处在它现在的位置。

**类型：** 学习
**语言：** Python（标准库，M-RoPE 编码器 + 动态 FPS 采样器）
**前置：** 阶段 12 · 06（patch-n'-pack）
**时长：** 约 120 分钟

## 学习目标

- 计算 M-RoPE 的三轴旋转（时间、高度、宽度），并解释为什么三者缺一不可。
- 为一段视频选择一种动态 FPS 采样策略，并就「每秒 token 数」与「事件检测准确率」之间的权衡进行推理。
- 按顺序说出 Qwen-VL 的四代升级，以及每一代各自带来了什么。
- 搭建一个 Qwen2.5-VL 风格的 JSON 智能体输出格式，并从 VLM 响应中解析出结构化的工具调用（tool call）。

## 问题所在

Qwen-VL 于 2023 年 8 月发布，是对 LLaVA-1.5 和 BLIP-2 的直接回应。Qwen 团队瞄准的差距有三方面：分辨率、视频和结构化输出。

分辨率：LLaVA-1.5 运行在 336x336。这对照片够用，但对一张中文发票或一张密集的电子表格截图毫无用处。Qwen-VL 的第一个创新是 448x448 分辨率和带定位的边界框（bounding-box）输出，让模型能够「指出」事物的位置。

视频：Video-LLaMA 把逐帧编码器堆叠起来再喂给大语言模型（LLM）。这对短片段有效，但对那些以时间轴为信号的数分钟长视频则无能为力。Qwen 团队想要一个能理解时间的单一编码器。

结构化输出：LLaVA 输出自由格式的文本。而智能体需要 JSON。Qwen-VL 在显式的 JSON 输出格式上进行训练，其中包含以文本形式表示的边界框坐标。

Qwen-VL 的每一代都在扩展这三条轴中的某一条。

## 核心概念

### Qwen-VL（2023 年 8 月）

第一代：以 OpenCLIP ViT-bigG/14 作为编码器（2.5B 参数）、LLaMA 兼容的 Q-Former（单步、256 个 query）、Qwen-7B 基座。主要贡献：

- 448x448 分辨率（当时开源 VLM 的 SOTA）。
- 定位（grounding）：在带有显式坐标 token 输出的图文对上训练。"The cat is at <box>(112, 204), (280, 344)</box>"。
- 从一开始就进行中英双语训练。

当时的基准表现：英文上与 GPT-4V 相当，中文上则占据优势。定位监督才是真正的亮点。

### Qwen2-VL（2024 年 9 月）—— M-RoPE 与原生分辨率

Qwen2-VL 用一个原生动态分辨率的 ViT 编码器替换了「固定分辨率 + Q-Former」的组合。关键变化：

- 原生动态分辨率。ViT 接受任意能被 28 整除的 HxW（patch 为 14，加上 2x 空间合并）。一张 1120x672 的图像（合并后 40x24 个 patch）产生 960 个视觉 token。无需缩放、无需切片、无需缩略图。
- M-RoPE（多模态 RoPE，Multimodal RoPE）。每个 token 携带一个 3D 位置 (t, h, w)，而非 1D。图像取 t=0，视频取 t = frame_index。RoPE 按每条轴上的频率旋转 query/key 向量。没有位置嵌入表（positional embedding table）。
- MLP 投影器。弃用 Q-Former；在合并后的 patch token 上使用一个两层 MLP。
- 动态 FPS 的视频。视频默认按 1-2 FPS 采样，但模型接受任意帧数。

结果：Qwen2-VL-7B 在多个多模态基准上追平 GPT-4o，并在 DocVQA 上超越它（94.5 对 88.4）。架构上的这次改动是决定性的一步。

### Qwen2.5-VL（2025 年 2 月）—— 动态 FPS + 绝对时间

Qwen2.5-VL 的重大转变在视频。动态 FPS 不只是「需要时多采几帧」。论文将其形式化为：

- 绝对时间 token。不再使用位置索引（第 0、1、2…… 帧），而是使用真实的时间戳。"At 0:04, the cat jumps."（在 0:04，猫跳起来。）模型看到的是与帧 token 交错排列的 `<time>0.04</time>` token。
- 动态 FPS。对慢节奏画面按 1 FPS 采样，对动作画面按 4+ FPS 采样。由用户或训练者选择；M-RoPE 自适应。
- ViT 中的窗口注意力。空间注意力被窗口化（在块内做局部计算）以提升吞吐量；每隔几层做一次全局注意力。
- 显式 JSON 输出格式。在工具调用数据上训练："{\"tool\": \"click\", \"coords\": [380, 220]}"。开箱即可用于智能体。
- MRoPE-v2 缩放。位置随最大输入尺寸缩放，使得一段 10 分钟的视频不会耗尽频率范围。

基准表现：Qwen2.5-VL-72B 在大多数视频基准上击败 GPT-4o，在文档任务上追平 Gemini 2.0，并在 GUI 定位上创下开源模型的 SOTA（ScreenSpot：84% 准确率，而 GPT-4o 为 38%）。

### Qwen3-VL（2025 年 11 月）

Qwen3-VL 是一次渐进式升级，重在巩固而非重新发明：更大的 LLM 主干（Qwen3-72B）、扩充的训练数据、改进的 OCR、借助 Qwen3「思考模式（thinking mode）」实现的更强推理能力。ViT 和 M-RoPE 保持不变。论文聚焦于数据和训练改进，而非架构。

谱系层面的要点：到 2025 年，Qwen-VL 架构已趋于稳定。后续各代扩展的是算力和数据，而非基本组件。

### M-RoPE 的数学原理

经典 RoPE 通过成对坐标，将一个维度为 `d` 的 query `q` 按位置 `m` 旋转：

```
q_rot[2i]   = q[2i]   * cos(m * theta_i) - q[2i+1] * sin(m * theta_i)
q_rot[2i+1] = q[2i]   * sin(m * theta_i) + q[2i+1] * cos(m * theta_i)
theta_i     = 10000^(-2i/d)
```

M-RoPE 把隐藏维度切分成三个频带。假设 `d = 96`，则分配 32 维给时间、32 维给高度、32 维给宽度。每个频带按其各自的轴位置旋转。位于 (t=5, h=10, w=20) 的一个 patch，其三个频带分别施加旋转 `R_t(5)`、`R_h(10)`、`R_w(20)`。

文本 token 使用 `t = text_index, h = 0, w = 0`（或某种归一化的取法），从而保持兼容性。视频帧使用 `t = frame_time, h = row, w = col`。单张图像使用 `t = 0`。

好处在于：一套位置编码即可处理文本、图像和视频，无需分支代码或不同的位置表。

### 动态 FPS 采样逻辑

给定一段时长为 `T` 秒的视频和一个目标 token 预算 `B`：

1. 计算你能承受的最大 FPS：`fps_max = B / (T * tokens_per_frame)`。
2. 从 `{1, 2, 4, 8}` 中挑选一个满足 `fps <= fps_max` 的目标 FPS。
3. 若运动剧烈（基于光流启发式判断或用户显式要求），选更高的 FPS；若运动平缓，选更低的 FPS。
4. 按所选 FPS 均匀采样；在各帧之间插入 `<time>t</time>` token。

Qwen2.5-VL 隐式地训练出这套逻辑；推理时用户通过 `fps` 参数控制。一段 60 秒的动作序列，按 4 FPS、每帧 81 token 计算 = 19440 个 token，在 32k 上下文中可控。

### 结构化智能体输出

Qwen2.5-VL 的智能体训练显式地针对结构化工具调用：

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

解析是确定性的：对模型输出执行 JSON.parse。与自由格式的 "click at (1024, 512)" 相比，后者需要正则表达式和歧义处理。正是这一转变，使得 Qwen2.5-VL 的 ScreenSpot 得分从 Qwen2-VL 的 55% 跃升至 84%。

## 动手实践

`code/main.py` 实现了：

- 针对一个混合文本、图像 patch 和视频帧的打包序列的 M-RoPE 位置计算。
- 动态 FPS 采样器：给定 (duration, budget, motion_level)，选择 FPS 并产出帧时间戳。
- 一个玩具版的 Qwen2.5-VL JSON 输出解析器，处理带坐标字段的工具调用响应。

运行它，然后在一段 5 分钟的视频上把固定 FPS 换成动态 FPS，感受其中的差异。

## 交付产出

本课产出 `outputs/skill-qwen-vl-pipeline-designer.md`。给定一个视频任务（监控、智能体、动作识别、无障碍辅助），它会输出 Qwen2.5-VL 的配置（帧预算、FPS 策略、窗口注意力开关、智能体输出模式）以及一个延迟估算。每当你为某个视频产品部署 Qwen-VL 家族模型时，都可以使用它。

## 练习

1. 为位于 (t=3, h=5, w=7) 的一个 patch 计算 M-RoPE 旋转，隐藏维度为 48（每个频带 16 维，基础 theta 为 10000）。展示每个频带中前三对的旋转角度。

2. 一段 10 分钟的安防摄像头录像按 1 FPS 采样会产生多少帧？在 384 分辨率、3x 池化下，总共多少 token？Qwen2.5-VL 默认的 32k 上下文能否容纳？

3. 分别为一段 30 秒的网球对拉、一段 30 秒的菜谱演示和一段 30 秒的 UI 智能体录屏选择 FPS。用动态 FPS 逻辑论证每个选择。

4. Qwen2.5-VL 完全弃用了 Q-Former。为什么一个简单的 MLP 在 2025 年有效，而在 2023 年不行？（提示：数据规模和编码器质量。）

5. 把三个 Qwen2.5-VL JSON 工具调用输出解析为 Python 字典。对于格式错误的 JSON 会出什么问题，Qwen cookbook 推荐采用什么恢复策略？

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|------------------------|
| M-RoPE | 「多模态 RoPE」 | 3D 旋转位置嵌入，在隐藏维度中带有时间、高度和宽度三个频带 |
| 动态 FPS | 「智能采样」 | 根据运动、时长和 token 预算，为每段视频选择的帧采样率 |
| 绝对时间 token | 「时间戳 token」 | 交错插入序列中的 `<time>t</time>`，使模型看到实际秒数而非帧索引 |
| 窗口注意力 | 「局部注意力」 | 为提速而限制在小窗口内的空间自注意力；周期性地加入全局注意力 |
| 结构化智能体输出 | 「JSON 模式」 | 通过训练数据监督，教会 VLM 输出可解析的、带坐标和工具名的 JSON |
| min_pixels / max_pixels | 「分辨率边界」 | Qwen2.5-VL 的逐请求控制项，限定总像素数从而限定 token 数 |
| 定位（Grounding） | 「指出位置」 | 以文本 token 形式输出边界框坐标；自 Qwen-VL v1 起即采用 |

## 延伸阅读

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
