# Capstone 15 — 宪法式安全防护层 + 红队靶场

> Anthropic 的 Constitutional Classifiers、Meta 的 Llama Guard 4、Google 的 ShieldGemma-2、NVIDIA 的 Nemotron 3 Content Safety 以及面向多语言覆盖的 X-Guard，共同定义了 2026 年的安全分类器技术栈。garak、PyRIT、NVIDIA Aegis 和 promptfoo 已成为标准对抗评估工具。NeMo Guardrails v0.12 将它们串联为生产级流水线。本 Capstone 将这一切整合起来：围绕目标应用的分层安全防护层、运行 6 类以上攻击家族的自主红队智能体，以及产生可测量无害性增量的宪法式自我批评运行。

**Type:** Capstone
**Languages:** Python（安全流水线、红队）、YAML（策略配置）
**Prerequisites:** Phase 10（从零构建 LLM）、Phase 11（LLM 工程）、Phase 13（工具）、Phase 14（智能体）、Phase 18（伦理、安全、对齐）
**Phases exercised:** P10 · P11 · P13 · P14 · P18
**Time:** 25 小时

## 问题

2026 年 LLM 安全的前沿问题不再是分类器是否有效（大体上有效），而是如何在生产应用周围正确地组合它们，既不过度拒答，也不留下明显漏洞。Llama Guard 4 处理英文政策违规。X-Guard（132 种语言）处理多语言越狱。ShieldGemma-2 捕捉基于图像的提示注入。NVIDIA Nemotron 3 Content Safety 覆盖企业类目。Anthropic 的 Constitutional Classifiers 则是一种独立的方法，用于训练阶段而非推理服务阶段。

攻击演化同样重要。PAIR 和 TAP 自动化越狱发现。GCG 运行基于梯度的后缀攻击。多轮和语码转换攻击利用智能体记忆。任何已部署的 LLM 都需要一个红队靶场——garak 和 PyRIT 是经典的驱动工具——外加有据可查的缓解措施和 CVSS 评分的发现。

你将对一个目标应用（8B 指令微调模型或其他 capstone 中的 RAG 聊天机器人）进行加固，对其运行 6 类以上攻击家族，并产出一个前后对比的无害性测量。

## 概念

安全流水线分为五层。**输入净化**：去除零宽字符、解码 base64/rot13、Unicode 归一化。**策略层**：NeMo Guardrails v0.12 rails（越域、毒性、PII 提取）。**分类器闸门**：输入用 Llama Guard 4，非英文用 X-Guard，图像输入用 ShieldGemma-2。**模型**：目标 LLM。**输出过滤**：输出用 Llama Guard 4，Presidio PII 清洗，适用处强制引用来源。**HITL 层**：被标记为高风险的输出进入 Slack 队列。

红队靶场按调度运行。PAIR 和 TAP 自主发现越狱。GCG 运行基于梯度的后缀攻击。ASCII / base64 / rot13 编码攻击。多轮攻击（人设采纳、记忆利用）。语码转换攻击（英文混以斯瓦希里语或泰语）。每次运行产出结构化的发现文件，包含 CVSS 评分和披露时间线。

宪法式自我批评运行是一次训练期干预。取 1k 条有害意图提示，让模型起草回复，依据成文宪法（不伤害规则）进行批评，再基于批评回路进行再训练。在留出的评测集上测量前后无害性增量。

## 架构

```
request (text / image / multilingual)
      |
      v
input sanitize (strip zero-width, decode, normalize)
      |
      v
NeMo Guardrails v0.12 rails (off-domain, policy)
      |
      v
classifier gate:
  Llama Guard 4 (English)
  X-Guard (multilingual, 132 langs)
  ShieldGemma-2 (image prompts)
  Nemotron 3 Content Safety (enterprise)
      |
      v (allowed)
target LLM
      |
      v
output filter: Llama Guard 4 + Presidio PII + citation check
      |
      v
HITL tier for flagged outputs

parallel:
  red-team scheduler
    -> garak (classic attacks)
    -> PyRIT (orchestrated red team)
    -> autonomous jailbreak agent (PAIR + TAP)
    -> GCG suffix attacks
    -> multilingual / code-switch
    -> multi-turn persona adoption

output: CVSS-scored findings + disclosure timeline + before/after harmlessness delta
```

## 技术栈

- 安全分类器：Llama Guard 4、ShieldGemma-2、NVIDIA Nemotron 3 Content Safety、X-Guard
- 防护栏框架：NeMo Guardrails v0.12 + OPA
- 红队驱动：garak（NVIDIA）、PyRIT（Microsoft Azure）、NVIDIA Aegis、promptfoo
- 越狱智能体：PAIR（Chao 等，2023）、Tree-of-Attacks（TAP）、GCG 后缀
- 宪法式训练：Anthropic 风格的自我批评回路 + 基于批评的 SFT
- PII 清洗：Presidio
- 目标：8B 指令微调模型或其他 capstone 的 RAG 聊天机器人

