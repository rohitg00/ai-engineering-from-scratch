# 产生性代理和新兴模拟

> 城市和地区的发展**Smallville**五个代理的沙箱,有三部分架构:**memory stream**其他国家**reflection**(该物体在自身流程中产生更高水平的合成),**plan**现在,我们需要一个小计划. 标志性的结果是情人节派对的出现:一个代理人种植了"想举办情人节派对",没有进一步编写剧本, 除显示,所有三个组件都需要可信度. 记录的故障是空间规范错误 (进入封闭的商店,共享单人浴室). 这就是2026年代理模拟和多代理社会评估的参考架构.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## 问题

大多数多代理系统是紧密编写的团队:规划者计划,编码码,审查员评论.这适用于明确的任务.它不捕捉到当代理人有记忆,优先事项和开放世界时产生的新兴,未编写的行为.研究,社会模拟和越来越多的游戏人工智能需要这种第二种.

斯摩尔维尔架构是其基准.直到2023年,最好的代理模拟是浅层脚本后者;之后,模式是开放世界中的生成代理的默认模式.如果你在2026年构建代理模拟,你要么使用Smolarville的三个组件,要么明确证明你为什么不这样.

## 概念

### 三个组成部分

**Memory stream.**每条条目都有时间,类型,描述 (自然语言) 和衍生的元数据:**recency**现在**importance**(经纪人自行评价1-10),**relevance**(与当前查询相似的可索数).

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

记忆检索组合了三个分数:`score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`现在的提示.

**Reflection.**定期 (每一个N记忆或重要事件),代理从最近的记忆中生成更高级的合成.反思条目回到流中,像其他任何记忆一样可回收.这就是代理建立"理解"的方法.

**Plan.**首先,一个日级计划在大小的时间 ("去工作,和克劳斯吃晚饭").然后是小时级计划.然后是行动级计划.计划可修改:当观察与计划相矛盾时,代理重新规划受影响的部分.

### 为什么三者都重要 (摘除)

帕克等人运行了对观测,反思和计划的每一个减法.

- 没有**observation**代理忽略了背景,并以旧信念行动.
- 没有**reflection**代理人不能形成更高层次的信念; 相互作用保持浅.
- 没有**plan**行为变得反应噪音,目标消失.

人类评级的可信度分数是所有三项中最高的;

### 情人节的出现

一名代理人伊莎贝拉·罗德里格斯被种植为目标"希望在2月14日下午5点在霍布斯咖啡馆举行情人节派对".

1. 伊莎贝拉的计划包括邀请人们.
2. 每次邀请都会成为一个邻居记忆中的观察.
3. 邻居的反思会让人们相信:"伊莎贝拉正在派对.
4. 邻居的计划包括"参加2月14日的聚会".
5. 邻居告诉邻居,邀请没有中央协调.
6. 2月14日下午5点,几名特工在霍布斯咖啡馆聚会.

这是在技术意义上出现的:系统层面的行为 (一个党) 源于本地互动 (双边邀请+个人规划) 没有中央管弦乐器.

### 记录的故障模式

帕克等人明确记录:

- **Spatial norm errors.**经纪人走进封闭的商店.经纪人试图使用同一个人用浴室.经纪人在不用于吃饭的房间里吃饭.模型不仅仅是从环境中推断社会-身体规范.
- **Memory overflow.**实用补救方法:定期缩小记忆 (总结和剪辑) 和低重量的输入的衰退.
- **Reflection hallucination.**缓解:在反射提示中包含源记忆ID,并在检索时验证.

这些是生产相关的故障模式:任何2026年代理模拟都继承它们.

### 执行三要素规则

1. **Memory is append-only.**修改是新的输入.
2. **Importance scores are cheap.**打电话给法师,在写作时给你一个10分的评分.
3. **Retrieval is ranked, not filtered.**结合分数的顶级k;不要使用硬式过器 (它们失去了语境).
4. **Reflection runs periodically.**触发器,未经处理的记忆重量的总量超过一个门 (例如150).
5. **Plans are revisable.**如果一个新的观察与一个计划相矛盾,只重建受影响的部分,而不是整个计划.

