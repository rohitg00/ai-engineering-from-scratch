# Capstone 15 — Constitutional Safety Harness + Red-Team Range（宪法式安全护栏 + 红队靶场）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Anthropic 的 Constitutional Classifiers、Meta 的 Llama Guard 4、Google 的 ShieldGemma-2、NVIDIA 的 Nemotron 3 Content Safety，以及覆盖多语种的 X-Guard，共同定义了 2026 年的安全分类器栈。garak、PyRIT、NVIDIA Aegis 和 promptfoo 成了对抗性评估的标准工具。NeMo Guardrails v0.12 把它们串进了一条生产流水线。本 capstone 把这一切连起来：在目标应用周围套一层分层安全护栏，跑一个能自主执行 6+ 攻击族的红队 agent，再做一轮 constitutional self-critique（宪法式自我批判），产出一个可量化的无害性 delta。

**Type:** Capstone
**Languages:** Python（安全流水线、红队），YAML（策略配置）
**Prerequisites:** Phase 10（从零实现 LLM）、Phase 11（LLM 工程）、Phase 13（工具）、Phase 14（agent）、Phase 18（伦理、安全、对齐）
**Phases exercised:** P10 · P11 · P13 · P14 · P18
**Time:** 25 hours

## 问题（Problem）

2026 年 LLM 安全的前沿，问题已经不是分类器到底能不能用（基本能用），而是怎么把它们正确地组合在生产应用周围，既不过度拒答，也不留明显漏洞。Llama Guard 4 处理英文策略违规。X-Guard（132 种语言）处理多语种 jailbreak。ShieldGemma-2 抓基于图像的 prompt injection。NVIDIA Nemotron 3 Content Safety 覆盖企业类目。Anthropic 的 Constitutional Classifiers 是另一条路线，用于训练阶段而非线上服务。

攻击的演化也很关键。PAIR 和 TAP 自动化发现 jailbreak。GCG 跑基于 gradient 的后缀攻击。多轮和 code-switch 攻击利用 agent 的记忆。任何一个上线的 LLM 都需要一个红队靶场——garak 和 PyRIT 是公认的驱动器——再加上有据可查的缓解措施和按 CVSS 评分的发现报告。

你将加固一个目标应用（要么是一个 8B 指令微调模型，要么是其它 capstone 里的某个 RAG 聊天机器人），对它跑 6+ 攻击族，并产出一份 before/after 的无害性度量。

## 概念（Concept）

安全流水线分五层。**输入清洗（input sanitize）**：剥离零宽字符、解码 base64/rot13、Unicode 归一化。**策略层（policy layer）**：NeMo Guardrails v0.12 的 rail（越界领域、毒性、PII 提取）。**分类器闸门（classifier gate）**：Llama Guard 4 看输入、X-Guard 看非英文、ShieldGemma-2 看图像输入。**模型（model）**：目标 LLM。**输出过滤（output filter）**：Llama Guard 4 看输出、Presidio 做 PII 清洗、按需做引用强制校验。**HITL 层**：被标记为高风险的输出进入 Slack 队列等待人工处理。

红队靶场跑在调度器上。PAIR 和 TAP 自主发现 jailbreak。GCG 跑基于 gradient 的后缀攻击。还有 ASCII / base64 / rot13 编码攻击。多轮攻击（人格扮演、记忆利用）。Code-switch 攻击（英文混斯瓦希里语或泰语）。每次跑都产出一个结构化 findings 文件，附带 CVSS 评分和披露时间线。

Constitutional self-critique 这一轮是训练时干预。拿 1k 条有害意图的 prompt，让模型先起草一版回答，再按一份成文的 constitution（不可作恶规则）来 critique 它，然后在这个 critique 循环上重新训练。在留出 eval 上度量 before/after 的无害性 delta。

## 架构（Architecture）

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

## 技术栈（Stack）

- 安全分类器：Llama Guard 4、ShieldGemma-2、NVIDIA Nemotron 3 Content Safety、X-Guard
- Guardrail（护栏）框架：NeMo Guardrails v0.12 + OPA
- 红队驱动器：garak（NVIDIA）、PyRIT（Microsoft Azure）、NVIDIA Aegis、promptfoo
- Jailbreak agent：PAIR（Chao 等，2023）、Tree-of-Attacks（TAP）、GCG suffix
- Constitutional 训练：Anthropic 风格的 self-critique 循环 + 在 critique 上做 SFT
- PII 清洗：Presidio
- 目标：一个 8B 指令微调模型，或者其它 capstone 里的某个 RAG 聊天机器人

## 动手实现（Build It）

1. **目标搭建（Target setup）。** 用 vLLM 拉起一个 8B 指令微调模型（或者复用其它 capstone 的某个 RAG 聊天机器人）。这就是被测应用。

2. **安全流水线包裹（Safety pipeline wrap）。** 把五层流水线接到目标周围。验证每一层都单独可观测（在 Langfuse 里每层一个 span）。

3. **分类器覆盖（Classifier coverage）。** 加载 Llama Guard 4、X-Guard（多语种）、ShieldGemma-2（图像）。在一个小规模带标签集合上分别跑一遍，建立基线。

