# Capstone 17 — 个人 AI 家教（自适应、多模态、带记忆）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Khanmigo（Khan Academy）、Duolingo Max、Google LearnLM / Gemini for Education、Quizlet Q-Chat 和 Synthesis Tutor 都在 2026 年大规模上线了自适应多模态家教。它们的共同形态是：一个 Socratic（苏格拉底式）policy（绝不直接给答案）、一个每次交互后都会更新的 learner model（学习者模型，Bayesian knowledge tracing 风格）、语音 + 文本 + 拍照解题的输入、curriculum graph（课程图谱）检索、间隔重复调度，以及针对低龄内容的硬性安全过滤。本 capstone 的任务是上线一个学科特定的家教（K-12 代数或 Python 入门），用 10 位学习者跑一次为期两周的效果研究，并通过一次内容安全审计。

**Type:** Capstone
**Languages:** Python（后端、learner model）、TypeScript（Web 应用）、SQL（curriculum graph，基于 Postgres + Neo4j）
**Prerequisites:** Phase 5（NLP）、Phase 6（语音）、Phase 11（LLM 工程）、Phase 12（多模态）、Phase 14（agent）、Phase 17（基础设施）、Phase 18（安全）
**Phases exercised:** P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 hours

## 问题（Problem）

自适应家教曾经是教育科技领域的小众研究方向。到了 2026 年，它已经是一个消费级产品。Khanmigo 已部署在大多数美国学区。Duolingo Max 月活到了几千万级。Google 的 LearnLM / Gemini for Education 为 Google Classroom 提供家教能力。Quizlet Q-Chat 和闪卡并列出现。Synthesis Tutor 凭借「面向好奇宝宝的家教」走红。它们的共同元素是：多模态输入（打字、说话、拍方程式）、Socratic 教学法（先问再讲）、每次交互后都会更新的 learner model，以及严格的、与年龄相适配的安全过滤。

你要为某个特定群体造一个这样的产品。衡量门槛是一次真实的效果研究：在两周时间内，对 10 位学习者做前测和后测打分。语音回路必须自然（复用 capstone 03 的子栈）。记忆必须尊重隐私。安全过滤要通过一次 COPPA 感知的红队测试，目标群体是 K-12。

## 概念（Concept）

四个组件。**Tutor policy（家教策略）**是一个 Socratic 循环：当学习者来要答案时，policy 反过来抛一个引导性问题；当学习者答对了，policy 推进到下一个概念；当学习者卡住了，policy 给一段有脚手架的提示。**Learner model** 是 Bayesian knowledge tracing（或它的简化变种），每次交互后更新该 curriculum 节点上的 mastery（掌握）概率。**Curriculum graph** 是一个 Neo4j，节点是概念，边是前置依赖；policy 在图上行走来挑下一个概念。**Memory** 是一个 episodic + semantic（情景 + 语义）存储（agentmemory 风格），保存过往交互、错误和偏好。

UX 是多模态的。文本输入用于打字作答。语音输入走 LiveKit + Whisper（复用 capstone 03）。数学题的拍照输入走 dots.ocr 或 PaliGemma 2。语音输出走 Cartesia Sonic-2。安全方面用 Llama Guard 4 加上一个年龄分级过滤器（屏蔽成人内容、暴力、自残），以及一个 COPPA 感知的记忆保留策略。

效果研究是最终交付物。10 位学习者、前测后测、两周。报告 learning gain（学习增益）的差值和置信区间。和一个非自适应的 baseline（基准）做对比——同样的内容线性投放、不走 tutor policy。

## 架构（Architecture）

```
learner device
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents (ASR + TTS)
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy (LangGraph)
       - Socratic decision head
       - next-concept chooser (curriculum graph walk)
       - hint scaffolder
       - mastery update
       |
       v
  learner model (BKT / item-response theory)
       - per-concept mastery probability
       - spaced-repetition scheduler (SM-2 or FSRS)
       |
       v
  memory (agentmemory-style)
       - episodic: every interaction
       - semantic: learned mistakes, preferences
       - retention policy: COPPA / GDPR aware
       |
       v
  curriculum graph (Neo4j)
       - prerequisite edges
       - OER content attached
       |
       v
  safety:
    Llama Guard 4 + age-appropriate filter
    memory access guarded by learner ID scope
```

## 技术栈（Stack）

- 学科选择：K-12 代数 或 Python 入门（挑一个做深）
- Tutor policy：LangGraph 跑在 Claude Sonnet 4.7 上（带 prompt caching）
- Learner model：Bayesian knowledge tracing（经典款）或 FSRS（用于间隔安排）
- Curriculum graph：Neo4j，节点是概念，边是前置依赖，并挂上 OER 内容
- Memory：agentmemory 风格的持久向量 + episodic + semantic 存储
- 语音：LiveKit Agents 1.0 + Cartesia Sonic-2（复用 capstone 03 子栈）
- 拍照解题：dots.ocr 或 PaliGemma 2，做方程识别
- 安全：Llama Guard 4 + 自定义的年龄分级过滤器
- 评估：Bloom 分级题目生成、前/后测试 harness、效果研究工具

## 动手实现（Build It）

