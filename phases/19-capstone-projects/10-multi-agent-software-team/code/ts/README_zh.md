# 多智能体软件团队 (TypeScript 骨架)

多文件 TypeScript 骨架，用于多智能体软件团队顶点项目。规划者、编码者和审阅者智能体共享一个工作区，并通过协调器轮换。一个 worktree 存根通过 execFile 启动子进程，带有拒绝列表和 shell 元字符拒绝。

## 目录结构

- `src/index.ts` — 演示运行器。
- `src/agent.ts` — 基础 `Agent` 类及 `PlannerAgent`、`CoderAgent`、`ReviewerAgent`。
- `src/coordinator.ts` — 轮询循环和轮转跟踪。
- `src/workspace.ts` — 共享内存文件系统和消息日志。
- `src/runtime.ts` — `child_process.execFile` worktree 存根，带拒绝列表。
- `src/types.ts` — 共享类型。
- `tests/*.test.ts` — 通过 `tsx` 的 `node --test` 风格测试。

## 安装

```bash
npm install
```

## 运行

```bash
npm start
```

## 验证

```bash
npm run typecheck
npm test
```

## 规范参考

- 源课程：`phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md`
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) 基于角色的多智能体框架。
