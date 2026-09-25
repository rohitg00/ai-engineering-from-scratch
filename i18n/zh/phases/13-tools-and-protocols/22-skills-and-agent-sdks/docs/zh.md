# Agent Skills：可移植契约与运行时边界

> 技能不是一个名字更好记的长提示词。它是一个可发现的指令、资源与可执行辅助程序包，通过运行时契约进入 agent 的上下文。

**Type:** Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 13 · 01（The Tool Interface）、Phase 13 · 05（Tool Schema Design）
**Time:** 约 90 分钟

## 学习目标

- 定义 agent 技能，不将其与提示词、仓库指令、工具、hook、子代理或插件混淆。
- 阅读可移植的 `SKILL.md` 契约，并将其与运行时特有的扩展区分开。
- 将发现、选择、激活、资源加载、工具使用和验证解释为彼此独立的生命周期阶段。
- 在运行时将技能包放入 agent 目录之前对其进行校验。
- 针对具体任务在技能、MCP 工具、hook、子代理或普通代码之间做出选择。

## 十分钟内的首次成功

先做这一步，再看后面的长篇解释。你将创建一个小技能，把完整的 reviewer 包安装到真实的 agent 宿主中，调用它，验证结果，然后卸载它。这通过可观察的结果证明了整个生命周期。

### 真实宿主实验的前置检查

真实宿主检查点需要 Node.js、`npx`、Python 3、一个选定支持技能的宿主，以及你在安装器中选择的 project 或 user 作用域的写权限。先验证本地命令：

```bash
node --version
npx --version
python3 --version
```

在安装之前决定使用哪个宿主和作用域。如果任何条件不可用，请在网站上阅读本课，或继续做下面的手动包练习。该后备路径能教会你契约，但无法证明宿主发现、调用、捆绑脚本执行或卸载行为。把这些观察标记为待完成。

### 1. 从一个空的工作目录开始

在你存放学习工作的任意父目录下运行以下命令：

```bash
mkdir -p agent-skills-first-run
cd agent-skills-first-run
TARGET_ROOT="$(pwd -P)"
printf 'TARGET_ROOT=%s\n' "$TARGET_ROOT"
ls -A
```

最后一条命令不应打印任何内容。如果它打印了文件，请选择另一个空目录，以便评审有清晰的边界。

为你的第一个技能创建目录：

```bash
mkdir -p my-first-skill
```

创建 `my-first-skill/SKILL.md`，内容如下：

```markdown
---
name: my-first-skill
description: Turn rough meeting notes into a compact decision record when the user asks to capture a technical decision.
---

# Decision record

Extract the decision, context, alternatives, owner, and next review date.
If the notes do not contain a decision, ask one clarifying question instead
of inventing one.
```

确认你已在预期的目录中创建了该文件：

```bash
test -f my-first-skill/SKILL.md
```

无输出且退出码为 0 表示文件存在。

### 2. 安装完整的 reviewer 包

停留在 `agent-skills-first-run` 目录中并运行：

```bash
npx skills add rohitg00/ai-engineering-from-scratch --skill skill-contract-reviewer --full-depth
```

选择你正在使用的 agent 宿主和作用域。安装器应列出 `skill-contract-reviewer` 及其写入的目标位置。必须加上 `--full-depth`，因为本课的技能是一个包含引用、脚本和资产的嵌套包。

将 `SKILL_ROOT` 设置为安装器报告的绝对目录。它必须是包含已安装 `SKILL.md` 的目录，而不是课程源码目录，也不是当前工作区：

```bash
# Replace the placeholder with the destination printed by the installer.
SKILL_ROOT="$(cd "/absolute/path/to/skill-contract-reviewer" && pwd -P)"
test -f "$SKILL_ROOT/SKILL.md"
printf 'SKILL_ROOT=%s\n' "$SKILL_ROOT"
```

如果 agent 会话早已打开，请启动新会话，或使用该宿主的技能重扫描命令。不要假设所有宿主都会热重载其目录。

### 3. 显式调用它

在已安装的 agent 中，以 `agent-skills-first-run` 为工作目录，使用该宿主支持的语法：

