# 生成式 agent 与涌现式仿真（Generative Agents and Emergent Simulation）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Park et al. 2023（UIST '23, arXiv:2304.03442）在 **Smallville**（一个 25 agent 的沙盒）里部署了三段式架构：**memory stream**（自然语言日志）、**reflection**（agent 自己对记忆流生成的更高层综合）、以及 **plan**（先做天级行为，再做子计划）。最具标志性的结果是情人节派对的涌现：只给一个 agent 注入「想办一场情人节派对」的种子，没有任何额外脚本，邀请就在群体中传播开来，约会被协调起来，派对真的办成了——而其他 24 个 agent 一开始对此一无所知。消融实验（ablation，首次出现括注）显示三个组件缺一不可。论文里明确记录的失败模式是空间规范错误（走进已经关门的店、共用单人卫生间）。这就是 2026 年 agent 仿真和多 agent 社会评估的参考架构。

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 04 (Primitive Model), Phase 16 · 13 (Shared Memory)
**Time:** ~75 minutes

## 问题（Problem）

大多数多 agent 系统都是脚本紧耦合的团队：planner 做规划、coder 写代码、reviewer 做审查。这套办法对定义良好的任务有效，却抓不住当 agent 拥有记忆、优先级和开放世界时所涌现出来的、未经脚本设计的行为。研究、社会仿真、以及越来越多的游戏 AI，都需要后者。

Smallville 架构就是这件事的标杆。在 Park 2023 之前，最好的 agent 仿真也只是浅层的脚本执行器；从此以后，这套范式成了开放世界生成式 agent 的默认选择。如果你在 2026 年构建一个 agent 仿真系统，要么你在用 Smallville 的三大组件，要么你得明确说出为什么不用。

## 概念（Concept）

### 三大组件（The three components）

**Memory stream（记忆流）。** 一份只追加（append-only）的日志，包含观察、行动、reflection 和计划。每条记录有时间戳、类型、自然语言描述，以及派生出的元信息：**recency（新近度）**、**importance（重要度，agent 自己打 1-10 分）**、**relevance（与当前 query 的余弦相似度）**。

```
[2026-02-14 09:12:03] observation: Isabella Rodriguez asked me if I like jazz
[2026-02-14 09:14:22] reflection:   I enjoy long conversations about music
[2026-02-14 10:05:00] plan:         Attend Isabella's Valentine's Day party tonight
```

记忆检索把三个分数合起来：`score = w_recency * e^(-decay * age) + w_importance * importance + w_relevance * cos_sim`。Top-k 条目进入当前 prompt。

**Reflection（反思）。** 周期性触发（每 N 条记忆，或在重要事件后），agent 从最近的记忆里生成更高阶的综合。Reflection 条目回写到记忆流，跟其他记忆一样可被检索。这就是 agent 如何形成「理解」——架构里对应于长期信念的部分。

**Plan（计划）。** 自上而下分解。先是天级粗略计划（「去上班，跟 Klaus 吃晚饭」），再是小时级，再是动作级。计划是可修订的：当一条观察与计划相悖，agent 只对受影响的片段重新规划。

### 为什么三者都重要（消融）（Why all three matter (ablation)）

Park 等人做了消融实验，逐一剔除观察、reflection 和计划。每一项剔除都损害了可信度：

- 没有**观察**，agent 错过上下文，凭过时的信念行动。
- 没有**reflection**，agent 形成不了高阶信念，互动停留在浅层。
- 没有**计划**，行为变成反应式噪音，目标自行消散。

人类评分员给出的可信度（believability）分数在三者齐备时最高；缺任何一个都有可量化的回退。

### 情人节涌现（The Valentine's Day emergence）

一个 agent，Isabella Rodriguez，被注入目标「想在 2 月 14 日下午 5 点在 Hobbs Cafe 办一场情人节派对」。其他 24 个 agent 没有任何这样的种子。在仿真的若干天里：

1. Isabella 的计划包括邀请别人。
2. 每一次邀请变成邻居记忆流里的一条观察。
3. 邻居的 reflection 生成信念：「Isabella 要办派对。」
4. 邻居的计划纳入「2 月 14 日去派对」。
5. 邻居告诉别的邻居。邀请在没有中心协调者的情况下扩散。
6. 2 月 14 日下午 5 点，几个 agent 在 Hobbs Cafe 汇合。

这就是技术意义上的涌现：系统级行为（一场派对）从局部互动（双边邀请 + 个体规划）中产生，没有任何中央编排者。

### 已记录的失败模式（The documented failure modes）

Park 等人明确记录了：

- **空间规范错误。** Agent 走进已经关门的店；agent 想用同一个单人卫生间；agent 在不该用餐的房间吃东西。模型无法仅凭环境就推断出社会-物理规范。
- **记忆溢出。** 长时间运行的仿真让记忆检索成本不断膨胀。实践办法：周期性的 memory compaction（压缩，首次括注）（即 summarize-and-prune），以及对低重要度条目做衰减。
- **Reflection 幻觉（hallucination）。** Reflection 会编造记忆流里根本不存在的关系。缓解办法：在 reflection 的 prompt 里带上来源记忆 id，并在检索时校验。

这些都是生产相关的失败模式：任何 2026 年的 agent 仿真都会继承它们。

### 三组件实现规则（Three-component implementation rules）

