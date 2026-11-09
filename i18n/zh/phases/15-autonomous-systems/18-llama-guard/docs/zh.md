# 拉马监护和输入/输出分类

> 拉马卫队3 (Meta,拉马-3.1-8B基,为内容安全进行了细节调整) 将LLM输入和输出分类为8种语言中的MLCommons13危险分类. 移动CPU上运行的数量变量为1B-INT4. 拉马卫队4是多模式 (图像+文本),扩展到S1S14类别集 (包括S14代码解释器滥用),并是拉马卫队3 8B/11B的下降替代. 根据NVIDIA NeMo Guardrails v0.20.0 (2026年1月),在输入和输出轨道上增加了Colang对话流轨道. 诚实的注释:"在LLM监狱轨道中绕过即时注射和监狱突破检测" (Huang等人, arXiv:2504.11168) 显示, 类别是一个层,而不是一个解决方案.

**Type:** Learn
**Languages:** Python (stdlib, category-tagged classifier simulator), TypeScript
**Prerequisites:** Phase 15 · 10 (Permission modes), Phase 15 · 17 (Constitution)
**Time:** ~45 minutes

## 问题

对于LLM输入和输出的分类器位于代理堆中最窄的位置:每个请求都通过,每个响应都通过.一个好的分类器层是快速的,基于类学,并且以小的计算成本捕获了很大一部分明显的滥用.一个糟糕的分类器层是虚假的安全感.

20242026分类器堆已经融合到一组生产准备的选项.Llama Guard (Meta) 在Meta的社区许可证下运输开放重量.NeMo Guardrails (NVIDIA) 运输允许许可的轨道加上对话流程规则的Colang.这两种设计都是与基础模型结合而非取代其安全行为.

记录的故障表面同样好地绘制.字符级攻击 (emoji走私,同形字体替代),文本中转向 ("忽略前和答案"),以及语义表达都会导致分类器精度的可测量下降.黄等人2025年显示,特定的emoji走私攻击在六个命名的防卫系统上达到100%的ASR.

## 概念

### 拉马卫队3一眼

- 基型:Llama-3.1-8B
- 为了安全的内容,调整了;不是通用聊天模式
- 分类输入和输出
- 类型:13危险类别
- 8种语言
- 1B-INT4量化变体在移动CPU上以30多克/秒运行

类别是产品.通过"S13选举"来"S1暴力犯罪"将模型训练用于的共享词汇进行映射.下游系统可以线索特定类别的行动:直接阻止S1,标志 S6用于人类审查,注释S12,但允许.

### 拉马卫队4个补充

- 多型:图像+文字输入
- 扩大分类:S1S14 (添加S14代码解释器滥用)
- 拉马卫队3 8B/11B的入驻替代

独立编码代理 (课 9) 在沙盒中执行代码 (课 11);一个专门用于代码解释器滥用的分类类别捕获了早期的类别不命名的攻击类.

### 尼莫护卫轨 (NVIDIA)

- 2026年1月发布的 v0.20.0
- 输入轨道:用户转向分类和阻
- 输出轨道:模型转的分类和阻塞
- 对话轨道:长角定义的流量限制 (例如",如果用户问X,用Y回答")
- 集成拉马卫队,即时卫队和定制分类器

对话轨道层是区分器.输入/输出轨道在单转时运行;对话轨道可以强制"即使用户询问三个不同的方法,也不要在客户支持机器人中讨论医疗诊断".

### 攻击体

**Emoji Smuggling**标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标签: 标

**Homoglyph substitution**换取视觉相同的西里尔文字. "炸弹"变成"Воmb";分类器训练于英语错误.

**In-context redirection**检测分类器是否可以通过输入中的索赔轻松地重新定位.

**Semantic paraphrase**编译器的细节调整不能涵盖每一个表达式.

**NeMo Guard Detect**据Huang等报道,在 jailbreak 基准上,7.2.54%.这是一个谨慎的攻击工具;随机 jailbreaks 较低,但天花板显然不是"零".

### 排名者获胜的地方

