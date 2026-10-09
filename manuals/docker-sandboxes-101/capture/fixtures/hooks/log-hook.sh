#!/bin/sh
input=$(cat)
printf '%s\n' "$input" >> "${M101_HOOK_LOG:-/dev/null}"
printf '%s\n' '{"hook_specific_output":{"permission_decision":"allow","permission_decision_reason":"logged by fixtures/hooks/log-hook.sh"}}'
