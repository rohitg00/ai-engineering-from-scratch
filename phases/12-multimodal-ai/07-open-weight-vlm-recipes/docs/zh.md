# 开源权重 VLM 配方：什么才是真正重要的（Open-Weight VLM Recipes: What Actually Matters）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 2024–2026 年的开源权重 VLM 文献是一片消融实验（ablation）表的森林。Apple 的 MM1 测试了 13 种图像 encoder、connector 和数据 mix 的组合。Allen AI 的 Molmo 证明了详尽的人工 caption 击败 GPT-4V 蒸馏数据。Cambrian-1 跑了 20 多个 encoder 对比。Idefics2 把五轴设计空间形式化下来。Prismatic VLMs 在受控基准上对比了 27 种训练配方（recipe）。在所有这些噪声中，有一小部分结论跨论文都成立：图像 encoder 比 connector 架构更重要，数据 mix 比两者都更重要，详尽的人工 caption 击败蒸馏的合成数据。本课替你把这些表读完，让你不必再自己读。

**Type:** Learn + lab
**Languages:** Python (stdlib, ablation table parser + recipe picker)
**Prerequisites:** Phase 12 · 05 (LLaVA baseline)
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 说出 VLM 的五轴设计空间：图像 encoder、connector、LLM、数据 mix、分辨率调度。
- 读懂 MM1 / Idefics2 / Cambrian-1 的消融实验表，预测哪个旋钮会影响某个基准。
- 给定算力预算和任务组合，为一个新 VLM 挑选配方（encoder、connector、数据、分辨率）。
- 解释为什么在相同 token 数下，详尽的人工 caption 会击败 GPT-4V 蒸馏。

## 问题（The Problem）

开源权重 VLM 已经数以百计。"够用"和"最好"之间的差距大部分不在架构。差距在数据、分辨率调度和 encoder 选型。当你的模型表现不佳时，知道该先转哪个旋钮，能帮你省下一个 500 万 GPU 小时的错误。

2023 年的一波（LLaVA-1.5、InstructBLIP、MiniGPT-4）跑的是 caption 对预训练 + LLaVA-Instruct-150k。基线尚可。MMMU 大约卡在 35% 左右。

2024 年这一波（MM1、Idefics2、Molmo、Cambrian-1、Prismatic VLMs）跑的是详尽的消融实验。结论既出人意料又非常实用。

## 概念（The Concept）

### 五轴设计空间（The five-axis design space）

Idefics2（Laurençon et al., 2024）给这些轴起了名字：

1. 图像 encoder。CLIP ViT-L/14、SigLIP SO400m/14、DINOv2 ViT-g/14、InternViT-6B。各 encoder 在 patch 大小、分辨率和预训练目标上各有差异。
2. Connector。MLP（2–4 层）、Q-Former（32 个 query + cross-attn）、Perceiver Resampler（64 个 query）、C-Abstractor（卷积 + 双线性池化）。
3. 语言模型（LLM）。Llama-3 8B / 70B、Mistral 7B、Phi-3、Gemma-2、Qwen2.5。LLM 大小是参数成本的主导项。
4. 训练数据。Caption 对（CC3M、LAION）、interleaved 数据（OBELICS、MMC4）、指令数据（LLaVA-Instruct、ShareGPT4V、PixMo、Cauldron）。
5. 分辨率调度。固定 224/336/448、AnyRes、原生动态。在训练中逐步提高（ramped）或保持不变。

每个生产级 VLM 都要在每个轴上做选择。MMMU 分数的方差中，大部分由轴 1、4、5 解释——而不是你选了哪个 connector。

### 轴 1：encoder 比 connector 重要（Axis 1: encoder > connector）

MM1 第 3.2 节展示：从 CLIP ViT-L/14 换到 SigLIP SO400m/14 在 MMMU 上加了 3+ 分。把 connector 从 MLP 换到 Perceiver Resampler 加了不到 1 分。Idefics2 复现了这个结论：SigLIP > CLIP；在相同 token 数下 Q-Former ≈ MLP ≈ Perceiver。

Cambrian-1 的 "Cambrian Vision Encoders Match-Up"（Tong et al., 2024）在一个视觉中心化基准（CV-Bench）上跑了 20 多个 encoder。榜首是 DINOv2 和 SigLIP 的混合；CLIP 居中；ImageBind 和 ViT-MAE 偏低。在 CV-Bench 上，CLIP ViT-L 到 DINOv2 ViT-g/14 的差距大概是 5–7 分。

