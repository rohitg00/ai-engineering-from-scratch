# 15 · 宪法式安全护栏与红队攻防靶场

> Anthropic 的宪法分类器、Meta 的 Llama Guard 4、Google 的 ShieldGemma-2、NVIDIA 的 Nemotron 3 Content Safety 以及覆盖多语言的 X-Guard，共同定义了 2026 年的安全分类器技术栈。garak、PyRIT、NVIDIA Aegis 和 promptfoo 已成为标准的对抗性评估工具。NeMo Guardrails v0.12 将它们串联为生产管线。本结业项目将这一切整合起来：围绕目标应用构建分层安全护栏、运行覆盖 6+ 攻击类型的自主红队智能体、以及产出可量化无害性提升的宪法式自我 critique 流程。

**类型：** 结业项目
**语言：** Python（安全管线、红队）、YAML（策略配置）
**前置：** 第 10 阶段（从零实现 LLM）、第 11 阶段（LLM 工程）、第 13 阶段（工具）、第 14 阶段（智能体）、第 18 阶段（伦理、安全与对齐）
**涉及阶段：** P10 · P11 · P13 · P14 · P18
**时长：** 25 小时

## 问题

2026 年 LLM 安全的前沿问题不在于分类器是否有效（它们大致是有效的），而在于如何在生产应用中正确地组合它们，既不造成过度拒绝，也不留下明显的漏洞。Llama Guard 4 处理英语策略违规。X-Guard（132 种语言）处理多语言越狱。ShieldGemma-2 捕获基于图像的提示注入。NVIDIA Nemotron 3 Content Safety 覆盖企业级类别。Anthropic 的宪法分类器（Constitutional Classifiers）则是一种不同的方法，用于训练阶段而非推理服务。

攻击演进同样重要。PAIR 和 TAP 实现了自动化越狱发现。GCG 运行基于梯度的后缀攻击。多轮对话攻击和语码转换攻击则利用智能体记忆。任何部署的 LLM 都需要一个红队攻防靶场 —— garak 和 PyRIT 是当前的主流驱动工具 —— 以及记录在案的缓解措施和 CVSS 评分的发现结果。

你将加固一个目标应用（可以是一个 8B 指令微调模型，也可以是其他结业项目中的某个 RAG 聊天机器人），对其运行 6+ 攻击类型，并产出加固前后的无害性对比度量。

## 概念

安全管线包含五层。**输入净化**：去除零宽字符、解码 base64/rot13、Unicode 标准化。**策略层**：NeMo Guardrails v0.12 护栏（离线域、毒性、PII 提取）。**分类器闸门**：输入经由 Llama Guard 4 检测，非英语输入经由 X-Guard 检测，图像输入经由 ShieldGemma-2 检测。**模型**：目标 LLM。**输出过滤**：输出经由 Llama Guard 4 检测、Presidio PII 脱敏、引用合规校验。**HITL 层**：标记为高风险的输出进入 Slack 队列。

红队靶场按调度器运行。PAIR 和 TAP 自主发现越狱方法。GCG 运行基于梯度的后缀攻击。ASCII / base64 / rot13 编码攻击。多轮对话攻击（角色扮演、记忆利用）。语码转换攻击（混合英语与斯瓦希里语或泰语）。每次运行产出结构化的发现文件，包含 CVSS 评分和披露时间线。

宪法式自我 critique 流程是一种训练阶段干预。取 1k 条有害尝试提示，让模型起草回复，由 critique LLM 根据书面宪法（不伤害规则）评分，对 critique 提出异议的提示重新撰写回复，最后在 critique 改进后的配对数据上微调目标模型。在留出评估集上量化加固前后的无害性提升。

## 架构

```
请求（文本 / 图像 / 多语言）
      |
      v
输入净化（去除零宽字符、解码、标准化）
      |
      v
NeMo Guardrails v0.12 护栏（离线域、策略）
      |
      v
分类器闸门：
  Llama Guard 4（英语）
  X-Guard（多语言，132 种语言）
  ShieldGemma-2（图像提示）
  Nemotron 3 Content Safety（企业级）
      |
      v（放行）
目标 LLM
      |
      v
输出过滤：Llama Guard 4 + Presidio PII + 引用校验
      |
      v
HITL 层（标记输出）

并行管线：
  红队调度器
    -> garak（经典攻击）
    -> PyRIT（编排式红队）
    -> 自主越狱智能体（PAIR + TAP）
    -> GCG 后缀攻击
    -> 多语言 / 语码转换
    -> 多轮角色扮演

输出：CVSS 评分发现 + 披露时间线 + 加固前后无害性提升
```

## 技术栈

- 安全分类器：Llama Guard 4、ShieldGemma-2、NVIDIA Nemotron 3 Content Safety、X-Guard
- 护栏框架：NeMo Guardrails v0.12 + OPA
- 红队驱动：garak（NVIDIA）、PyRIT（Microsoft Azure）、NVIDIA Aegis、promptfoo
- 越狱智能体：PAIR（Chao et al., 2023）、Tree-of-Attacks (TAP)、GCG 后缀攻击
- 宪法式训练：Anthropic 风格的自我 critique 循环 + 基于 critique 的 SFT
- PII 脱敏：Presidio
- 目标模型：8B 指令微调模型或其他结业项目的 RAG 聊天机器人

