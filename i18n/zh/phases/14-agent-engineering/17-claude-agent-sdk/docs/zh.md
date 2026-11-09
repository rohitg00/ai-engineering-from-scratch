#  套装和会议店

> 您可以进口的带:内置工具,环境隔离的子管,子,W3C痕迹传播,会议持久性. 克劳德代理SDK是参考例子 克劳德代码带的库形式 克劳德管理代理是长期的异步工作的托管替代品.

**Type:** Learn + Build
**Languages:** Python (stdlib), TypeScript
**Prerequisites:** Phase 14 · 01 (Agent Loop), Phase 14 · 10 (Skill Libraries)
**Time:** ~75 minutes

## 学习目标

- 解释Anthropic Client SDK (原料API) 和Claude Agent SDK (形) 的区别.
- 描述子体并行和背景隔离以及何时达到它们.
- 命名Python SDK的会议存储表面 (`append`现在`load`现在`list_sessions`现在`delete`现在`list_subkeys`) 和 `--session-mirror`现在,我们要去.
- 实现一个有内置工具的 stdlib 带,一个孤立的背景,生命周期子,和一个会议商店的子弹.

## 问题

制作代理需要工具执行,MCP服务器,生命周期,子弹生殖,会议持续性,痕迹传播.Claude Agent SDK将这种形状作为库相同的使用工具Claude Code,暴露于定制代理.

## 概念

### 客户端 SDK VS 代理 SDK

- **Client SDK (`anthropic`).**你拥有循环,工具,状态.
- **Agent SDK (`claude-agent-sdk`).**集成的工具执行,MCP连接,子,子弹产,会议存储.

### 嵌入式工具

 SDK 运输出10多种工具:文件阅读/写, shell, grep, glob, web fetch等. 通过标准工具方案接口进行自定义工具注册.

### 子

两种目的由人类记录:

1. **Parallelization.**同时执行独立工作. "找到每个20个模块的测试文件"是20个并行的子组任务.
2. **Context isolation.**们使用自己的背景窗口;只有结果返回管家.管家的预算被保存.

最近添加的Python SDK: `list_subagents()`现在`get_subagent_messages()`阅读副本文稿.

### 会议商店

与TypeScript的协议平衡:

- `append(session_id, message)`加一个转.
- `load(session_id)`恢复对话.
- `list_sessions()`列出.
- `delete(session_id)`                     
- `list_subkeys(session_id)`列出子键.

`--session-mirror`通过传输,将转录映射到外部文件中,用于调试.

### 子

您可以注册的生命周期:

- `PreToolUse`现在`PostToolUse` 门户或审计工具的通话.
- `SessionStart`现在`SessionEnd`建立和拆除.
- `UserPromptSubmit`在模型看到之前,在用户输入上采取行动.
- `PreCompact`在文本紧缩之前运行.
- `Stop`在代理出口时进行清理.
- `Notification`侧通道警报.

子是如何支持工作流程 (阶段14课程参考) 和类似的系统增加跨界行为.

###  W3C 追踪环境

通过W3C跟踪语境标题,在调用器上活动的OTel跨度通过CLI子进程传播到后端.整个多进程跟踪显示为一个跟踪.

### 克劳德管理了代理人

托管的替代方案 (beta 头条`managed-agents-2026-04-01`长期的异步工作,内置快速缓存,内置紧缩,管理基础设施的贸易控制.

### 在这个模式出现错误的地方

- **Subagent over-spawn.**让100个小任务完成100个小任务. 总体占主导地位.
- **Hook creep.**每个团队都会增加子,启动时间气球,每季度检查子.
- **Session bloat.**会议积累,规模增加.`list_sessions`退出政策

```figure
ae-subagent-isolation
```

## 建立它

`code/main.py`在 stdlib 中实现SDK形状:

- `Tool`现在`ToolRegistry`具有内置的`read_file`现在`write_file`现在`list_dir`现在,我们要去.
- `Subagent`私人环境,孤立运行,结果返回.
- `SessionStore`添加,加载,列表,删除,列表_子键.
- `Hooks` `pre_tool_use`现在`post_tool_use`现在`session_start`现在`session_end`现在,我们要去.
- 演示:主代理并行生成3个子组 (每个单独),总结结果,持续会议.

运行它:

```
python3 code/main.py
npx tsx code/main.ts
```

痕迹显示了亚级文本隔离 (乐队主持人文本尺寸保持限制),执行和会议持久性.

## 用它

- **Claude Agent SDK**对于需要Cloed Code的产品来说,
- **Claude Managed Agents**对于长期的主机无同步工作.
- **OpenAI Agents SDK**(第16课) 对OpenAI首批对手.
- **LangGraph + custom tools**如果您想要图形状态机,

## 运送它

`outputs/skill-claude-agent-scaffold.md`提供了Claude Agent SDK应用程序,包括子弹,子,会议存储,MCP服务器附件,以及W3C的痕迹传播.

## 运动

1. 加入一个分组分组分20项任务为5个平行分组分组的分组分组分组. 测量管弦器背景大小与每项任务的一个.
2. 实施一个`PreToolUse`住这些利率限制`write_file`追踪行为.
3. 电线`list_subkeys`树的树是什么样子?
4. 把玩具带到真实世界里`claude-agent-sdk`工具注册的变化是什么?
5. 你从自主托管转到管理的时间?

## 关键词

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Agent SDK | "Claude Code as a library" | Harness shape: tools, MCP, hooks, subagents, session store |
| Subagent | "Child agent" | Separate context, own budget; results bubble up |
| Session store | "Conversation DB" | Persist, load, list, delete turns with subagent cascade |
| Hook | "Lifecycle callback" | Pre/post tool, session, prompt submit, compact, stop |
| W3C trace context | "Cross-process trace" | Parent span propagates into CLI subprocess |
| Managed Agents | "Hosted harness" | Anthropic-hosted long-running async work |
| `--session-mirror` | "Transcript mirror" | Writes session turns to an external file as they stream |
| MCP server | "Tool surface" | External tool/resource source attached to the agent |

## 进一步阅读

- [Claude Agent SDK overview](https://platform.claude.com/docs/en/agent-sdk/overview)克劳德代码的图书馆形式
- [Anthropic, Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)生产模式
- [Claude Managed Agents overview](https://platform.claude.com/docs/en/managed-agents/overview) 接待的替代方案
- [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/)对应
