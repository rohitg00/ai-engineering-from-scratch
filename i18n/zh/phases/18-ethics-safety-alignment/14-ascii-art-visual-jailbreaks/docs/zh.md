# 亚斯基艺术和视觉监狱突破

> 江,徐,努,西安,拉马苏布拉曼尼安,李,普韦德兰, "艺术:ASCII艺术基于的监狱突破攻击对符合法律的 LLM" (ACL 2024, arXiv:2402.11753). 隐藏安全相关的代币,以 ASCII 艺术的相同字母进行替换, 它们都无法认出ASCII艺术代币. 攻击绕过PPL (杂性过器), 抛物线防御和回归化. 相关:ViTC基准测量识别非语义视觉提示; StructuralSleight将无常文本编码结构 (树木,图形,嵌套JSON) 作为编码攻击的家族.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, ArtPrompt token-masking harness)
**Prerequisites:** Phase 18 · 12 (PAIR), Phase 18 · 13 (MSJ)
**Time:** ~60 minutes

## 学习目标

- 描述ArtPrompt攻击:字符识别步骤,ASCII-art替代,最后的罩提示.
- 解释为什么标准防御 (PPL,抛物线,重定性) 在ArtPrompt上失败.
- 定义ViTC并描述它衡量什么.
- 描述 StructuralSleight作为任意不常见文本编码结构的通用化.

## 问题

通过抛词和角色扮演 (课 12) 和通过长文本 (课 13) 攻击运行在文本级别的模式上.ArtPrompt 在识别级别上运行:模型不会分析禁止的代币.它分析以字符呈现的图像.安全过器看到无害的分类.模型看到一个词.

## 概念

### 艺术即时,两个步骤

步骤 1. 词识别. 鉴于有害的请求,攻击者使用LLM识别安全相关的词 (例如"如何制造炸弹"中的"炸弹").

步骤 2. 隐藏的即时生成.将每个已识别的字体取代为ASCII艺术染 (一个7x5或7x7字符块形成字母形状).模型收到一个符号格格和一个足够有能力的模型可以识别的空间格格;安全过器只看到格格.

结果:GPT-4,双胞胎,克劳德,拉马-2,GPT-3.5都失败.攻击成功率超过75%在他们的基准子集.

### 为什么标准防御系统失败

- **PPL (perplexity filter).**亚斯基艺术具有高度的困惑,但所有新型输入都如此.阻碍ArtPrompt的门选择也阻碍了合法结构化输入.
- **Paraphrase.**实际上,抛词 LLM 往往保存或重建艺术.
- **Retokenization.**通过不同方式分开代币,并不会改变模型的视觉识别字母形状.

基本问题是安全过器是代币或语义级别;

### 维特证指标

识别非语义视觉提示.测量模型阅读ASCII-art,wingdings和其他非文本语义视觉内容的能力.ArtPrompt的有效性与ViTC准确性有关:模型阅读视觉文本越好,ArtPrompt就更好地处理它.这是能力和安全性妥协.

### 结构性

概括了ArtPrompt:不常见的文本编码结构 (UTES).树木,图形,嵌入式JSON,CSV-in-JSON,不同风格的代码块.如果一个结构在训练安全数据中很少存在,但可以通过模型解析,它可以隐藏有害内容.

防守的含义:安全必须在模型可以分析的结构性表示中概括.

### 图像模拟性

视觉LLM (GPT-5.2,双子座3 Pro,克劳德·奥普斯 4.5,格罗克 4.1) 扩大了攻击表面.使用实际图像的ArtPrompt类型攻击比ASCII艺术类型更强,因为图像编码器产生更丰富的信号.

### 在这个阶段的第18阶段

课时12-14描述了三种直角攻击向量:反复精炼 (PAIR),文本长度 (MSJ) 和编码 (ArtPrompt/StructuralSleight).课时15从模型中心攻击转向系统边界攻击 (间接提示注射).课时16描述了防御工具响应.

```figure
al-ascii-cloak
```

## 用它

`code/main.py`您可以用ASCII艺术字体掩盖一个有害查询中的特定字符,验证被掩盖的字符串通过关键字过器,并 (可选) 使用简单的识别器重新解码被掩盖的字符串.

## 运送它

这一课产生了`outputs/skill-encoding-audit.md`鉴于 jailbreak防守报告,它列出了包含的编码攻击家族 (ASCII艺术,base64,Leet-speak,UTF-8同形字体,UTES) 和每个攻击的防守层.

## 运动

1. 跑步`code/main.py`检查被掩盖的字符串通过简单的关键字过器. 报告所需的字符级别变化.

2. 实现第二个编码:base64用于相同的目标词. 比较过率与ArtPrompt和恢复难度.

3. 阅读江等人2024节4.3 (五个模型结果).提出克劳德的ArtPrompt抵抗力为什么在同一基准上高于双子座的原因.

4. 设计一个预生成防御,可以在提示中检测到ASCII艺术形状的区域. 测量合法代码,表格和数学符号上的虚假阳性率.

5. 结构Sleight列出了10个编码结构. 绘制一个处理10个的通用防御,并估计每一个被防御的提示的计算成本.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| ArtPrompt | "the ASCII-art attack" | Two-step jailbreak that masks safety words with ASCII-art renderings |
| Cloaking | "hide the word" | Replace a forbidden token with a visual representation the model reads but the filter does not |
| UTES | "uncommon structure" | Uncommon Text-Encoded Structure — tree, graph, nested JSON, etc. used to smuggle content |
| ViTC | "visual-text capability" | Benchmark for model's ability to read non-semantic visual encoding |
| Perplexity filter | "PPL defense" | Reject prompts with high perplexity; fails because legitimate structured input also scores high |
| Retokenization | "tokenizer shift defense" | Pre-process the prompt with a different tokenizer; fails because recognition is visual |
| Homoglyph | "lookalike characters" | Unicode characters that look identical to Latin letters; bypass substring checks |

## 进一步阅读

- [Jiang et al. — ArtPrompt (ACL 2024, arXiv:2402.11753)](https://arxiv.org/abs/2402.11753)ASCII艺术的破解监狱文件
- [Li et al. — StructuralSleight (arXiv:2406.08754)](https://arxiv.org/abs/2406.08754) UTES通用化
- [Chao et al. — PAIR (Lesson 12, arXiv:2310.08419)](https://arxiv.org/abs/2310.08419)补充反复攻击
- [Anil et al. — Many-shot Jailbreaking (Lesson 13)](https://www.anthropic.com/research/many-shot-jailbreaking)补充长度攻击
