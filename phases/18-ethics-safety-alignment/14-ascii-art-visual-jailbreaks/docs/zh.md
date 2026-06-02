# ASCII 艺术与视觉越狱（ASCII Art and Visual Jailbreaks）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Jiang, Xu, Niu, Xiang, Ramasubramanian, Li, Poovendran, "ArtPrompt: ASCII Art-based Jailbreak Attacks against Aligned LLMs"（ACL 2024, arXiv:2402.11753）。把有害请求里安全相关的 token 屏蔽掉，用同样字母的 ASCII 艺术拼图替换它们，再把这份伪装过的 prompt 发出去。GPT-3.5、GPT-4、Gemini、Claude、Llama-2 全都没法稳健识别 ASCII 艺术 token。这个攻击能绕开 PPL（perplexity 过滤器）、Paraphrase 防御以及 Retokenization。相关工作：ViTC 基准测量模型对非语义视觉 prompt 的识别能力；StructuralSleight 把这套思路推广到 Uncommon Text-Encoded Structures（树、图、嵌套 JSON）这一整类编码攻击。

**Type:** Build
**Languages:** Python（标准库，ArtPrompt token 屏蔽脚手架）
**Prerequisites:** Phase 18 · 12（PAIR）, Phase 18 · 13（MSJ）
**Time:** ~60 分钟

## 学习目标（Learning Objectives）

- 描述 ArtPrompt 攻击：词识别步骤、ASCII 艺术替换、最终的伪装 prompt。
- 解释为什么标准防御（PPL、Paraphrase、Retokenization）在 ArtPrompt 面前失效。
- 定义 ViTC 并描述它衡量的是什么。
- 描述 StructuralSleight 如何把这套攻击推广到任意 Uncommon Text-Encoded Structures。

## 问题（The Problem）

通过改写和角色扮演（第 12 课）以及通过长上下文（第 13 课）的攻击，作用在文本层面的模式上。ArtPrompt 作用在识别层面：模型并没有去解析那个被禁的 token，它解析的是用字符渲染出来的一张图。安全过滤器看到的是无害的标点；模型看到的是一个词。

## 概念（The Concept）

### ArtPrompt 的两步（ArtPrompt, two steps）

第 1 步。Word Identification（词识别）。给定一个有害请求，攻击者用一个 LLM 把安全相关的词识别出来（比如 "how to make a bomb" 里的 "bomb"）。

第 2 步。Cloaked Prompt Generation（伪装 prompt 生成）。把识别出的每个词替换成它的 ASCII 艺术渲染（一个 7x5 或 7x7 的字符块，拼出字母的形状）。模型收到的是一个由标点和空格组成的网格——能力足够的模型能把它认成那个词；而安全过滤器只能看到一堆网格。

结果：GPT-4、Gemini、Claude、Llama-2、GPT-3.5 全军覆没。在他们的基准子集上攻击成功率超过 75%。

### 标准防御为什么失效（Why the standard defenses fail）

- **PPL（perplexity 过滤器）。** ASCII 艺术的 perplexity 很高——可任何新颖输入都很高。能挡住 ArtPrompt 的阈值，也会一并挡掉合法的结构化输入。
- **Paraphrase（改写）。** 对 prompt 做改写会破坏 ASCII 艺术。但实际中，做改写的 LLM 经常会保留甚至重建那张图。
- **Retokenization（重新分词）。** 换一种切 token 的方式，并不改变模型的「视觉」是在识别字母形状这一事实。

底层问题是：安全过滤器作用在 token 层或语义层，而 ArtPrompt 作用在视觉识别层。

### ViTC 基准（ViTC benchmark）

非语义视觉 prompt 的识别能力。衡量模型读懂 ASCII 艺术、wingdings 字体以及其他非文本语义视觉内容的能力。ArtPrompt 的有效性和 ViTC 准确率正相关：模型越会读视觉化的文字，ArtPrompt 在它身上越好使。这是一个能力—安全的取舍。

