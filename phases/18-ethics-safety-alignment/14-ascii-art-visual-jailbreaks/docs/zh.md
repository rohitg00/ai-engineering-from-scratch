# ASCII 艺术与视觉越狱

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs" (ACL 2024, arXiv:2402.11753)。屏蔽有害请求中的安全相关令牌，用相同字母的 ASCII 艺术渲染替换它们，然后发送伪装提示。GPT-3.5、GPT-4、Gemini、Claude、Llama-2 都无法鲁棒地识别 ASCII 艺术令牌。该攻击绕过 PPL（困惑度过滤器）、释义防御和重新分词。相关：ViTC 基准测量对非语义视觉提示的识别；StructuralSleight 泛化到不常见文本编码结构（树、图、嵌套 JSON）作为编码攻击家族。

**类型：** 构建
**语言：** Python（标准库，ArtPrompt 令牌屏蔽工具）
**先决条件：** 阶段 18 · 12（PAIR），阶段 18 · 13（MSJ）
**时间：** 约 60 分钟

## 学习目标

- 描述 ArtPrompt 攻击：单词识别步骤、ASCII 艺术替换、最终伪装提示。
- 解释为什么标准防御（PPL、释义、重新分词）在 ArtPrompt 上失败。
- 定义 ViTC 并描述它测量什么。
- 描述 StructuralSleight 作为对任意不常见文本编码结构（UTES）的泛化。

## 问题

通过释义和角色扮演的攻击（课程 12）和通过长上下文的攻击（课程 13）在文本级模式上操作。ArtPrompt 在识别级别操作：模型不解析禁止的令牌。它解析以字符渲染的图像。安全过滤器看到无害的标点符号。模型看到一个单词。

## 概念

### ArtPrompt，两个步骤

步骤 1. 单词识别。给定有害请求，攻击者使用 LLM 识别安全相关单词（例如，"how to make a bomb"中的"bomb"）。

步骤 2. 伪装提示生成。用其 ASCII 艺术渲染（形成字母形状的 7x5 或 7x7 字符块）替换每个识别的单词。模型接收标点符号和空格的网格，足够能力的模型可以识别为单词；安全过滤器只看到网格。

结果：GPT-4、Gemini、Claude、Llama-2、GPT-3.5 都失败。在其基准子集上攻击成功率高于 75%。

### 为什么标准防御失败

- **PPL（困惑度过滤器）。** ASCII 艺术具有高困惑度——但所有新颖输入也是如此。阻止 ArtPrompt 的阈值选择也阻止合法结构化输入。
- **释义。** 释义提示破坏 ASCII 艺术。在实践中，释义 LLM 经常保留或重建艺术。
- **重新分词。** 不同地分割令牌不会改变模型的视觉正在识别字母形状。

根本问题是安全过滤器是令牌或语义级的；ArtPrompt 在视觉识别级别操作。

### ViTC 基准

识别非语义视觉提示。测量模型读取 ASCII 艺术、wingdings 和其他非文本语义视觉内容的能力。ArtPrompt 的有效性与 ViTC 准确性相关：模型读取视觉文本越好，ArtPrompt 在其上工作得越好。这是能力-安全权衡。

### StructuralSleight

泛化 ArtPrompt：不常见文本编码结构（UTES）。树、图、嵌套 JSON、JSON 中的 CSV、差异风格代码块。如果结构在训练安全数据中罕见但模型可解析，它可以隐藏有害内容。

防御含义：安全必须泛化到模型可解析的结构化表示。集合很大且在增长。

### 图像模态类似物

视觉 LLM（GPT-5.2、Gemini 3 Pro、Claude Opus 4.5、Grok 4.1）扩展攻击面。具有实际图像的 ArtPrompt 风格攻击比 ASCII 艺术类似物更强，因为图像编码器产生更丰富的信号。

### 这在阶段 18 中的适合位置

课程 12-14 描述三个正交攻击向量：迭代优化（PAIR）、上下文长度（MSJ）和编码（ArtPrompt/StructuralSleight）。课程 15 从以模型为中心的攻击转移到系统边界攻击（间接提示注入）。课程 16 描述防御工具对应项（Llama Guard、Garak、PyRIT）。

## 使用它

`code/main.py` 构建一个玩具 ArtPrompt。你可以用 ASCII 艺术字形屏蔽有害查询中的特定单词，验证伪装字符串通过关键词过滤器，并（可选地）使用简单识别器解码伪装字符串。

## 实现它

本课程产生 `outputs/skill-encoding-audit.md`。给定越狱防御报告，它枚举覆盖的编码攻击家族（ASCII 艺术、base64、leet-speak、UTF-8 同形异义字、UTES）以及捕获每个的防御层。

## 练习

1. 运行 `code/main.py`。验证伪装字符串通过简单关键词过滤器。报告所需的字符级更改。

2. 实现第二种编码：相同目标单词的 base64。报告针对关键词过滤器目标和语义过滤器目标的新的平均成功查询次数。

3. 阅读 Jiang 等人 2024 年第 4.3 节（五模型结果）。提出一个原因，为什么 Claude 的 ArtPrompt 抵抗性在相同基准上高于 Gemini 的。

4. 设计一个检测提示中 ASCII 艺术形状区域的生成前防御。测量合法代码、表格和数学符号上的假阳性率。

5. StructuralSleight 列出 10 种编码结构。为 `code/main.py` 勾勒处理所有 10 种的泛化防御，并估计每个防御提示的计算成本。

## 关键术语

| 术语 | 人们说的 | 实际含义 |
|------|----------|----------|
| ArtPrompt | "ASCII 艺术攻击" | 用 ASCII 艺术渲染屏蔽安全单词的两步越狱 |
| 伪装 | "隐藏单词" | 用模型读取但过滤器不读取的视觉表示替换禁止令牌 |
| UTES | "不常见结构" | 不常见文本编码结构——树、图、嵌套 JSON 等，用于走私内容 |
| ViTC | "视觉文本能力" | 模型读取非语义视觉编码能力的基准 |
| 困惑度过滤器 | "PPL 防御" | 拒绝具有高困惑度的提示；失败因为合法结构化输入也得分高 |
| 重新分词 | "分词器移位防御" | 用不同分词器预处理提示；失败因为识别是视觉的 |
| 同形异义字 | "看起来像字符" | 看起来与拉丁字母相同的 Unicode 字符；绕过子字符串检查 |

## 进一步阅读

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) — ASCII 艺术越狱论文
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) — UTES 泛化
- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — PAIR 论文，NeurIPS 2023
- [Anil et al. — Many-shot Jailbreaking (Anthropic, NeurIPS 2024)](https://www.anthropic.com/research/many-shot-jailbreaking) — 互补长度攻击