# 技能库与终身学习（Skill Libraries and Lifelong Learning · Voyager）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Voyager（Wang et al., TMLR 2024）把可执行代码当作技能（skill）。技能有名字、可检索、可组合，并通过环境反馈不断打磨。这是 Claude Agent SDK skills、skillkit，以及 2026 年 skill-library 范式的参考架构。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 14 · 07 (MemGPT), Phase 14 · 08 (Letta Blocks)
**Time:** ~75 minutes

## 学习目标（Learning Objectives）

- 说出 Voyager 的三个组件——automatic curriculum（自动课程）、skill library（技能库）、iterative prompting（迭代式提示）——以及各自的角色。
- 解释为什么 Voyager 把动作空间设计成代码，而不是基本命令。
- 用标准库实现一个 skill library：注册、检索、组合，以及由失败驱动的精炼。
- 把 Voyager 的范式映射到 2026 年的 Claude Agent SDK skills 与 skillkit 生态。

## 问题（The Problem）

每次会话都从零重建全部能力的 agent，会犯三个错：

1. **浪费 token。** 同样的推理被反复触发。
2. **进步流失。** A 会话里学到的修正没法迁移到 B 会话。
3. **长链路组合容易翻车。** 复杂任务需要能力层级，one-shot prompt 表达不了。

Voyager 的回答是：把每一项可复用能力都视作一段命名的代码，存进库里，按相似度检索，可与其他技能组合，并通过执行反馈不断打磨。

## 概念（The Concept）

### 三个组件（Three components）

Voyager（arXiv:2305.16291）把 agent 围绕这三个东西组织：

1. **Automatic curriculum（自动课程）。** 一个由好奇心驱动的 proposer 根据当前技能集合和环境状态挑选下一个任务。探索是自下而上的。
2. **Skill library（技能库）。** 每个技能都是可执行代码。任务成功后新增技能。技能按 query 与 description 的相似度检索。
3. **Iterative prompting mechanism（迭代式提示机制）。** 失败时，agent 拿到执行错误、环境反馈、自我校验输出，然后精炼这条技能。

Minecraft 上的评测（Wang et al., 2024）：相比基线，独立物品多 3.3×、获得石器快 8.5×、铁器快 6.4×、地图横穿距离长 2.3×。这些数字是 Minecraft 专属，但范式可以迁移。

### 动作空间 = 代码（Action space = code）

大多数 agent 输出基本命令。Voyager 输出 JavaScript 函数。一个技能长这样：

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

由子技能组合而成。以描述与 embedding 为键存储。检索时拿到的是程序，不是 prompt。

这就是 2026 年的 Claude Agent SDK skill：一段命名的、可检索的代码，加上 agent 按需加载的指令。

### 技能检索（Skill retrieval）

新任务「make a diamond pickaxe」。Agent 的步骤：

1. 把任务描述 embedding。
2. 在 skill library 中查询 top-k 相似技能。
3. 取回 `craftIronPickaxe`、`mineDiamond`、`placeCraftingTable` 等等。
4. 用取回的原语 + 新逻辑组合出新技能。

这正是 MCP resources（Phase 13）和 Agent SDK skills 实现的范式：在某个知识 / 代码表面上做检索，并把范围限定到当前任务。

### 迭代精炼（Iterative refinement）

Voyager 的反馈环：

1. Agent 写出一条技能。
2. 技能在环境中运行。
3. 三种信号之一返回：`success`、`error`（带 stack trace）、`self-verification failure`。
4. Agent 把信号作为上下文重写技能。
5. 直到成功或达到最大轮数。

这就是把 Self-Refine（Lesson 05）套到代码生成上，并用环境校验来锚定。CRITIC（Lesson 05）是同一范式，区别是用外部工具来当 verifier（验证器）。

### 课程与探索（Curriculum and exploration）

Voyager 的 curriculum 模块会基于「agent 已经有什么、还没做什么」提出诸如「在湖边建个棚子」之类的任务。Proposer 综合环境状态 + 技能清单，挑出一个略高于当前能力上限的任务——这就是探索的甜区。

