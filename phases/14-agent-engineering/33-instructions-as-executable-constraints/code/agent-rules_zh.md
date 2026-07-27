# 智能体规则

## startup/state-file-fresh
- category: startup
- check: state_file_fresh
智能体在任何工具调用前必须读取 agent_state.json。

## forbidden/no-release-script-edits
- category: forbidden
- check: no_release_script_edits
除非在批准的发布任务中，否则绝不编辑 scripts/release.sh。

## done/tests-pass
- category: definition_of_done
- check: tests_pass
只有当任务的验收命令返回退出码零时，任务才算完成。

## uncertainty/open-question-note
- category: uncertainty
- check: opened_question_when_unsure
当置信度低于阈值时，撰写问题注释而非猜测。

## approval/new-dependency
- category: approval
- check: new_dependency_approved
添加运行时依赖需要显式的人工批准。
