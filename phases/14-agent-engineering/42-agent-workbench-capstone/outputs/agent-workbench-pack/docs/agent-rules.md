# Agent Rules

## startup/state-file-fresh
- category: startup
- check: state_file_fresh
Agent must read agent_state.json before any tool call.

## forbidden/no-out-of-scope-writes
- category: forbidden
- check: no_out_of_scope_writes
Never edit a file outside the active task's scope contract.

## done/tests-pass
- category: definition_of_done
- check: tests_pass
A task is done only when every acceptance command exits zero.

## uncertainty/open-question-note
- category: uncertainty
- check: opened_question_when_unsure
When confidence is below threshold, open a question note instead of guessing.

## approval/new-dependency
- category: approval
- check: new_dependency_approved
Adding a runtime dependency requires explicit human approval.
