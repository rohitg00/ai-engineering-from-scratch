# Handoff Protocol

すべての session は、次を含む handoff packet で終わります。

- summary
- changed_files
- commands_run
- failed_attempts
- open_risks (severity + detail)
- next_action (1つの具体的 step)
- verdict_pointer (verification + review reports への paths)

packet は handoff.md (humans) と handoff.json (next agent) の両方で出荷されます。
missing fields は session-end hook を停止させます。
