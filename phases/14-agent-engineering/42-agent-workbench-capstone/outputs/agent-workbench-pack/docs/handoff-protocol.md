# Handoff Protocol

Every session ends with a handoff packet containing:

- summary
- changed_files
- commands_run
- failed_attempts
- open_risks (severity + detail)
- next_action (one concrete step)
- verdict_pointer (paths to verification + review reports)

The packet ships as both handoff.md (humans) and handoff.json (next agent).
Missing fields halt the session-end hook.
