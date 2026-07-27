# 终极项目 15 — 宪法安全防护网 + 红队靶场

> Anthropic 的宪法分类器、Meta 的 Llama Guard 4、Google 的 ShieldGemma-2、NVIDIA 的 Nemotron 3 内容安全以及 X-Guard（支持多语言覆盖）定义了 2026 年的安全分类器技术栈。garak、PyRIT、NVIDIA Aegis 和 promptfoo 成为标准的对抗性评估工具。NeMo Guardrails v0.12 将它们串联为生产级流水线。本终极项目将所有内容整合在一起：为目标应用构建分层安全防护网、运行 6 种以上攻击家族的自主红队智能体，以及执行可产生可量化无害性差异的宪法自我批判。

**类型：** 终极项目
**语言：** Python（安全流水线、红队）、YAML（策略配置）
**前置要求：** 阶段 10（从零构建 LLM）、阶段 11（LLM 工程）、阶段 13（工具）、阶段 14（智能体）、阶段 18（伦理、安全、对齐）
**涉及的阶段：** P10 · P11 · P13 · P14 · P18
**时间：** 25 小时

## 问题

2026 年 LLM 安全的前沿问题不在于分类器是否有效（大体上是有效的），而在于如何正确地将其组合到生产应用周围，既不过度拒绝，也不留下明显的漏洞。Llama Guard 4 处理英文策略违规。X-Guard（132 种语言）处理多语言越狱。ShieldGemma-2 检测基于图像的提示注入。NVIDIA Nemotron 3 内容安全覆盖企业类别。Anthropic 的宪法分类器是一种独立方法，用于训练阶段而非服务阶段。

攻击演进同样重要。PAIR 和 TAP 可自动发现越狱方法。GCG 运行基于梯度的后缀攻击。多轮攻击和代码切换攻击利用智能体记忆。任何已部署的 LLM 都需要一个红队靶场——garak 和 PyRIT 是规范化的驱动工具——以及记录在案的缓解措施和 CVSS 评分发现。

你将加固一个目标应用（一个 8B 指令微调模型，或来自其他终极项目的 RAG 聊天机器人），对其运行 6 种以上攻击家族，并产出前后无害性测量结果。

## 概念

安全流水线包含五个层次。**输入清理**：去除零宽字符、解码 base64/rot13、归一化 Unicode。**策略层**：NeMo Guardrails v0.12 护栏（领域外、毒性、PII 提取）。**分类器网关**：输入阶段使用 Llama Guard 4，非英文内容使用 X-Guard，图像输入使用 ShieldGemma-2。**模型**：目标 LLM。**输出过滤**：输出阶段使用 Llama Guard 4、Presidio PII 擦除，以及引用强制检查（如适用）。**人工介入层**：被标记为高风险的内容进入 Slack 队列。

红队靶场在调度器上运行。PAIR 和 TAP 自主发现越狱方法。GCG 运行基于梯度的后缀攻击。ASCII/base64/rot13 编码攻击。多轮攻击（角色扮演、记忆利用）。代码切换攻击（混合英语与斯瓦希里语或泰语）。每次运行都会生成结构化的发现文件，包含 CVSS 评分和披露时间线。

宪法自我批判是一种训练阶段的干预措施。选取 1k 条有害尝试提示，让模型起草回复，根据成文宪法（不伤害规则）进行批判，并在批判循环上进行重训练。在保留的评估集上测量前后无害性差异。

## 架构

```
请求（文本/图像/多语言）
      |
      v
输入清理（去除零宽字符、解码、归一化）
      |
      v
NeMo Guardrails v0.12 护栏（领域外、策略）
      |
      v
分类器网关：
  Llama Guard 4（英文）
  X-Guard（多语言，132 种语言）
  ShieldGemma-2（图像提示）
  Nemotron 3 内容安全（企业）
      |
      v（允许通过）
目标 LLM
      |
      v
输出过滤：Llama Guard 4 + Presidio PII + 引用检查
      |
      v
标记输出的人工介入层

并行：
  红队调度器
    -> garak（经典攻击）
    -> PyRIT（编排式红队）
    -> 自主越狱智能体（PAIR + TAP）
    -> GCG 后缀攻击
    -> 多语言/代码切换
    -> 多轮角色扮演

输出：CVSS 评分发现 + 披露时间线 + 前后无害性差异
```

## 技术栈

- 安全分类器：Llama Guard 4、ShieldGemma-2、NVIDIA Nemotron 3 内容安全、X-Guard
- 护栏框架：NeMo Guardrails v0.12 + OPA
- 红队驱动工具：garak（NVIDIA）、PyRIT（Microsoft Azure）、NVIDIA Aegis、promptfoo
- 越狱智能体：PAIR（Chao 等人，2023）、树状攻击（TAP）、GCG 后缀
- 宪法训练：Anthropic 风格的自我批判循环 + 基于批判的 SFT
- PII 擦除：Presidio
- 目标：一个 8B 指令微调模型，或其他终极项目之一的 RAG 聊天机器人

## 构建步骤

