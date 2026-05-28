# Agent Rules

## startup/state-file-fresh
- category: startup
- check: state_file_fresh
Agent は tool call の前に agent_state.json を読まなければならない。

## forbidden/no-release-script-edits
- category: forbidden
- check: no_release_script_edits
approved release task の外で scripts/release.sh を編集してはならない。

## done/tests-pass
- category: definition_of_done
- check: tests_pass
task は acceptance command が exit zero のときだけ done になる。

## uncertainty/open-question-note
- category: uncertainty
- check: opened_question_when_unsure
confidence が threshold 未満なら、推測せず question note を書く。

## approval/new-dependency
- category: approval
- check: new_dependency_approved
runtime dependency の追加には explicit human approval が必要。
