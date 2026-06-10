# 10 · 技能库与终身学习（Voyager）

> Voyager（Wang 等人，TMLR 2024）将可执行代码视为一种「技能（skill）」。技能是有命名、可检索、可组合的，并通过环境反馈不断精炼。这是 Claude Agent SDK skills、skillkit 以及 2026 年技能库模式的参考架构。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置：** 第 14 阶段 · 07（MemGPT），第 14 阶段 · 08（Letta Blocks）
**时长：** 约 75 分钟

## 学习目标

- 说出 Voyager 的三大组件——「自动课程（automatic curriculum）」、「技能库（skill library）」、「迭代提示（iterative prompting）」——以及各自的作用。
- 解释为什么 Voyager 把「动作空间（action space）」设为代码，而非原始命令。
- 用标准库实现一个具备注册、检索、组合以及失败驱动精炼能力的技能库。
- 把 Voyager 的模式映射到 2026 年的 Claude Agent SDK skills 以及 skillkit 生态。

## 问题所在

每次会话都从零重建全部能力的智能体，会犯三个错误：

1. **浪费 token。** 每个任务都要重新引出同样的推理。
2. **丢失进度。** 会话 A 中学到的纠正无法迁移到会话 B。
3. **在长程组合上失败。** 复杂任务需要能力层级；一次性提示无法表达它们。

Voyager 的答案：把每一项可复用能力当作一段有命名的代码，存入库中，可按相似度检索，可与其他技能组合，并通过执行反馈不断精炼。

## 核心概念

### 三大组件

Voyager（arXiv:2305.16291）围绕以下三者构建智能体：

1. **自动课程（automatic curriculum）。** 一个由好奇心驱动的「提议器（proposer）」根据智能体当前的技能集与环境状态，挑选下一个任务。探索是自底向上的。
2. **技能库（skill library）。** 每个技能都是可执行代码。当任务成功时，新技能被加入库中。技能按「查询到描述」的相似度进行检索。
3. **迭代提示机制（iterative prompting mechanism）。** 失败时，智能体会收到执行错误、环境反馈以及自我验证输出，然后据此精炼技能。

Minecraft 评测（Wang 等人，2024）：相较于基线，获得的独特物品多 3.3 倍，获取石质工具快 8.5 倍，获取铁质工具快 6.4 倍，地图遍历距离长 2.3 倍。这些数字是 Minecraft 特有的，但模式可以迁移。

### 动作空间 = 代码

大多数智能体发出的是原始命令。Voyager 发出的是 JavaScript 函数。一个技能形如：

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

由子技能组合而成。以描述和嵌入（embedding）作为键存储。作为程序而非提示被检索出来。

这正是 2026 年的 Claude Agent SDK 技能：一段有命名、可检索的代码，外加智能体按需加载的指令。

### 技能检索

新任务「制作一把钻石镐」。智能体：

1. 嵌入该任务描述。
2. 在技能库中查询 top-k 个相似技能。
3. 检索出 `craftIronPickaxe`、`mineDiamond`、`placeCraftingTable` 等。
4. 用检索到的原语 + 新逻辑组合出新技能。

这正是 MCP 资源（第 13 阶段）和 Agent SDK 技能所实现的模式：在某个知识/代码面上进行检索，并将范围限定到当前任务。

### 迭代精炼

Voyager 的反馈循环：

1. 智能体编写一个技能。
2. 技能针对环境运行。
3. 返回三种信号之一：`success`、`error`（带堆栈跟踪）、`self-verification failure`。
4. 智能体以该信号为上下文重写技能。
5. 循环，直到成功或达到最大轮数。

这正是把 Self-Refine（第 05 课）应用于代码生成，并辅以基于环境的验证。CRITIC（第 05 课）是同一模式，只是用外部工具作为验证器。

### 课程与探索

Voyager 的课程模块会基于智能体已拥有什么、尚未完成什么，提议诸如「在湖边搭建一处庇护所」之类的任务。提议器利用环境状态 + 技能清单，挑选一个略高于当前能力的任务——这是探索的甜蜜点。

