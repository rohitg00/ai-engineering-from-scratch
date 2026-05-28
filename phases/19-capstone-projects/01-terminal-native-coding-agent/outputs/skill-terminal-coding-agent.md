---
name: terminal-coding-agent
description: コスト上限、サンドボックス化されたツール、2026年版 hook 面を備えたターミナルネイティブ Coding Agent を構築し、SWE-bench Pro で評価する。
version: 1.0.0
phase: 19
lesson: 01
tags: [capstone, coding-agent, claude-code, swe-bench, mcp, hooks, sandbox]
---

対象リポジトリと自然言語のタスクを受け取り、計画し、サンドボックス内で実行し、pull request を開く harness を構築する。タスクあたり $5 以内に収めつつ、30タスクの SWE-bench Pro サブセットで mini-swe-agent baseline と同等以上を目指す。

構築計画:

1. Bun + Ink の TUI harness を立ち上げ、plan ペイン、tool-call stream、token/dollar budget のライブ表示を用意する。
2. Model Context Protocol StreamableHTTP 上で6つのツール (read_file, edit_file, ripgrep, tree_sitter_symbols, run_shell, git) を定義する。各呼び出しの返却は最大 4k tokens に制限する。
3. すべての tool call を、新しい `git worktree add` branch 上の E2B または Daytona sandbox 内で実行する。host filesystem には触れない。
4. 2026年版の8つの hook event をすべて配線する: SessionStart, SessionEnd, PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop, PreCompact。少なくとも4つのユーザー作成 hook (destructive-command guard, token accounting, OTel span emitter, trace bundle writer) を同梱する。
5. 3つの budget を強制する: 50 turns, 200k tokens, $5。150k で PreCompact を発火させ、古い turn を要約する。
6. GenAI semantic conventions に従った OpenTelemetry span を self-hosted Langfuse に送る。
7. 成功時は branch を push し、plan と trace bundle を本文に含む PR を開く。
8. 30 issue の SWE-bench Pro Python サブセットで mini-swe-agent と比較評価し、pass@1、turns、tokens、task あたり dollars を記録する。

評価 rubric:

| Weight | Criterion | Measurement |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 | mini-swe-agent baseline と同じ30タスクサブセットで比較 |
| 20 | Architecture clarity | plan/act/observe の分離、hook 面、tool schema の読みやすさ |
| 20 | Safety | sandbox escape red-team と destructive-command guard audit |
| 20 | Observability | tool call の 100% が span 化され、turn ごとに token accounting されること |
| 15 | Developer UX | 2秒未満の cold-start、crash recovery、Ctrl-C cancel semantics |

ハードリジェクト:

- sandbox 内ではなく host filesystem 上で git を shell out する harness。
- worktree 外へ書き込める、または明示的な allowlist hook なしに外部 URL へ curl できる agent。
- 同じ30 issue 上での matched baseline run なしに報告された eval 数値。
- retry のたびに `git reset --hard` することに依存した「pass rate」主張。SWE-bench Pro は pass@1。

拒否ルール:

- どの設定でも main へ直接 push することを拒否する。PR branch のみ。
- destructive-command guard を無効化することを拒否する。これは rubric の必須要件。
- budget ceiling なしで実行することを拒否する。無制限実行は eval 比較を汚染する。

出力: harness を含むリポジトリ、mini-swe-agent baseline run と対応した固定30タスク SWE-bench Pro eval harness、少なくとも5回の完全実行の OpenTelemetry trace archive、baseline が解けず harness が解けたタスクとその逆を示す write-up。最後に、観測した上位3つの failure mode と、それぞれを修正した hook 変更のセクションを置く。