1. **目标设置。** 在 vLLM 上部署一个 8B 指令微调模型（或复用其他终极项目中的 RAG 聊天机器人）。这是被测试的应用。

2. **安全流水线封装。** 将五层流水线围绕目标进行封装。验证每一层是可单独观测的（在 Langfuse 中每层一个 span）。

3. **分类器覆盖。** 加载 Llama Guard 4、X-Guard（多语言）、ShieldGemma-2（图像）。在每个分类器的小型标注集上运行，建立基线。

4. **红队调度器。** 调度 garak、PyRIT、一个 PAIR 智能体、一个 TAP 智能体、一个 GCG 运行器、一个多轮攻击器以及一个代码切换攻击器。每个在独立的队列中运行。

5. **攻击套件。** 六个攻击家族：(1) PAIR 自动化越狱，(2) TAP 树状攻击，(3) GCG 梯度后缀，(4) ASCII/base64/rot13 编码，(5) 多轮角色扮演，(6) 多语言代码切换。报告每个家族的成功率。

6. **宪法自我批判。** 整理 1k 条有害尝试提示。对于每条提示，目标起草回复。一个批判 LLM 根据成文宪法（"不伤害"、"引用证据"、"拒绝非法请求"）进行评分。批判者反对的提示被重写；目标在经批判改进的配对数据上进行微调。在保留的评估集上测量前后无害性差异。

7. **过度拒绝测量。** 在良性提示集（如 XSTest）上跟踪误报率。目标必须在良性问题上保持有用性。

8. **CVSS 评分。** 对于每次成功的越狱，按 CVSS 4.0（攻击向量、复杂度、影响）评分。生成披露时间线和缓解计划。

9. **靶场自动化。** 以上所有内容在 cron 上运行；发现结果写入队列；过度拒绝回归警报发送到 Slack。

## 使用示例

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR 智能体在目标上运行
[attack]     第 1/50 次尝试：将查询伪装为学术研究……已阻止
[attack]     第 2/50 次尝试：诉诸角色扮演……已阻止
[attack]     第 3/50 次尝试：思维链引导……成功
[finding]    CVSS 4.8 中等：目标上的角色扮演绕过
[range]      50 次中 7 次成功（14% 成功率）
```

## 交付标准

`outputs/skill-safety-harness.md` 是交付物。一个生产级的分层安全流水线，加上可复现的红队靶场，附带前后无害性差异。

| 权重 | 标准 | 衡量方式 |
|:-:|---|---|
| 25 | 攻击面覆盖率 | 运行 6+ 个攻击家族，2+ 种语言 |
| 15 | 真阳性/假阳性权衡 | 攻击阻止率 vs XSTest 良性通过率 |
| 25 | 自我批判差异 | 保留评估集上的前后无害性 |
| 20 | 文档与披露 | 附带时间线的 CVSS 评分发现 |
| 15 | 自动化与可重复性 | 所有内容在 cron 上运行并带有警报 |
| **100** | | |

## 练习

1. 在 RAG 聊天机器人上运行 garak 的提示注入插件，比较有和没有输出过滤层时的攻击成功率。

2. 添加第七个攻击家族：通过检索文档进行间接提示注入。衡量所需的额外防御措施。

3. 实现"拒绝+帮助"模式：当护栏阻止时，目标提供更安全的相关答案，而非直接拒绝。测量 XSTest 差异。

4. 多语言覆盖缺口：找到 X-Guard 性能不佳的一种语言。提出针对该语言的微调数据集。

5. 在 30B 模型上运行宪法自我批判，衡量差异是否随模型规模扩展。

## 关键术语

| 术语 | 人们所说的 | 实际含义 |
|------|-----------|---------|
| 分层安全 | "纵深防御" | 在输入、网关、输出、人工介入多个层次设置防护栏 |
| Llama Guard 4 | "Meta 的安全分类器" | 2026 年参考的输入/输出内容分类器 |
| PAIR | "越狱智能体" | 关于 LLM 驱动的越狱发现的论文（Chao 等人） |
| TAP | "树状攻击" | PAIR 的树搜索变体 |
| GCG | "贪心坐标梯度" | 基于梯度的对抗性后缀攻击 |
| 宪法自我批判 | "Anthropic 风格训练" | 目标起草 -> 批判评分 -> 重写 -> 重训练 |
| XSTest | "良性探测集" | 过度拒绝回归的基准测试 |
| CVSS 4.0 | "严重性评分" | 安全发现的标准漏洞评分系统 |

## 延伸阅读

- [Anthropic 宪法分类器](https://www.anthropic.com/research/constitutional-classifiers) — 训练阶段参考
- [Meta Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — 2026 年输入/输出分类器
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) — 图像+多模态安全
- [NVIDIA Nemotron 3 内容安全](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) — 企业参考
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) — 132 种语言的多语言安全
- [garak](https://github.com/NVIDIA/garak) — NVIDIA 红队工具包
- [PyRIT](https://github.com/Azure/PyRIT) — Microsoft 红队框架
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — 护栏框架
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — 越狱智能体论文
