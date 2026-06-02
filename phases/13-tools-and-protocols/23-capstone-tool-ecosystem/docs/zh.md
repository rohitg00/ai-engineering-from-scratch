# 毕业项目 —— 搭一套完整的工具生态（Capstone — Build a Complete Tool Ecosystem）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> Phase 13 把每一块零件都讲过了。这个毕业项目把它们组装成一套贴近生产形态的系统：一个同时提供 tools + resources + prompts + tasks + UI 的 MCP server、边缘上的 OAuth 2.1、一道做 RBAC 的 gateway、一个连多 server 的 client、一次 A2A 子 agent 调用、把 trace 打到 collector 的 OTel、CI 里跑的 tool-poisoning 检测，以及一份 AGENTS.md + SKILL.md 套件。做完之后你能为每一个架构选择给出辩护。

**Type:** Build
**Languages:** Python（stdlib，端到端生态 harness）
**Prerequisites:** Phase 13 · 01 到 21
**Time:** ~120 分钟

## 学习目标（Learning Objectives）

- 组合出一个 MCP server，对外暴露 tools、resources、prompts，以及一个带 `ui://` app 的 task。
- 在 server 前面架一道 OAuth 2.1 gateway，强制执行 RBAC 和 pinned hash。
- 写一个多 server 的 client，端到端用 OTel GenAI 属性打 trace。
- 把一部分负载委派给一个 A2A 子 agent；验证 opacity（不透明性）被保留。
- 用 AGENTS.md + SKILL.md 把整套 stack 打包，让其他 agent 也能驱动它。

## 问题（The Problem）

把这套「研究 + 报告」系统交付出去：

- 用户问：「summarize the three most-cited 2026 arXiv papers on agent protocols.」
- 系统：通过 MCP 搜 arXiv；通过 A2A 把论文摘要任务委派给一个专门的 writer agent；汇总结果；把交互式报告渲染成一份 MCP Apps 的 `ui://` resource；每一步都打到 OTel。

Phase 13 里所有的 primitive 都会出场。这不是玩具——2026 年 Anthropic（Claude Research 产品）、OpenAI（带 Apps SDK 的 GPTs）以及第三方厂商上线的生产级研究助手系统，都是这个形态。

## 概念（The Concept）

### 架构（Architecture）

```
[user] -> [client] -> [gateway (OAuth 2.1 + RBAC)] -> [research MCP server]
                                                      |
                                                      +- MCP tool: arxiv_search (pure)
                                                      +- MCP resource: notes://recent
                                                      +- MCP prompt: /research_topic
                                                      +- MCP task: generate_report (long)
                                                      +- MCP Apps UI: ui://report/current
                                                      +- A2A call: writer-agent (tasks/send)
                                                      |
                                                      +- OTel GenAI spans
```

### Trace 层级（Trace hierarchy）

```
agent.invoke_agent
 ├── llm.chat (kick off)
 ├── mcp.call -> tools/call arxiv_search
 ├── mcp.call -> resources/read notes://recent
 ├── mcp.call -> prompts/get research_topic
 ├── a2a.tasks/send -> writer-agent
 │    └── task transitions (opaque internals)
 ├── mcp.call -> tools/call generate_report (task-augmented)
 │    └── tasks/status polling
 │    └── tasks/result (completed, returns ui:// resource)
 └── llm.chat (final synthesis)
```

一个 trace id。每条 span 都带上正确的 `gen_ai.*` 属性。

### 安全姿态（Security posture）

- OAuth 2.1 + PKCE，用 resource indicator 把 audience 锁定到 gateway。
- 上游凭据由 gateway 持有；用户从来看不到。
- RBAC：`alice` 拥有 `research:read`、`research:write`，可以调所有 tool。`bob` 只有 `research:read`，不能调 `generate_report`。
- Pinned 描述清单：tool hash 一变就把对应 server 摘掉。
- Rule of Two 审计：没有任何 tool 同时具备「不可信输入 + 敏感数据 + 有后果的动作」三件事。

### 渲染（Rendering）

最终的 `generate_report` task 返回一组 content block，加上一个 `ui://report/current` resource。Client 的 host（Claude Desktop 等）在沙箱 iframe 里渲染这份交互式 dashboard。Dashboard 里有一份排好序的论文列表、citation 数，以及一个按钮：用户点哪篇论文，就调用 `host.callTool('summarize_paper', {arxiv_id})`。

### 打包（Packaging）

整个系统的交付形态：

```
research-system/
  AGENTS.md                     # project conventions
  skills/
    run-research/
      SKILL.md                  # the top-level workflow
  servers/
    research-mcp/               # the MCP server
      pyproject.toml
      src/
  agents/
    writer/                     # the A2A agent
  gateway/
    config.yaml                 # RBAC + pinned manifest
```

