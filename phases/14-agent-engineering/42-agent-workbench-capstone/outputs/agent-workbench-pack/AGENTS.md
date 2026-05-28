# AGENTS.md

あなたは agent workbench を使う repository の中で作業しています。

行動する前に次を読んでください。

1. `agent_state.json` — 前 session が止まった場所。
2. `task_board.json` — 進行中のもの、次に行うもの。
3. `docs/agent-rules.md` — startup、forbidden、done、uncertainty、approval。
4. `docs/reliability-policy.md` — この workbench が吸収するよう設計された failure modes。
5. `docs/handoff-protocol.md` — session end が生成すべきもの。
6. `docs/reviewer-rubric.md` — completed work の判断方法。

Verification command: board 上の active task の `acceptance_criteria` を参照してください。

Pack version: 1.0.0
