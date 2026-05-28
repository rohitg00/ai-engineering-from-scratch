---
name: task-store-designer
description: long-running MCP tool の task store を設計する。state shape、ttl、durability、cancellation、crash recovery を扱う。
version: 1.0.0
phase: 13
lesson: 13
tags: [mcp, tasks, durable-store, long-running, sep-1686]
---

long-running tool（research、build、export、report generation）に対して、SEP-1686 task augmentation を支える task store を設計してください。

作成するもの:

1. State shape。minimum fields: `id`、`state`、`progress`、`result`、`error`、`ttl`、`created_at`。optional: `request_meta`、`parent_task_id`（future subtasks 用）。
2. Durability choice。toy なら filesystem、single-process なら SQLite、multi-replica なら Redis。理由を示す。
3. taskSupport flag。tool ごとに `forbidden`、`optional`、または `required`。1 行で理由を示す。
4. Cancellation plan。worker が cancel signal を確認する方法と、partial progress の扱い。
5. Crash recovery。boot-time reload rule と、`CRASH_RECOVERY` failures が client にどう見えるか。

強制拒否:
- ttl 内に completed results を失う store。
- explicit terminal states（`completed`、`failed`、`cancelled`）を持たない task state。
- idempotent ではない cancellation。

拒否ルール:
- tool が 5 秒未満で終わる場合、task への昇格を拒否する。synchronous のほうが単純。
- task が 10 MB を超える result を生成する場合、拒否して streaming content blocks を推奨する。
- server に state を persist できる process がない場合（stateless edge function）、拒否して durable runtime への移行を推奨する。

Output: state shape、durability choice、taskSupport flag、cancellation plan、crash-recovery rule を含む one-page store design。最後に、SEP-1686 subtasks が shipped されたときにこの design へ影響するかを 1 行で助言する。
