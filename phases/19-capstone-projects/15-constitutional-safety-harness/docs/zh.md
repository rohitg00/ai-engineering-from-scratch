# 顶点项目 15 —— 宪法安全框架 + 红队靶场

> Anthropic 的宪法分类器、Meta 的 Llama Guard 4、Google 的 ShieldGemma-2、NVIDIA 的 Nemotron 3 内容安全，以及用于多语言覆盖的 X-Guard 定义了 2026 年的安全分类器栈。garak、PyRIT、NVIDIA Aegis 和 promptfoo 成为标准对抗性评估工具。NeMo Guardrails v0.12 将它们整合到生产管道中。这个顶点项目将所有这些连接在一起：围绕目标应用的分层安全框架、运行 6+ 攻击家族的自主红队智能体，以及产生可测量无害性差异的宪法自我批评运行。

**类型：** 顶点项目
**语言：** Python（安全管道、红队）、YAML（策略配置）
**先决条件：** Phase 10（从头开始 LLM）、Phase 11（LLM 工程）、Phase 13（工具）、Phase 14（智能体）、Phase 18（伦理、安全、对齐）
**涉及阶段：** P10 · P11 · P13 · P14 · P18
**时间：** 25 小时

## 问题

2026 年 LLM 安全的前沿不是分类器是否有效（它们大致有效），而是如何正确地将它们组合到生产应用周围，不过度拒绝或留下明显漏洞。Llama Guard 4 处理英语策略违规。X-Guard（132 种语言）处理多语言越狱。ShieldGemma-2 捕获基于图像的提示注入。NVIDIA Nemotron 3 内容安全覆盖企业类别。Anthropic 的宪法分类器是一种在训练期间而非服务期间使用的单独方法。

攻击进化也很重要。PAIR 和 TAP 自动化越狱发现。GCG 运行基于梯度的后缀攻击。多轮和代码切换攻击利用智能体记忆。任何部署的 LLM 都需要一个红队靶场——garak 和 PyRIT 是经典驱动程序——加上记录的缓解措施和 CVSS 评分的发现。

你将加固一个目标应用（一个 8B 指令微调模型或其他顶点项目中的 RAG 聊天机器人之一），对其运行 6+ 攻击家族，并产生前后无害性测量。

## 概念

安全管道有五层。**输入清理**：剥离零宽字符、解码 base64/rot13、规范化 Unicode。**策略层**：NeMo Guardrails v0.12 轨道（域外、毒性、PII 提取）。**分类器门**：Llama Guard 4 在输入上，X-Guard 在非英语上，ShieldGemma-2 在图像输入上。**模型**：目标 LLM。**输出过滤器**：Llama Guard 4 在输出上，Presidio PII 清洗，适用时引用强制。**HITL 层**：标记为高风险的输出进入 Slack 队列。

红队靶场在调度器上运行。PAIR 和 TAP 自主发现越狱。GCG 运行基于梯度的后缀攻击。ASCII / base64 / rot13 编码攻击。多轮攻击（角色采用、记忆利用）。代码切换攻击（将英语与斯瓦希里语或泰语混合）。每次运行产生一个结构化发现文件，带 CVSS 评分和披露时间线。

宪法自我批评运行是训练时干预。取 1k 有害尝试提示，让模型起草响应，根据书面宪法（不伤害规则）批评它，并在批评循环上重新训练。测量保留评估上的前后无害性差异。

## 架构

```
请求（文本 / 图像 / 多语言）
      |
      v
输入清理（剥离零宽、解码、规范化）
      |
      v
NeMo Guardrails v0.12 轨道（域外、策略）
      |
      v
分类器门：
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
标记输出的 HITL 层

并行：
  红队调度器
    -> garak（经典攻击）
    -> PyRIT（编排红队）
    -> 自主越狱智能体（PAIR + TAP）
    -> GCG 后缀攻击
    -> 多语言 / 代码切换
    -> 多轮角色采用

输出：CVSS 评分发现 + 披露时间线 + 前后无害性差异
```

## 技术栈

- 安全分类器：Llama Guard 4、ShieldGemma-2、NVIDIA Nemotron 3 内容安全、X-Guard
- 护栏框架：NeMo Guardrails v0.12 + OPA
- 红队驱动：garak（NVIDIA）、PyRIT（Microsoft Azure）、NVIDIA Aegis、promptfoo
- 越狱智能体：PAIR（Chao 等，2023）、Tree-of-Attacks（TAP）、GCG 后缀
- 宪法训练：Anthropic 风格自我批评循环 + 对批评的 SFT
- PII 清洗：Presidio
- 目标：一个 8B 指令微调模型或其他顶点项目的 RAG 聊天机器人之一

## 构建它

