# Mission - 最小の Agent Workbench

## Goal
3 file の minimum workbench (router, state, task board) を fresh な `workdir/` に配置し、single agent turn が state を読み、task を pull し、scope に書き込み、更新済み state を永続化できることを証明する。

## Inputs
- lesson code の横にある空の `workdir/` directory
- 3 file (`AGENTS.md`, `agent_state.json`, `task_board.json`) に関する知識

## 成果物
- 3 file を作成し 1 turn を実行する `code/main.py`
- state、board、verification command を指す短い router `workdir/AGENTS.md`
- active task id、touched files、next action を持つ `workdir/agent_state.json`
- 小さな backlog と status を持つ `workdir/task_board.json`

## Acceptance
- `python3 code/main.py` が 1 回目と 2 回目の実行で exit zero
- 2 回目の run がゼロからではなく 1 回目の停止地点から再開する
- script が表示する diff に、その turn が触れた 1 file が示される

## Out of scope
- Scope contracts、verification gates、reviewer agents。これらは later lessons で上に重ねる。
- 長い monolithic な `AGENTS.md`。router は意図的に短く保つ。

## References
- `docs/en.md` - full lesson
- `code/main.py` - reference implementation
- `outputs/skill-minimal-workbench.md` - extracted skill
