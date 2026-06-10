# 32 · 最小智能体工作台

> 最小但实用的工作台只需三个文件：一份根指令路由器、一份状态文件，以及一份任务看板。其余一切都是在此之上叠加的。如果一个代码库连这三个文件都承载不了，任何模型都救不了它。

**类型：** 实战构建（Build）
**语言：** Python（标准库）
**前置：** 第 14 阶段 · 31（为什么强大的模型仍会失败）
**时长：** 约 45 分钟

## 学习目标

- 定义构成最小可用工作台（minimum viable workbench）的三个文件。
- 解释为什么一份简短的根路由器（router）胜过一份冗长的单体 `AGENTS.md`。
- 构建一份智能体每一轮都能读取、并在结束时写入的状态文件。
- 构建一份无需聊天历史也能跨越多次会话存续的任务看板。

## 问题所在

大多数团队搭建工作台的方式，是写一份 3000 行的 `AGENTS.md`，然后就算大功告成。模型把它加载进来，忽略掉那些它无法概括的部分，然后照样在它一向失败的地方继续失败。

你需要的恰恰相反：一个极小的根文件，仅在相关时才把智能体路由（route）到更深层的文件中去。一份持久化的状态，让智能体在行动前读取、行动后写入。一份任务看板，说明哪些任务正在进行、哪些被阻塞、哪些即将开始。

三个文件。每个都有自己的职责。每个都足够机器可读，以便日后演化为真正的系统。

## 核心概念

```mermaid
flowchart LR
  Agent[Agent Loop] --> Router[AGENTS.md]
  Router --> State[agent_state.json]
  Router --> Board[task_board.json]
  State --> Agent
  Board --> Agent
```

### AGENTS.md 是路由器，不是手册

一份好的 `AGENTS.md` 应该简短。它把智能体指向：

- 状态文件（你当前在哪里）。
- 任务看板（还剩什么没做）。
- 更深层的规则（位于 `docs/agent-rules.md`）。
- 验证命令（如何确认它确实可用）。

任何更长的内容都应放进更深层的文档，仅在需要时才加载。冗长的手册会被忽略，简短的路由器才会被遵循。

### agent_state.json 是记录系统

状态承载着：当前活动任务的 id、被改动过的文件、所做的假设、阻塞项，以及下一步动作。智能体在每一轮都会读取它。下一次会话读取的是它，而不是重放聊天记录。

状态之所以存在于文件中，是因为聊天历史不可靠。会话会终止，对话会被截断，而文件不会。

### task_board.json 是队列

任务看板承载着每一项任务，其状态为 `todo | in_progress | done | blocked`。它是智能体在状态为空时拉取任务的队列，也是你想知道智能体是否走在正轨上时所读取的队列。

看板上的一项任务有 id、目标（goal）、负责人（`builder`、`reviewer` 或 `human`），以及验收标准（acceptance criteria）。看板刻意保持精简：当它的内容增长到超过一屏时，说明你遇到的是规划问题，而非看板问题。

### 三个文件是地板，不是天花板

后续课程会加入范围契约（scope contracts）、反馈运行器（feedback runners）、验证关卡（verification gates）、审查者清单（reviewer checklists）和交接包（handoff packets）。本课的这三个文件，正是它们共同的前提假设。

## 动手构建

`code/main.py` 会把最小工作台写入一个空仓库，并演示单次智能体回合（agent turn），该回合会：

1. 读取 `agent_state.json`。
2. 若状态为空，则从 `task_board.json` 拉取下一项任务。
3. 在范围内改动单个文件。
4. 把更新后的状态写回。

运行它：

```
python3 code/main.py
```

该脚本会在自身旁边创建 `workdir/`，铺设这三个文件，运行一个回合，并打印 diff。重新运行它，可以看到第二个回合如何接续第一个回合中断的位置。

## 实际运用

在生产级的智能体产品内部，这同样的三个文件以不同的名字出现：

- **Claude Code：** 路由器用 `AGENTS.md` 或 `CLAUDE.md`，状态用 `.claude/state.json` 这类存储，看板用钩子（hooks）。
- **Codex / Cursor：** 路由器用工作区规则（workspace rules），状态用会话记忆（session memory），看板用聊天侧边栏中排队的任务。
- **自定义 Python 智能体：** 就是你刚刚写下的那几个文件。

名字会变，形态不变。

## 真实世界中的生产模式

当三种模式叠加在最小工作台之上时，它便能经受住与真实单体仓库（monorepo）的正面碰撞。这些模式相互独立；挑选你的仓库真正需要的那些即可。

