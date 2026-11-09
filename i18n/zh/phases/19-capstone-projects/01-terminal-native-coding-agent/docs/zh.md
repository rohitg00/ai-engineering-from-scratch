#   终端本土编码代理

> 到2026年,编码器的形状已经确定. 图伊带,一个状态的计划,一个沙盒的工具表面,一个循环,计划,行动,观察,恢复. 克劳德代码,课程3和开码从50英尺处看起来都是一样的. 这块顶石要求你构建一个端到一个端,  CLI,  拉出请求, 你会了解为什么最难的是不是模型调用,而是工具循环,沙盒和50转运费用上限.

**Type:** Capstone
**Languages:** TypeScript / Bun (harness, loop scaffold), Python (eval scripts)
**Prerequisites:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:**子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子,子
**Time:** 35 hours

## 问题

2026年,编码代理成为主导AI应用类别. 克劳德代码 (人类),Cursor 3与组合器2和代理图表 (Cursor),Amp (Sourcegraph),OpenCode (112k星),工厂无人机和谷歌朱尔斯所有船变化相同的架构:终端带,一个许可的工具表面,一个沙盒,和一个计划-行动观察循环围绕边界模型. 直播SWE代理达到79.2%的SWE台 验证了Opus 4.5 ,但工程工艺是宽的. 失败模式的大部分都不是模型错误. 它们是工具循环不稳定性,环境中毒,逃跑的代币成本,

你必须建造一个,在47的环节崩,当Ripgrep返回8MB的匹配,

## 概念

带有四个表面.**Plan**保持一个 TodoWrite 样式状态对象,模型每次转换. **Act**发送工具调用 (阅读,编辑,运行,搜索, Git).**Observe**捕获/stderr/出口代码,缩小,并将总结回放. **Recover**没有打破文本窗口或永远循环处理工具错误. 2026 形状增加了另一个东西: **hooks**现在,我们要去.`PreToolUse`现在`PostToolUse`现在`SessionStart`现在`SessionEnd`现在`UserPromptSubmit`现在`Notification`现在`Stop`其他`PreCompact`可配置的延伸点,操作员注入的政策,远程测量和防护.

沙箱是E2B或戴顿. 每个任务都运行在一个新的 devcontainer, 连接器永远不会触及主机文件系统. 工作树在成功或失败时会被撕毁. 成本控制是通过三个层次执行的:每轮代币上限,每次会议的美元预算,以及硬转限 (通常是50). 观察性层是与GenAI语义公约的OpenTelemetry跨度,

## 建筑

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## 堆

- 带运行时间: Bun 1.2 + Ink 5 (终端反应)
- 模型访问:OpenRouter与Claude Sonnet 4.7,GPT-5.4-Codex,Gemini 3 Pro,Opus 4.5 (用于最困难的任务)
- 工具运输:模式语境协议 StreamableHTTP (MCP 2026修订)
- 沙箱:E2B沙箱 (JS SDK) 或戴tona开发集装箱
- 代码搜索: ripgrep子工艺,17种语言的树守护器 (预编译)
- 隔离:`git worktree add`按任务,成功/失败的清理
- 杆:SWE-bench Pro (验证子集) +终端-Bench 2.0 +您自己的30任务持有
- 可观察性: 开放Telemetry SDK`gen_ai.*`semconv → 自主主办的Langfuse
- 公共关系发布:GitHub应用程序,具有细粒度的代币,范围仅限于目标回复

```figure
ce-agent-loop
```

## 建立它

1. **TUI and command loop.**布一个子项目用墨水.接受.`agent run <repo> "<task>"`打印分类视图:计划表 (上),工具调用流 (中),代币预算 (下). 添加取消在Ctrl-C上开启 `SessionEnd`在出口前.

2. **Plan state.**定义输入的 TodoWrite 方案 (悬而未决 / in_progress /完成的项目与笔记).模型每次重写完整状态作为工具调用. 不要让它逐步变化. 继续计划`.agent/state.json`让车恢复.

3. **Tool surface.**定义六种工具:`read_file`现在`edit_file`其他地方的`ripgrep`现在`tree_sitter_symbols`现在`run_shell`通过时间限制,`git`(status/diff/commit/push). 通过MCP StreamableHTTP将其曝光,使其具有交通不知性.每个工具都会返回缩小输出 (每次通话的4k代币限制).

