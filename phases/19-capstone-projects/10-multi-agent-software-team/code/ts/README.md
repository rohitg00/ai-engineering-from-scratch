# Multi-agent software team (TypeScript skeleton)

Multi-file TypeScript skeleton for the multi-agent software team capstone.
Planner, coder, and reviewer agents share a workspace and rotate through a
coordinator. A worktree stub launches child processes via execFile with a
denylist and a shell-metachar refusal.

## Layout

- `src/index.ts` — demo runner.
- `src/agent.ts` — base `Agent` class plus `PlannerAgent`, `CoderAgent`, `ReviewerAgent`.
- `src/coordinator.ts` — round-robin loop and rotation tracking.
- `src/workspace.ts` — shared in-memory filesystem and message log.
- `src/runtime.ts` — `child_process.execFile` worktree stub with denylist.
- `src/types.ts` — shared types.
- `tests/*.test.ts` — `node --test` style tests via `tsx`.

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
