# Qwen-VL 家族与动态 FPS 视频

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Qwen-VL 家族 —— Qwen-VL（2023）、Qwen2-VL（2024）、Qwen2.5-VL（2025）、Qwen3-VL（2025）—— 是 2026 年最具影响力的开源视觉语言模型谱系。每一代都做了一个决定性的架构押注，而开源生态在十二个月内纷纷照搬：通过 M-RoPE 实现的原生动态分辨率、带绝对时间对齐的动态 FPS 采样、ViT 中的 window attention，以及结构化的 agent 输出格式。到 Qwen3-VL，这套配方（recipe）已经稳定下来：一个采用 2D-RoPE-ViT 的 encoder 接受原生宽高比输入，一个 MLP（多层感知机）projector 接到大型 Qwen3 语言基座，训练阶段把 OCR、grounding 和 agent 行为作为一等目标。本课按时间顺序通读这个家族，让你理解每一个旋钮为什么处在它现在的位置。

**Type:** Learn
**Languages:** Python（标准库，M-RoPE encoder + 动态 FPS 采样器）
**Prerequisites:** Phase 12 · 06（patch-n'-pack）
**Time:** ~120 minutes

## 学习目标（Learning Objectives）

- 计算 M-RoPE 的三轴旋转（temporal、height、width），并解释为什么三者缺一不可。
- 给一段视频选一个动态 FPS 采样策略，并就「每秒 token 数」与「事件检测准确度」的权衡进行推理。
- 按顺序说出 Qwen-VL 四代的代际升级，以及每一代解锁了什么。
- 接通一个 Qwen2.5-VL 风格的 JSON agent 输出格式，并从 VLM 响应中解析结构化的 tool call。

## 问题（The Problem）

Qwen-VL 在 2023 年 8 月发布，是对 LLaVA-1.5 和 BLIP-2 的直接回应。Qwen 团队瞄准的差距有三：分辨率、视频、结构化输出。

分辨率：LLaVA-1.5 跑在 336x336。拍照可以，但中文发票或密集表格截图就完全无能为力。Qwen-VL 的第一项创新是 448x448 加上有 grounding 的 bounding-box 输出，让模型能「指」出东西在哪。

视频：Video-LLaMA 把逐帧 encoder 堆起来再喂给 LLM。短片段还行，但对于多分钟的视频——时间轴本身就是信号——就不够用了。Qwen 团队想要一个能理解时间的单一 encoder。

结构化输出：LLaVA 输出的是自由文本。但 agent 需要 JSON。Qwen-VL 直接在显式的 JSON 输出格式上训练，包括把 bounding-box 坐标作为文本输出。

Qwen-VL 的每一代都在沿这三条轴中的某一条延展。

## 概念（The Concept）

### Qwen-VL（2023 年 8 月）

第一代：以 OpenCLIP ViT-bigG/14 为 encoder（25 亿参数）、LLama 兼容的 Q-Former（单步、256 个 query）、以 Qwen-7B 为基座。贡献：

- 448x448 分辨率（当时开源 VLM 的 SOTA）。
- Grounding：在带显式坐标 token 输出的图文对上训练。「The cat is at <box>(112, 204), (280, 344)</box>」。
- 一开始就做中英双语训练。

当时的基准：英文上与 GPT-4V 旗鼓相当，中文上明显领先。Grounding 监督才是真正的看点。

### Qwen2-VL（2024 年 9 月）—— M-RoPE 与原生分辨率

Qwen2-VL 把「固定分辨率 + Q-Former」的栈替换成了原生支持动态分辨率的 ViT encoder。关键变化：

- 原生动态分辨率。ViT 接受任意可被 28 整除的 HxW（patch 14 加 2x 空间合并）。一张 1120x672 的图（合并后 40x24 个 patch）产生 960 个视觉 token。无需 resize、无需切片、无需缩略图。
- M-RoPE（Multimodal RoPE，多模态 RoPE）。每个 token 携带一个 3D 位置 (t, h, w)，而不是 1D。图像取 t=0，视频取 t = frame_index。RoPE 按每个轴的频率分别旋转 query/key 向量。没有位置编码表。
- MLP projector。丢掉 Q-Former；在合并后的 patch token 上用 2 层 MLP。
- 带动态 FPS 的视频。视频默认按 1-2 FPS 采样，但模型可接受任意帧数。