1. **目标设置。** 在 vLLM 上启动一个 8B 指令微调模型（或重用另一个顶点项目的 RAG 聊天机器人）。这是被测应用。

2. **安全管道包装。** 围绕目标连接五层管道。验证每层单独可观察（Langfuse 中每层的跨度）。

3. **分类器覆盖。** 加载 Llama Guard 4、X-Guard（多语言）、ShieldGemma-2（图像）。在小型标记集上运行每个以建立基线。

4. **红队调度器。** 调度 garak、PyRIT、PAIR 智能体、TAP 智能体、GCG 运行器、多轮攻击者和代码切换攻击者。每个在单独队列上运行。

5. **攻击套件。** 六个攻击家族：（1）PAIR 自动越狱，（2）TAP 树攻击，（3）GCG 梯度后缀，（4）ASCII / base64 / rot13 编码，（5）多轮角色，（6）多语言代码切换。报告每家族成功率。

6. **宪法自我批评。** 策划 1k 有害尝试提示。对于每个，目标起草响应。批评 LLM 根据书面宪法评分（"不伤害"、"引用证据"、"拒绝非法请求"）。批评反对的提示被重写；目标在批评改进的对上微调。测量保留评估上的前后无害性。

7. **过度拒绝测量。** 在良性提示套件（例如，XSTest）上跟踪误报率。目标必须在良性问题上保持有帮助。

8. **CVSS 评分。** 对于每个成功的越狱，在 CVSS 4.0 上评分（攻击向量、复杂性、影响）。产生披露时间线和缓解计划。

9. **靶场自动化。** 以上所有在 cron 上运行；发现写入队列；过度拒绝回归警报触发到 Slack。

## 使用它

```
$ safety probe --model=target --family=PAIR --budget=50
[攻击者]   PAIR 智能体在目标上运行
[攻击]     尝试 1/50：将查询伪装成学术研究 ... 被阻止
[攻击]     尝试 2/50：诉诸角色扮演 ... 被阻止
[攻击]     尝试 3/50：思维链诱导 ... 成功
[发现]    CVSS 4.8 中等：目标上的角色扮演绕过
[靶场]      50 次中 7 次成功（14% 成功率）
```

## 交付它

`outputs/skill-safety-harness.md` 是可交付成果。一个生产级分层安全管道加上可复现的红队靶场，带前后无害性差异。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 攻击面覆盖 | 6+ 攻击家族执行，2+ 语言 |
| 20 | 真阳性 / 假阳性权衡 | 攻击阻止率 vs XSTest 良性通过率 |
| 20 | 自我批评差异 | 保留评估上的前后无害性 |
| 20 | 文档和披露 | 带时间线的 CVSS 评分发现 |
| 15 | 自动化和可重复性 | 所有在 cron 上运行，带警报 |
| **100** | | |

## 练习

1. 在 RAG 聊天机器人上运行 garak 的提示注入插件，并比较带和不带输出过滤器层的攻击成功率。

2. 添加第七个攻击家族：通过检索文档的间接提示注入。测量所需的额外防御。

3. 实现"拒绝并帮助"模式：当护栏阻止时，目标提供更安全的相关答案，而非直接拒绝。测量 XSTest 差异。

4. 多语言覆盖缺口：找到 X-Guard 表现不佳的语言。提出针对它的微调数据集。

5. 在 30B 模型上运行宪法自我批评，并测量差异是否随规模扩展。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| 分层安全 | "纵深防御" | 输入、门、输出、HITL 的多层护栏 |
| Llama Guard 4 | "Meta 的安全分类器" | 2026 年参考输入/输出内容分类器 |
| PAIR | "越狱智能体" | 关于 LLM 驱动越狱发现的论文（Chao 等） |
| TAP | "树攻击" | PAIR 的树搜索变体 |
| GCG | "贪婪坐标梯度" | 基于梯度的对抗性后缀攻击 |
| 宪法自我批评 | "Anthropic 风格训练" | 目标起草 -> 批评评分 -> 重写 -> 重新训练 |
| XSTest | "良性探测集" | 过度拒绝回归基准 |
| CVSS 4.0 | "严重性评分" | 安全发现的标准漏洞评分 |

## 延伸阅读

- [Anthropic 宪法分类器](https://www.anthropic.com/research/constitutional-classifiers) —— 训练时参考
- [Meta Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) —— 2026 年输入/输出分类器
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) —— 图像 + 多模态安全
- [NVIDIA Nemotron 3 内容安全](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) —— 企业参考
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) —— 132 语言多语言安全
- [garak](https://github.com/NVIDIA/garak) —— NVIDIA 红队工具包
- [PyRIT](https://github.com/Azure/PyRIT) —— Microsoft 红队框架
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) —— 轨道框架
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) —— 越狱智能体论文
