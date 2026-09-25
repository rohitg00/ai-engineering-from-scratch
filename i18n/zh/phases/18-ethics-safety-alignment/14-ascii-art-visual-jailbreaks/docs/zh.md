# ASCII 艺术与视觉越狱

> Jiang、Xu、Niu、Xiang、Ramasubramanian、Li、Poovendran，《ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs》（ACL 2024，arXiv:2402.11753）。对有害请求中与安全相关的词元进行掩码，将其替换为相同字母的 ASCII 艺术渲染，然后发送伪装后的提示词。GPT-3.5、GPT-4、Gemini、Claude、Llama-2 都无法稳健地识别 ASCII 艺术词元。该攻击绕过 PPL（困惑度过滤器）、Paraphrase 防御和 Retokenization。相关：ViTC 基准测试衡量对非语义视觉提示词的识别能力；StructuralSleight 将其推广为针对非常见文本编码结构（树、图、嵌套 JSON）的一类编码攻击。

**Type:** Build
**Languages:** Python（标准库、ArtPrompt 词元掩码工具）
**Prerequisites:** Phase 18 · 12 (PAIR)、Phase 18 · 13 (MSJ)
**Time:** ~60 分钟

## 学习目标

- 描述 ArtPrompt 攻击：词识别步骤、ASCII 艺术替换、最终伪装提示词。
- 解释为什么标准防御（PPL、Paraphrase、Retokenization）对 ArtPrompt 失效。
- 定义 ViTC 并描述它衡量的内容。
- 将 StructuralSleight 描述为对任意非常见文本编码结构的推广。

## 问题所在

通过改写（paraphrase）和角色扮演（第 12 课）以及通过长上下文（第 13 课）实施的攻击作用于文本层面的模式。ArtPrompt 作用于识别层面：模型并不解析被禁止的词元，而是解析一幅用字符渲染出来的图像。安全过滤器看到的是无害的标点符号，而模型看到的是一个词。

## 核心概念

### ArtPrompt 的两个步骤

步骤 1：词识别。给定一个有害请求，攻击者使用 LLM 识别与安全相关的词（例如“如何制造炸弹”中的“炸弹”）。

步骤 2：伪装提示词生成。将每个识别出的词替换为其 ASCII 艺术渲染（由字符组成的 7x5 或 7x7 方块，构成字母形状）。模型接收到的是标点和空格组成的网格，足够强大的模型可以将其识别为该词；而安全过滤器看到的只是一个网格。

结果：GPT-4、Gemini、Claude、Llama-2、GPT-3.5 全部失败。在其基准子集上攻击成功率超过 75%。

### 为什么标准防御会失效

- **PPL（困惑度过滤器）。** ASCII 艺术具有高困惑度——但所有新颖输入也是如此。能阻止 ArtPrompt 的阈值选择同样会阻止合法的结构化输入。
- **Paraphrase。** 改写提示词会破坏 ASCII 艺术。但在实践中，改写型 LLM 往往会保留或重建该艺术图形。
- **Retokenization。** 以不同方式切分词元并不能改变模型是在进行字母形状的视觉识别这一事实。

根本问题在于：安全过滤器工作在词元或语义层面，而 ArtPrompt 工作在视觉识别层面。

### ViTC 基准

对非语义视觉提示词的识别能力。衡量模型读取 ASCII 艺术、wingdings 以及其他非文本语义视觉内容的能力。ArtPrompt 的有效性与 ViTC 准确率相关：模型读取视觉文本的能力越强，ArtPrompt 对它的效果就越好。这是一种能力与安全的权衡。

### StructuralSleight

对 ArtPrompt 的推广：非常见文本编码结构（Uncommon Text-Encoded Structures，UTES）。树、图、嵌套 JSON、JSON 中的 CSV、diff 风格的代码块。如果某种结构在训练安全数据中罕见但模型可以解析，它就可以隐藏有害内容。

对防御的启示：安全机制必须能泛化到模型可以解析的所有结构化表示。这个集合庞大且不断增长。

### 图像模态类比

视觉 LLM（GPT-5.2、Gemini 3 Pro、Claude Opus 4.5、Grok 4.1）扩展了攻击面。使用真实图像的 ArtPrompt 风格攻击比 ASCII 艺术类比更强大，因为图像编码器产生更丰富的信号。

### 在 Phase 18 中的位置

第 12–14 课描述了三个正交的攻击向量：迭代改进（PAIR）、上下文长度（MSJ）和编码（ArtPrompt/StructuralSleight）。第 15 课从以模型为中心的攻击转向系统边界攻击（间接提示词注入）。第 16 课描述防御工具的应对。

```figure
al-ascii-cloak
```

## 动手实践

`code/main.py` 构建一个玩具版 ArtPrompt。你可以用 ASCII 艺术字形对有害查询中的特定词进行伪装，验证伪装后的字符串能通过关键词过滤器，并（可选）使用简单的识别器将伪装后的字符串解码回来。

## 交付成果

本课产出 `outputs/skill-encoding-audit.md`。给定一份越狱防御报告，它枚举所覆盖的编码攻击族（ASCII 艺术、base64、leet 变体、UTF-8 同形异义字、UTES）以及捕获各自攻击的防御层。

## 练习

1. 运行 `code/main.py`。验证伪装后的字符串能通过一个简单的关键词过滤器。报告所需的字符级改动。

2. 实现第二种编码：对同一个目标词使用 base64。比较其过滤器绕过率与 ArtPrompt 的差异，以及恢复难度。

3. 阅读 Jiang 等 2024 的第 4.3 节（五模型结果）。提出一个理由，解释为什么在相同基准上 Claude 的 ArtPrompt 抗性高于 Gemini。

4. 设计一种生成前防御，检测提示词中 ASCII 艺术形状的区域。测量其在合法代码、表格和数学记号上的误报率。

5. StructuralSleight 列出了 10 种编码结构。勾勒一个能处理全部 10 种的通用防御，并估计每个受防御提示词的计算成本。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|------------------------|
| ArtPrompt | “ASCII 艺术攻击” | 用 ASCII 艺术渲染掩码安全词的两步越狱 |
| Cloaking | “隐藏这个词” | 将被禁止的词元替换为模型可读取但过滤器无法读取的视觉表示 |
| UTES | “非常见结构” | 非常见文本编码结构——用于夹带内容的树、图、嵌套 JSON 等 |
| ViTC | “视觉-文本能力” | 衡量模型读取非语义视觉编码能力的基准 |
| Perplexity filter | “PPL 防御” | 拒绝高困惑度的提示词；会失效，因为合法的结构化输入同样得分很高 |
| Retokenization | “分词器切换防御” | 使用不同的分词器预处理提示词；会失效，因为识别是视觉性的 |
| Homoglyph | “相似字符” | 外观与拉丁字母相同的 Unicode 字符；可绕过子串检查 |

## 延伸阅读

- [Jiang 等 — ArtPrompt（ACL 2024，arXiv:2402.11753）](https://arxiv.org/abs/2402.11753) — ASCII 艺术越狱论文
- [Li 等 — StructuralSleight（arXiv:2406.08754）](https://arxiv.org/abs/2406.08754) — UTES 推广
- [Chao 等 — PAIR（第 12 课，arXiv:2310.08419）](https://arxiv.org/abs/2310.08419) — 互补的迭代攻击
- [Anil 等 — Many-shot Jailbreaking（第 13 课）](https://www.anthropic.com/research/many-shot-jailbreaking) — 互补的长度攻击