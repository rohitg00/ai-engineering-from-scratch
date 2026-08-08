# Agent 初始化脚本

> 每个冷启动的会话都要付出代价。Agent 读取相同的文件，重试相同的探测，重新发现相同的路径。初始化脚本一次性付出代价，并将答案写入状态。

**类型：** 构建
**语言：** Python（标准库）
**前置条件：** 第 14 阶段 · 32（最小工作台），第 14 阶段 · 34（仓库记忆）
**时间：** ~45 分钟

## 学习目标

- 识别 agent 永远不应每会话重复的工作。
- 构建一个确定性的初始化脚本，探测运行时、依赖项和仓库健康度。
- 持久化探测结果，使 agent 在启动时读取它而不是重新运行检查。
- 失败时大声、快速，并且只有一个地方可查看当初始化失败时。

## 问题

打开一个会话。Agent 猜测 Python 版本。猜测测试命令。列出仓库根目录五次以找到入口点。尝试导入未安装的包。询问用户配置文件在哪里。等到它做出真正的编辑时，一万个 token 已经花在了本应是一个单一脚本的设置工作上。

修复方法是一个初始化脚本，在 agent 做任何其他事情之前运行，并写入 agent 在启动时读取的 `init_report.json`。

## 概念

```mermaid
flowchart TD
  Start[会话启动] --> Init[init_agent.py]
  Init --> Probes[探测运行时 / 依赖 / 路径 / 环境 / 测试]
  Probes --> Report[init_report.json]
  Report --> Decision{健康？}
  Decision -- 是 --> Agent[Agent 循环]
  Decision -- 否 --> Halt[大声失败，停止，呈现给人类]
```

### 初始化脚本探测什么

| 探测 | 为什么重要 |
|------|-----------|
| 运行时版本 | 错误的 Python 或 Node 版本意味着静默的错误版本 bug |
| 依赖可用性 | 现在捕获缺失的包比以后捕获成本少十倍 |
| 测试命令 | Agent 必须知道如何验证；如果命令缺失，工作台就坏了 |
| 仓库路径 | 硬编码路径会漂移；一次性解析并固定 |
| 环境变量 | 缺失的 `OPENAI_API_KEY` 是失败表面，不是运行时谜团 |
| 状态 + 板新鲜度 | 来自崩溃会话的陈旧状态是一个陷阱 |
| 最后已知良好提交 | 会话结束时交接差异的锚点 |

### 大声失败，快速失败，在一个地方失败

探测失败意味着停止并呈现给人类。没有"agent 会搞定的"。初始化的全部意义是在工作台损坏时拒绝启动。

### 幂等

连续运行两次。第二次运行应该是无操作，除了一个新鲜的时间戳。幂等性让你可以将脚本接入 CI、钩子或预任务斜杠命令。

### 初始化与启动规则

规则（第 14 阶段 · 33）描述必须为真才能行动。初始化是建立这些规则可以被检查的脚本。没有初始化的规则变成"小心"。没有规则的初始化变成精致的失败。

## 构建

`code/main.py` 实现 `init_agent.py`：

- 五个探测：Python 版本、通过 `importlib.util.find_spec` 列出依赖项、测试命令可解析性、必需环境变量、状态文件新鲜度。
- 每个探测返回 `(name, status, detail)`。
- 脚本写入包含完整探测集的 `init_report.json`，如果任何 block 严重度探测失败则非零退出。

运行：

```
python3 code/main.py
```

脚本打印探测表，写入 `init_report.json`，在快乐路径上零退出或在失败探测列表上非零退出。

## 野外生产模式

三种模式将有用的初始化脚本与仪式分开。

**最后已知良好提交锚定。** 针对上次成功合并时写入的 `LKG` 文件探测当前提交。如果差异超过预算（默认 50 个文件），拒绝启动并要求人类批准新基线。这就是 Cloudflare 的 AI 代码审查用于范围审查者 agent 的方法：每个审查会话都针对相同的最后已知良好锚定，永远不会跨会话复合漂移。

**带 TTL 的锁文件。** 在第一次成功探测通过后写入 `prereqs.lock`。后续运行信任锁 N 小时（默认 24 小时）并跳过昂贵的探测。初始化脚本首先读取锁；如果它是新鲜的且依赖清单哈希匹配，则短路。这与 Docker 用于层缓存的相同模式：幂等探测 + 内容哈希 = 跳过。

**热路径中无网络、无 LLM、无意外。** 初始化探测是确定性管道。调用 LLM 分类失败或命中外部服务检查许可证的探测不是探测；它是工作流。如果探测在干运行中花费超过三秒，将其视为工作台异味，要么将其移出初始化，要么缓存其结果。

## 使用

在生产中：

- **Claude Code 钩子。** `pre-task` 钩子调用初始化脚本，如果失败则拒绝启动 agent。
- **GitHub Actions。** `setup-agent` 作业运行初始化脚本；agent 作业依赖于它。
- **Docker 入口点。** Agent 容器在 exec agent 运行时之前运行初始化脚本；失败时日志呈现。

初始化脚本是可移植的，因为它不调用特定框架。Bash、Make 或任务文件都可以包装它。

## 交付

`outputs/skill-init-script.md` 访谈项目，将其设置工作分类为探测，并发出项目特定的 `init_agent.py` 加在任何 agent 步骤之前运行它的 CI 工作流。

## 练习

1. 添加一个探测，将当前提交与最后已知良好提交进行差异比较，如果超过 50 个文件更改则拒绝启动。
2. 将脚本接入写入 `prereqs.lock` 文件，如果锁超过七天则拒绝启动。
3. 添加 `--fix` 标志，自动安装缺失的开发依赖项，但未经批准绝不修改运行时依赖项。
4. 将探测从硬编码函数移动到 YAML 注册表。为权衡辩护。
5. 为每个探测添加时间预算。运行超过三秒的探测是工作台异味。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------|---------|
| Probe | "检查" | 返回 `(name, status, detail)` 的确定性函数 |
| Init report | "设置输出" | 写在状态旁边的 JSON，包含探测结果 |
| Idempotent | "安全重新运行" | 连续两次运行产生相同的报告，仅时间戳不同 |
| Fail loud | "不要吞掉" | 停止并呈现给人类；无静默回退 |
| Setup tax | "引导成本" | Agent 每会话花在重新发现显而易见的事情上的 token |

## 延伸阅读

- [Anthropic, 长程 agent 的有效工具](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [GitHub Actions, 复合操作用于设置](https://docs.github.com/en/actions/sharing-automations/creating-actions/creating-a-composite-action)
- [microservices.io, GenAI 开发平台：护栏](https://microservices.io/post/architecture/2026/03/09/genai-development-platform-part-1-development-guardrails.html) —— 预提交 + CI 检查作为初始化
- [Augment Code, 如何构建你的 AGENTS.md (2026)](https://www.augmentcode.com/guides/how-to-build-agents-md) —— 初始化期望
- [Codex Blog, Codex CLI 上下文压缩](https://codex.danielvaughan.com/2026/03/31/codex-cli-context-compaction-architecture/) —— 会话启动作为压缩感知初始化
- 第 14 阶段 · 33 —— 此脚本启用的规则集
- 第 14 阶段 · 34 —— 此脚本播种的状态文件
- 第 14 阶段 · 38 —— 初始化脚本供给的验证门控
- 第 14 阶段 · 40 —— 消费初始化报告最后已知良好的交接