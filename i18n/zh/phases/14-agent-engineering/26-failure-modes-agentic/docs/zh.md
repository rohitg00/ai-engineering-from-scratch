# 失败模式:为什么代理人会断裂

> 马斯夫特 (伯克利, 2025) 在3类别中列出了14种多代理故障模式.微软的分类记录了现有AI故障如何在代理设置中放大.行业领域数据汇集在五种重复模式上:幻觉行为,范围爬,级错误,文本损失,工具滥用.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 05 (Self-Refine and CRITIC), Phase 14 · 24 (Observability)
**Time:** ~60 minutes

## 学习目标

- 列出MASFT的三个故障类别,每个类别至少有四种特定模式.
- 解释为什么代理失败会放大现有AI失败模式 (偏见,幻觉).
- 描述五种行业重复的模式及其减轻措施.
- 执行一个标签代理追踪的 stdlib 探测器,

## 问题

团队运输代理,他们处理90%的痕迹.10%的故障不是随机噪音.

## 概念

### 美国国家:

多代理系统故障类别.14种故障模式分为3类.科恩的卡帕 0.88 类别可靠地区分.

主要要求:多代理系统的设计缺陷是基本的缺陷,而不是通过更好的基模型来解决LLM的限制.

### 微软在代理人工智能系统中故障模式的分类

- 现有的AI失败 (偏见,幻觉,数据泄漏) 在代理环境中加剧.
- 独立性带来了新的失败:规模上的意想不到的行动,工具的滥用,任务漂移.
- 报纸是对药物产品的风险登记表.

### 标识人工智能代理中的缺陷 (arXiv:2603.06847)

- 失败是由于管弦乐,内部状态的进化和环境相互作用.
- 不仅仅是"坏代码"或"坏模型输出".

### 士研究员的幻觉调查 (arXiv:2509.18970)

两种主要表现:

1. **Instruction-following Deviation**代理不跟随系统提示.
2. **Long-range Contextual Misuse** 代理人忘记或误用之前的转折的文本.

部分意图错误:遗漏 (错过步骤),冗余 (重复步骤),混乱 (排行之外的步骤).

### 五种行业重复模式

亚里兹,加利略,尼姆布莱恩2024-2026场分析汇集于:

1. **Hallucinated actions.**代理呼唤一个不存在的工具或捏造论点.
2. **Scope creep.**代理扩大任务,超出用户要求 (创建额外的公关,发送额外的电子邮件).
3. **Cascading errors.**一次错误的呼叫会引发下游效应. 一次幻觉的 SKU 引发了四次API呼叫.
4. **Context loss.**长远任务忘记了早期转换的限制.
5. **Tool misuse.**调用错误的论点,或者完全错误的工具.

代理人无法区分"我失败了"和"任务是不可能的",并且经常在400个错误中产生成功信息,

### 减轻:每一步都有门

根据环境状态,检查事实的基础.

- 步骤安全分类器 (课 21).
- 工具调用参数验证 (课06).
- 检查已获取的内容与已知事实 (课05,批判).
- 通过重新检查状态检测到成功幻觉 (文件是否真的创建了?).

### 在失败监测失败的地方

- **Tagging only crashes.**大多数代理失败都会产生有效的输出.
- **No baseline.**没有它,你不能说"情况正在恶化".
- **Over-alerting.**每次失败都会产生一个页面,集群和速度限制.

```figure
failure-cascade
```

## 建立它

`code/main.py`执行stdlib失败模式标签:

- 综合地追踪数据集,涵盖五种模式.
- 检测器按模式的功能 (工具调用,输出,重复操作的签名模式).
- 标签标签每一个痕迹,并报告模式分布.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

产量:每条标签+总分量, 便宜地复制城的痕迹集群表面.

## 用它

- **Phoenix**对于生产漂移集群 (课 24)
- **Langfuse**对于回放+注释的会话.
- **Custom**对于域名特定的签名, 你的可观测平台无法检测.

## 运送它

`outputs/skill-failure-detector.md`产生适合您的域的故障模式探测器, 连接到一个追踪商店.

## 运动

1. 添加一个检测器来"成功幻觉":代理返回成功,但目标状态没有改变.
2. 标记100个真正的产品痕迹.哪种模式占主导地位?
3. 实施"射径"指标:鉴于步骤N失败,它影响了多少下游步骤?
4. 阅读MASFT的14个故障模式,选择适用于产品的三个.
5. 连接一个探测器到一个CI工作:如果>=5%的痕迹标记模式,则无法构建.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| MASFT | "Multi-agent failure taxonomy" | Berkeley 14-mode categorization |
| Cascading error | "Ripple failure" | One early mistake propagates through N steps |
| Context loss | "Forgot the constraint" | Long-horizon turn drops early-turn facts |
| Tool misuse | "Wrong tool / wrong args" | Valid call, wrong invocation |
| Success hallucination | "Faked completion" | Agent claims success on a 400; state unchanged |
| Scope creep | "Overreach" | Agent does more than asked |
| Instruction-following deviation | "Disobedience" | Ignores system prompt or user constraint |
| Sub-intention errors | "Plan bugs" | Omission, redundancy, disorder in plan execution |

## 进一步阅读

- [Cemri et al., MASFT (arXiv:2503.13657)](https://arxiv.org/abs/2503.13657)14种故障模式,3种类别
- [Microsoft, Taxonomy of Failure Mode in Agentic AI Systems](https://cdn-dynmedia-1.microsoft.com/is/content/microsoftcorp/microsoft/final/en-us/microsoft-brand/documents/Taxonomy-of-Failure-Mode-in-Agentic-AI-Systems-Whitepaper.pdf)风险登记
- [Arize Phoenix](https://docs.arize.com/phoenix) 实际上的漂移集群
- [Anthropic, Building Effective Agents](https://www.anthropic.com/research/building-effective-agents)简单的模式完全避免模式