放到生产 agent 上，这等于一个「缺什么」算子：给定当前 skill library 和一个领域，我们还有哪些技能没覆盖到？团队通常会把它做成人工的 curriculum review。

### 这个范式会在哪里出问题（Where this pattern goes wrong）

- **Skill library rot（技能库腐烂）。** 同一条技能换 10 种描述被加进去 10 次。要在写入时去重，让检索只返回唯一一条。
- **组合技能漂移（Composed-skill drift）。** 父技能依赖某个被精炼过的子技能。给技能打版本；钉死在 v1 的父技能不会神奇地自动用上 v3。
- **检索质量。** 当库扩张到几百条以上，按描述做 vector 检索的质量就会下滑。补上 tag 过滤和硬约束（比如「只在 `category=tooling` 的技能里检索」）。

## 动手实现（Build It）

`code/main.py` 用标准库实现了一个 skill library：

- `Skill` — name、description、code（字符串形式）、version、tags、dependencies。
- `SkillLibrary` — register、search（token 重叠）、compose（按依赖做拓扑排序），以及 refine（更新时 bump 版本号）。
- 一个脚本式 agent：注册三条原语技能、组合出第四条、撞上一次失败、然后精炼。

跑起来：

```
python3 code/main.py
```

trace 会展示库写入、检索、组合、一次失败执行，以及一次 v2 精炼——一条 Voyager 反馈环从头到尾。

## 用起来（Use It）

- **Claude Agent SDK skills**（Anthropic）—— 2026 年的参考实现：每个 skill 由 description、code、instructions 组成，agent 会话中按需加载。
- **skillkit**（npm: skillkit）—— 跨 agent 的 skill 管理，已支持 32+ AI 编码 agent。
- **自建 skill library** —— 领域专属（数据 agent 的 SQL 技能、基础设施 agent 的 Terraform 技能）。Voyager 范式向下也能用。
- **OpenAI Agents SDK `tools`** —— 轻量端：每个 tool 就是一个轻量级 skill。

## 上线部署（Ship It）

`outputs/skill-skill-library.md` 会生成一份 Voyager 形态的 skill library，把注册、检索、版本化、精炼都接好，可以适配任意目标运行时。

## 练习（Exercises）

1. 给 `compose()` 加一个依赖环检测器。当技能 A 依赖 B、B 又依赖 A 时怎么办？是 error 还是 warning？
2. 实现按技能粒度的 version 钉死。当父技能组合了子技能 `crafting@1` 时，把 `crafting` 精炼到 `@2` 不能静默升级父技能。
3. 把 token 重叠检索换成 sentence-transformers embedding（或者一个标准库的 BM25 实现）。在一个 50 条技能的玩具库上测 retrieval@5。
4. 加一个「curriculum」 agent：给定当前库和一段领域描述，提出 5 条缺失技能。把它做成每周跑一次。
5. 读 Anthropic 的 Claude Agent SDK skill 文档。把玩具库迁到 SDK 的 skill schema 上。可发现性会发生什么变化？

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Skill | 「可复用能力」 | 命名的一段代码 + 描述，可按相似度检索 |
| Skill library | 「agent 关于 how-to 的记忆」 | 持久化的技能存储，可搜索可组合 |
| Curriculum | 「任务 proposer」 | 由当前能力差距驱动的自下而上目标生成器 |
| Composition | 「技能 DAG（有向无环图）」 | 技能调用技能；执行时做拓扑排序 |
| Iterative refinement | 「自我修正环」 | 环境反馈 + 错误 + 自校验回灌进下一版 |
| Action-space-as-code | 「程序化动作」 | 输出函数而非基本命令，以表达跨时间步的行为 |
| Dedup on write | 「技能坍缩」 | 近似重复的描述坍缩为同一条规范技能 |

## 延伸阅读（Further Reading）

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) —— 最初的 skill-library 论文
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) —— 2026 年把 skill 产品化的参考
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) —— skills 与 subagents 在实战中的样子
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) —— Voyager 底下的精炼环