1. **记忆是只追加的。** 永远不要修改一条已有记忆。修正用新条目表达。
2. **Importance 评分要便宜。** 写入时调一次 LLM 给 1-10 评分。把分数缓存下来。
3. **检索是排序，不是过滤。** 用合并分数取 top-k；不要用硬过滤（会丢上下文）。
4. **Reflection 周期性运行。** 当未处理记忆的 importance 累计超过阈值（如 150）时触发。
5. **计划可修订。** 一条新观察与计划冲突时，只重新生成受影响片段，不要重做整个计划。

### Smallville 之外的生成式 agent（Generative agents beyond Smallville）

2024-2026 的后续文献在扩展这套架构：

- **面向政策 / 市场研究的多 agent 社会仿真。** 类 Smallville 群体用来仿真用户对功能的反应。比 A/B 测试更快；准确度仍有争议。
- **游戏 NPC AI。** 用 Smallville agent 的 RPG 产生涌现式剧情，而不是预定脚本任务。
- **生成式 agent 评估基准。** 评估指标不再是任务准确率，而是长时间运行下的可信度 + 行为一致性。

架构是参考蓝本。各种扩展替换其中组件（用向量数据库做记忆、retrieval 增强的 reflection、神经-符号混合的计划），但保留三段式结构。

### 这件事对多 agent 工程为什么重要（Why this matters for multi-agent engineering）

Smallville 是「只要组件搭对，多 agent 涌现并不昂贵」的概念验证。这套架构现在已经在开源模型上被复现（更小的 LLM 是优雅地降低可信度，而不是断崖式坠落）。任何生产系统只要需要 **涌现式社会行为**，就会用这个形态。任何系统只要需要 **紧凑的任务执行**，就会用本 phase 前面讲的 supervisor / 角色 / 原语模式。

## 动手实现（Build It）

`code/main.py` 用 Python 标准库实现了三大组件，agent 策略是脚本化的（没有真实 LLM）。Demo 以微缩规模复现了情人节派对涌现：

- `MemoryStream` — 只追加日志，带 recency / importance / relevance 检索。
- `reflect(stream)` — 在最近高重要度记忆上做脚本化 reflection。
- `plan(agent_state)` — 基于当前信念的天级和小时级计划。
- 场景：5 个 agent。Agent 1 起步带「下午 5 点办派对」种子。在仿真 tick 推进中，邀请扩散，agent 汇合。

运行：

```
python3 code/main.py
```

预期输出：逐 tick 的 trace。到最后一个 tick，5 个 agent 中至少 3 个的计划里出现了派对，并且他们在派对地点汇合。一个种子、没有任何编排者，就产生了协调到达。

## 用起来（Use It）

`outputs/skill-simulation-designer.md` 设计一个生成式 agent 仿真：agent 数量、记忆 schema、reflection 频率、计划时间跨度、以及评估指标。

## 上线部署（Ship It）

生产仿真的规则：

- **记忆即数据库。** 上规模时选一个真实存储（向量数据库、Postgres）。内存里的 stdlib 只是原型。
- **记录检索 trace。** 每一次行动，都记下驱动它的 top-k 记忆。这是你的可调试性所在。
- **预算每 agent 的 token。** 每个 agent 每个 tick 的 retrieve + reflect + plan 是 O(k) 次 LLM 调用。N 个 agent × T 个 tick × 每 tick 调用数，会迅速吞掉你的预算。
- **周期性压缩记忆。** 把低重要度条目 summarize-and-prune。保留策略是设计决定，不是细节。
- **显式检测空间 / 社会规范违规。** 架构本身学不到这些。

## 练习（Exercises）

1. 跑 `code/main.py`。确认 3 个以上 agent 在派对处汇合。把 agent 数量加到 10——涌现还会发生吗？
2. 拿掉 reflection 步骤。行为是什么样的？把现象对应到 Park 2023 中的消融发现。
3. 引入一个相互竞争的种子目标（「Klaus 想在下午 5 点做研究 talk」）。Agent 是分裂，还是某个目标占据主导？什么决定了结果？
4. 加入空间约束：Hobbs Cafe 最多容 4 个 agent。仿真能优雅处理溢出吗？还是会撞上「单人卫生间」失败模式？
5. 读 Park et al. (arXiv:2304.03442) 第 6 节（涌现行为实验）。找出一种你的微缩版无法复现的行为。要复现它，你需要增强架构里的哪个组件？

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 它实际是什么 |
|------|----------------|------------------------|
| Memory stream | 「agent 的日记」 | 只追加的观察、行动、reflection、计划日志。 |
| Recency | 「记忆有多新」 | 按时间衰减的指数分。 |
| Importance | 「agent 有多在意」 | 写入时自评 1-10。被缓存。 |
| Relevance | 「跟当前 query 多相关」 | 余弦相似度（基于 embedding）。 |
| Reflection | 「高阶信念」 | 由最近记忆综合生成，重新写入流作为新记忆。 |
| Plan | 「天 / 小时 / 动作分解」 | 自上而下计划树。被观察推翻时可修订。 |
| Smallville | 「Park 2023 的沙盒」 | 25-agent 仿真，产生了情人节涌现。 |
| Believability | 「质量指标」 | 人类评分员对行为是否像一个合理 agent 的打分。 |

## 延伸阅读（Further Reading）

- [Park et al. — Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) — 参考架构
- [UIST '23 paper page](https://dl.acm.org/doi/10.1145/3586183.3606763) — 发表venue
- [Smallville code release](https://github.com/joonspk-research/generative_agents) — 参考 Python 实现
- [Hayes-Roth 1985 — A Blackboard Architecture for Control](https://www.sciencedirect.com/science/article/abs/pii/0004370285900639) — 结构化记忆 agent 的先驱工作