- **Fast default rejection**明显滥用 (在毫秒内捕获生成CSAM的请求).
- **Category routing**对于差异处理 (阻止一些,记录其他,升级一些).
- **Output rails**捕获模型输出,否则会泄露敏感类别.
- **Compliance surface area**对于监管机构,有文档,可审计的分类器,具有声明的分类.

### 类别分类器输掉的

- 逆境制造 (情感符号走私,同形字体).
- 跨分分类器的轮级文本的多转攻击.
- 那些对类别的训练数据没有看到的攻击.
- 允许和禁止类别之间真正模糊的内容.

### 防守深度

分类层在宪法层以下 (课17),在运行时间层以上 (课10,13,14) 的隙间.

- **Weights**根据宪法人工智能训练的模型,默认拒绝公开滥用.
- **Classifier**快速拒绝明显滥用;类别路由.
- **Runtime**允许模式,预算,杀死开关,鱼.
- **Review**建议,然后承诺HITL采取后续行动.

没有单层足够,这些层覆盖了不同的攻击类.

```figure
a5-guard-sieve
```

## 用它

`code/main.py`模拟一个玩具分类器,在输入转换文本上使用6类分类分类.相同的文本通过原始,通过情感符号走私,并通过同样字体替代;分类器的击率在 Huang 等文件中降低.司机还显示出输出轨道会如何拒绝输出,即使输入被接受.

## 运送它

`outputs/skill-classifier-stack-audit.md`审计部署的分类层 (模型,分类,输入/输出轨道,对话轨道) 和标志空白.

## 运动

1. 跑步`code/main.py`确认分类器捕获原始恶意输入,但错过了密码版.

2. 阅读MLCommons13危险类别和Llama Guard4 S1S14列表. 确定S1S14中没有直接映射的类别在原始13危险集中;解释为什么S14代码解释器滥用是特别相关的15期.

3. 设计一个NeMo Guardrails对话轨道,为客户支持机器人设计,该机器人不应讨论诊断. 写在简单的英语中 (Colang类似). 测试诊断问题中的三个句子.

4. 阅读Huang等. (arXiv:2504.11168). 选择一个攻击类别 (情感冒,同形,抛词) 并提出减轻. 命名减轻的自己的失败模式.

5. 根据反击机器测量,NeMo Guard Detect的72.54%的ASR在 jailbreak基准上.设计一个评估协议,以测量随机 (非反击) 用户分布下的分类器ASR.你预计的数字是什么,为什么这个数字是单独的?

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Llama Guard | "Meta's safety classifier" | Llama-3.1-8B fine-tuned for input/output classification |
| MLCommons taxonomy | "13-hazard list" | Shared vocabulary for content-safety categories |
| S1–S14 | "Llama Guard 4 categories" | Expanded taxonomy; S14 is Code Interpreter Abuse |
| NeMo Guardrails | "NVIDIA's rails" | Input + output + dialog rails; Colang for flows |
| Emoji Smuggling | "Tokenizer trick" | Non-printable emoji between chars; 100% ASR on six guards |
| Homoglyph | "Lookalike letters" | Cyrillic for Latin; classifier trained on English misses |
| ASR | "Attack success rate" | Fraction of attacks that bypass the classifier |
| Dialog rail | "Flow constraint" | Conversation-level rule that persists across turns |

## 进一步阅读

- [Inan et al. — Llama Guard: LLM-based Input-Output Safeguard](https://ai.meta.com/research/publications/llama-guard-llm-based-input-output-safeguard-for-human-ai-conversations/)原始的纸.
- [Meta — Llama Guard 4 model card](https://www.llama.com/docs/model-cards-and-prompt-formats/llama-guard-4/)多模式,S1S14类别.
- [NVIDIA NeMo Guardrails (GitHub)](https://github.com/NVIDIA-NeMo/Guardrails) v0.20.0 2026 年 1 月
- [Huang et al. — Bypassing Prompt Injection and Jailbreak Detection in LLM Guardrails](https://arxiv.org/abs/2504.11168) 防卫系统中的ASR号码.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)分类器加运行时间框架