2026 年开源 VLM 的默认 encoder 是 SigLIP 2 SO400m/14（用于语义 + 稠密特征），有时会再拼接 DINOv2 ViT-g/14 的特征（Cambrian 的 "Spatial Vision Aggregator" 就是这么做的）。

### 轴 2：connector 设计基本无关紧要（Axis 2: connector design is a wash）

MM1、Idefics2、Prismatic 和 MM-Interleaved 得出的结论都一样：在视觉 token 数固定时，connector 架构几乎没有差别。在相同 token 预算下，对均值池化后的 patch 上接一个 2 层 MLP，性能与 32-query 的 Q-Former 相差不到 1 分。

真正重要的是 token 数。视觉 token 越多 = LLM 算力越多 = 性能越好，到一定程度后边际递减。每张图 64 个 token 对 OCR 来说太少。576–1024 个 token 是大多数开源 VLM 的甜点区。2048+ 只对文档和图表有帮助。

Q-Former 与 MLP 的争论是成本问题，不是质量问题：无论图像分辨率多高，Q-Former 都把 token 数压到 32–64；MLP 则发出全部 patch token。对于高分辨率输入，Q-Former 节省 LLM 的 context 空间；对于低分辨率，差异是噪声级别。

### 轴 3：LLM 大小决定上限（Axis 3: LLM size sets the ceiling）

把 LLM 从 7B 翻倍到 13B，在每篇 VLM 论文中都能稳定为 MMMU 加上 2–4 分。到了 70B，大多数基准就饱和了。VLM 的多模态推理上限就是该 LLM 的文本推理上限——视觉 encoder 只能"喂"它，不能替它推理。

这就是为什么 Qwen2.5-VL-72B 和 Claude Opus 4.7 能在 MMMU-Pro 和 ScreenSpot-Pro 上碾压：语言"大脑"足够大。一个 7B VLM 不可能靠巧妙的 connector 设计去替代 70B VLM。

### 轴 4：数据——详尽的人工 caption 击败蒸馏（Axis 4: data — detailed human captions beat distillation）

Molmo + PixMo（Deitke et al., 2024）是 2024 年所有人都该读的结论。Allen AI 让人类标注员用 1–3 分钟的密集语音转写来描述图像，得到了 71.2 万张稠密 caption 的图像。训练数据里完全没有 GPT-4V 蒸馏。

Molmo-72B 在 11 个基准中 11 个都击败了 Llama-3.2-90B-Vision。差距不是来自架构——是来自 caption 质量。详尽的人工 caption 每张图所含信息是简短网络 caption 的 5–10 倍，并在 GPT-4V 蒸馏会 hallucinate 的地方保持事实可信。

ShareGPT4V（Chen et al., 2023）和 Cauldron（Idefics2）沿用了同一打法，但混用了人工 + GPT-4V caption。趋势很清楚：对于 2026 年前沿，caption 密度 > caption 数量 > 蒸馏便利性。

### 轴 5：分辨率及其调度（Axis 5: resolution and its schedule）

Idefics2 的消融实验：384 → 448 加了 1–2 分。448 → 980 配合图像切分（AnyRes）在 OCR 基准上又加了 3–5 分。固定分辨率的训练在中等精度处停滞；分辨率渐进式（resolution ramping，从 224 起步，结束在 448 或原生分辨率）训练得更快、最终也更高。

Cambrian-1 跑了一个分辨率 vs token 的取舍：在固定算力下，你要么在低分辨率下要更多 token，要么在高分辨率下要更少 token。OCR 上更高分辨率胜出；通用场景理解上"更低分辨率 + 更多 token"胜出。

2026 年的生产配方：Stage 1 在 384 固定分辨率训练，Stage 2 用动态分辨率最高到 1280 应对 OCR 重的任务。

### Prismatic 的受控对比（The Prismatic controlled comparison）

Prismatic VLMs（Karamcheti et al., 2024）是这篇把所有轴都控制住的论文。同样的 13B LLM、同样的指令数据、同样的评估——一次只变一个轴。结果：

- 每张图的视觉 token 数解释了约 60% 的方差。
- Encoder 选型解释了约 20%。
- Connector 架构解释了约 5%。
- 其他一切（数据 mix、scheduler、学习率）解释剩余的约 15%。

这是个粗糙的分解，但它是文献里对"我应该先消融哪一项"最干净的回答。

### 一份 2026 年的挑选器（A picker for 2026）

依据这些证据，2026 年新项目的开源 VLM 默认配方是：