| 宿主 | 显式调用 |
|---|---|
| Codex | `skill-contract-reviewer`，或从 `/skills` 中选择它，然后提供评审请求 |
| Claude Code | `/skill-contract-reviewer` 后接评审请求 |
| 可移植后备方式 | `Use skill-contract-reviewer to review the target package.` |

在请求中使用为 `SKILL_ROOT` 和 `TARGET_ROOT` 打印出的绝对值。要求宿主在执行前展开它们，并展示解析后的确切命令，而不是依赖进程工作目录的命令：

```text
Use skill-contract-reviewer to review <TARGET_ROOT>/my-first-skill. The installed bundle root is <SKILL_ROOT>. Run python3 <SKILL_ROOT>/scripts/check_skill.py <TARGET_ROOT>/my-first-skill. Before running it, show the fully resolved argv. Return the validation report, selected primitives, and one sentence for each selection. Include the resolved script path, resolved target path, cwd, argv, and exit code as execution evidence.
```

解析后的命令应呈现如下形态，且不残留任何占位符：

```bash
python3 "/absolute/install/path/skill-contract-reviewer/scripts/check_skill.py" \
  "/absolute/workspace/path/agent-skills-first-run/my-first-skill"
```

成功的结果须同时具备以下三个性质：

1. 宿主能按名称找到 `skill-contract-reviewer`。
2. 评审者读取包契约并运行其捆绑的校验器。
3. 响应包含一份校验报告，对样例没有结构错误，并给出有依据的原语选择。

执行证据还必须给出脚本路径、目标路径、cwd、确切的参数向量和退出码。一份流畅但没有这些字段的报告，无法证明已安装的配套脚本真的运行过。

如果宿主报告技能不可用，请核对安装目标位置，重扫描或重启一次，然后重试显式请求。不要改写技能描述来掩盖安装失败。

### 4. 探测隐式选择

开启一个全新的 agent 回合，在不点名技能的情况下输入相同任务：

```text
Review <TARGET_ROOT>/my-first-skill as a reusable agent package and tell me whether its package contract is valid.
```

如果宿主暴露被选中的技能，记录它是否选择了 `skill-contract-reviewer`。如果宿主不暴露路由信息，则将隐式选择标记为未验证。显式调用是可移植的后备方式。

### 5. 清理

只移除已安装的 reviewer 包：

```bash
npx skills remove skill-contract-reviewer
```

选择与安装时相同的宿主和作用域。在重扫描或新会话之后，对 `skill-contract-reviewer` 的显式请求应报告其不可用。保留 `my-first-skill` 以便后续课程使用，或在完成本学习路线后删除实验目录。

## 问题所在

假设你的团队有一套可靠的发布流程。它会查找已合并的变更、检查迁移说明、更新变更日志、运行打包命令，并生成一份评审清单。

把这套流程塞进一个提示词里，粘贴很方便，却难以运营。这个提示词没有稳定标识、没有发现规则、没有资源边界、没有可测试的包形态，也无法回答这些基本问题：谁可以调用它？模型何时应选择它？它能运行哪些脚本？哪些文件是可信的？上下文被压缩时什么会留存？

相反的错误是把每段可复用指令都当成技能。仓库约定、确定性自动化、外部工具、事件 hook 和委派代理解决的是不同的问题。把它们全部塞进 `SKILL.md` 会产出一个看似可移植、实则依赖某一宿主未公开行为的目录。

第一项工程任务是分类。在决定如何打包之前，先决定这个工件是什么。

## 概念

### 技能编码程序性知识

agent 技能是一个目录，其入口是 `SKILL.md`。入口文件包含 YAML frontmatter 及其后的 Markdown 指令。目录中还可以包含引用、脚本和资产。

```figure
skill-package-anatomy
```

部署单元是目录本身，而不只是那个 Markdown 文件。一份缺少引用的、被复制出来的 `SKILL.md` 是残缺的包，即使其 frontmatter 能被解析。

### 相邻的抽象