```figure
cf-safety-stack
```

## 构建步骤

1. **目标搭建。** 在 vLLM 上部署一个 8B 指令微调模型（或复用其他 capstone 的 RAG 聊天机器人）。这是被测应用。

2. **安全流水线包裹。** 围绕目标接好五层流水线。验证每一层都可单独观测（Langfuse 中每层一个 span）。

3. **分类器覆盖。** 加载 Llama Guard 4、X-Guard（多语言）、ShieldGemma-2（图像）。在小标注集上运行每一个，以建立基线。

4. **红队调度。** 调度 garak、PyRIT、PAIR 智能体、TAP 智能体、GCG 运行器、多轮攻击者、语码转换攻击者。每个在独立队列上运行。

5. **攻击套件。** 六类攻击家族：(1) PAIR 自动化越狱，(2) TAP 攻击树，(3) GCG 梯度后缀，(4) ASCII / base64 / rot13 编码，(5) 多轮人设，(6) 多语言语码转换。报告每个家族的成功率。

6. **宪法式自我批评。** 策划 1k 条有害意图提示。对每条，由目标起草回复。批评 LLM 依据成文宪法（"不伤害"、"引用证据"、"拒绝非法请求"）评分。批评者提出异议的提示被重写；目标在批评改进后的配对上微调。在留出的评测集上测量前后无害性。

7. **过度拒答测量。** 在良性提示套件（如 XSTest）上追踪假阳性率。目标必须对良性问题保持有用性。

8. **CVSS 评分。** 对每个成功越狱，按 CVSS 4.0 评分（攻击向量、复杂度、影响）。产出披露时间线和缓解计划。

9. **靶场自动化。** 以上全部在 cron 上运行；发现写入队列；过度拒答回归告警发送到 Slack。

## 使用

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## 交付

`outputs/skill-safety-harness.md` 是交付物。一套生产级的分层安全流水线，加上可复现的红队靶场及前后无害性增量。

| 权重 | 标准 | 测量方式 |
|:-:|---|---|
| 25 | 攻击面覆盖 | 6 类以上攻击家族，2 种以上语言 |
| 20 | 真阳性 / 假阳性权衡 | 攻击拦截率 vs XSTest 良性通过率 |
| 20 | 自我批评增量 | 留出评测集上的前后无害性 |
| 20 | 文档与披露 | 带 CVSS 评分和时间线的发现 |
| 15 | 自动化与可重复性 | 全部在 cron 上运行并带告警 |
| **100** | | |

## 练习

1. 在 RAG 聊天机器人上运行 garak 的提示注入插件，比较有和没有输出过滤层时的攻击成功率。

2. 增加第七类攻击家族：通过检索文档进行间接提示注入。测量所需的额外防御。

3. 实现"带帮助的拒答"模式：当防护栏拦截时，目标提供更安全的相关答案而非直接拒绝。测量 XSTest 增量。

4. 多语言覆盖缺口：找到 X-Guard 表现不佳的一种语言。提出针对该语言的微调数据集。

5. 在 30B 模型上运行宪法式自我批评，测量增量是否随规模扩大。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 分层安全 | "纵深防御" | 输入、闸门、输出、HITL 处的多重防护栏 |
| Llama Guard 4 | "Meta 的安全分类器" | 2026 年的参考输入/输出内容分类器 |
| PAIR | "越狱智能体" | 关于 LLM 驱动越狱发现的论文（Chao 等） |
| TAP | "Tree-of-Attacks" | PAIR 的树搜索变体 |
| GCG | "贪心坐标梯度" | 基于梯度的对抗后缀攻击 |
| 宪法式自我批评 | "Anthropic 风格训练" | 目标起草 -> 批评者评分 -> 重写 -> 再训练 |
| XSTest | "良性探针集" | 过度拒答回归的基准测试 |
| CVSS 4.0 | "严重性评分" | 面向安全发现的标准漏洞评分 |

## 延伸阅读

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) — 训练期参考
- [Meta Llama Guard 4](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/) — 2026 年的输入/输出分类器
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) — 图像 + 多模态安全
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) — 企业参考
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) — 132 种语言的多语言安全
- [garak](https://github.com/NVIDIA/garak) — NVIDIA 红队工具包
- [PyRIT](https://github.com/Azure/PyRIT) — Microsoft 红队框架
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — rail 框架
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — 越狱智能体论文