- Encoder：SigLIP 2 SO400m/14，原生分辨率 + NaFlex；如果需要 segmentation/grounding，再拼接 DINOv2 ViT-g/14 的稠密特征。
- Connector：在 patch token 上的 2 层 MLP。除非你受 token 数约束，否则跳过 Q-Former。
- LLM：Qwen2.5 / Llama-3.1 / Gemma 2，按目标延迟挑——成本敏感选 7B，质量优先选 70B。
- 数据：PixMo + ShareGPT4V + Cauldron，再加上任务相关的指令数据。
- 分辨率：动态（最短边 256 像素，最长边最高 1280 像素）。
- 调度：Stage 1 对齐（仅训 projector），Stage 2 全量微调，Stage 3 任务相关微调。

以上每条默认值都能在本课末尾引用的论文里找到一组实测的消融实验作为依据。

## 用起来（Use It）

`code/main.py` 是一个消融实验表解析器和配方挑选器。它把 MM1 和 Idefics2 的消融实验表（精简版）编码进去，让你可以查询：

- "给定预算 X 和任务 Y，哪个配方胜出？"
- "如果在一个 7B Llama 上把 SigLIP 换成 CLIP，预期的 MMMU delta 是多少？"
- "想要 80% 置信度的回答，我应该先消融哪一轴？"

输出是一份带预期基准 delta 的配方排名列表，再加一条"先消融这里"的建议。

## 上线部署（Ship It）

本课产出 `outputs/skill-vlm-recipe-picker.md`。给定目标任务组合、算力预算和延迟目标，它会发出一份完整的配方（encoder、connector、LLM、数据 mix、分辨率调度），并为每个选择附上对应消融实验的引用。这能阻止工程师每次启动一个新 VLM 项目时都重新发明 Idefics2 的消融实验表。

## 练习（Exercises）

1. 阅读 MM1 第 3.2 节。在固定 2B LLM、预算 5000 万张图的设置下，哪个 encoder 胜出？换成 13B LLM 答案会反转吗？为什么？

2. Cambrian-1 发现，DINOv2 + SigLIP 拼接在视觉中心化基准上优于单独使用任一者，但对 MMMU 没有任何信号增益。预测哪些基准会受益、哪些会维持不变。

3. 你的目标是一个跑在 2B LLM 上的移动 UI agent。挑选 encoder、connector、分辨率和数据 mix。每个选择都用一张具体的消融实验表来论证。

4. Molmo 提供 4B 和 72B 两种模型。4B 与闭源 7B VLM 不相上下；72B 在 11/11 基准上击败 Llama-3.2-90B-Vision。这告诉你关于"LLM 大小存在停滞期"假说的什么信息？

5. 设计一张消融实验表，在一个 7B VLM 上把数据 mix 质量与 encoder 质量解耦。最少需要多少次训练？提出这四条轴上的设置。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------|----------|
| Ablation（消融实验） | "拧一个旋钮" | 跑多次训练，每次只在一条设计空间的轴上不同，其他全部保持不变 |
| Connector | "桥" / "projector" | 可训练模块，把视觉 encoder 的输出映射到 LLM 的 token 空间（MLP、Q-Former、Perceiver） |
| Detailed human caption（详尽人工 caption） | "稠密 caption" | 一段多句的人写描述（一般 80–300 tokens），比网页 alt 文本信息更丰富 |
| Distillation（蒸馏） | "GPT-4V caption" | 由更强的闭源 VLM 生成的训练数据；方便，但容易继承 hallucination |
| AnyRes / 动态分辨率 | "高分辨率通路" | 通过 tiling 或 M-RoPE 把超过 encoder 原生分辨率的图像喂给模型的策略 |
| Resolution ramp（分辨率渐进） | "课程学习（curriculum）" | 从低分辨率开始逐步提高的训练调度，能加速对齐学习 |
| Vision-centric bench（视觉中心化基准） | "CV-Bench / BLINK" | 强调细粒度视觉感知、而非语言重推理的评估 |
| PixMo | "Molmo 的数据" | Allen AI 的 71.2 万张稠密 caption 图像数据集；由人工口述转写为稠密 caption |

## 延伸阅读（Further Reading）

- [McKinzie et al. — MM1 (arXiv:2403.09611)](https://arxiv.org/abs/2403.09611)
- [Laurençon et al. — Idefics2 / What matters building VLMs (arXiv:2405.02246)](https://arxiv.org/abs/2405.02246)
- [Deitke et al. — Molmo and PixMo (arXiv:2409.17146)](https://arxiv.org/abs/2409.17146)
- [Tong et al. — Cambrian-1 (arXiv:2406.16860)](https://arxiv.org/abs/2406.16860)
- [Karamcheti et al. — Prismatic VLMs (arXiv:2402.07865)](https://arxiv.org/abs/2402.07865)