**带「就近优先」优先级的嵌套 `AGENTS.md`。** OpenAI 在其主仓库中部署了 88 个 `AGENTS.md` 文件，每个子组件一个。Codex、Cursor、Claude Code 和 Copilot 都会从当前工作文件向仓库根目录逐级上溯，并把沿途找到的每一个 `AGENTS.md` 拼接起来。子目录文件会扩展根文件。Codex 额外提供了 `AGENTS.override.md` 用于替换而非扩展；该覆盖机制是 Codex 专有的，在跨工具协作时应避免使用。Augment Code 的测量结果才是关键所在：最好的 `AGENTS.md` 文件能带来相当于从 Haiku 升级到 Opus 的质量跃升；最差的则会让输出比没有文件还糟。

**应当拒绝的反模式，哪怕它们看起来覆盖很全。** 相互冲突的指令会悄无声息地把智能体从交互模式拖入贪婪模式（ICLR 2026 AMBIG-SWE：解决率 48.8% → 28%）；要为优先级编号，而不是把它们平铺堆叠。不可验证的风格规则（「遵循 Google Python Style Guide」）若没有强制执行命令，会让智能体自行编造「合规」的假象；每条风格规则都要配上确切的 lint 命令。把风格写在命令前面会埋没验证路径；命令在先，风格在后。为人类而非智能体撰写会浪费上下文预算；简洁本身就是一项特性。

**跨工具符号链接。** 一个根文件配上符号链接（`ln -s AGENTS.md CLAUDE.md`、`ln -s AGENTS.md .github/copilot-instructions.md`、`ln -s AGENTS.md .cursorrules`），可以让每一个编码智能体都基于同一份事实来源（source of truth）。Nx 的 `nx ai-setup` 能从单一配置出发，跨 Claude Code、Cursor、Copilot、Gemini、Codex 和 OpenCode 自动完成这一切。

## 交付上线

`outputs/skill-minimal-workbench.md` 可为任何新仓库生成这套三文件工作台：一份针对项目调校过的 `AGENTS.md` 路由器、一份带有正确键的 `agent_state.json`，以及一份用当前待办积压（backlog）填充好的 `task_board.json`。

## 练习

1. 给 `agent_state.json` 加一个 `last_run` 时间戳。若该文件超过 24 小时未更新，则拒绝运行，除非操作员确认。
2. 给任务看板加一个 `priority` 字段，并修改拉取器，使其始终选取优先级最高的 `todo`。
3. 把 `task_board.json` 迁移为 JSON Lines 格式，让每项任务占一行，从而在版本控制中获得干净的 diff。
4. 编写一个 `lint_workbench.py`，若 `AGENTS.md` 超过 80 行，或引用了不存在的文件，则报错失败。
5. 在这三个文件中，判断丢失哪一个会损失最惨重。为你的选择辩护。

## 关键术语

| 术语 | 人们口中的说法 | 它实际的含义 |
|------|----------------|------------------------|
| 路由器（Router） | `AGENTS.md` | 简短的根文件，把智能体指向更深层的文档与文件 |
| 状态文件（State file） | 「那些笔记」 | 机器可读的记录，标明智能体当前所处位置，每一轮都会写入 |
| 任务看板（Task board） | 「待办积压」 | 带状态、负责人、验收标准的 JSON 工作队列 |
| 记录系统（System of record） | 「事实来源」 | 当聊天记录不复存在时，工作台视为权威依据的那个文件 |

## 延伸阅读

- [agents.md — 开放规范](https://agents.md/) —— 已被 Cursor、Codex、Claude Code、Copilot、Gemini、OpenCode 采用
- [Augment Code，好的 AGENTS.md 是一次模型升级，差的则比没有文档还糟](https://www.augmentcode.com/blog/how-to-write-good-agents-dot-md-files) —— 实测的质量跃升
- [Blake Crosley，AGENTS.md 模式：到底什么才真正改变智能体行为](https://blakecrosley.com/blog/agents-md-patterns) —— 经验上有效与无效的做法
- [Datadog Frontend，用 AGENTS.md 在单体仓库中引导 AI 智能体](https://dev.to/datadog-frontend-dev/steering-ai-agents-in-monorepos-with-agentsmd-13g0) —— 嵌套优先级的实践
- [Nx 博客，教会你的 AI 智能体如何在单体仓库中工作](https://nx.dev/blog/nx-ai-agent-skills) —— 跨六款工具的单一源生成
- [The Prompt Shelf，AGENTS.md 最佳实践：结构、范围与真实示例](https://thepromptshelf.dev/blog/agents-md-best-practices/) —— 能经受审查的章节排序
- [Anthropic，Claude Code 子智能体与会话存储](https://docs.anthropic.com/en/docs/agents-and-tools/claude-code/sub-agents)
- 第 14 阶段 · 31 —— 这个最小工作台所吸收的失败模式
- 第 14 阶段 · 34 —— 本课所预告的持久化状态模式（schema）