结果：Qwen2-VL-7B 在多个多模态基准上追平 GPT-4o，并在 DocVQA 上反超（94.5 vs 88.4）。架构变更是决定性的一步。

### Qwen2.5-VL（2025 年 2 月）—— 动态 FPS + 绝对时间

Qwen2.5-VL 的大转向是视频。Dynamic FPS 不只是「需要时多采几帧」。论文将其形式化为：

- 绝对时间 token。不用位置索引（frame 0、1、2……），而是用真实时间戳。「At 0:04, the cat jumps.」模型看到的是与帧 token 交错的 `<time>0.04</time>` token。
- 动态 FPS。慢镜头按 1 FPS 采，动作场景按 4+ FPS 采。用户或训练者来选；M-RoPE 自适应。
- ViT 里的 window attention。空间 attention 改为 windowed（在 block 内部局部化）以提高吞吐；每隔几层做一次全局 attention。
- 显式 JSON 输出格式。在 tool-call 数据上训练：「{\"tool\": \"click\", \"coords\": [380, 220]}」。开箱即用的 agent。
- MRoPE-v2 缩放。位置随最大输入尺寸缩放，使得 10 分钟视频不会跑出频率范围。

基准：Qwen2.5-VL-72B 在大多数视频基准上击败 GPT-4o，在文档上追平 Gemini 2.0，并在 GUI grounding 上创下开源模型 SOTA（ScreenSpot：84% 准确率，对比 GPT-4o 的 38%）。

### Qwen3-VL（2025 年 11 月）

Qwen3-VL 是一次增量升级，重在巩固而非重塑：更大的 LLM 主干（Qwen3-72B）、更大的训练数据、更强的 OCR、借助 Qwen3 的「thinking mode」（思考模式）增强推理。ViT 与 M-RoPE 保持不变。论文聚焦于数据和训练改进，而非架构。

谱系层面的启示：到 2025 年 Qwen-VL 的架构已经稳定下来。后续代际靠扩计算与扩数据，而非新原语。

### M-RoPE 数学表达

经典 RoPE 把维度为 `d` 的 query `q` 在位置 `m` 处用配对坐标做旋转：

```
q_rot[2i]   = q[2i]   * cos(m * theta_i) - q[2i+1] * sin(m * theta_i)
q_rot[2i+1] = q[2i]   * sin(m * theta_i) + q[2i+1] * cos(m * theta_i)
theta_i     = 10000^(-2i/d)
```

M-RoPE 把 hidden dim 拆成三段。比如 `d = 96`，把 32 维分给 temporal，32 维分给 height，32 维分给 width。每一段按自己的轴位置旋转。位于 (t=5, h=10, w=20) 的一个 patch，会对它的三段分别施加 `R_t(5)`、`R_h(10)`、`R_w(20)`。

Text token 用 `t = text_index, h = 0, w = 0`（或一种归一化的选择），保持兼容性。视频帧用 `t = frame_time, h = row, w = col`。单图像用 `t = 0`。

好处：一套位置编码同时处理文本、图像、视频，无需分支代码或不同的位置表。

### 动态 FPS 采样逻辑

给定时长为 `T` 秒的视频和目标 token 预算 `B`：

1. 计算你能负担的最大 FPS：`fps_max = B / (T * tokens_per_frame)`。
2. 在 `{1, 2, 4, 8}` 中选一个满足 `fps <= fps_max` 的目标 FPS。
3. 如果运动剧烈（光流启发式或用户显式要求），取更高的 FPS；运动平缓则取更低。
4. 按选定 FPS 均匀采样；在帧之间插入 `<time>t</time>` token。

Qwen2.5-VL 隐式地在训练里学会了这套逻辑；推理时由用户通过 `fps` 参数控制。一段 60 秒动作序列按 4 FPS 采、每帧 81 个 token = 19440 个 token，在 32k context 里完全可控。

### 结构化 agent 输出

Qwen2.5-VL 的 agent 训练显式针对结构化 tool call：

```
{
  "tool": "mouse_click",
  "coords": [1024, 512],
  "button": "left",
  "modifier": null
}
```

解析是确定性的：对模型输出做 JSON.parse 即可。对比一下自由文本式的「click at (1024, 512)」，那种需要正则 + 处理歧义。这一转变正是 Qwen2.5-VL 在 ScreenSpot 上从 Qwen2-VL 的 55% 跃升到 84% 的原因。

## 用起来（Use It）

`code/main.py` 实现了：

- 针对一个混合了文本、图像 patch 和视频帧的 packed sequence，计算 M-RoPE 位置。
- 动态 FPS 采样器：给定 (duration, budget, motion_level)，选定 FPS 并发出帧时间戳。
- 一个玩具版的 Qwen2.5-VL JSON 输出 parser，处理带坐标字段的 tool-call 响应。

跑一遍，然后在一段 5 分钟的视频上把固定 FPS 换成动态 FPS，亲自体会差别。

## 上线部署（Ship It）

本课产出 `outputs/skill-qwen-vl-pipeline-designer.md`。给定一项视频任务（监控、agent、动作识别、无障碍），它会输出 Qwen2.5-VL 配置（帧预算、FPS 策略、window-attention 开关、agent 输出模式）以及一个延迟估算。每当你为一个视频产品部署 Qwen-VL 家族模型时，都用它。

## 练习（Exercises）

1. 计算位于 (t=3, h=5, w=7)、hidden 为 48（每段 16 维，base theta 10000）的一个 patch 的 M-RoPE 旋转。给出每一段中前三对的旋转角。

2. 一段 10 分钟的安防摄像头录像按 1 FPS 采样会得到多少帧？在 384 分辨率、3x pool 下总共多少 token？Qwen2.5-VL 默认的 32k context 装得下吗？

3. 为以下三段视频分别选 FPS：30 秒的网球对拉、30 秒的食谱演示、30 秒的 UI-agent 录屏。用动态 FPS 逻辑为每个选项给出理由。

4. Qwen2.5-VL 完全丢掉了 Q-Former。为什么 2025 年一个简单的 MLP 能用，2023 年却不行？（提示：数据规模和 encoder 质量。）

5. 把三个 Qwen2.5-VL JSON tool-call 输出解析为 Python dict。对于格式不合法的 JSON 会失败在哪？Qwen cookbook 推荐什么恢复策略？

## 关键术语（Key Terms）

| Term | 大家怎么说 | 它真正的意思 |
|------|-----------------|------------------------|
| M-RoPE | 「Multimodal RoPE」 | 在 hidden dim 中划分 temporal、height、width 三段的 3D 旋转位置编码 |
| Dynamic FPS | 「智能采样」 | 按视频的运动强度、时长和 token 预算来逐视频选择帧采样率 |
| Absolute time token | 「时间戳 token」 | 序列中交错插入的 `<time>t</time>`，让模型看到的是真实秒数而非帧索引 |
| Window attention | 「局部 attention」 | 空间 self-attention 受限在小窗口内以提速；周期性地加入全局 attention |
| Structured agent output | 「JSON 模式」 | 用训练数据监督 VLM 输出可解析的 JSON，含坐标和工具名 |
| min_pixels / max_pixels | 「分辨率上下界」 | Qwen2.5-VL 按请求控制的总像素数（亦即 token 数）边界 |
| Grounding | 「指出来」 | 把 bounding-box 坐标作为文本 token 输出；自 Qwen-VL v1 起就在用 |

## 延伸阅读（Further Reading）

- [Bai et al. — Qwen-VL (arXiv:2308.12966)](https://arxiv.org/abs/2308.12966)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
- [Qwen Team — Qwen2.5-VL Technical Report (arXiv:2502.13923)](https://arxiv.org/abs/2502.13923)
- [Qwen Team — Qwen3-VL (arXiv:2511.21631)](https://arxiv.org/abs/2511.21631)
- [Zhu et al. — InternVL3 (arXiv:2504.10479)](https://arxiv.org/abs/2504.10479)