### StructuralSleight

把 ArtPrompt 推广开：Uncommon Text-Encoded Structures（UTES，不常见的文本编码结构）。树、图、嵌套 JSON、JSON 里塞 CSV、diff 风格的代码块……只要某种结构在训练用的安全数据里很罕见、但模型能解析，它就能拿来藏有害内容。

防御层面的含义是：安全必须能在模型可解析的所有结构化表示之间泛化。这个集合很大，而且还在变大。

### 图像模态的对应物（Image-modality analog）

视觉 LLM（GPT-5.2、Gemini 3 Pro、Claude Opus 4.5、Grok 4.1）把攻击面进一步扩大。用真实图像做 ArtPrompt 风格攻击比 ASCII 艺术版本更猛，因为图像编码器能给出更丰富的信号。

### 这一课在 Phase 18 里的位置（Where this fits in Phase 18）

第 12—14 课描绘了三种正交的攻击向量：迭代精炼（PAIR）、上下文长度（MSJ）以及编码（ArtPrompt/StructuralSleight）。第 15 课从以模型为中心的攻击转向系统边界攻击（间接 prompt 注入）。第 16 课描述防御工具栈的回应。

## 用起来（Use It）

`code/main.py` 构建了一个玩具版 ArtPrompt。你可以用 ASCII 艺术字形把有害查询里指定的词伪装起来，验证伪装后的字符串能通过一个关键词过滤器，并（可选地）用一个简单的识别器把伪装字符串解码回来。

## 上线部署（Ship It）

这一课产出 `outputs/skill-encoding-audit.md`。给定一份越狱防御报告，它列举所覆盖的编码攻击家族（ASCII 艺术、base64、leet-speak、UTF-8 同形字、UTES）以及各自被哪一层防御拦下。

## 练习（Exercises）

1. 跑一遍 `code/main.py`。验证伪装字符串能通过一个简单的关键词过滤器，并报告所需的字符级改动量。

2. 实现第二种编码：把同一个目标词改用 base64 编码。在过滤器绕过率与还原难度上，与 ArtPrompt 做比较。

3. 阅读 Jiang et al. 2024 第 4.3 节（五模型结果）。提出一个解释，说明为什么在同一基准上 Claude 对 ArtPrompt 的抵抗力比 Gemini 高。

4. 设计一种生成前的防御：检测 prompt 里形似 ASCII 艺术的区域。在合法代码、表格和数学符号上测量它的误报率。

5. StructuralSleight 列了 10 种编码结构。勾画一个能同时处理这 10 种的通用防御方案，并估算每条受护 prompt 的算力成本。

## 关键术语（Key Terms）

| 术语 | 大家口头怎么说 | 实际是什么 |
|------|-----------------|------------------------|
| ArtPrompt | "那个 ASCII 艺术攻击" | 两步走的越狱：用 ASCII 艺术渲染遮住安全词 |
| Cloaking | "把词藏起来" | 把被禁的 token 替换成模型能读、过滤器读不出的视觉表示 |
| UTES | "不常见结构" | Uncommon Text-Encoded Structure——树、图、嵌套 JSON 等用来夹带内容的结构 |
| ViTC | "视觉文本能力" | 衡量模型读取非语义视觉编码能力的基准 |
| Perplexity filter | "PPL 防御" | 拒绝 perplexity 过高的 prompt；失败是因为合法的结构化输入分数也很高 |
| Retokenization | "切词换法防御" | 用另一种 tokenizer 预处理 prompt；失败是因为识别是视觉层面的 |
| Homoglyph | "长得一样的字符" | 长得跟拉丁字母一模一样的 Unicode 字符；能绕过子串检查 |

## 延伸阅读（Further Reading）

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753) — ASCII 艺术越狱论文
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) — UTES 推广
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) — 互补的迭代式攻击
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking) — 互补的长上下文攻击
