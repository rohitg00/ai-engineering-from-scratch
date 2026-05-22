# 综合项目 15 — 宪法安全框架 + 红队靶场

> Anthropic 的宪法分类器、Meta 的 Llama Guard 4、Google 的 ShieldGemma-2、NVIDIA 的 Nemotron 3 内容安全，以及用于多语言覆盖的 X-Guard 定义了 2026 年的安全分类器技术栈。garak、PyRIT、NVIDIA Aegis 和 promptfoo 成为了标准对抗评估工具。NeMo Guardrails v0.12 将它们捆绑到生产管道中。本综合项目将所有这些连接在一起：围绕目标应用的分层安全框架、运行 6+ 攻击家族的自主红队智能体，以及产生可测量无害性增量的宪法自我批评运行。

**类型：** 综合项目
**语言：** Python（安全管道、红队）、YAML（策略配置）
**前置条件：** 第 10 阶段（从零构建 LLM）、第 11 阶段（LLM 工程）、第 13 阶段（工具）、第 14 阶段（智能体）、第 18 阶段（伦理、安全、对齐）
**涉及阶段：** P10 · P11 · P13 · P14 · P18
**时间：** 25 小时

## 问题描述

2026 年 LLM 安全的前沿不是分类器是否有效（它们大致有效），而是如何在不被过度使用或留下明显漏洞的情况下，在生产应用周围正确组合它们。Llama Guard 4 处理英语策略违规。X-Guard（132 种语言）处理多语言越狱。ShieldGemma-2 捕获基于图像的提示注入。NVIDIA Nemotron 3 内容安全覆盖企业类别。Anthropic 的宪法分类器是一种在训练期间而非服务期间使用的独立方法。

攻击演变同样重要。PAIR 和 TAP 自动化越狱发现。GCG 运行基于梯度的后缀攻击。多轮和代码切换攻击利用智能体记忆。任何已部署的 LLM 都需要一个红队靶场——garak 和 PyRIT 是规范驱动程序——加上已记录的缓解措施和 CVSS 评分的发现。

你将加固一个目标应用（一个 8B 指令调优模型或其他综合项目的 RAG 聊天机器人），对其运行 6+ 攻击家族，并产生前后无害性测量。

## 核心概念

安全管道有五层。**输入净化**：去除零宽字符、解码 base64/rot13、规范化 Unicode。**策略层**：NeMo Guardrails v0.12 栏杆（域外、毒性、PII 提取）。**分类器门控**：输入用 Llama Guard 4、非英语用 X-Guard、图像输入用 ShieldGemma-2。**模型**：目标 LLM。**输出过滤器**：输出用 Llama Guard 4、Presidio PII 清理、适用时的引用强制执行。**人在回路层**：输出标记为高风险时进入 Slack 队列。

红队靶场在调度器上运行。PAIR 和 TAP 自主发现越狱。GCG 运行基于梯度的后缀攻击。ASCII / base64 / rot13 编码攻击。多轮攻击（角色采用、记忆利用）。代码切换攻击（混合英语和斯瓦希里语或泰语）。每次运行产生一个带有 CVSS 评分和披露时间线的结构化发现文件。

宪法自我批评运行是训练时干预。获取 1k 有害尝试提示，让模型起草响应，根据书面宪法（不伤害规则）进行批评，并在批评循环上重新训练。在留出评估上测量前后无害性增量。

## 架构

```
请求（文本 / 图像 / 多语言）
      |
      v
输入净化（去除零宽、解码、规范化）
      |
      v
NeMo Guardrails v0.12 栏杆（域外、策略）
      |
      v
分类器门控：
  Llama Guard 4（英语）
  X-Guard（多语言，132 种语言）
  ShieldGemma-2（图像提示）
  Nemotron 3 内容安全（企业）
      |
      v（允许）
目标 LLM
      |
      v
输出过滤器：Llama Guard 4 + Presidio PII + 引用检查
      |
      v
高风险输出的人在回路层
```

并行：
```
  红队调度器
    -> garak（经典攻击）
    -> PyRIT（编排的红队）
    -> 自主越狱智能体（PAIR + TAP）
    -> GCG 后缀攻击
    -> 多语言 / 代码切换
    -> 多轮角色采用
```

输出：CVSS 评分的发现和披露时间线 + 前后无害性增量

## 技术栈

- 安全分类器：Llama Guard 4、ShieldGemma-2、NVIDIA Nemotron 3 内容安全、X-Guard
- 防护栏框架：NeMo Guardrails v0.12 + OPA
- 红队驱动程序：garak（NVIDIA）、PyRIT（Microsoft Azure）、NVIDIA Aegis、promptfoo
- 越狱智能体：PAIR（Chao 等人，2023）、Tree-of-Attacks（TAP）、GCG 后缀
- 宪法训练：Anthropic 风格的自我批评循环 + 批评上的 SFT
- PII 清理：Presidio
- 目标：一个 8B 指令调优模型或其他综合项目的 RAG 聊天机器人