### 产品代理商在斯摩尔维尔以外

2024-2026年后的后续文献扩展了建筑:

- **Multi-agent social simulation for policy / market research.**类似于小镇的种群模拟用户行为,以响应功能. 比A/B测试更快;准确性受到质疑.
- **NPC AI for games.**随着小镇的代理人进行的角色扮演游戏,
- **Generative-agent evaluation benchmarks.**而不是任务精度,测量量变得长期的行为可信性+一致性.

扩展交换组件 (存储存储存储器,检索增强反射,神经象征性计划),但保持三部分结构.

### 为什么这对多代理工程很重要

斯摩尔维尔是概念证明,当组件合合适时多代理出现是便宜的. 架构现在已经在开源模型上复制 (较小的LLM会轻松而不会急剧失去可信性).**emergent social behavior**任何需要的系统都能使用这种形状.**tight task execution**在此阶段使用了早期的监督者/角色/原始模式.

```figure
a5-memory-reflection
```

## 建立它

`code/main.py`通过脚本编写的代理政策 (没有真正的LLM) 实现了 stdlib Python 的三个组件.

- `MemoryStream`仅添加日志,可检索最新/重要/相关性.
- `reflect(stream)` 关于最近重要记忆的剧本反思.
- `plan(agent_state)`基于当前信仰的日期和小时计划.
- 剧情:五名代理人. 代理人1开始于下午5点的投球派对.

运行:

```
python3 code/main.py
npx tsx code/main.ts
```

预期产量:点后点.到最后点,至少有3个代理人显示了他们的计划,然后他们聚集在聚会地点.单个种子产生了无任何管弦乐器的协调到达.

## 用它

`outputs/skill-simulation-designer.md`设计生成代理模拟:代理数量,记忆模式,反射序列,计划视界和评估指标.

## 运送它

生产模拟的规则:

- **Memory is the database.**选择一个真正的商店 (向量DB, Postgres) 尺度. 内存的SDLB是为原型.
- **Log the retrieval trace.**每次行动,记录驱动的最顶级记忆.这是你的调试能力.
- **Budget per-agent tokens.**每个代理的每次点的回收+反射+计划是$O(k)$士号码,N代理 ×T子 ×每子的调用可以使你的预算变得矮小.
- **Compact memory periodically.**简单地摘要,并剪除重要小项.
- **Detect spatial / social norm violations**建筑不会学到它们.

## 运动

1. 跑步`code/main.py`确认3+代理在聚会上聚会. 增加代理到10.
2. 现在,我们要把这些数据从"反思"中移除.
3. 引入一个竞争的目标 ("克劳斯想在下午5点发表研究讲话"). 代理人是否分裂,或者一个目标是主导的?
4. 增加空间限制:霍布斯咖啡馆最多可以容纳4个代理人.模拟手柄是否优雅地溢出,还是会碰到"单人浴室"失败模式?
5. 阅读 Park et al. (arXiv:2304.03442) 第6节 (新兴行为实验). 确定一个行为不能在您的小型图中复制.您需要增强建筑的哪个组件?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Memory stream | "The agent's diary" | Append-only log of observations, actions, reflections, plans. |
| Recency | "How new is the memory" | Exponential-decay score by age. |
| Importance | "How much does the agent care" | Self-rated 1-10 at write time. Cached. |
| Relevance | "How related to the current query" | Cosine similarity (embedding-based). |
| Reflection | "Higher-order belief" | Synthesis generated from recent memories, re-ingested as a new memory. |
| Plan | "Day/hour/action decomposition" | Top-down plan tree. Revisable when observations contradict. |
| Smallville | "Park 2023's sandbox" | 25-agent simulation that produced the Valentine's Day emergence. |
| Believability | "The quality metric" | Human-rater score for whether behavior seems like a plausible agent. |

## 进一步阅读

- [Park et al. — Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442)参考架构
- [UIST '23 paper page](https://dl.acm.org/doi/10.1145/3586183.3606763)出版地点
- [Smallville code release](https://github.com/joonspk-research/generative_agents)参考Python实现
- [Hayes-Roth 1985 — A Blackboard Architecture for Control](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639)结构性记忆代理的先例