用户用 `docker compose up` 部署。Claude Code、Cursor、Codex、opencode 的用户都可以通过调用 `run-research` skill 来驱动这套系统。

### Phase 13 每节贡献了什么（What each Phase 13 lesson contributed）

| Lesson | 毕业项目里用到的部分 |
|--------|------------------------|
| 01-05 | tool 接口、provider 可移植性、并行调用、schema、lint |
| 06-10 | MCP primitive、server、client、transport、resources + prompts |
| 11-14 | sampling、roots + elicitation、异步 task、`ui://` app |
| 15-17 | tool poisoning、OAuth 2.1、gateway + registry |
| 18 | A2A 子 agent 委派 |
| 19 | OTel GenAI tracing |
| 20 | LLM 层的 routing gateway |
| 21 | SKILL.md + AGENTS.md 打包 |

## 用起来（Use It）

`code/main.py` 把前面几节的模式缝合成一个可运行 demo。全部 stdlib，全部 in-process，方便你从头读到尾。它会跑完「研究 + 报告」场景的完整流程：跟 gateway 握手，模拟 OAuth 2.1，合并 tools/list，把 generate_report 当成 task 执行，调 A2A 给 writer，返回 ui:// resource，发出 OTel span。

重点看这些：

- 每一跳都用同一个 trace id。
- Gateway 策略会拦下第二个用户的写操作。
- Task 生命周期从 working → completed，同时返回文本和 ui:// 内容。
- A2A 调用的内部状态对 orchestrator 是不透明的。
- AGENTS.md 和 SKILL.md 是另一个 agent 复现这套工作流唯一需要的两个文件。

## 上线部署（Ship It）

这一节产出 `outputs/skill-ecosystem-blueprint.md`。给定一个产品需求（研究、摘要、自动化），这个 skill 会产出完整架构：用哪些 MCP primitive、哪些 gateway 控制、哪些 A2A 调用、哪些 telemetry、怎么打包。

## 练习（Exercises）

1. 跑 `code/main.py`。注意那个唯一的 trace id，看 span 是怎么嵌套的。数一数 demo 触及了 Phase 13 里的多少个 primitive。

2. 扩展 demo：加一个第二个后端 MCP server（比如 `bibliography`），确认 gateway 把它的 tool 合并进同一个命名空间。

3. 把假的 A2A writer agent 换成一个真在子进程里跑的 agent。用 Lesson 19 的 harness。

4. 在 routing gateway 里、orchestrator 和 LLM 之间，加一道 PII 脱敏。确认用户 query 里的邮箱被擦掉。

5. 给一个将要维护这套系统的同事写一份 AGENTS.md。读起来要不到五分钟，但要让他在 Cursor 或 Codex 里能直接驱动这个毕业项目。

## 关键术语（Key Terms）

| 术语 | 大家怎么说 | 实际意思 |
|------|----------------|------------------------|
| Capstone | 「Phase-13 集成 demo」 | 用上每一种 primitive 的端到端系统 |
| Research and report | 「那个场景」 | 搜索、摘要、渲染的模式 |
| Ecosystem | 「所有零件凑一起」 | server + client + gateway + 子 agent + telemetry + 打包 |
| Trace hierarchy | 「单一 trace id」 | 每一跳的 span 共享同一个 trace；通过 span id 形成父子关系 |
| Gateway-issued token | 「Transitive auth（传递式鉴权）」 | Client 只看到 gateway 的 token；上游凭据由 gateway 持有 |
| Merged namespace | 「所有 tool 摊在一张扁平表里」 | 在 gateway 处合并多 server，冲突就加前缀 |
| Opacity boundary | 「A2A 调用把内部藏起来」 | 子 agent 的推理过程对 orchestrator 不可见 |
| Three-layer stack | 「AGENTS.md + SKILL.md + MCP」 | 项目上下文 + 工作流 + tool |
| Defense-in-depth | 「多层安全」 | pinned hash、OAuth、RBAC、Rule of Two、审计日志 |
| Spec compliance matrix | 「我们交付的东西对应 spec 的哪些要求」 | 把交付物对照到 2025-11-25 spec 要求的 checklist |

## 延伸阅读（Further Reading）

- [MCP — Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) —— 整合后的参考
- [MCP blog — 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) —— 协议的走向
- [a2a-protocol.org](https://a2a-protocol.org/latest/) —— A2A v1.0 参考
- [OpenTelemetry — GenAI semconv](https://opentelemetry.io/docs/specs/semconv/gen-ai/) —— 标准 tracing 约定
- [Anthropic — Claude Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview) —— 生产 agent runtime 模式