| 工件 | 主要职责 | 何时加载或运行 | 不应冒充的角色 |
|---|---|---|---|
| 提示词 | 塑造一次模型交互 | 由应用或用户引入 | 带资源的版本化包 |
| 仓库指令 | 说明一个代码库的长期规则 | 编码运行时进入该作用域 | 可复用的任务工作流 |
| Agent 技能 | 提供可复用的程序性知识 | 显式或隐式激活 | 硬性授权边界 |
| MCP 工具 | 暴露带类型的远程能力 | 模型或应用调用它 | 详细的操作规程 |
| Hook | 在事件上运行确定性逻辑 | 声明的事件发生 | 概率性的模型路由 |
| 子代理 | 以独立上下文和状态委派工作 | 编排器创建或调用它 | 静态指令包 |
| 插件 | 分发更大的运行时扩展 | 宿主安装或启用它 | 可移植技能契约本身 |
| 已学习技能库 | 存储通过经验发现的行为 | 策略检索先前的程序或轨迹 | 基于标准的 `SKILL.md` 包 |

一个发布技能可以告诉 agent 如何审查一次发布。一个 MCP 服务器可以暴露发布注册表。一个 hook 可以禁止直接推送。一个子代理可以独立审计候选发布。这些组件之所以能组合，是因为它们承担着不同的职责。

### “技能”一词指向两种不同的概念

研究系统有时会把学习到的程序、成功轨迹或环境特定的策略片段称为技能。agent 可以在探索过程中创建这些工件、按任务相似性检索、执行它们，并根据反馈修订这个库。Phase 14 · 10 构建的就是这种终身学习库。

本小型课程单元中的 Agent Skill 则不同。它是一个经人工编写的包，具有声明的文件系统契约、目录元数据、渐进披露、运行时中介的调用，以及由宿主控制的工具。它可以由 agent 生成或改进，但学习并非该格式所必需。

| 维度 | Agent Skill 包 | 已学习技能库 |
|---|---|---|
| 基本单元 | `SKILL.md` 目录 | 程序、策略、轨迹或记忆记录 |
| 创建 | 编写、生成或人工策划 | 通常从环境经验中发现 |
| 选择 | 目录描述加运行时策略 | 基于任务状态的检索或策略 |
| 执行 | 模型遵循指令并调用宿主工具 | 环境运行存储的行为或代码工件 |
| 可移植性 | 包契约可跨兼容宿主迁移 | 常与单一环境和动作空间绑定 |
| 评估 | 路由、工件、安全与宿主兼容性 | 奖励、成功率、迁移与库增长 |

两种概念都打包了可复用的能力。它们不应仅因同名就在实现主张上混为一谈。

### 可移植核心

Agent Skills 规范要求两个 frontmatter 字段：

```yaml
---
name: release-readiness
description: Inspect a release candidate when the user asks whether a version is ready to publish.
---
```

`name` 是稳定标识符。它必须满足规范的命名规则，并与父目录名一致。`description` 既是文档也是路由元数据。它应说明该技能做什么、何时适用。

可移植的可选字段为：

| 字段 | 用途 | 可移植性说明 |
|---|---|---|
| `license` | 声明包的使用条款 | 核心规范 |
| `compatibility` | 声明环境要求 | 核心规范 |
| `metadata` | 承载字符串值的扩展数据 | 核心规范 |
| `allowed-tools` | 建议预先批准的工具 | 实验性；宿主支持程度不一 |

Markdown 正文承载操作性指令。它应定义工作流、决策点、失败行为，以及指向支持资源的直接路径。

```markdown
# Release readiness

Use this workflow for a release candidate, not for ordinary development builds.

1. Read `references/release-policy.md`.
2. Run `python3 scripts/inspect_release.py --format json`.
3. Stop if the report contains a blocking failure.
4. Produce the checklist from `assets/release-checklist.md`.
5. Ask for approval before any publish or tag action.
```

### 运行时扩展是第二层

一些宿主接受额外的 frontmatter 或伴随配置。这些字段可能有用，但并不自动可移植。

| 行为 | 宿主扩展示例 | 属于可移植核心？ |
|---|---|:---:|
| 对模型路由隐藏技能，但保留用户的直接调用 | `disable-model-invocation` | 否 |
| 对用户命令菜单隐藏技能，但允许模型路由 | `user-invocable` | 否 |
| 在命令菜单中显示参数帮助 | `argument-hint` | 否 |
| 在委派上下文中运行技能 | `context`、`agent` | 否 |
| 固定模型或推理设置 | `model`、`effort` | 否 |
| 注册生命周期自动化 | `hooks` | 否 |
| 在 Codex 中禁用隐式调用 | `agents/openai.yaml` 策略 | 否 |

