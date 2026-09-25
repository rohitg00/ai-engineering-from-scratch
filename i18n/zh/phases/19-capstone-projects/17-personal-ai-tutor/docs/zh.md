# 毕业设计 17 —— 个人 AI 导师(自适应、多模态、带记忆)

> Khanmigo(Khan Academy)、Duolingo Max、Google LearnLM / Gemini for Education、Quizlet Q-Chat 以及 Synthesis Tutor 都在 2026 年实现了规模化落地的自适应多模态辅导。其共同形态是：苏格拉底式策略(绝不直接抛出答案)、每次交互后更新的学习者模型(贝叶斯知识追踪风格)、语音 + 文本 + 拍照解题输入、课程图谱检索、间隔重复调度，以及面向适龄内容的严格安全过滤。本毕业设计要求交付一个学科专用导师(K-12 代数或 Python 入门)，对 10 名学习者开展为期两周的有效性研究，并通过内容安全审计。

**Type:** 毕业设计
**Languages:** Python(后端、学习者模型)、TypeScript(Web 应用)、SQL(通过 Postgres + Neo4j 实现课程图谱)
**Prerequisites:** Phase 5(NLP)、Phase 6(语音)、Phase 11(LLM 工程)、Phase 12(多模态)、Phase 14(智能体)、Phase 17(基础设施)、Phase 18(安全)
**Phases exercised:** P5 · P6 · P11 · P12 · P14 · P17 · P18
**Time:** 30 小时

## 问题

自适应辅导曾长期是教育科技研究的边缘领域。到 2026 年，它已成为消费级产品。Khanmigo 部署于美国大多数学区。Duolingo Max 的月活跃用户达到数千万。Google 的 LearnLM / Gemini for Education 为 Google Classroom 中的辅导功能提供支持。Quizlet Q-Chat 与单词卡并列。Synthesis Tutor 以“面向好奇心强的孩子的导师”走红。它们的共同要素是：多模态输入(打字、说话、拍摄方程)、苏格拉底式教学法(先提问，后讲解)、每次交互后更新的学习者模型，以及严格的适龄安全机制。

你将为特定人群构建其中一个产品。衡量标准是一次真正的有效性研究：10 名学习者、两周内的前测和后测分数。语音循环必须自然流畅(复用毕业设计 03 的子技术栈)。记忆必须尊重隐私。安全过滤器必须通过面向 K-12 的 COPPA 意识红队测试。

## 概念

四个组件。**导师策略**是一个苏格拉底式循环：当学习者索要答案时，策略提出引导性问题；当他们答对时，进入下一个概念；当他们卡住时，提供阶梯式提示。**学习者模型**是贝叶斯知识追踪(或其简单变体)，在每次交互后更新每个课程节点的掌握概率。**课程图谱**是一个 Neo4j 概念图，带前置关系边；策略沿图谱遍历以选择下一个概念。**记忆**是情景 + 语义存储(agentmemory 风格)，保存过去的交互、错误和偏好。

UX 是多模态的。文本输入用于打字作答。语音输入通过 LiveKit + Whisper(复用毕业设计 03)。数学题拍照输入通过 dots.ocr 或 PaliGemma 2。语音输出通过 Cartesia Sonic-2。安全使用 Llama Guard 4 加上适龄过滤器(拦截成人内容、暴力、自残)以及符合 COPPA 的记忆保留策略。

有效性研究是交付成果。10 名学习者，前测与后测，两周。报告学习增益差值和置信区间。与非自适应基线(以线性方式提供相同内容、不含导师策略)进行对比。

## 架构

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

## 技术栈

- 学科选择：K-12 代数或 Python 入门(选一个以做深)
- 导师策略：基于 Claude Sonnet 4.7 的 LangGraph(使用 prompt caching)
- 学习者模型：贝叶斯知识追踪(经典版)或用于间隔调度的 FSRS
- 课程图谱：Neo4j 概念 + 前置关系边 + OER 内容
- 记忆：agentmemory 风格的持久向量 + 情景 + 语义存储
- 语音：LiveKit Agents 1.0 + Cartesia Sonic-2(复用毕业设计 03 的子技术栈)
- 拍照解题：dots.ocr 或 PaliGemma 2 做方程识别
- 安全：Llama Guard 4 + 自定义适龄过滤器
- 评估：Bloom 层级题目生成、前后测工具链、有效性研究工具

```figure
cf-tutor-loop
```

## 构建它

1. **课程图谱。** 构建包含 50–150 个概念节点的 Neo4j 图(例如 K-12 代数，从“数轴”到“求根公式”)，带前置关系边。为每个节点挂载 OER 内容(Open Textbook、OpenStax)。