4. **红队调度器（Red-team scheduler）。** 调度 garak、PyRIT、一个 PAIR agent、一个 TAP agent、一个 GCG runner、一个多轮攻击器、一个 code-switch 攻击器。每个跑在独立队列上。

5. **攻击套件（Attack suite）。** 六个攻击族：(1) PAIR 自动 jailbreak，(2) TAP tree-of-attacks，(3) GCG gradient suffix，(4) ASCII / base64 / rot13 编码，(5) 多轮人格扮演，(6) 多语种 code-switch。按族报告成功率。

6. **Constitutional self-critique。** 收集 1k 条有害意图 prompt。对每条，目标先起草一版回答。一个 critic LLM 按一份成文的 constitution（"不可作恶"、"援引证据"、"拒绝违法请求"）打分。被 critic 反对的 prompt 会被改写；目标在 critique 改进过的样本对上做微调。在一份留出 eval 上度量 before/after 的无害性。

7. **过度拒答度量（Over-refusal measurement）。** 在一组良性 prompt 套件（比如 XSTest）上追踪 false-positive 率。目标必须在良性问题上仍然乐于帮忙。

8. **CVSS 评分。** 对每一次成功的 jailbreak，按 CVSS 4.0 打分（攻击向量、复杂度、影响）。产出披露时间线和缓解计划。

9. **靶场自动化（Range automation）。** 上面所有东西都跑在 cron 上；findings 写入队列；过度拒答的回归会通过 Slack 告警。

## 用起来（Use It）

```
$ safety probe --model=target --family=PAIR --budget=50
[attacker]   PAIR agent running on target
[attack]     attempt 1/50: disguise query as academic research ... blocked
[attack]     attempt 2/50: appeal to roleplay ... blocked
[attack]     attempt 3/50: chain-of-thought coax ... SUCCEEDED
[finding]    CVSS 4.8 medium: roleplay bypass on target
[range]      7 successes out of 50 (14% success rate)
```

## 上线部署（Ship It）

`outputs/skill-safety-harness.md` 就是交付物。一条生产级的分层安全流水线，加上一个可复现的红队靶场，并附带 before/after 无害性 delta。

| 权重 | 评分项 | 度量方式 |
|:-:|---|---|
| 25 | 攻击面覆盖 | 跑过 6+ 攻击族，2+ 语种 |
| 20 | True-positive / false-positive 权衡 | 攻击拦截率 vs XSTest 良性通过率 |
| 20 | Self-critique delta | 留出 eval 上的 before/after 无害性 |
| 20 | 文档与披露 | 带时间线的 CVSS 评分 findings |
| 15 | 自动化与可重复性 | 一切都跑在 cron 上并有告警 |
| **100** | | |

## 练习（Exercises）

1. 在一个 RAG 聊天机器人上跑 garak 的 prompt-injection 插件，比较带不带输出过滤层时的攻击成功率。

2. 加一个第七攻击族：通过被检索文档实施的间接 prompt injection。度量需要额外多少防御。

3. 实现一个 "refuse-with-help"（拒答但帮忙）模式：当 guardrail 拦下时，目标给出一个更安全的相关回答，而不是简单粗暴地拒答。度量 XSTest delta。

4. 多语种覆盖缺口：找一个 X-Guard 表现不佳的语种。提出一个针对它的微调数据集方案。

5. 在一个 30B 模型上跑 constitutional self-critique，看看 delta 会不会随规模放大。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|------|-----------------|------------------------|
| Layered safety | "纵深防御" | 在输入、闸门、输出、HITL 多处叠加 guardrail |
| Llama Guard 4 | "Meta 的安全分类器" | 2026 年的输入/输出内容分类器参考方案 |
| PAIR | "Jailbreak agent" | Chao 等的论文，讲 LLM 驱动的 jailbreak 发现 |
| TAP | "Tree-of-Attacks" | PAIR 的树搜索变体 |
| GCG | "Greedy coordinate gradient" | 基于 gradient 的对抗性后缀攻击 |
| Constitutional self-critique | "Anthropic 风格训练" | 目标起草 -> critic 打分 -> 改写 -> 重训 |
| XSTest | "良性探针集" | 用来回归过度拒答的基准 |
| CVSS 4.0 | "严重度评分" | 安全 finding 的标准漏洞评分 |

## 延伸阅读（Further Reading）

- [Anthropic Constitutional Classifiers](https://www.anthropic.com/research/constitutional-classifiers) — 训练时方案参考
- [Meta Llama Guard 4](https://ai.meta.com/research/publications/llama-guard-4/) — 2026 年的输入/输出分类器
- [Google ShieldGemma-2](https://huggingface.co/google/shieldgemma-2b) — 图像 + 多模态安全
- [NVIDIA Nemotron 3 Content Safety](https://developer.nvidia.com/blog/building-nvidia-nemotron-3-agents-for-reasoning-multimodal-rag-voice-and-safety/) — 企业方案参考
- [X-Guard (arXiv:2504.08848)](https://arxiv.org/abs/2504.08848) — 132 语种多语种安全
- [garak](https://github.com/NVIDIA/garak) — NVIDIA 红队工具包
- [PyRIT](https://github.com/Azure/PyRIT) — Microsoft 红队框架
- [NeMo Guardrails v0.12](https://docs.nvidia.com/nemo-guardrails/) — rail 框架
- [PAIR (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — jailbreak agent 论文
