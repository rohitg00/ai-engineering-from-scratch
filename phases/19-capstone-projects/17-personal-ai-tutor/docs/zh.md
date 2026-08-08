# 17 · 个人 AI 导师（自适应、多模态、带记忆）

> Khanmigo（Khan Academy）、Duolingo Max、Google LearnLM / Gemini for Education、Quizlet Q-Chat 以及 Synthesis Tutor 在 2026 年均已大规模交付自适应多模态辅导。其共同形态是：苏格拉底式策略（Socratic Policy，绝不直接给答案）、在每次交互后更新的学习者模型（Learner Model，贝叶斯知识追踪风格）、语音 + 文本 + 拍照数学题输入、课程图谱（Curriculum Graph）检索、间隔重复调度，以及针对适龄内容的严格安全过滤。本结业项目要求交付一个面向特定学科的导师（K-12 代数或 Python 入门），对 10 名学习者进行为期两周的成效研究（efficacy study），并通过内容安全审计。

**类型：** 结业项目
**语言：** Python（后端、学习者模型）、TypeScript（Web 应用）、SQL（课程图谱，使用 Postgres + Neo4j）
**前置：** 第 5 步（NLP）、第 6 步（语音）、第 11 步（LLM 工程）、第 12 步（多模态）、第 14 步（智能体）、第 17 步（基础设施）、第 18 步（安全）
**涉及步骤：** P5 · P6 · P11 · P12 · P14 · P17 · P18
**时长：** 30 小时

## 问题

自适应辅导曾经是教育科技（ed-tech）领域的研究小众话题。到 2026 年，它已成为一款消费级产品。Khanmigo 已部署到美国大多数学区。Duolingo Max 月活用户数达数千万。Google 的 LearnLM / Gemini for Education 为 Google Classroom 提供辅导能力。Quizlet Q-Chat 与闪卡功能并列。Synthesis Tutor 凭借"为好奇的孩子打造的导师"这一理念实现病毒式传播。这些产品的共同要素包括：多模态输入（打字、语音、拍照上传方程式）、苏格拉底式教学法（先提问，后讲解）、在每次交互后更新的学习者模型，以及严格的适龄安全措施。

你将为一个特定群体构建这样一款产品。衡量标准是实际成效研究：对 10 名学习者进行为期两周的前测与后测（pre-test / post-test）。语音回路必须流畅自然（复用结业项目 03 的子技术栈）。记忆系统必须尊重隐私。安全过滤器必须通过面向 K-12 的 COPPA 合规红队测试。

## 概念

四个组件。**导师策略（Tutor Policy）** 是一个苏格拉底式循环：当学习者索要答案时，策略会提出引导性问题；当他们回答正确时，则进入下一个概念；当他们卡住时，则提供分步提示（scaffolded hint）。**学习者模型**采用贝叶斯知识追踪（Bayesian Knowledge Tracing, BKT）或其简化变体，在每次交互后更新每个课程图谱节点的掌握概率。**课程图谱**是 Neo4j 中带前置关系（prerequisite edge）的概念图；策略遍历该图谱以选择下一个概念。**记忆（Memory）** 是一个情景+语义存储（agentmemory 风格），保存过往交互、错误和偏好。

用户体验是多模态的。文本输入用于键入答案。语音输入通过 LiveKit + Whisper（复用结业项目 03）。拍照数学题输入通过 dots.ocr 或 PaliGemma 2。语音输出通过 Cartesia Sonic-2。安全方面使用 Llama Guard 4 加上适龄过滤器（屏蔽成人内容、暴力、自残）以及 COPPA 合规的记忆留存策略。

成效研究是交付物。10 名学习者，前测和后测，为期两周。报告学习增益差值（learning gain delta）和置信区间。与无自适应基线（即在无导师策略的情况下按线性方式交付相同内容）进行对比。

## 架构

```
learner device（学习者设备）
  |
  +-- text         -> web app
  +-- voice        -> LiveKit Agents（ASR + TTS）
  +-- photo math   -> dots.ocr / PaliGemma 2
       |
       v
  tutor policy（LangGraph）
       - Socratic decision head（苏格拉底式决策头）
       - next-concept chooser（下一概念选择器，课程图谱遍历）
       - hint scaffolder（提示搭建器）
       - mastery update（掌握度更新）
       |
       v
  learner model（BKT / 项目反应理论）
       - per-concept mastery probability（每个概念的掌握概率）
       - spaced-repetition scheduler（间隔重复调度器，SM-2 或 FSRS）
       |
       v
  memory（agentmemory 风格）
       - episodic（情景）：每次交互
       - semantic（语义）：习得的错误、偏好
       - retention policy（留存策略）：COPPA / GDPR 合规
       |
       v
  curriculum graph（Neo4j）
       - prerequisite edges（前置关系边）
       - OER content attached（附带的开放教育资源内容）
       |
       v
  safety（安全）：
    Llama Guard 4 + 适龄过滤器
    记忆访问受学习者 ID 范围限制
```

## 技术栈

- 学科选择：K-12 代数或 Python 入门（择一深入）
- 导师策略：基于 Claude Sonnet 4.7 的 LangGraph（启用 prompt caching）
- 学习者模型：经典贝叶斯知识追踪（BKT）或用于间隔调度的 FSRS
- 课程图谱：Neo4j 概念节点 + 前置关系边 + 开放教育资源（OER）内容
- 记忆：agentmemory 风格的持久化向量 + 情景 + 语义存储
- 语音：LiveKit Agents 1.0 + Cartesia Sonic-2（复用结业项目 03 子技术栈）
- 拍照数学题：dots.ocr 或 PaliGemma 2，用于方程式识别
- 安全：Llama Guard 4 + 自定义适龄过滤器
- 评估：Bloom 层级问题生成、前测/后测工具、成效研究工具

