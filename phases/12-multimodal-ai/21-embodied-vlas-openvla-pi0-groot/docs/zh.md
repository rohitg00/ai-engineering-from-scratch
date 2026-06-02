# 具身 VLA：RT-2、OpenVLA、π0、GR00T

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 第一次有模型从网页上读取菜谱、然后在厨房机器人里把它执行出来，是 RT-2（Google DeepMind，2023 年 7 月）。RT-2 把动作离散化为文本 token，在网页数据加机器人动作数据上对一个 VLM 做联合微调（co-fine-tune），证明了网页规模的视觉-语言知识可以迁移到机器人控制。OpenVLA（2024 年 6 月）放出了开源的 7B 参考实现。Physical Intelligence 的 π0 系列（2024-2025）加入了基于 flow-matching 的动作专家。NVIDIA 的 GR00T N1（2025 年 3 月）则把双系统（System 1 / System 2）控制规模化地交付给了人形机器人。VLA 这个原语 —— vision-language-action（视觉-语言-动作），一个能看、能读、能动的单一模型 —— 是本阶段的理解类模型与第 15 阶段自主系统之间的桥梁。

**Type:** Learn
**Languages:** Python (stdlib, action tokenizer + VLA inference skeleton)
**Prerequisites:** Phase 12 · 05 (LLaVA), Phase 15 (Autonomous Systems, referenced)
**Time:** ~180 minutes

## 学习目标（Learning Objectives）

- 描述动作 tokenization：离散分桶编码（RT-2）、FAST 高效动作 token、连续 flow-matching 动作（π0）。
- 解释为什么在网页 + 机器人数据上做联合微调能够保留通用知识向新任务的迁移能力。
- 在同一个机器人任务上比较 OpenVLA（开源 7B Llama+VLM）、π0（flow-matching）和 GR00T N1（双系统）。
- 说出 Open X-Embodiment 数据集的名字以及它作为 RT-X 训练语料的角色。

## 问题（The Problem）

让机器人按自然语言指令做家务，从 1970 年代起就是一个研究目标。2020 年代的答案：vision-language-action（VLA）模型。架构和做 VQA 的 VLM 一样，只是输出从文本换成了动作（关节力矩、末端执行器位姿、离散指令）。

VLA 特有的挑战：

1. 动作空间是连续的（关节角、力）且高维（7-DOF 手臂 + 3-DOF 夹爪 = 30 Hz 下 10 维）。
2. 机器人专属训练数据稀缺。Open X-Embodiment 大约 1M 条轨迹；网页文本-图像有 5B+。
3. 控制频率很重要。30 Hz 控制环意味着每个动作只有 33ms 预算。
4. 安全。一个错误动作会损伤硬件、人或财产。

## 概念（The Concept）

### 动作 tokenization（RT-2）

RT-2 的小技巧：把每个关节目标表示成一个量化后的文本 token。把归一化的 [-1, 1] 区间离散为 256 桶，每桶映射到一个词表 ID。一个 10-DOF 动作在每个控制步会变成 10 个 token。

在一个混合数据上联合微调一个 PaLM-X VLM：

- 网页图文对（caption、VQA）。
- 机器人示范，动作以 token 形式呈现。

模型看到「pick up the red cube」（语言）→ 图像（视觉）→ 10-token 动作序列（离散化的关节目标）。网页预训练保留了通用知识迁移：RT-2 能跟随「move towards the fast-moving object」，哪怕「fast-moving」并没有出现在训练数据里。

RT-2 论文里的推理是 3-5 Hz，受限于 VLM 的 autoregressive decode。

### OpenVLA —— 开源 7B 参考实现

OpenVLA（Kim et al.，2024 年 6 月）是 RT-2 的开权重等价物。7B Llama backbone，DINOv2 + SigLIP 双视觉 encoder，动作 tokenization 走 256 桶。

在 Open X-Embodiment（22 个机器人共 970k 条轨迹）上训练。自带 LoRA 微调支持，方便适配新机器人。

推理：A100 + 量化下 4-5 Hz。够用于慢速操作，不够高频控制。

### FAST tokenizer —— 更快的动作 decode

Pertsch et al.（2024）指出离散分桶 tokenization 是低效的 —— 大多数动作集中在桶空间的一个小区域里。FAST（Frequency-domain Action Sequence Tokenizer）通过 DCT 压缩动作序列，再对系数做量化。

一个 30 步的动作轨迹会变成约 10 个 FAST token，而不是 300 个离散桶 token。推理因此提速 3-5 倍且不损失质量。

### π0 与 flow-matching 动作

Physical Intelligence 的 π0（Black et al.，2024 年 10 月）用一个 flow-matching 动作专家替换掉离散动作 token：

- 一个小动作 transformer 读取 VLM 的隐状态，通过 rectified flow 输出连续的 50 步动作序列。
- 动作头用 flow-matching 损失训练；VLM 预训练保持不变。
- 推理：完整动作序列在约 5 步去噪内输出，等效 50 Hz 控制。

π0 的说法是：在一大批操作任务上击败 OpenVLA 和 Octo。连续动作的表述保留了离散化会破坏的平滑性。

π0.5 和 π0-FAST 是增量升级。π0-FAST 把 FAST tokenization 与 flow matching 结合起来。

### GR00T N1 —— 面向人形的双系统

NVIDIA 的 GR00T N1（2025 年 3 月）是给人形机器人造的（>30 DOF，全身）：

