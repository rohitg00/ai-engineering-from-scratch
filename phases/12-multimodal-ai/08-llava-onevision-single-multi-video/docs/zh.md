# LLaVA-OneVision：单图、多图、视频统一进一个模型

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 在 LLaVA-OneVision（Li 等，2024 年 8 月）出现之前，开源 VLM 世界各有山头：LLaVA-1.5 主打单图，Mantis、VILA 这类多图模型各占一席，视频则归 Video-LLaVA、Video-LLaMA。每个都在自家 benchmark（基准测试）上拿冠军，换个场景就翻车。LLaVA-OneVision 的主张是：一套训练 curriculum（课程）就能让一个模型在三类场景里全面碾压；而且任务迁移的涌现效果（单图技能外溢到视频，多图推理外溢到单图）会超过专家模型之和。配方看似简单：一个跨场景恒定的 visual token 预算，加上一条从单图 → OneVision（多图）→ 视频的明确 curriculum。这节课我们就来读一读这份预算、这条 curriculum，以及随之而来的涌现行为。

**Type:** Build
**Languages:** Python (stdlib, token budget solver + curriculum planner)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 12 · 06 (any-resolution)
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 设计一份在单图、多图、视频三类输入下都保持恒定的 visual token 预算。
- 编排一条训练 curriculum，把技能从单图迁移到视频，且不引发灾难性遗忘（catastrophic forgetting）。
- 解释为什么参数量相同的情况下，curriculum 安排得当的单一模型能击败一众专家模型。
- 说出 LLaVA-OneVision 报告的三项涌现能力：多摄像头推理、set-of-mark prompting、iPhone 截图 agent。

## 问题（Problem）

图像、多图、视频对模型的压力点完全不同。

单图希望 token 高分辨率（AnyRes，约 2880 个 visual token）以抓住 OCR 和细节。每条样本的预算：1 张图，2880 个 token。

多图希望若干张中等分辨率图（每张约 576 个 token），让跨图推理能塞进 context。每条样本的预算：4–8 张图，每张 576，合计 2300–4600 个 token。

视频希望帧数多但分辨率低（pooling 后每帧约 196 个 token）以捕捉时间动态。每条样本的预算：8–32 帧，每帧 196，合计 1600–6200 个 token。

如果你训练独立模型，只需挑一个预算就行。如果你训练一个统一模型，预算就必须能在场景间合理伸缩，又不能撑爆 context。

OneVision 之前的默认答案是「只训一个场景，其它的随它去」。Video-LLaVA 在图像模型上加了几轮训练把视频塞进去。LLaVA-NeXT 用 tile（切块）支持多图。没有谁能干净地同时搞定三件事。

## 概念（Concept）

### OneVision 的 token 预算

LLaVA-OneVision 选了一份统一的 visual token 预算，每条样本约 3000–4000 个 token，分场景做不同分配：

- 单图：AnyRes-9（3×3 切块 + 一张缩略图），每块 384 分辨率，729 个 patch，再做激进的 2×2 双线性 pooling → 每块 182。合计：9 × 182 + 182 = 1820 个 token。或者 AnyRes-4，每块 729 = 2916 + 729。
- 多图：每张图中等分辨率（384，不切块），不做 pooling，729 个 token。预算可容纳 6 张图 → 4374 个 token。
- 视频：32 帧，384 分辨率，激进的 3×3 双线性 pool → 每帧 81 个 token。合计：32 × 81 = 2592 个 token。

这种分配方式让总 token 数大致恒定。LLM 永远不会拿到一批撑爆 context 的样本。encoder 在不同场景下产出不同几何形状，但 LLM 消耗的预算是一样的。

### 三阶段 curriculum

LLaVA-OneVision 分三阶段训练：

1. 单图 SFT（阶段 SI）。所有数据都是单图加文本。在高分辨率 AnyRes 输入上训练。这一阶段教会模型感知、OCR、细粒度理解。使用 LLaVA-NeXT 数据加 OneVision 自有的单图数据。
2. OneVision SFT（阶段 OV）。混合单图 + 多图 + 视频（均匀采样帧）。在统一 token 预算下训练。这一阶段教会模型处理异构 batch 形状。不重置权重——直接从阶段 SI 继续。
3. 任务迁移（阶段 TT）。继续按目标任务比例训练，通常根据产品形态偏向多图或视频。可选：再做一次部署用的 fine-tune（微调）。

关键：curriculum 的顺序很重要。先训视频或先训多图，得到的图像表现都比先训单图差，即便用的数据完全相同。论文里专门做了消融实验（ablation）来证明这点。

### 为什么 curriculum 有用

单图训练打的是感知底子。Patch token 携带细粒度视觉特征；LLM 学会把它们和文本融合。多图和视频引入了结构性挑战（哪张是哪张、谁先发生），没有强感知底子是学不动的。

如果你把所有场景从零一起训，模型会在感知上欠拟合（每个 batch 里单图数据有限），又在结构上过拟合（多图/视频数据太多）。结果是：一个能跟着跨图推理套路走、但视觉很浅的模型。

curriculum 的顺序让你先在阶段 SI 拿到感知力，再从阶段 OV 拿到组合 / 时间推理能力，两边都不丢。

### 跨场景的涌现技能

LLaVA-OneVision 论文报告了三项涌现能力：