把每个扩展都当作适配器。核心工作流必须在没有它的情况下仍然有效，记录后备方式，并在消费它的宿主上进行测试。运行时可能忽略未知字段、拒绝它，或在不实现对应行为的情况下保留它。

### Frontmatter 是可执行的元数据

元数据会在技能正文被读取之前改变系统行为。

- 格式错误的 `name` 会导致发现失败。
- 模糊的 `description` 会把错误的请求路由过来。
- 仅限人工的标记会把技能从模型目录中移除。
- 工具许可会改变宿主是否请求权限。
- 上下文设置会把执行移入单独的 agent 会话。

像对待配置代码一样审查 frontmatter。对它进行校验和版本管理，并把其行为纳入评估。

### 技能生命周期

```figure
skill-runtime-lifecycle
```

每个箭头都是一个边界，各有自己的失败模式。

1. **发现**在配置的位置中查找可能的包。
2. **校验**在目录发布前拒绝格式错误或不安全的包。
3. **编目**暴露精简的 `name` 和 `description`，而非完整包。
4. **选择**判断该技能是否相关。
5. **激活**将正文加载到模型可见的上下文中。
6. **披露**只在某个分支需要时才读取引用或资产。
7. **执行**在宿主的权限与隔离规则下使用宿主工具。
8. **验证**独立于模型的声明检查产出的工件。

把这些阶段混为一谈会导致错误的心智模型。被发现不等于已激活。已激活不等于被授权做它描述的一切。一次被许可的工具调用也不是结果正确的证明。

### 技能与工具是正交的

MCP 回答的是：“这个应用可以调用哪些能力，它们的 schema 是什么？”技能回答的是：“agent 应该如何处理这类任务？”

```figure
skill-tool-orthogonality
```

技能可以点名某个工具，但真正的能力注册表归宿主管辖。如果工具不存在，技能应声明后备方案或明确失败。它绝不能暗示“点名一个能力就等于创造了它”。

### 技能与仓库指令作用域不同

仓库指令描述你当前所处的环境：命令、约定、生成文件和边界。技能为可能出现在多个仓库中的任务提供可复用的流程。

当两者同时适用时，当前的用户请求和仓库规则约束技能。一个通用的重构技能不得覆盖禁止编辑生成文件的仓库规则。

### 技能之间不互相导入

一个技能可以指示 agent 调用另一个技能，但这不是语言层面的导入。第二个技能仍要经过运行时的发现、资格判定、激活、权限和上下文处理。

把跨技能依赖写成可观察的工作流边：

```markdown
After producing the candidate changelog, invoke the `release-risk-review` skill.
Pass the candidate path and require a blocking or non-blocking verdict.
If that skill is unavailable, stop and report the missing dependency.
```

这使得依赖可测试，并给宿主一个执行策略的机会。

## 动手构建

`code/main.py` 实现了一个小型的面向规范的校验器和一个工件选择器。它仅使用标准库，因此每条规则都清晰可见。

校验器暴露：

- `parse_frontmatter(text)`，用于把元数据与正文分离。
- `validate_skill_text(text, directory_name, allowed_runtime_extensions=())`，用于检查必填字段、命名、未知扩展、正文存在性和可移植性限制。
- `ValidationIssue` 和 `SkillReport`，用于返回结构化证据而非一个不透明的布尔值。
- `FrontmatterSyntaxError`，用于无法安全解析的输入。

选择器暴露 `TaskShape` 和 `select_primitives(task)`。它把任务的需求映射到普通代码、仓库指令、技能、hook、子代理或 MCP 工具。

运行实验：

```bash
cd "$(git rev-parse --show-toplevel)"
cd phases/13-tools-and-protocols/22-skills-and-agent-sdks
python3 code/main.py
python3 -m unittest discover -s code/tests -v
```

这个命令块需要本地克隆，并且必须从该克隆内的任意位置启动，以便 `git rev-parse --show-toplevel` 能解析仓库根目录。

演示为以下内容打印 JSON：一个有效的可移植技能、一个宿主扩展技能、一个无效包，以及若干任务形态的决策。请检查问题码。包校验器应解释如何修复工件，而不是替作者猜测。