## 动手构建

1. **课程图谱。** 构建一个包含 50-150 个概念节点的 Neo4j 图（例如 K-12 代数，从"数轴"到"二次公式"），配上前置关系边。为每个节点附上 OER 内容（Open Textbook、OpenStax）。

2. **学习者模型。** 用先验参数初始化贝叶斯知识追踪：猜测率（guess）、失误率（slip）、学习率（learn-rate）。在每次交互后更新每个概念的掌握度。按学习者持久化存储。

3. **导师策略。** LangGraph 工作流，节点包括：`read_signal`（学习者的回答是正确的 / 部分正确 / 卡住了？）、`select_concept`（遍历课程图谱，选出优先级最高的概念）、`scaffold`（苏格拉底式提示）、`update_mastery`。

4. **记忆。** 每次交互写入情景存储。错误和偏好提升到语义记忆。COPPA 合规的留存策略：1 年后自动删除，家长可访问。

5. **语音通路。** LiveKit Agents worker 挂载到导师策略。ASR 使用 Whisper-v3-turbo。TTS 使用 Cartesia Sonic-2。支持打断（barge-in，复用结业项目 03 的机制）。

6. **拍照数学题通路。** 上传或拍摄图像；运行 dots.ocr 或 PaliGemma 2 识别方程式；将结构化输入送入导师。

7. **安全。** 每条模型输出都经过 Llama Guard 4 + 适龄过滤器（屏蔽自残、成人内容、暴力）。记忆访问按学习者 ID 限定范围；提供家长端删除入口。

8. **成效研究。** 10 名学习者，前测（标准化的 30 题基线测试），为期两周的导师互动（每周 3 次），后测。与接受相同内容的 10 名无自适应基线组进行对比。

9. **每周进度报告。** 为每位学习者自动生成一份 PDF 摘要，涵盖探索过的主题、掌握度轨迹以及推荐的下一步学习内容。

## 使用示例

```
learner: "我不明白为什么 3x + 6 = 12 意味着 x = 2"
[signal]   卡住
[concept]  'isolating variables'（前置条件：addition-subtraction-equality）
[scaffold] "你应当从等式两边减去什么数才能开始？"
learner: "6"
[signal]   正确
[mastery]  addition-subtraction-equality: 0.62 -> 0.77
[concept]  继续 'isolating variables'
[scaffold] "很好。那么 3x / 3 等于多少？"
```

## 交付

`outputs/skill-ai-tutor.md` 为交付物。一个面向特定学科的自适应导师，具备多模态输入、学习者模型、记忆、安全以及可测量的成效。

| 权重 | 评分标准 | 衡量方式 |
|:-:|---|---|
| 25 | 学习增益差值 | 10 名学习者为期两周的前测/后测差值 |
| 20 | 苏格拉底式忠实度 | 对话样本的评分量表（rubric）得分 |
| 20 | 多模态用户体验 | 语音 + 拍照 + 文本的端到端连贯性 |
| 20 | 安全与隐私姿态 | Llama Guard 4 通过率 + COPPA 合规留存 |
| 15 | 课程覆盖广度与图谱质量 | 概念覆盖度 + 前置关系图谱一致性 |
| **100** | | |

## 练习

1. 分别在有和没有自适应学习者模型（随机概念顺序）的情况下运行成效研究。报告差值。预期自适应会胜出，但差值的大小才是值得关注的数字。

2. 添加多模态探测：同一个概念问题分别以文本、语音和拍照方式呈现。衡量学习者是否在自己偏好的模态中收敛更快。

3. 构建家长仪表盘：已练习的主题、掌握度轨迹、即将学习的概���、安全事件（任何护栏被触发的情况）。COPPA 合规。

4. 添加语言切换模式：导师接受西班牙语输入并用西班牙语教学。衡量 X-Guard 覆盖率。

5. 对记忆隐私进行压力测试：验证学习者 A 无法看到学习者 B 的数据，即使通过语音片段重注入攻击也不行。记录尝试访问并发出警报。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| Socratic Policy（苏格拉底式策略） | "引导式提问，别直接给答案" | 导师提出引导性问题，而非直接给出答案 |
| Bayesian Knowledge Tracing（贝叶斯知识追踪） | "BKT" | 每个概念掌握概率的经典学习者模型方程 |
| FSRS | "自由间隔重复调度器" | 2024 年的间隔重复调度器，优于 SM-2 |
| Curriculum Graph（课程图谱） | "概念 DAG" | Neo4j 中带前置关系边的概念图 |
| Episodic Memory（情景记忆） | "每次交互日志" | 存储每次交互以供后续检索 |
| Semantic Memory（语义记忆） | "习得模式存储" | 从情景记忆中提升的已提炼错误与偏好 |
| COPPA | "儿童隐私法" | 美国限制收集 13 岁以下儿童数据的法律 |

## 延伸阅读

- [Khanmigo（Khan Academy）](https://www.khanmigo.ai) —— 参考级消费 K-12 导师
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) —— 参考级语言学习导师
- [Google LearnLM / Gemini for Education](https://blog.google/technology/google-deepmind/learnlm) —— 托管参考模型
- [Quizlet Q-Chat](https://quizlet.com) —— 另一参考产品
- [Synthesis Tutor](https://www.synthesis.com) —— 创业公司参考
- [FSRS 算法](https://github.com/open-spaced-repetition/fsrs4anki) —— 间隔重复调度器
- [贝叶斯知识追踪](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) —— 学习者模型经典
- [LiveKit Agents](https://github.com/livekit/agents) —— 语音技术栈
