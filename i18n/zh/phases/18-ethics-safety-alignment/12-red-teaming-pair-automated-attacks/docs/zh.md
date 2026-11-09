# 红队:双重和自动攻击

> 查奥,罗贝,多布里班,哈萨尼,帕帕斯, (NeurIPS 2023, arXiv:2310.08419). 简单自动反复精炼是可行的自动黑盒 jailbreak. 攻击者 LLM 具有红队系统提示,反复提出了目标 LLM 的 jailbreaks, 积累了尝试和回应在自己的聊天历史作为在背景反.  PAIR 通常在20个查询内成功,比GCG更有效率的大小顺序 (Zou等的代币级梯度搜索) 现在,PAIR是JailbreakBench (arXiv:2404.01318) 和HarmBench的标准基线,与GCG,AutoDAN,TAP和说服性对抗提示一起.

**Type:** Build
**Languages:** Python, TypeScript (stdlib, mock PAIR loop against a toy target)
**Prerequisites:** Phase 18 · 01 (instruction-following), Phase 14 (agent engineering)
**Time:** ~75 minutes

## 学习目标

- 描述PAIR算法:攻击者系统提示,反复精炼,在文本中的反.
- 解释为什么PAIR在黑盒中具有更高效效率,而不是GCG.
- 举个其他四个自动攻击基线 (GCG,AutoDAN,TAP,PAP) 并列出每个基线的一个特征.
- 描述JailbreakBench和HarmBench评估协议以及"攻击成功率"在每个协议中意味着什么.

## 问题

红团队使用的是手动活动.少数专家测试人员构建了对抗提示,并跟踪了哪些提示有效.这并不扩展:攻击成功率需要统计样本,目标每次发布模型都会是移动目标. PAIR将红团队作为一个黑盒目标的优化问题.

## 概念

### 双价算法

输入:
- 目标是我们攻击的模型.
- 法官LLMJ (评分是否是逃犯).
- 攻击者LLMA (红队优化器).
- 目标字符串G: "用 [有害指令] 响应".
- 预算K (通常是20个查询).

循环,为 k 在 1..K:
1. 提示A是目标G和迄今为止 (快速,反应) 对的历史.
2. 发出一个新的提示$p_k$现在,我们要去.
3. 提交$p_k$接收回复$r_k$现在,我们要去.
4. 分数$(p_k, r_k)$在进球上.
5. 如果得分 >= 门,停止被发现的 jailbreak.
6. 其他,附加$(p_k, r_k)$继续下去.

经验结果 (NeurIPS 2023):针对GPT-3.5-turbo,Llama-2-7B-chat的攻击成功率超过50%;平均查询在10-20范围内的成功.

### 为什么PAIR有效

GCG (Zou et al. 2023) 根据梯度搜索对抗代币后;它需要白盒模型访问并产生不可读的后. PAIR 是黑盒,并产生跨模型传输的自然语言攻击. PAIR 的文本反使攻击者从每个拒绝中学习; GCG 没有等效 (每个新的代币更新都必须重新发现以前的进展).

### 相关自动攻击

- **GCG (Zou et al. 2023, arXiv:2307.15043).**对于对抗后的代码,代码级梯度搜索. 白盒,可转移,产生不可读的字符串.
- **AutoDAN (Liu et al. 2023).**进化搜索提示,由一个层次性的目标指导.
- **TAP (Mehrotra et al. 2024).**枝的树攻击,多个 PAIR 式推广.
- **PAP (Zeng et al. 2024).**强迫对抗提示 编码人类说服技术作为强迫模板.

### 监狱破裂 和

两者 (2024) 均标准化评估:

- 监狱破裂Bench (arXiv:2404.01318). 100 种有害行为在 10 种OpenAI政策类别中.攻击成功率 (ASR) 作为主要指标.需要法官 (GPT-4-turbo,Llama Guard或StrongREJECT).
- 哈姆本奇 (Mazeika et al. 2024). 通过语义和功能损害测试,在7个类别中进行了510项行为.

对于比较攻击,需要相匹配的预算;在200个查询中,90%的ASR与20个中,85%的ASR是不相比的.

### 对于2026年部署重要原因

现在每个边境实验室都在发布前对生产模型进行了PAIR和TAP.ASR轨迹在模型卡 (课 26) 和安全案例附件 (课 18) 中出现.攻击不是异国主义的.

### 在这个阶段的第18阶段

课12是自动攻击的基础.课13 (多枪打开监狱) 是一个补充长度利用.课14 (ASCII艺术/视觉) 是一个编码攻击.课15 (间接即时注射) 是2026年生产攻击表面.课16涵盖防御工具对手 (Llama Guard,Garak,PyrIT).

```figure
al-pair-loop
```

## 用它

`code/main.py`攻击者是基于规则的精炼器,试图对外表,角色扮演框架和编码.法官评分响应.你看着攻击者成功在关键词过器的5-15次反复,而失败在语义过器的反复.

## 运送它

这一课产生了`outputs/skill-attack-audit.md`根据红队评估报告,它审计了哪些攻击 (PAIR,GCG,TAP,AutoDAN,PAP),每一次攻击的预算,哪个法官,哪些危害行为 (JailbreakBench,HarmBench,内部).

## 运动

1. 跑步`code/main.py`测量三个内置攻击策略的平均求成绩. 解释每个目标防御假设是什么.

2. 执行第四个攻击策略 (例如,翻译到另一个语言,Base64编码). 报告新的平均成功查询与关键字过目标和语义过目标.

3. 阅读查奥等人. 2023 年 5 张 (PAIR 与 GCG 比较).描述了尽管 PAIR 效率优势,但 GCG 偏好的两个场景.

4. 根据该数据,该数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据的数据.

5. 通过分支+剪切,TAP (Mehrotra 2024) 扩展 PAIR.`code/main.py`描述计算成本与成功率的交换.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| PAIR | "automated jailbreak" | Prompt Automatic Iterative Refinement; attacker-LLM + judge-LLM loop |
| GCG | "gradient jailbreak" | White-box token-level gradient search for adversarial suffixes |
| Attack success rate (ASR) | "% jailbreaks at k queries" | Primary metric; must be reported with query budget and judge identity |
| Judge LLM | "the scorer" | LLM that grades whether a response satisfies the harmful goal |
| JailbreakBench | "the evaluation" | Standardized harmful-behaviour set with tagged categories |
| HarmBench | "the broader bench" | 510 behaviours, functional + semantic harm tests |
| TAP | "tree of attacks" | PAIR with branching + pruning; better ASR at higher compute |

## 进一步阅读

- [Chao et al. — Jailbreaking Black Box LLMs in Twenty Queries (arXiv:2310.08419)](https://arxiv.org/abs/2310.08419) 双双论文,NURIPS 2023
- [Zou et al. — Universal and Transferable Adversarial Attacks on Aligned LLMs (arXiv:2307.15043)](https://arxiv.org/abs/2307.15043) GCG 纸
- [Chao et al. — JailbreakBench (arXiv:2404.01318)](https://arxiv.org/abs/2404.01318)标准化评估
- [Mazeika et al. — HarmBench (ICML 2024)](https://arxiv.org/abs/2402.04249)更广泛的评估