4. **Sandbox wrapping.**每个任务都会产生一个E2B沙箱.`git worktree add -b agent/$TASK_ID`现在,我们在一个新的分支.所有工具调用都在沙盒内执行. 主机文件系统是不可访问的.

5. **Hooks.**实现2026年所有八种子类型. 连接至少四种用户授权的子: (a) `PreToolUse`破坏性指挥卫队,阻止了`rm -rf`在工作树外,`PostToolUse`标志性会计, (c) `SessionStart`预算初始化,`Stop`写出最后一个痕迹.

6. **Eval loop.**复制一个30个版本的SWE-bench Pro Python子集. 运行你的束对每一个. 通过@1,转换每任务和$-per-task上进行微型Swe-agent (最小基线) 的比较. 写结果到`eval/results.jsonl`现在,我们要去.

7. **Cost control.**硬切割:50轮,200万语境,每任务5美元.`PreCompact`子总结了旧的转变,成为一个前状态块, 在150k的标志, 给新的观测空间,

8. **PR posting.**对于成功,最后一步是`git push`+一个GitHub API调用,将计划和体内的差异总结打开一个 PR.

## 用它

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## 运送它

能得到的技能生活在`outputs/skill-terminal-coding-agent.md`根据备忘录路径和任务描述,它将在沙盒中运行完整的计划-行为-观察循环,并返回一个 PR URL 加上一个追踪捆绑.

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs baseline | Your harness vs mini-swe-agent on 30 matched Python tasks |
| 20 | Architecture clarity | Plan/act/observe separation, hook surface, tool schema — reviewed against Live-SWE-agent layout |
| 20 | Safety | Sandbox escape tests, permission prompts, destructive-command guard passes red-team |
| 20 | Observability | Trace completeness (100% of tool calls spanned), token accounting per turn |
| 15 | Developer UX | Cold-start < 2s, crash recovery resumes plan, Ctrl-C cancels mid-tool cleanly |
| **100** | | |

## 运动

1. 换取支持模型从Claude Sonnet 4.7到vLLM上提供的Qwen3-Coder-30B.比较pass@1和$-per-task.报告开放模型的性能低.

2. 添加一个`reviewer`测量假阳性评价是否降低SWE位通过率低于单代理基线 (提示:通常是的).

3. 压力测试沙盒:写一个试图完成的任务`curl`确认两个被 PreToolUse 锁.记录尝试.

4. 实施`PreCompact`通过较小的模型来总结 (海库4.5). 测量在3x紧缩时损失了多少计划忠诚度.

5. 换MCP流动HTTP输送为工作室. 标记冷启动和每次通话延迟. 选择一个获胜者仅用于本地使用.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Harness | "The agent loop" | The code surrounding the model that dispatches tools, maintains plan state, and enforces budgets |
| Hook | "Agent event listener" | A user-authored script run on one of eight lifecycle events by the harness |
| Worktree | "Git sandbox" | A linked git checkout at a separate path; disposable without touching the main clone |
| TodoWrite | "Plan state" | A typed list of pending/in-progress/done items the model rewrites each turn |
| StreamableHTTP | "MCP transport" | 2026 MCP revision: long-lived HTTP connection with bidirectional streaming; replaces SSE |
| Token ceiling | "Context budget" | Per-turn or per-session cap on input+output tokens; triggers compaction or termination |
| pass@1 | "Single-attempt pass rate" | Fraction of SWE-bench tasks solved on the first run without retry or test-set peeking |

## 进一步阅读

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code)来自Anthropic的参考带
- [Cursor 3 changelog](https://cursor.com/changelog) 代理 标签和作曲器2产品说明
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent)SWE-板的最低基准比较
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) 79.2% SWE  通过 Opus 4.5 验证
- [OpenCode](https://opencode.ai)开放的带,112千颗星星
- [SWE-bench Pro leaderboard](https://www.swebench.com)本标题的评估目标
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/)流式HTTP,功能元数据
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)工具调用和代币使用的跨度方案