1. 多摄像头推理。模型分别在多图 + 视频上训练；推理时被要求理解一段多摄像头的驾驶场景。模型能正确融合多个视角，尽管它在训练里从未见过这种确切格式。
2. Set-of-mark prompting。用户在图像上给物体打编号标记，模型则被问「标记 3 相对标记 7 在做什么」。它既没有在 mark 上训过、也没有在标注数据上训过；这种能力来自空间 grounding（定位）+ 多图引用的组合。
3. iPhone 截图 agent。用户给一张 iPhone 屏幕截图，让它规划下一次点击。它训练时见过 UI 截图、用户工作流视频、多图前后对比对，泛化到了 agent 用例。

这些都不是被显式训练的任务；它们是从 curriculum 的组合结构里涌现出来的。

### Visual token 的 pooling

token 预算靠 pooling 来达成。OneVision 在 2D patch 网格上做双线性插值：24×24 = 576 个 patch 变成 12×12 = 144（2 倍系数）或 8×8 = 64（3 倍系数）。pooling 是在 patch 网格空间做的，不是 token 空间，这样能保留局部性。

每个场景的 pooling 系数本身就是一个超参。pooling 越少 = token 越多 = 表达越丰富。pooling 越多 = token 越少 = 能塞进的帧数 / 图数越多。

### LLaVA-OneVision-1.5

2025 年的后续工作（LLaVA-OneVision-1.5，arXiv 2509.23661）在训练数据、模型权重和代码上「完全开源」。在部分 benchmark 上追平了闭源差距，把这套配方民主化了。curriculum 没变、数据更多、底座 LLM 更强。架构没动。

### 对照 Qwen2.5-VL

Qwen2.5-VL（第 12.09 课）的选择不一样。它用 M-RoPE 和动态 FPS 取代固定 pooling。它的预算随输入伸缩——1 分钟视频比 5 秒视频用更多 token。LLaVA-OneVision 把预算钉死，让 pooling 来伸缩。两条路都能走，前者用可配置性换可预测性。

## 用起来（Use It）

`code/main.py` 是一份 OneVision 风格 VLM 的 curriculum 与预算规划器。给定每条样本的 token 预算，以及目标场景比例（比如 40% 单图、30% 多图、30% 视频），它会：

- 为每个场景分配分辨率、pooling 系数、帧数。
- 检查每个场景是否都能塞进共享预算。
- 报告预期 token 数、LLM FLOPs，以及哪些场景被欠 token。
- 打印分阶段的训练时间表。

用它来规划一次 OneVision 微调，或者给某个 VLM 部署做单请求成本的合理性检查。

## 上线部署（Ship It）

本节课会产出 `outputs/skill-onevision-budget-planner.md`。给定目标任务分布和单样本预算，它会输出 AnyRes 系数、每帧的 pooling、视频帧数，以及 curriculum 阶段的权重。每当你要训练或微调一个统一场景的 VLM，就用上它。

## 练习（Exercises）

1. 你的产品流量是 80% 单图、10% 多图（2–4 张）、10% 视频（8–16 帧）。设计这份 token 预算。多图省下来的预算你会塞到哪里？

2. 读 LLaVA-OneVision 第 4.3 节（涌现能力）。提出第四种这条 curriculum 很可能解锁、但论文没报告的涌现技能。

3. 把 curriculum 顺序换一下——先多图、再单图、再视频。预测哪些 benchmark 会退化、为什么。

4. 论文报告的视频 benchmark 在训练时每条样本只用了 8 帧。这能泛化到 30 秒长的视频推理吗？最先崩的是 token 预算还是时间推理？

5. 把 24×24 patch 双线性 pooling 到 12×12，是每维 4 倍缩减。用 stdlib Python 实现这个 pooling，并验证每个 2×2 块的均值是否匹配双线性输出。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|------|-----------------|------------------------|
| OneVision 场景 | 「单图、多图或视频」 | 统一 VLM 处理的三种输入形状之一；预算跨场景保持恒定 |
| Token 预算 | 「每条样本多少 token」 | LLM 在每条训练 / 推理样本上看到的 visual token 总数，通常 3000–4000 |
| Curriculum | 「训练顺序」 | 阶段顺序（单图 → 多图 → 视频），为追求涌现迁移而选 |
| 双线性 pooling | 「token 缩减」 | 在 patch 网格（2D）上做双线性插值，缩减 token 数同时保留局部性 |
| 涌现技能 | 「没训过也能用」 | 推理时出现、训练数据没有匹配项的能力，源于 curriculum 的组合结构 |
| AnyRes-k | 「k 块切片配置」 | k 个固定分辨率的子块加 1 张缩略图，典型 k ∈ {4, 9} |
| 任务迁移 | 「跨场景泛化」 | 单图上学到的技能借共享 backbone 应用到视频（反之亦然） |

## 延伸阅读（Further Reading）

- [Li et al. — LLaVA-OneVision (arXiv:2408.03326)](https://arxiv.org/abs/2408.03326)
- [LLaVA-OneVision-1.5: Fully Open Framework (arXiv:2509.23661)](https://arxiv.org/abs/2509.23661)
- [Lin et al. — Video-LLaVA (arXiv:2311.10122)](https://arxiv.org/abs/2311.10122)
- [Lin et al. — VILA (arXiv:2312.07533)](https://arxiv.org/abs/2312.07533)
- [Wang et al. — Qwen2-VL (arXiv:2409.12191)](https://arxiv.org/abs/2409.12191)
