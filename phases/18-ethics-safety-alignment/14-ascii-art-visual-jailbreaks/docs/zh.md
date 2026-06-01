# 14 · ASCII 美术与视觉越狱攻击

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs" (ACL 2024, arXiv:2402.11753)。将有危害请求中与安全相关的分词屏蔽，替换为相同字母的 ASCII 美术（ASCII Art）渲染，然后发送伪装提示。GPT-3.5、GPT-4、Gemini、Claude、Llama-2 均无法可靠识别 ASCII 美术分词。该攻击绕过了 PPL（困惑度（Perplexity）过滤器）、释义（Paraphrase）防御和重分词（Retokenization）防御。相关：ViTC 基准衡量对非语义视觉提示的识别能力；StructuralSleight 将其推广到非常见文本编码结构（Uncommon Text-Encoded Structures, UTES），如树、图、嵌套 JSON，作为一类编码攻击家族。

**类型：** 构建
**语言：** Python（标准库，ArtPrompt 分词遮蔽框架）
**前置：** 阶段 18 · 12（PAIR）、阶段 18 · 13（MSJ）
**时长：** 约 60 分钟

## 学习目标

- 描述 ArtPrompt 攻击的三个步骤：词识别、ASCII 美术替换、最终伪装提示。
- 解释为什么标准防御（PPL、释义、重分词）对 ArtPrompt 无效。
- 定义 ViTC 并描述它衡量什么。
- 描述 StructuralSleight，即泛化到任意非常见文本编码结构的攻击。

## 问题

通过改写和角色扮演（第 12 课）以及长上下文（第 13 课）的攻击是在文本层面操作的。ArtPrompt 则在识别层面操作：模型并不解析被禁的分词，而是解析用字符渲染的图像。安全过滤器看到无害的标点符号，而模型却看到一个单词。

## 概念

### ArtPrompt 两步法

第一步：词识别（Word Identification）。给定一个有危害的请求，攻击者使用大语言模型（LLM）识别与安全相关的词（例如"如何制造炸弹"中的"炸弹"）。

第二步：伪装提示生成（Cloaked Prompt Generation）。将每个识别出的词替换为其 ASCII 美术渲染（一个 7x5 或 7x7 的字符块，形成字母形状）。模型接收到一个由标点和空格组成的网格，能力足够强的模型可以将其识别为单词；而安全过滤器只能看到网格。

结果：GPT-4、Gemini、Claude、Llama-2、GPT-3.5 全部失败。在其基准测试子集上，攻击成功率超过 75%。

### 为什么标准防御失败

- **PPL（困惑度过滤器）。** ASCII 美术具有高困惑度——但所有新颖输入都有高困惑度。能阻挡 ArtPrompt 的阈值也同样会阻挡合法的结构化输入。
- **释义（Paraphrase）。** 对提示进行释义会破坏 ASCII 美术。但在实践中，释义用的大语言模型往往会保留或重建美术。
- **重分词（Retokenization）。** 以不同方式拆分分词并不会改变模型视觉上识别字母形状这一事实。

根本问题在于，安全过滤器处于分词或语义层面；而 ArtPrompt 在视觉识别层面操作。

### ViTC 基准

衡量对非语义视觉提示的识别能力。ViTC 基准测试模型读取 ASCII 美术、Wingdings 字体以及其他非文本语义视觉内容的能力。ArtPrompt 的有效性与 ViTC 准确率正相关：模型读取视觉文本的能力越强，ArtPrompt 对其的攻击效果越好。这是一项能力-安全的权衡。

### StructuralSleight

对 ArtPrompt 的泛化：非常见文本编码结构（Uncommon Text-Encoded Structures, UTES）。包括树、图、嵌套 JSON、JSON 内嵌 CSV、diff 风格的代码块等。如果某种结构在训练安全数据中很少出现但模型能够解析，它就可以隐藏有危害内容。

防御启示：安全必须泛化到模型能够解析的所有结构化表示。这个集合庞大且持续增长。

### 图像模态类比

视觉大语言模型（GPT-5.2、Gemini 3 Pro、Claude Opus 4.5、Grok 4.1）扩展了攻击面。基于实际图像的 ArtPrompt 风格攻击比 ASCII 美术版本更强，因为图像编码器产生的信号更丰富。

### 在阶段 18 中的定位

第 12-14 课描述了三个正交的攻击向量：迭代精炼（PAIR）、上下文长度（MSJ）和编码（ArtPrompt/StructuralSleight）。第 15 课从面向模型本身的攻击转向系统边界攻击（间接提示注入）。第 16 课描述防御性工具链的应对方案。

## 动手实践

`code/main.py` 构建了一个玩具级 ArtPrompt。你可以用 ASCII 美术字形遮蔽有危害查询中的特定词，验证遮蔽后的字符串能通过关键词过滤器，并（可选地）使用简单识别器将遮蔽字符串解码还原。

## 成果交付

本课产出 `outputs/skill-encoding-audit.md`。给定一份越狱防御报告，它会枚举所覆盖的编码攻击家族（ASCII 美术、base64、leet-speak、UTF-8 同形字、UTES）以及捕获每种攻击的防御层。

## 练习

1. 运行 `code/main.py`。验证遮蔽后的字符串能通过简单的关键词过滤器。报告所需的字符级改动。

2. 实现第二种编码方式：对同一目标词使用 base64 编码。比较其与 ArtPrompt 的过滤器绕过率以及恢复难度。

3. 阅读 Jiang 等人 2024 年第 4.3 节（五个模型的结果）。提出一个理由，说明为什么在同一基准测试上 Claude 对 ArtPrompt 的抵抗力高于 Gemini。

4. 设计一种生成前的防御方案，用于检测提示中的 ASCII 美术形状区域。测量其在合法代码、表格和数学符号上的误报率。

5. StructuralSleight 列出了 10 种编码结构。草拟一种能处理全部 10 种的通用防御方案，并估算每条受防提示的计算成本。

## 关键术语

| 术语 | 通俗说法 | 实际含义 |
|------|---------|---------|
| ArtPrompt | 「ASCII 美术攻击」 | 用 ASCII 美术渲染遮蔽安全词的两步越狱攻击 |
| 遮蔽（Cloaking） | 「隐藏单词」 | 将被禁分词替换为模型可读但过滤器不可读的视觉表示 |
| UTES | 「非常见结构」 | 非常见文本编码结构——用于夹带内容的树、图、嵌套 JSON 等 |
| ViTC | 「视觉文本能力」 | 衡量模型读取非语义视觉编码能力的基准 |
| 困惑度过滤器 | 「PPL 防御」 | 拒绝高困惑度提示；因合法结构化输入同样得分高而失效 |
| 重分词 | 「分词器切换防御」 | 使用不同分词器预处理提示；因识别本质是视觉层面的而失效 |
| 同形字（Homoglyph） | 「看起来一样的字符」 | 与拉丁字母外观完全相同的 Unicode 字符；可绕过子串检查 |

## 延伸阅读

- [Jiang 等人 — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) — ASCII 美术越狱论文
- [Li 等人 — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) — UTES 泛化
- [Chao 等人 — PAIR（第 12 课，arXiv:2310.08419）](https://arxiv.org/abs/2310.08419) — 互补的迭代攻击
- [Anil 等人 — Many-shot Jailbreaking（第 13 课）](https://www.anthropic.com/research/many-shot-jailbreaking) — 互补的长度攻击