对于生产级智能体，这转化为一个「缺什么」算子：给定当前技能库和一个领域，我们还有哪些技能尚未覆盖？团队通常通过人工的课程评审来实现这一点。

### 这一模式在哪里会出错

- **技能库腐化。** 同一个技能以略有不同的描述被加入了 10 次。在写入时加入去重；检索只返回其中一个。
- **组合技能漂移。** 父技能依赖于某个已被精炼过的子技能。给技能加版本；钉死在 v1 的父技能不会神奇地用上 v3。
- **检索质量。** 当库增长到几百个以上时，基于技能描述的向量检索质量会下降。用标签过滤和硬约束来补充（「只要 `category=tooling` 的技能」）。

## 动手构建

`code/main.py` 用标准库实现了一个技能库：

- `Skill`——name、description、code（以字符串形式）、version、tags、dependencies。
- `SkillLibrary`——register、search（词元重叠）、compose（对依赖做拓扑排序）以及 refine（更新时版本号递增）。
- 一个脚本化的智能体：注册三个原始技能，组合出第四个，遇到一次失败，然后精炼。

运行它：

```
python3 code/main.py
```

该轨迹展示了库的写入、检索、组合、一次失败的执行，以及一次 v2 精炼——这就是 Voyager 闭环的端到端呈现。

## 应用场景

- **Claude Agent SDK skills**（Anthropic）——2026 年的参考实现：每个技能都有描述、代码和指令；在智能体会话中按需加载。
- **skillkit**（npm: skillkit）——面向 32+ 种 AI 编码智能体的跨智能体技能管理。
- **自定义技能库**——领域专用（给数据智能体的 SQL 技能，给基础设施智能体的 Terraform 技能）。Voyager 模式可以向下缩放。
- **OpenAI Agents SDK `tools`**——位于低端；每个工具都是一个轻量级技能。

## 交付落地

`outputs/skill-skill-library.md` 会生成一个 Voyager 形态的技能库，针对任意目标运行时接好注册、检索、版本管理与精炼。

## 练习

1. 给 `compose()` 加一个依赖环检测器。当技能 A 依赖 B、B 又依赖 A 时会发生什么？是报错还是警告？
2. 实现按技能的版本钉定。当父技能组合子技能 `crafting@1` 时，对 `crafting@2` 的精炼不得悄悄升级父技能。
3. 把词元重叠检索替换为 sentence-transformers 嵌入（或一个标准库实现的 BM25）。在一个 50 技能的玩具库上测量 retrieval@5。
4. 加一个「课程」智能体：给定当前库和一个领域描述，提议 5 个缺失的技能。每周调用一次。
5. 阅读 Anthropic 的 Claude Agent SDK 技能文档。把玩具库移植到 SDK 的技能 schema。可发现性会有什么变化？

## 关键术语

| 术语 | 人们怎么说 | 它实际的含义 |
|------|----------------|------------------------|
| 技能（Skill） | 「可复用的能力」 | 有命名的代码片段 + 描述，可按相似度检索 |
| 技能库（Skill library） | 「智能体关于如何做的记忆」 | 技能的持久化存储，可搜索、可组合 |
| 课程（Curriculum） | 「任务提议器」 | 由当前能力缺口驱动的自底向上目标生成器 |
| 组合（Composition） | 「技能 DAG」 | 技能调用技能；执行时按拓扑排序 |
| 迭代精炼（Iterative refinement） | 「自纠正循环」 | 环境反馈 + 错误 + 自我验证回灌进下一个版本 |
| 动作空间即代码（Action-space-as-code） | 「程序化动作」 | 为获得时间上延展的行为，发出函数而非原始命令 |
| 写入即去重（Dedup on write） | 「技能坍缩」 | 近似重复的描述坍缩为一个规范技能 |

## 延伸阅读

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) —— 最初的技能库论文
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) —— 技能作为 2026 年的产品化形态
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) —— 技能与子智能体的实战
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) —— Voyager 底层的精炼循环
