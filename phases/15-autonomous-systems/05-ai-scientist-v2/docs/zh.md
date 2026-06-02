# AI Scientist v2 — 工坊级（Workshop-Level）自主科研

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Sakana 的 AI Scientist v2（Yamada 等，arXiv:2504.08066）跑通了完整科研闭环：提出假设、写代码、做实验、画图、撰稿、投稿。它是史上第一个让生成的论文通过 ICLR 2025 工坊同行评审的系统。独立评测（Beel 等）发现 42% 的实验因代码错误而失败，文献综述常把已有概念误标为新颖。Sakana 自家文档也警告：这套代码库会执行 LLM 写出来的代码，建议用 Docker 隔离。这两面都是重点。

**Type:** Learn
**Languages:** Python（标准库，科研循环状态机玩具）
**Prerequisites:** Phase 15 · 03（AlphaEvolve）、Phase 15 · 04（DGM）
**Time:** ~60 分钟

## 问题（Problem）

科研是开放式任务。不像 AlphaEvolve 的算法搜索或 DGM 受 benchmark 边界约束的自我修改，科研结论没有机器可校验的正确性判据。论文是由审稿人评判，不是单元测试。这让闭环更难收口——但一旦收口价值更高，因为科研是复利式进步的发源地。

AI Scientist v1（Sakana, 2024）靠人写的模板来闭环。LLM 在固定脚手架内填入实验。AI Scientist v2（Yamada 等, 2025）则用「带视觉-语言模型批评循环的 agentic 树搜索」去掉模板需求。系统自己生成想法、实现实验、产出图表、撰写论文，并依据审稿反馈迭代。

同行评审裁决（verdict / 裁决）：一篇 v2 生成的论文在 ICLR 2025 工坊获录用（论文已披露身份）。独立评测裁决：系统离可靠还很远。两个裁决同时为真。

## 概念（Concept）

### 架构

1. **想法生成（Idea generation）。** LLM 基于主题和先前文献提出科研想法。v1 用模板；v2 在假设空间上做 agentic 搜索。
2. **新颖性检查（Novelty check）。** 一道文献检索环节判断想法是否已发表。Beel 等的评测发现误标恰恰发生在这一步——成熟方法常被判为新颖。
3. **实验方案（Experiment plan）。** Agent 起草实验协议并写代码。
4. **执行（Execution）。** 代码在沙盒中运行。失败被喂回重试循环。Beel 等测得：42% 的实验在此环节因代码错误而失败。
5. **图表生成（Figure generation）。** 视觉-语言模型读取生成的图表并重写以增强清晰度。这是 v2 的关键技术增量。
6. **撰稿（Writeup）。** LLM 起草论文，与内置 reviewer（验证器）反复迭代。
7. **可选：投稿（Submission）。** 论文投给某个会议/工坊。

### 工坊录用这个结果意味着什么

一篇 v2 生成的论文通过了 ICLR 2025 工坊的同行评审。作者向程序委员会披露了论文出处。这是一个数据点，不是「系统会做科研」的通行证。

重要语境：工坊论文比主会论文门槛更低。同行评审本身有噪声，任何一天总有一小部分投稿会被录用。一次成功是概念验证，不是可靠性主张。Nature 2026 那篇论文记录的是端到端循环本身，并且是由人类研究者共同署名的；不是「系统写了一篇 Nature」。

### 独立评测发现了什么

Beel 等（arXiv:2502.14297）做了外部评测。主要发现：

- **实验失败。** 42% 的实验因代码错误而失败（错误 import、shape 不匹配、未定义变量）。重试循环救回一些，并非全部。
- **新颖性误标。** 文献检索环节频繁把已有概念标为新颖。这是科研版的 hallucination（幻觉）。
- **呈现质量落差（Presentation-quality gap）。** 视觉-语言模型对图表的批评打磨产出了「发表级」视觉效果，反而掩盖了底层实验的薄弱。

最后一条对本阶段最关键。一个能产出令人信服结果但其实没做出令人信服科研的系统，比一个明显失败的系统更危险，而不是更安全。评估必须打到底层主张，不能止步于图。

### 沙盒逃逸隐患

Sakana 自家仓库 README 写道：

> Due to the nature of this software, which executes LLM-generated code, we cannot guarantee safety. There are risks of dangerous packages, uncontrolled web access, and spawning of unintended processes. Use at your own risk and consider Docker isolation.

这就是「在未经验证领域里运行自主性」的真实操作形态。LLM 写代码；代码运行；代码能做这个进程被允许做的一切。如果没有硬性限制文件系统、网络、进程动作的沙盒，任何自驱式科研 agent 都能外泄数据、烧算力，或者重写自己。