1. **Curriculum graph。** 构建一个 50–150 节点的 Neo4j 概念图（例如 K-12 代数从「数轴」一路到「求根公式」），边是前置依赖。每个节点挂上 OER 内容（Open Textbook、OpenStax）。

2. **Learner model。** 用先验初始化 Bayesian knowledge tracing：guess、slip、learn-rate。每次交互后更新该概念的 mastery。按 learner 持久化。

3. **Tutor policy。** 一个 LangGraph，节点包括：`read_signal`（学习者的回答是对的、部分对、还是卡住？）、`select_concept`（在 curriculum graph 上走，挑出优先级最高的概念）、`scaffold`（Socratic prompt）、`update_mastery`。

4. **Memory。** 每次交互写入一个 episodic 存储。错误和偏好被提升到 semantic memory。COPPA 感知的保留策略：1 年后自动删除，家长可访问。

5. **语音通路。** 一个 LiveKit Agents worker 接到 tutor policy 上。ASR 走 Whisper-v3-turbo。TTS 走 Cartesia Sonic-2。支持 barge-in（复用 capstone 03 的机制）。

6. **拍照解题通路。** 上传或拍摄图像；跑 dots.ocr 或 PaliGemma 2 识别方程；以结构化输入喂给 tutor。

7. **安全。** 每个模型输出都过 Llama Guard 4 + 一个年龄分级过滤器（屏蔽自残、成人内容、暴力）。记忆访问按 learner ID 做 scope；提供面向家长的删除入口。

8. **效果研究。** 10 位学习者，前测（标准化 30 题基线）、两周的家教交互（每周 3 次）、后测。和一个 10 位学习者的非自适应 baseline 队列在同样内容上做对比。

9. **每周进度报告。** 给每位学习者自动生成一份 PDF 摘要，列出本周覆盖的话题、mastery 轨迹和推荐的下一步。

## 用起来（Use It）

```
learner: "I don't understand why 3x + 6 = 12 means x = 2"
[signal]   stuck
[concept]  'isolating variables' (prerequisite: addition-subtraction-equality)
[scaffold] "what number would you subtract from both sides to start?"
learner: "6"
[signal]   correct
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  continue 'isolating variables'
[scaffold] "great. now what is 3x / 3 equal to?"
```

## 上线部署（Ship It）

`outputs/skill-ai-tutor.md` 就是交付物。一个学科特定的自适应家教，具备多模态输入、learner model、记忆、安全，以及实测过的效果数据。

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | Learning gain delta | 10 位学习者两周研究中的前/后测差值 |
| 20 | Socratic fidelity | 在 transcript 样本上的 rubric 打分 |
| 20 | Multimodal UX | 语音 + 拍照 + 文本端到端的连贯度 |
| 20 | Safety + privacy posture | Llama Guard 4 通过率 + COPPA 感知的保留策略 |
| 15 | Curriculum breadth and graph quality | 概念覆盖度 + 前置依赖图的一致性 |
| **100** | | |

## 练习（Exercises）

1. 跑两次效果研究：一次用自适应 learner model，一次不用（随机概念顺序）。报告差值。预期自适应会赢，但赢多少才是有趣的数字。

2. 加一个多模态探针：同一个概念题分别用文本、语音、拍照三种方式投放。测量学习者是否在自己偏好的模态下收敛得更快。

3. 做一个家长 dashboard：练过的题目、mastery 轨迹、即将进入的概念、安全事件（任何 guardrail（护栏）命中）。要符合 COPPA。

4. 加一个语言切换模式：tutor 接受西班牙语输入并用西班牙语教学。测量 X-Guard 的覆盖度。

5. 给记忆隐私施压：验证学习者 A 即使通过语音片段重新注入攻击，也无法看到学习者 B 的数据。把尝试访问的事件记录下来并告警。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Socratic policy | "Ask, do not dump" | 家教抛出引导性问题，而不是直接给答案 |
| Bayesian knowledge tracing | "BKT" | 经典的 learner-model 方程组，给出每个概念的 mastery 概率 |
| FSRS | "Free Spaced Repetition Scheduler" | 2024 年的间隔重复调度器，比 SM-2 更好 |
| Curriculum graph | "Concept DAG"（有向无环图） | 一个 Neo4j 概念图，边是前置依赖 |
| Episodic memory | "Per-interaction log" | 每次交互都被存下来供后续检索 |
| Semantic memory | "Learned pattern store" | 从 episodic 提升上来、被压缩过的错误和偏好 |
| COPPA | "Kids privacy law" | 美国法律，限制对 13 岁以下儿童的数据收集 |

## 延伸阅读（Further Reading）

- [Khanmigo (Khan Academy)](https://www.khanmigo.ai) — 消费级 K-12 家教参考
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) — 语言学习家教参考
- [Google LearnLM / Gemini for Education](https://blog.google/technology/google-deepmind/learnlm) — 托管参考模型
- [Quizlet Q-Chat](https://quizlet.com) — 备选参考
- [Synthesis Tutor](https://www.synthesis.com) — 创业公司参考
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) — 间隔重复调度器
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) — learner-model 经典之作
- [LiveKit Agents](https://github.com/livekit/agents) — 语音栈
