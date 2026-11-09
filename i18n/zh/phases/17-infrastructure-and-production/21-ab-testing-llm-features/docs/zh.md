#  增长书,Statsig和Vibes问题

> 传统的A/B测试并没有为非确定性 LLM而建立. 重要区别:评估答案是"模型能做好工作吗?"A/B测试答案是"用户是否关心?" 2026年要测试什么:快速工程 (表达式),模型选择 (GPT-4 vs GPT-3.5 vs OSS;准确性 vs 成本 vs 延迟),生成参数 (温度,顶级). 实例:聊天机器人奖励模型变体提供了+70%的对话长度和+30%的保留;接下来AI主题线实验提供了+1%的CTR后奖励功能的完善;Khan Academy Khanmigo在延迟与数学准确性轴上进行了代. 平台分开:**Statsig**测试序列,CUPED,全共一. **GrowthBook**开源,仓库本土,贝叶斯式+频率化+序列引擎,CUPED,SRM检查,Benjamin-Hochberg+Bonferroni修正.您根据仓库SQL偏好选择,以及"OpenAI收购"是否对您的组织重要.

**Type:** Learn
**Languages:** Python, TypeScript (stdlib, toy sequential test simulator)
**Prerequisites:** Phase 17 · 13 (Observability), Phase 17 · 20 (Progressive Deployment)
**Time:** ~60 minutes

## 学习目标

- 区分评估 ("模型能做好工作吗") 和A/B测试 ("用户关心").
- 列出三个可测试轴 (提示,模型,参数) 并为每个轴选择指标.
- 解释CUPED,序列测试和Benin-Hochberg多次比较纠正.
- 根据库存SQL姿势和企业收购态度,选择Statsig或 GrowthBook.

## 问题

你手动调整了系统提示.它感觉更好.你运送它.转换变化是通过噪音.你责怪的指标.或者你运送一个新模型,转换没有移动?

标准答案是模型是否可以在标记的集合上完成任务.它们没有回答用户是否更喜欢输出.只有一个受控的在线实验才能回答这个问题,只有实验有足够的权力,控制非确定性,并对多个比较进行纠正.

## 概念

### 平均值与A/B测试

**Evals**离线,标签集,法官 (标签或法官或人). 回答:"这个固定分布的输出是否正确/有用/安全?"

**A/B test**在线,现场用户,随机. 回答:"新变体是否移动了重要的是用户水平的指标?"

既需要,Evals在暴露前捕获回归;A/B后确认产品影响.

### 测试什么

1. **Prompt engineering**语法,系统提示结构,例子. 计量:任务成功,用户保留,成本/请求.
2. **Model selection** GPT-4 vs GPT-3.5-Turbo vs Llama-OSS. 计量:准确性 (任务) +成本/请求 + 延迟 P99. 多目标.
3. **Generation parameters**温度,顶部p,max_tokens. 计量:任务特定 (输出多样性与确定性).

###         

试验前数据. 在比较后期之前,退出前期差异.典型差异减少: 30-70%.有效的样本大小免费增加.

实施: Statsig 和 GrowthBook 两者都实施.

### 序列测试

经典A/B假设样本大小是固定的. 序列测试 ("望和决定") 在重复的看法下控制虚假阳性率. 始终有效的序列程序 (mSPRT,霍华德的信心序列) 让你早点停止清晰的获胜者.

### 复杂比较纠正

运行20次A/B测试, 95%的信心,随机产生一个假阳性. 波恩弗罗尼纠正每次测试加紧 α; 布尼亚米尼-霍奇伯格控制了假发现率. 增长书实现了两者.

###  SRM 样本比率不匹配

分配哈希将用户随机分为变体.如果50/50分分为47/53,则有东西被打破.

### 经济与增长

**Statsig**其他:
- 收购于OpenAI为1.1亿美元 (2025年9月). 主机,SaaS.
- 测试,CUPED,持续的群体.
- 一个全合:特征标志+实验+可观测性.
- 团队已经想要一个捆绑的产品, 不关心OpenAI的所有权.

**GrowthBook**其他:
- 开源 (MIT);仓库本土 (直接从Snowflake/BigQuery/Redshift中读取).
- 机器的数量:贝叶斯式,频率式,序列式.
- ,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,.
- 提供自主托管或管理云.
- 数据团队控制了测量层,想要OSS.

### 不确定性使权力复杂

根据标准,在测试中,测试结果的结果是不同的. 传统的功率计算假设是IID观测. 在LLM非确定性学中,有效样本大小低于名义. 乘以安全边缘的1.3-1.5x所需的样本大小.

### 实际案件结果

- 聊天机器人奖励模式变异: +70%的对话长度,+30%的保留.
- 接下来的主题线: 奖励函数完善后的+1%的CTR.
- 学院:反复延迟与数学准确度交易.

### 反模式:在振动上运输

任何高级工程师都能命名出出货的功能,因为"感觉更好",没有A/B. 大多数产品的指标退后,团队几个月没有注意到.A/B是强迫函数.

### 你应该记住的数字

- 美国国家航空公司收购的Statsig:2025年9月11亿美元.
- 增长书:开源MIT;贝叶斯语+频率主义+序列.
- 减轻CUPED变异率:30-70%.
- 专业学历非确定性 → +30-50%的样本尺寸缓冲.

```figure
mx-sequential-test
```

## 用它

`code/main.py`模拟一个连续A/B测试,有固定和连续边界.

## 运送它

这一课产生了`outputs/skill-ab-plan.md`鉴于功能变化,工作量,基线,平台选择,门口,样本大小.

## 运动

1. 跑步`code/main.py`预计5%升降,基线转换3%的样本大小为80%功率?
2. 选择Statsig或 GrowthBook,以供医疗保健监管的本地客户.
3. 设计一个A/B测试GPT-4与GPT-3.5的价格.
4. 你的鱼通过了,但A/B显示了 -1.2%的转换.你发货吗?写下升级标准.
5. 应用前期的变量,解释了后期变量的60% (平方相关性为0.6).计算有效样本大小增长.

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Eval | "offline test" | Labeled-set evaluation of model capability |
| A/B test | "experiment" | Live randomized comparison on users |
| CUPED | "variance reduction" | Pre-period regression to reduce variance |
| Sequential test | "peek-ok test" | Always-valid procedure allowing early stop |
| Multiple comparison | "the family error" | Running many tests inflates false positives |
| Bonferroni | "tight correction" | Divide α by number of tests |
| Benjamini-Hochberg | "BH FDR" | False-discovery-rate control, less conservative |
| SRM | "bad split" | Sample ratio mismatch; assignment bug |
| Statsig | "OpenAI owned" | Commercial all-in-one, acquired 2025 |
| GrowthBook | "the OSS one" | MIT warehouse-native platform |
| mSPRT | "sequential probability ratio test" | Classical sequential procedure |

## 进一步阅读

- [GrowthBook — How to A/B Test AI](https://blog.growthbook.io/how-to-a-b-test-ai-a-practical-guide/)
- [Statsig — Beyond Prompts: Data-Driven LLM Optimization](https://www.statsig.com/blog/llm-optimization-online-experimentation)
- [Statsig vs GrowthBook comparison](https://www.statsig.com/perspectives/ab-testing-feature-flags-comparison-tools)
- [Deng et al. — CUPED](https://www.exp-platform.com/Documents/2013-02-CUPED-ImprovingSensitivityOfControlledExperiments.pdf)
- [Howard — Confidence Sequences](https://arxiv.org/abs/1810.08240)