- System 2：一个大 VLM 读取场景 + 指令，以 ~1 Hz 产出高层子目标。
- System 1：一个小动作头 transformer，在子目标条件下产出 50-100 Hz 的低层关节指令。

这个划分对应到 Kahneman 的快慢思考：System 2 规划，System 1 行动。好处：VLM 量级的慢规划不阻塞快控制；System 1 保持小巧以保证延迟。

GR00T N1.7（2025 年末）改进了数据扩展。GR00T 用 Omniverse 出来的 sim-to-real 数据做微调。

### Open X-Embodiment

训练数据。RT-X（2023 年 10 月）汇集了 22 个数据集，覆盖 22 种机器人共 1M 条轨迹。Open X-Embodiment 是大家都在用的语料：

- ALOHA / Bridge V2 / Droid / RT-2 Kitchen / Language Table。
- 每个样本：(机器人状态、相机视角、指令、动作序列)。
- 训练卫生：统一动作空间、归一化关节范围、resize 相机。

OpenVLA 和 π0 都在 Open X-Embodiment 上训练。任何具体机器人的 domain gap 通过在 100-1000 条任务专属示范上做 LoRA 微调来弥合。

### 联合微调 vs 仅机器人

联合微调把网页 VQA 数据与机器人轨迹混合。比例很关键：VQA 太多模型会忘记动作；机器人数据太多模型会丢失通用知识。

RT-2 的比例：约 1:1。OpenVLA：网页:机器人 约 0.5:1。π0：类似。具体比例是一个超参，要随数据集规模调。

只用机器人数据训出的是任务专属模型，遇到分布外指令就会失败。联合微调是「pick up the red cube（示范里有）」与「pick up the third largest object from the left（新颖措辞）」之间的差距。

### 安全与动作限制

每一个生产环境的 VLA 都会带上：

- 硬关节限位（不能力矩超规）。
- 速度限位（软裁剪）。
- 工作空间边界（末端执行器不能离开桌面）。
- 新颖任务的 human-in-the-loop（人工确认）审批。

这些都是位于 VLA 之外的控制层检查。VLA 的输出是建议，不是指令。

## 用起来（Use It）

`code/main.py`：

- 实现 256 桶的动作 tokenization 与反 tokenization。
- 草拟一个基于 DCT + 量化的 FAST tokenizer。
- 比较每个动作步的 token 数（离散桶、FAST、连续 flow 三者）。
- 打印一份 RT-2 → OpenVLA → π0 → GR00T 的脉络小结。

## 上线部署（Ship It）

本课产出 `outputs/skill-vla-action-format-picker.md`。给定一个机器人任务（操作、导航、人形全身），在「离散桶 + RT-2」「FAST + OpenVLA」「flow-matching + π0」「双系统 + GR00T」之间做选择。

## 练习（Exercises）

1. 一个 10-DOF 手臂、30 Hz 控制率。256 桶的离散桶 tokenization 每秒产出多少 token？一个 7B VLM 跟得上吗？

2. FAST tokenization 把 30 步轨迹压成约 10 token。如果轨迹有高频运动（比如打鼓），用户会损失什么？

3. π0 的 flow-matching 头大约 5 步去噪。把它的吞吐和 OpenVLA 4-5 Hz 的 autoregressive decode 比较一下。

4. GR00T 的 System 1 / System 2 划分对应 Kahneman。提出一个不同的划分（System 3？），可能有助于双足行走。

5. 阅读 Open X-Embodiment 论文第 4 节关于数据集筛选的部分。说出阻止 domain 泄漏的三条筛选规则。

## 关键术语（Key Terms）

| 术语 | 一般人怎么说 | 它实际指的是什么 |
|------|-----------------|------------------------|
| VLA | "Vision-language-action" | 接收图像 + 指令、输出动作指令的模型 |
| 动作 tokenization | "Discrete bins"（离散桶） | 把每一维的连续关节目标量化到 256 桶，每桶一个词表 ID |
| FAST tokenizer | "Frequency action tokens"（频域动作 token） | 用 DCT + 量化把 30 步轨迹压到约 10 token |
| Co-fine-tune | "Mix web + robot"（混网页 + 机器人） | 在网页 VQA 数据和机器人示范上一起训练，以保留通用知识 |
| Flow-matching 动作头 | "π0 continuous output"（π0 的连续输出） | 通过 rectified flow 输出 50 步动作序列的小 transformer |
| System 1 / System 2 | "Dual-system control"（双系统控制） | 大 VLM 慢慢规划，小动作头快速行动；GR00T 的范式 |
| Open X-Embodiment | "RT-X dataset"（RT-X 数据集） | 1M 条轨迹的跨机器人数据集；训练语料 |

## 延伸阅读（Further Reading）

- [Brohan et al. — RT-2 (arXiv:2307.15818)](https://arxiv.org/abs/2307.15818)
- [Kim et al. — OpenVLA (arXiv:2406.09246)](https://arxiv.org/abs/2406.09246)
- [Black et al. — π0 (arXiv:2410.24164)](https://arxiv.org/abs/2410.24164)
- [NVIDIA — GR00T N1 (arXiv:2503.14734)](https://arxiv.org/abs/2503.14734)
- [Open X-Embodiment Collab — RT-X (arXiv:2310.08864)](https://arxiv.org/abs/2310.08864)
