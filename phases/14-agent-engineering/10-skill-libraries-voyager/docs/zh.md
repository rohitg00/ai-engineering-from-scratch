# 技能库与终身学习（Voyager）

> Voyager（Wang 等，TMLR 2024）将可执行代码视为技能。技能是命名的、可检索的、可组合的，并通过环境反馈精炼。这是 Claude Agent SDK 技能、skillkit 和 2026 年技能库模式的参考架构。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 07（MemGPT），第 14 阶段 · 08（Letta 块）
**时间：** ~75 分钟

## 学习目标

- 说出 Voyager 的三个组件——自动课程、技能库、迭代提示——及其各自的作用。
- 解释为什么 Voyager 将动作空间设为代码，而不是原始命令。
- 实现一个标准库技能库，包含注册、检索、组合和失败驱动的精炼。
- 将 Voyager 的模式映射到 2026 年 Claude Agent SDK 技能和 skillkit 生态系统。

## 问题

在每个会话中从头开始重建每个能力的 agent 做错了三件事：

1. **浪费 token。** 每个任务都重新引发相同的推理。
2. **失去进展。** 会话 A 中学到的修正不会转移到会话 B。
3. **长程组合失败。** 复杂任务需要能力层次结构；一次性提示无法表达它们。

Voyager 的答案：将每个可复用能力视为存储在库中的命名代码块，可按相似性检索，可与其他技能组合，并通过执行反馈精炼。

## 概念

### 三个组件

Voyager（arXiv:2305.16291）围绕以下结构构建 agent：

1. **自动课程。** 好奇心驱动的提议者根据 agent 当前技能集和环境状态选择下一个任务。探索是自下而上的。
2. **技能库。** 每个技能是可执行代码。任务成功时添加新技能。技能按查询到描述的相似性检索。
3. **迭代提示机制。** 失败时，agent 接收执行错误、环境反馈和自我验证输出，然后精炼技能。

Minecraft 评估（Wang 等，2024）：独特物品多 3.3 倍，石制工具快 8.5 倍，铁制工具快 6.4 倍，地图遍历长 2.3 倍。数字是 Minecraft 特定的，但模式可转移。

### 动作空间 = 代码

大多数 agent 发出原始命令。Voyager 发出 JavaScript 函数。一个技能是：

```
async function craftIronPickaxe(bot) {
  await mineIron(bot, 3);
  await mineStick(bot, 2);
  await placeCraftingTable(bot);
  await craft(bot, 'iron_pickaxe');
}
```

由子技能组合。按键描述和嵌入存储。作为程序检索，不是提示词。

这是 2026 年 Claude Agent SDK 技能：agent 按需加载的命名、可检索代码块加指令。

### 技能检索

新任务"制作钻石镐"。Agent：

1. 嵌入任务描述。
2. 查询技能库获取 top-k 相似技能。
3. 检索 `craftIronPickaxe`、`mineDiamond`、`placeCraftingTable` 等。
4. 从检索到的原语 + 新逻辑组合新技能。

这是 MCP 资源（第 13 阶段）和 Agent SDK 技能实现的模式：在知识/代码表面上检索，范围限定到当前任务。

### 迭代精炼

Voyager 的反馈循环：

1. Agent 编写技能。
2. 技能针对环境运行。
3. 返回三种信号之一：`success`、`error`（带堆栈跟踪）、`self-verification failure`。
4. Agent 使用信号作为上下文重写技能。
5. 循环直到成功或最大轮数。

这是 Self-Refine（第 05 课）应用于代码生成，带环境依据验证。CRITIC（第 05 课）是相同模式，外部工具作为验证器。

### 课程与探索

Voyager 的课程模块提议任务如"在湖边建造避难所"，基于 agent 已有什么和尚未做什么。提议者使用环境状态 + 技能清单选择略高于当前能力的任务——探索最佳点。

对于生产 agent，这转化为"缺少什么"操作：给定当前技能库和领域，我们尚未覆盖哪些技能？团队通常手动实现为课程审查。

### 此模式出错的地方

- **技能库腐烂。** 同一技能以略微不同的描述添加 10 次。在写入时添加去重；检索只返回一个。
- **组合技能漂移。** 父技能依赖于被精炼的子技能。对技能进行版本控制；固定到 v1 的父技能不会自动获取 v3。
- **检索质量。** 技能描述上的向量检索在库增长到几百个以上时退化。用标签过滤和硬约束补充（"仅限 `category=tooling` 的技能"）。

## 构建

`code/main.py` 实现标准库技能库：

- `Skill` —— 名称、描述、代码（字符串）、版本、标签、依赖。
- `SkillLibrary` —— 注册、搜索（token 重叠）、组合（依赖的拓扑排序）、精炼（更新时版本提升）。
- 脚本 agent 注册三个原语技能，组合第四个，遇到失败，然后精炼。

运行：

```
python3 code/main.py
```

跟踪显示库写入、检索、组合、失败执行和 v2 精炼——端到端的 Voyager 循环。

## 使用

- **Claude Agent SDK 技能**（Anthropic）—— 2026 年参考：每个技能有描述、代码和指令；在 agent 会话期间按需加载。
- **skillkit**（npm: skillkit）—— 32+ AI 编码 agent 的跨 agent 技能管理。
- **自定义技能库** —— 领域特定（数据 agent 的 SQL 技能、基础设施 agent 的 Terraform 技能）。Voyager 模式可缩小规模。
- **OpenAI Agents SDK `tools`** —— 低端；每个工具是轻量级技能。

## 交付

`outputs/skill-skill-library.md` 生成 Voyager 形状的技能库，包含注册、检索、版本控制和精炼，为任何目标运行时连接。

## 练习

1. 为 `compose()` 添加依赖循环检测器。当技能 A 依赖于 B 而 B 依赖于 A 时会发生什么？错误 vs 警告？
2. 实现每技能版本固定。当父技能组合子 `crafting@1` 时，对 `crafting@2` 的精炼不得静默升级父技能。
3. 用 sentence-transformers 嵌入（或标准库 BM25 实现）替换 token 重叠检索。在 50 技能玩具库上测量 retrieval@5。
4. 添加一个"课程"agent：给定当前库和领域描述，提议 5 个缺失技能。每周调用一次。
5. 阅读 Anthropic 的 Claude Agent SDK 技能文档。将玩具库移植到 SDK 的技能模式。可发现性有什么变化？

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Skill | "可复用能力" | 命名代码块 + 描述，按相似性检索 |
| Skill library | "Agent 如何做的记忆" | 技能的持久存储，可搜索和组合 |
| Curriculum | "任务提议者" | 由当前能力差距驱动的自下而上目标生成器 |
| Composition | "技能 DAG" | 技能调用技能；执行时拓扑排序 |
| Iterative refinement | "自我纠正循环" | 环境反馈 + 错误 + 自我验证折叠进下一版本 |
| Action-space-as-code | "程序化动作" | 发出函数而非原始命令，用于时间延伸行为 |
| Dedup on write | "技能折叠" | 近似重复描述折叠为一个规范技能 |

## 延伸阅读

- [Wang 等，Voyager (arXiv:2305.16291)](https://arxiv.org/abs/2305.16291) —— 原始技能库论文
- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview) —— 2026 年产品化
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk) —— 实践中的技能和子 agent
- [Madaan 等，Self-Refine (arXiv:2303.17651)](https://arxiv.org/abs/2303.17651) —— Voyager 下的精炼循环