## 构建步骤

1. **目标设置。** 在 vLLM 上部署一个 8B 指令调优模型（或重用另一个综合项目的 RAG 聊天机器人）。这是被测试的应用。

2. **安全管道封装。** 在目标周围连接五层管道。验证每一层都是可单独观测的（Langfuse 中每层的 span）。

3. **分类器覆盖。** 加载 Llama Guard 4、X-Guard（多语言）、ShieldGemma-2（图像）。在每个上运行一个小型标注集以建立基线。

4. **红队调度器。** 调度 garak、PyRIT、PAIR 智能体、TAP 智能体、GCG 运行器、多轮攻击者，以及代码切换攻击者。每个在独立队列上运行。

5. **攻击套件。** 六个攻击家族：(1) PAIR 自动化越狱，(2) TAP 树状攻击，(3) GCG 基于梯度的后缀，(4) ASCII / base64 / rot13 编码，(5) 多轮角色，(6) 多语言代码切换。报告每个家族的成功率。

6. **宪法自我批评。** 策划 1k 有害尝试提示。对于每个，目标起草响应。批评者 LLM 根据书面宪法（"不伤害"、"引用证据"、"拒绝非法请求"）评分。批评者反对的提示被重写；目标在批评改进的配对上进行微调。在留出评估上测量前后无害性。

7. **过度拒绝测量。** 在良性提示套件（例如 XSTest）上跟踪假阳性率。目标必须在良性问题上保持有用。

8. **CVSS 评分。** 对于每个成功的越狱，基于 CVSS 4.0 评分（攻击向量、复杂性、影响）。生成披露时间线和缓解计划。

9. **靶场自动化。** 以上所有内容都在 cron 上运行；发现写入队列；过度拒绝回归警报触发到 Slack。

## 使用示例

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR 智能体在目标上运行
[attack]     尝试 1/50：伪装为学术研究... 已阻止
[attack]     尝试 2/50：appeal to roleplay... 已阻止
[attack]     尝试 3/50：chain-of-thought coax... 成功
[finding]    CVSS 4.8 中等：目标上的角色扮演绕过
[range]      50 次中 7 次成功（14% 成功率）
```

## 交付成果

`outputs/skill-safety-harness.md` 是可交付成果。一个生产级分层安全管道，加上一个可重现的红队靶场，带有前后无害性增量。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 攻击面覆盖 | 运行 6+ 攻击家族，2+ 种语言 |
| 20 | 真阳性 / 假阳性权衡 | 攻击阻止率 vs XSTest 良性通过率 |
| 20 | 自我批评增量 | 在留出评估上的前后无害性 |
| 20 | 文档和披露 | 带有时间线的 CVSS 评分发现 |
| 15 | 自动化和可重现性 | 一切都在 cron 上运行，带有警报 |
| **100** | | |

## 练习

1. 在 RAG 聊天机器人上运行 garak 的提示注入插件，并比较有和没有输出过滤器层的攻击成功率。

2. 添加第七个攻击家族：通过检索文档的间接提示注入。测量所需的额外防御。

3. 实现"拒绝并帮助"模式：当防护栏阻止时，目标提供一个更安全的相关答案，而不是平淡的拒绝。测量 XSTest 增量。

4. 多语言覆盖差距：找到 X-Guard 表现不佳的语言。提出针对它的微调数据集。

5. 在 30B 模型上运行宪法自我批评，并测量增量是否规模化。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| 分层安全 | "深度防御" | 输入、门控、输出、人在回路的多重防护栏 |
| Llama Guard 4 | "Meta 的安全分类器" | 2026 年参考输入/输出内容分类器 |
| PAIR | "越狱智能体" | LLM 驱动越狱发现的论文（Chao 等人） |
| TAP | "树状攻击" | PAIR 的树搜索变体 |
| GCG | "贪心坐标梯度" | 基于梯度的对抗后缀攻击 |
| 宪法自我批评 | "Anthropic 风格训练" | 目标草案 -> 批评评分 -> 重写 -> 重新训练 |
| XSTest | "良性探测集" | 过度拒绝回归的基准测试 |
| CVSS 4.0 | "严重性评分" | 安全发现的标堆漏洞评分 |

## 延伸阅读

- [Anthropic 宪法分类器](https://www.anthropic.com/research/constitutional-classifiers) — 训练时参考
- [Meta Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — 2026 年输入/输出分类器
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) — 图像 + 多模态安全
- [NVIDIA Nemotron 3 内容安全](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) — 企业参考
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) — 132 种语言的多语言安全
- [garak](https://github.com/NVIDIA/garak) — NVIDIA 红队工具包
- [PyRIT](https://github.com/Azure/PyRIT) — 微软红队框架
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — 栏杆框架
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — 越狱智能体论文