2. **学习者模型。** 用先验参数初始化贝叶斯知识追踪：guess、slip、learn-rate。每次交互后更新各概念的掌握度。按学习者持久化。

3. **导师策略。** LangGraph,节点包括：`read_signal`(学习者的回答是正确/部分正确/卡住？)、`select_concept`(遍历课程图谱，选择优先级最高的概念)、`scaffold`(苏格拉底式提示)、`update_mastery`。

4. **记忆。** 每次交互写入情景存储。错误和偏好提升为语义记忆。符合 COPPA 的保留策略：一年后自动删除，家长可访问。

5. **语音通路。** 将 LiveKit Agents worker 挂载到导师策略。ASR 用 Whisper-v3-turbo。TTS 用 Cartesia Sonic-2。支持打断(复用毕业设计 03 机制)。

6. **拍照解题通路。** 上传或拍摄图片；用 dots.ocr 或 PaliGemma 2 识别方程；作为结构化输入交给导师。

7. **安全。** 每条模型输出都经过 Llama Guard 4 + 适龄过滤器(拦截自残、成人内容、暴力)。记忆访问按学习者 ID 隔离；提供家长访问界面以执行删除。

8. **有效性研究。** 10 名学习者，前测(标准化 30 题基线)，两周的导师交互(每周 3 次)，后测。与同样内容、非自适应基线组的 10 名学习者对比。

9. **每周进度报告。** 为每个学习者自动生成 PDF 摘要，涵盖所学主题、掌握轨迹和推荐下一步。

## 使用它

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

## 交付它

`outputs/skill-ai-tutor.md` 是交付成果。一个具备多模态输入、学习者模型、记忆、安全机制，且有效性经过测量的学科专用自适应导师。

| 权重 | 评估标准 | 衡量方式 |
|:-:|---|---|
| 25 | 学习增益差值 | 10 名学习者两周研究中的前后测差值 |
| 20 | 苏格拉底式保真度 | 基于对话样本的评分细则得分 |
| 20 | 多模态 UX | 语音 + 拍照 + 文本端到端一致性 |
| 20 | 安全 + 隐私态势 | Llama Guard 4 通过率 + COPPA 意识保留策略 |
| 15 | 课程广度与图谱质量 | 概念覆盖 + 前置图谱一致性 |
| **100** | | |

## 练习

1. 分别在有和无自适应学习者模型的条件下(概念顺序随机)运行有效性研究。报告差值。预期自适应方案会胜出，但差值的大小才是有趣的数字。

2. 增加多模态探针：同一概念问题分别以文本、语音和拍照形式呈现。衡量学习者在自己偏好的模态下是否收敛更快。

3. 构建家长仪表盘：练习的主题、掌握轨迹、即将学习的概念、安全事件(任何护栏命中记录)。符合 COPPA。

4. 增加语言切换模式：导师接受西班牙语输入并用西班牙语教学。衡量 X-Guard 的覆盖情况。

5. 压力测试记忆隐私：验证学习者 A 即使通过语音片段重摄入攻击也无法看到学习者 B 的数据。记录尝试访问并告警。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|------------------------|
| 苏格拉底式策略 | “提问，不要灌答案” | 导师提出引导性问题而非直接给出答案 |
| 贝叶斯知识追踪 | “BKT” | 经典的学习者模型方程，用于计算每个概念的掌握概率 |
| FSRS | “Free Spaced Repetition Scheduler” | 2024 年的间隔重复调度器，优于 SM-2 |
| 课程图谱 | “概念 DAG” | 带前置关系边的 Neo4j 概念图 |
| 情景记忆 | “逐次交互日志” | 每次交互都被存储以供后续检索 |
| 语义记忆 | “已习得模式存储” | 从情景记忆提升而来的压缩错误与偏好 |
| COPPA | “儿童隐私法” | 限制收集 13 岁以下儿童数据的美国法律 |

## 延伸阅读

- [Khanmigo(Khan Academy)](https://www.khanmigo.ai) —— 面向消费者的 K-12 导师参考
- [Duolingo Max](https://blog.duolingo.com/duolingo-max/) —— 语言学习导师参考
- [Google LearnLM / Gemini for Education](https://blog.google/technology/google-deepmind/learnlm) —— 托管参考模型
- [Quizlet Q-Chat](https://quizlet.com) —— 替代参考
- [Synthesis Tutor](https://www.synthesis.com) —— 创业公司参考
- [FSRS algorithm](https://github.com/open-spaced-repetition/fsrs4anki) —— 间隔重复调度器
- [Bayesian Knowledge Tracing](https://en.wikipedia.org/wiki/Bayesian_knowledge_tracing) —— 学习者模型经典
- [LiveKit Agents](https://github.com/livekit/agents) —— 语音技术栈