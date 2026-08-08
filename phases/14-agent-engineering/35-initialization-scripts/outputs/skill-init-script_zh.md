---
name: init-script
description: 采访项目并发出确定性的 init_agent.py，带有五个探测加上 CI 工作流，如果任何探测失败则拒绝启动代理。
version: 1.0.0
phase: 14
lesson: 35
tags: [init, probes, ci, workbench, fail-loud]
---

给定仓库、代理产品和其依赖表面，生成项目特定的初始化脚本和 CI 连接。

生成：

1. `tools/init_agent.py`，带有这些探测：runtime version、listed dependencies、test command resolvability、required env vars、state file freshness。
2. 脚本旁边记录的 `init_report.json` 模式。每个探测返回 `(name, status: pass|warn|fail, detail)`。
3. `.github/workflows/agent-init.yml`（或等效）运行脚本并在任何 fail-severity 探测上阻塞代理作业。
4. 代理运行时可以在每次会话开始前调用的 `pre-task` 钩子脚本。
5. `docs/init.md` 文档，列出每个探测、其严重性和如何修复失败。

硬性拒绝：

- 没有超时调用网络的探测。初始化必须快速且离线安全。
- 需要 LLM 调用的探测。初始化是确定性管道。
- 包装器吞没的非零退出代码。Fail loud 是重点。
- 没有幂等性接触状态的探测。两次连续运行必须产生相同的报告，时间戳除外。

拒绝规则：

- 如果项目没有测试命令，拒绝发布脚本。将差距添加到工作台审计。
- 如果 env var 列表包含脚本将打印的秘密，拒绝并强制编校。初始化报告不应携带秘密。
- 如果探测在干运行中花费超过三秒，在发布之前提出计时发现。长探测将初始化变成仪式。

输出结构：

```
<repo>/
├── tools/
│   ├── init_agent.py
│   └── pre_task.sh
├── docs/
│   └── init.md
└── .github/
    └── workflows/
        └── agent-init.yml
```

以"what to read next"结束，指向：

- Lesson 36 用于使用初始化报告的 `repo_paths` 的每任务范围契约。
- Lesson 37 用于消耗解析的测试命令的运行时反馈循环。
- Lesson 38 用于依赖探测通过的验证门。