### 校验顺序很重要

先校验开销小的结构事实，再校验更深的内容规则：

```figure
skill-validation-order
```

这个顺序可以防止次要错误掩盖第一个被破坏的不变量。

## 如何使用

在编写技能之前，填写这张决策卡：

| 问题 | 如果是 | 可能的原语 |
|---|---|---|
| 这是否需要在多个步骤间复用的模型判断？ | 流程稳定但决策多变 | 技能 |
| 这是否必须在每次事件触发时发生？ | 错过一次执行不可接受 | Hook 或应用代码 |
| 模型是否需要带类型化输入的外部能力？ | 操作发生在模型上下文之外 | 工具或 MCP 服务器 |
| 工作是否需要隔离的上下文、状态或所有权？ | 由独立的工作者返回有界结果 | 子代理 |
| 这份指引是否只针对一个仓库？ | 它描述本地命令和约束 | 仓库指令 |
| 一次交互是否足够？ | 不需要包生命周期 | 提示词 |

许多生产工作流会用到不止一行。这张决策卡防止用一个工件假装具备所有属性。

## 如何交付

本课产出位于 `outputs/` 下的 `skill-contract-reviewer` 包。它包含：

- 一个可移植的 `SKILL.md`，用于评审拟议的技能包；
- 关于可移植契约和原语选择的参考清单；
- 一个确定性校验脚本；
- 覆盖提示词、技能、工具、hook、普通代码和子代理的任务形态夹具。

安装完整包，而不只是入口文件：

```bash
cd "$(git rev-parse --show-toplevel)"
python3 scripts/install_skills.py /tmp/aiefs-skills --phase 13 --type skill
```

课程安装器会报告每个被复制的 Phase 13 技能，并写入 `/tmp/aiefs-skills/manifest.json`。这个干净的目标位置检查包形态；上文的首胜循环则在真实宿主中检查发现与调用。

接下来的课程深化生命周期的每个阶段。Lesson 24 构建发现与渐进披露。Lesson 25 构建调用策略与路由。Lesson 26 把权限与沙箱区分开。Lesson 27 把整个包变成可评估的发布工件。

## 练习

1. 使用 `TaskShape` 对你所在团队的五个工作流进行分类。为每一个选择多个原语的情形给出理由。
2. 添加边界测试，证明 500 字符的 `compatibility` 值通过，而 501 字符的值作为规范错误失败。
3. 向允许清单添加一个运行时扩展。编写测试证明同一个文件仍能与仅含可移植核心的技能区分开。
4. 把一个 400 行的提示词拆分为 `SKILL.md`、一个引用文件、一个脚本契约和一个输出模板。让每个文件只负责一类信息。
5. 为引用了不可用 MCP 工具的技能设计失败响应。不要用权限更宽的工具静默替代。
6. 审查一个现有技能，把每句话标记为路由、流程、策略、引用指针或输出契约。移动所有不属于原处的内容。

## 关键术语

| 术语 | 人们常说 | 实际含义 |
|---|---|---|
| Agent skill | “一个保存的提示词” | 一个可发现的目录，包含程序性指令和可选资源 |
| 可移植核心 | “所有运行时共享的字段” | 由 Agent Skills 规范定义的契约 |
| 运行时扩展 | “额外的 frontmatter” | 宿主特定配置，其行为需要兼容的适配器 |
| 激活 | “技能运行了” | 技能正文进入模型可见的上下文；执行可能在此之后 |
| 技能依赖 | “导入另一个技能” | 一条经运行时中介的调用边，带有可用性和策略检查 |
| 工具契约 | “一个函数 schema” | 一个能力的输入、输出、权限、副作用、错误和证据 |

## 延伸阅读

- [Agent Skills specification](https://agentskills.io/specification)：可移植目录与 frontmatter 契约。
- [Agent Skills best practices](https://agentskills.io/skill-creation/best-practices)：作用域、指令与资源组织。
- [OpenAI: Build skills](https://learn.chatgpt.com/docs/build-skills)：Codex 当前的发现与调用行为。
- [Claude Code skills](https://code.claude.com/docs/en/skills)：某一运行时的调用、参数、工具与委派上下文扩展。