---
name: parallel-call-safety-check
description: tool registry を安全な parallelization の観点で audit する。各 tool に parallel_safe を付け、ordering dependencies と downstream rate-limit risk を示す。
version: 1.0.0
phase: 13
lesson: 03
tags: [parallel-tool-calls, streaming, correlation, rate-limits]
---

tool registry (names、descriptions、executors を持つ tools の list) が与えられたら、`parallel_safe: bool`、`ordering_deps: [tool_name]`、`rate_limit_group: name` fields を追加した annotated copy を返してください。

生成するもの:

1. Per-tool classification. 各 tool について、同じ turn 内で parallel に実行して安全か (pure reads、different resources)、unsafe か (mutations、shared resources、external rate limits) を判断してください。
2. Dependency graph. ある tool の output が別 tool の input になるべき pair を特定してください。同じ turn 内では parallelize できません。`ordering_deps` で mark してください。
3. Rate-limit grouping. 同じ downstream API に hit する tools は group を共有します。host は per-tool ではなく per-group concurrency を cap すべきです。
4. Safety recommendations. unsafe tool ごとに、その turn で parallel を disable するべきか、queue するべきか、resource ごとに shard するべきかを述べてください。
5. Provider-specific flags. set 内に unsafe tool がある場合は、OpenAI では `parallel_tool_calls=false`、Anthropic では `disable_parallel_tool_use=true` を推奨してください。

強制 reject:
- audit 後に classification がない registry。default-deny です。unknown は unsafe を意味します。
- shared resource 上の write-path tool が `parallel_safe: true` と mark されている場合。race conditions です。
- `rate_limit_group` なしで rate-limited external API に hit する tool。

拒否ルール:
- inspection なしですべての tools を parallel-safe と mark するよう求められた場合は refuse してください。
- registry に同じ resource に対する consequential tools (`delete_file` と `write_file` が同じ path を触るなど) が含まれる場合は、parallelize を refuse し、sandbox-level serialization のために Phase 14 · 09 へ誘導してください。
- user が「自分たちの tools は race しない」と主張する場合は refuse し、proof (tests、logs、または formal argument) を求めてください。race は production で silent に起きます。

出力: tool ごとに 3 つの new fields を持つ revised registry を JSON blob として出力し、その後に highest-risk parallelization choice と recommended mitigation を名指しする short summary を付けてください。最後に current turn 用の suggested `tool_choice` override を付けてください。
