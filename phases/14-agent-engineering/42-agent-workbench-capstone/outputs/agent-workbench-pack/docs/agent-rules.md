# Agent Rules

## startup/state-file-fresh
- category: startup
- check: state_file_fresh
Agent は tool call の前に必ず agent_state.json を読む。

## forbidden/no-out-of-scope-writes
- category: forbidden
- check: no_out_of_scope_writes
active task の scope contract 外の file を編集してはいけない。

## done/tests-pass
- category: definition_of_done
- check: tests_pass
task は、すべての acceptance command が exit zero になったときだけ done。

## uncertainty/open-question-note
- category: uncertainty
- check: opened_question_when_unsure
confidence が threshold 未満のときは、推測せず question note を開く。

## approval/new-dependency
- category: approval
- check: new_dependency_approved
runtime dependency を追加するには、明示的な human approval が必要。