## 构建过程

1. **目标搭建。** 在 vLLM 上部署一个 8B 指令微调模型（或复用其他结业项目的 RAG 聊天机器人）。这是被测试的应用。

2. **安全管线封装。** 围绕目标搭建五层安全管线。验证每一层都可独立观测（每层在 Langfuse 中为一个 span）。

3. **分类器覆盖。** 加载 Llama Guard 4、X-Guard（多语言）、ShieldGemma-2（图像）。各自在小型标注集上运行，建立基线。

4. **红队调度器。** 调度 garak、PyRIT、PAIR 智能体、TAP 智能体、GCG 运行器、多轮攻击器和语码转换攻击器。每种攻击运行在独立队列上。

5. **攻击套件。** 六种攻击类型：（1）PAIR 自动化越狱，（2）TAP 攻击树搜索，（3）GCG 梯度后缀攻击，（4）ASCII / base64 / rot13 编码攻击，（5）多轮角色扮演攻击，（6）多语言语码转换攻击。按攻击类型报告成功率。

6. **宪法式自我 critique。** 收集 1k 条有害尝试提示。对每条提示，目标模型起草回复。critique LLM 根据书面宪法（「不造成伤害」「引用证据」「拒绝非法请求」）评分。critique 提出异议的提示被重新撰写；目标模型在 critique 改进后的配对数据上微调。在留出评估集上量化加固前后的无害性。

7. **过度拒绝度量。** 在良性提示套件（如 XSTest）上跟踪误报率。目标应用必须在良性问题上保持有帮助性。

8. **CVSS 评分。** 对每次成功的越狱，按 CVSS 4.0 评分（攻击向量、复杂度、影响）。产出披露时间线和缓解方案。

9. **靶场自动化。** 以上所有步骤按 cron 定时运行；发现结果写入队列；过度拒绝回退告警发送至 Slack。

## 使用方式

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## 交付标准

`outputs/skill-safety-harness.md` 是交付物。即一套生产级的分层安全管线，加上一个可复现的红队攻防靶场，以及加固前后的无害性提升对比。

| 权重 | 评估标准 | 度量方式 |
|:-:|---|---|
| 25 | 攻击面覆盖 | 覆盖 6+ 攻击类型、2+ 语言 |
| 20 | 真阳性/假阳性权衡 | 攻击拦截率 vs XSTest 良性通过率 |
| 20 | 自我 critique 提升幅度 | 留出评估集上加固前后的无害性 |
| 20 | 文档与披露 | CVSS 评分的发现结果及时间线 |
| 15 | 自动化与可复现性 | 全部流程按 cron 运行并发送告警 |
| **100** | | |

## 练习

1. 在 RAG 聊天机器人上运行 garak 的提示注入插件，比较有/无输出过滤层时的攻击成功率。

2. 添加第七种攻击类型：通过检索文档进行的间接提示注入。衡量所需的额外防御措施。

3. 实现「拒绝但提供帮助」模式：当护栏拦截时，目标应用提供更安全的替代回答，而非直接拒绝。测量 XSTest 的变化。

4. 多语言覆盖缺口：找出 X-Guard 表现不佳的一种语言。提出针对性的微调数据集。

5. 在 30B 模型上运行宪法式自我 critique，测量无害性提升幅度是否随模型规模而扩展。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 分层安全 | "纵深防御" | 在输入、闸门、输出、HITL 多层设置护栏 |
| Llama Guard 4 | "Meta 的安全分类器" | 2026 年的参考级输入/输出内容分类器 |
| PAIR | "越狱智能体" | 论文 (Chao et al.) 提出的 LLM 驱动的越狱发现 |
| TAP | "攻击树" | PAIR 的树搜索变体 |
| GCG | "贪心坐标梯度" | 基于梯度的对抗性后缀攻击 |
| 宪法式自我 critique | "Anthropic 风格训练" | 目标起草 -> critique 评分 -> 重写 -> 再训练 |
| XSTest | "良性探测集" | 用于检测过度拒绝回退的基准测试 |
| CVSS 4.0 | "严重性评分" | 用于安全发现的标准漏洞评分体系 |

## 延伸阅读

- [Anthropic 宪法分类器](https://www.anthropic.com/research/constitutional-classifiers) — 训练阶段参考
- [Meta Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — 2026 年输入/输出分类器
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) — 图像 + 多模态安全
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) — 企业级参考
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) — 132 语言多语言安全
- [garak](https://github.com/NVIDIA/garak) — NVIDIA 红队工具包
- [PyRIT](https://github.com/Azure/PyRIT) — Microsoft 红队框架
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — 护栏框架
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — 越狱智能体论文
