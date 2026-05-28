# Multi-agent software team (TypeScript skeleton)

multi-agent software team capstone 用の multi-file TypeScript skeleton です。Planner、coder、reviewer agent が workspace を共有し、coordinator を通じて rotate します。worktree stub は denylist と shell-metachar refusal を持ち、execFile で child process を起動します。

## Layout

- `src/index.ts` — demo runner。
- `src/agent.ts` — base `Agent` class と `PlannerAgent`, `CoderAgent`, `ReviewerAgent`。
- `src/coordinator.ts` — round-robin loop と rotation tracking。
- `src/workspace.ts` — shared in-memory filesystem と message log。
- `src/runtime.ts` — denylist 付き `child_process.execFile` worktree stub。
- `src/types.ts` — shared types。
- `tests/*.test.ts` — `tsx` 経由の `node --test` style tests。

## Install

```bash
npm install
```

## Run

```bash
npm start
```

## Verify

```bash
npm run typecheck
npm test
```

## Spec references

- Source lesson: `phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md`
- [MetaGPT](https://github.com/FoundationAgents/MetaGPT) role-based multi-agent framework.