AlphaEvolve 的沙盒故事更好讲，因为它的评估器很紧。AI Scientist v2 的循环跑的是开放代码、追求开放目标。所以它需要更强的隔离（最低 Docker；优先 seccomp / gVisor）以及在论文离开系统前对每一份提交做人工审阅。

### v2 在前沿栈里的位置

| 系统 | 目标 | 输出形态 | 评估器 | 已知失败 |
|---|---|---|---|---|
| AlphaEvolve | 算法 | 代码 | 单元 + benchmark | 受评估器严谨度限制 |
| DGM | agent 脚手架 | 代码 | SWE-bench | reward hacking（奖励作弊） |
| AI Scientist v2 | 科研论文 | 文本 + 代码 + 图表 | 同行评审（弱） | 实验失败、误标、打磨掩盖薄弱 |

三者中 v2 的自动评估器最弱、输出面最宽、到公开产物的路径最短。安全工作主要靠运营层控制（沙盒、审阅、披露）来扛。

## 用起来（Use It)

`code/main.py` 把 v2 的循环模拟成一个状态机：想法 → 新颖性检查 → 实验 → 图表 → 撰稿 → 评审 → 录用-或-迭代。每个状态都带一个可配置的失败概率，取自 Beel 等的发现。把模拟器跑 N 轮，统计：

- 多少想法跑到投稿。
- 多少投稿其实带着关键实验缺陷，而被打磨过的论文掩盖。
- 重试预算如何在质量与产量之间权衡。

## 上线部署（Ship It）

`outputs/skill-ai-scientist-sandbox-review.md` 是一份两关式审阅清单，针对任何由科研循环 agent 产出的内容、在它离开沙盒之前使用。

## 练习（Exercises）

1. 用默认参数跑 `code/main.py`。多大比例的循环跑出「干净」论文？多大比例跑出带实验失败缺陷、却被图表批评打磨掩盖过去的论文？

2. 默认值已经用了 Beel 等的 42% / 25%。再用 `--experiment-failure 0.20 --novelty-mislabel 0.10` 跑一次，再用 `--experiment-failure 0.60 --novelty-mislabel 0.40` 跑一次。两次之间「打磨过但有缺陷」的比例如何变化？

3. 读 Sakana 的 AI Scientist v2 仓库 README 里关于沙盒要求的部分。列出两条额外限制（在 Docker 之外），你会在多日级自主运行中加上。

4. 读 Beel 等论文第 4 节关于 presentation-quality gap 的内容。设计一个额外的评估器，让它能抓住「外观打磨过但实验有缺陷」的论文。

5. 为科研 agent 的产出设计一套人工审阅协议，要比「让一个博士读每一篇论文」更可扩展。指出瓶颈所在，并围绕它做设计。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际是什么 |
|---|---|---|
| AI Scientist v1 | 「Sakana 的模板化科研 agent」 | 把实验填入固定脚手架 |
| AI Scientist v2 | 「无模板科研 agent」 | 带 VLM 图表批评的 agentic 树搜索 |
| Agentic tree search | 「分支型科研 agent」 | 并行扩展多套实验方案；由内部批评器剪枝 |
| Vision-language critique | 「VLM 给图表加抛光」 | 多模态模型读取图表并重写以增强清晰度 |
| Literature retrieval | 「新颖性检查」 | 搜索先前工作以确认想法的新颖性——已被记录会误标 |
| Polish masking（打磨掩盖） | 「论文好看，研究出问题」 | 呈现质量超出实验质量；掩盖薄弱 |
| Sandbox escape（沙盒逃逸） | 「LLM 代码跑出去了」 | Agent 执行的代码做了循环设计者未预期的事 |

## 延伸阅读（Further Reading）

- [Yamada et al. (2025). The AI Scientist-v2](https://arxiv.org/abs/2504.08066) — 论文。
- [Sakana blog on the Nature 2026 publication](https://sakana.ai/ai-scientist-nature/) — 厂商总结，含同行评审语境。
- [Beel et al. (2025). Independent evaluation of The AI Scientist](https://arxiv.org/abs/2502.14297) — 外部评测数据。
- [Sakana AI Scientist v1 paper](https://arxiv.org/abs/2408.06292) — 模板化前身。
- [Anthropic — Measuring AI agent autonomy](https://www.anthropic.com/research/measuring-agent-autonomy) — 对开放式科研 agent 更宽框架的讨论。
