# 技能库与终身学习（Voyager）

> Voyager（Wang 等人，TMLR 2024）将可执行代码视为一种技能。技能是命名的、可检索的、可组合的，并通过环境反馈进行精炼。这是 Claude Agent SDK skills、skillkit 和 2026 年技能库模式的参考架构。

**类型：** 构建（Build）
**语言：** Python（标准库）
**前置要求：** 阶段 14 · 07（MemGPT）、阶段 14 · 08（Letta Blocks）
**时长：** 约 75 分钟

## 学习目标

- 说出 Voyager 的三个组成部分——自动课程（automatic curriculum）、技能库（skill library）、迭代提示（iterative prompting）——以及每个的作用。
- 解释为什么 Voyager 将动作空间设为代码，而不是原始命令。
- 实现一个带有注册、检索、组合和失败驱动精炼的标准库技能库。
- 将 Voyager 的模式映射到 2026 年 Claude Agent SDK 技能和 skillkit 生态系统。

## 问题背景

在每次会话中从头重建每个能力的 Agent 在三个方面是错误的：

1. **浪费 token。** 每个任务重新引发相同的推理。
2. **失去进展。** 在会话 A 中学到的纠正不会转移到会话 B。
3. **在长期组合上失败。** 复杂任务需要能力层次结构；一次性提示无法表达它们。

Voyager 的回答：将每个可重用能力视为存储在库中的命名代码块，可通过相似性检索，可与其他技能组合，并通过执行反馈进行精炼。

## 核心概念

### 三个组成部分

Voyager（arXiv:2305.16291）围绕以下结构构建 Agent：

1. **自动课程（Automatic curriculum）。** 好奇心驱动的提议器根据 Agent 的当前技能集和环境状态选择下一个任务。探索是自下而上的。
2. **技能库（Skill library）。** 每个技能都是可执行代码。任务成功时添加新技能。技能通过查询到描述的相似性进行检索。
3. **迭代提示机制（Iterative prompting mechanism）。** 失败时，Agent 接收执行错误、环境反馈和自我验证输出，然后精炼技能。

Minecraft 评估（Wang 等人，2024）：相比基线，独特物品多 3.3 倍，石器工具快 8.5 倍，铁器工具快 6.4 倍，地图遍历长 2.3 倍。数字特定于 Minecraft，但模式可以迁移。

### 动作空间 = 代码

大多数 Agent 发出原始命令。Voyager 发出 JavaScript 函数。一个技能是：

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

由子技能组成。以描述和 embedding 为键存储。作为程序检索，而不是提示。

这是 2026 年 Claude Agent SDK 技能：一个命名的、可检索的代码块加上 Agent 按需加载的指令。

### 技能检索

新任务"制作钻石镐"。Agent：

1. 嵌入任务描述。
2. 查询技能库中 top-k 相似技能。
3. 检索 `craftIronPickaxe`、`mineDiamond`、`placeCraftingTable` 等。
4. 从检索到的原语 + 新逻辑组成新技能。

这是 MCP 资源（阶段 13）和 Agent SDK 技能实现的模式：在知识/代码表面上进行检索，范围限定到当前任务。

### 迭代精炼

Voyager 的反馈循环：

1. Agent 写一个技能。
2. 技能针对环境运行。
3. 返回三种信号之一：`success`、`error`（带堆栈跟踪）、`self-verification failure`。
4. Agent 使用信号作为上下文重写技能。
5. 循环直到成功或达到最大轮数。

这是应用于带环境 grounding 验证的代码生成的 Self-Refine（第 05 课）。CRITIC（第 05 课）是使用外部工具作为验证器的相同模式。

### 课程与探索

Voyager 的课程模块根据 Agent 拥有什么和尚未做什么来提议任务，如"在湖附近建造一个庇护所"。提议器使用环境状态 + 技能清单来选择刚好高于当前能力的任务——探索的甜蜜点。

对于生产 Agent，这转换为"缺少什么"操作员：给定当前技能库和域，我们还没有覆盖哪些技能？团队通常手动实现此作为课程审查。

### 这种模式哪里会出错

- **技能库腐烂。** 同一技能添加了 10 次，描述略有不同。在写入时添加去重；检索只返回一个。
- **组合技能漂移。** 父技能依赖于已精炼的子技能。技能版本控制；固定到 v1 的父技能不会神奇地获取 v3。
- **检索质量。** 随着库增长到几百个以上，技能描述上的向量检索会降级。用标签过滤器和硬约束（"仅限具有 `category=tooling` 的技能"）补充。

## 构建它

`code/main.py` 实现一个标准库技能库：

- `Skill`——名称、描述、代码（作为字符串）、版本、标签、依赖项。
- `SkillLibrary`——注册、搜索（token 重叠）、组合（依赖项的拓扑排序）和精炼（更新时版本碰撞）。
- 一个脚本化 Agent，注册三个原语技能，组成一个第四个，遇到失败，并进行精炼。

运行它：

```
python3 code/main.py
```

轨迹显示库写入、检索、组合、失败执行和 v2 精炼——Voyager 的端到端循环。

## 使用它

- **Claude Agent SDK skills**（Anthropic）——2026 年参考：每个技能都有描述、代码和指令；在 Agent 会话期间按需加载。
- **skillkit**（npm: skillkit）——用于 32+ AI 编码 Agent 的跨 Agent 技能管理。
- **自定义技能库**——特定于域（数据 Agent 的 SQL 技能、基础设施 Agent 的 Terraform 技能）。Voyager 模式可缩小规模。
- **OpenAI Agents SDK `tools`**——在低端；每个工具都是一个轻量级技能。

## 部署它

`outputs/skill-skill-library.md` 为任何目标运行时生成带有注册、检索、版本控制和精炼连接的 Voyager 形技能库。

## 练习

1. 向 `compose()` 添加依赖循环检测器。当技能 A 依赖于 B 且 B 依赖于 A 时会发生什么？错误 vs 警告？
2. 实现每技能版本固定。当父技能组成子 `crafting@1` 时，`crafting@2` 的精炼绝不能静默升级父技能。
3. 将 token 重叠检索替换为 sentence-transformers embeddings（或 BM25 标准库实现）。在 50 技能玩具库上测量 retrieval@5。
4. 添加一个"课程"Agent：给定当前库和域描述，提议 5 个缺失的技能。每周调用一次。
5. 阅读 Anthropic 的 Claude Agent SDK 技能文档。将玩具库移植到 SDK 的技能模式。可发现性发生了什么变化？

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------|---------|
| Skill | "可重用能力" | 命名的代码块 + 描述，可通过相似性检索 |
| Skill library | "Agent 如何做的记忆" | 技能的持久存储，可搜索和可组合 |
| Curriculum | "任务提议器" | 由当前能力差距驱动的自下而上目标生成器 |
| Composition | "技能 DAG" | 技能调用技能；执行时拓扑排序 |
| Iterative refinement | "自我纠正循环" | 环境反馈 + 错误 + 自我验证折叠到下一版本 |
| Action-space-as-code | "程序化动作" | 发出函数，而不是原始命令，用于时间扩展行为 |
| Dedup on write | "技能折叠" | 近乎重复的描述折叠为一个规范技能 |

## 延伸阅读

- [Wang et al., Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291)——原始技能库论文
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)——作为 2026 年产品化的技能
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)——实践中的技能和子 Agent
- [Madaan et al., Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651)——Voyager 底层的精炼循环
