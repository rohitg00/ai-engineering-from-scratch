# Capstone 01 — ターミナルネイティブ Coding Agent

> 2026年には coding agent の形はほぼ固まっています。TUI harness、状態を持つ plan、sandbox 化された tool surface、plan / act / observe / recover の loop。Claude Code、Cursor 3、OpenCode は遠目には同じ形に見えます。この capstone では、それを CLI 入力から pull request 作成まで end to end で構築し、SWE-bench Pro 上で mini-swe-agent と Live-SWE-agent に対して測定します。難しいのは model call ではなく、tool loop、sandbox、50 turn 実行時の cost ceiling だと学びます。

**種別:** Capstone
**言語:** TypeScript / Bun (harness), Python (eval scripts)
**前提条件:** Phase 11 (LLM engineering), Phase 13 (tools and protocols), Phase 14 (agents), Phase 15 (autonomous systems), Phase 17 (infrastructure)
**Phases exercised:** P0 · P5 · P7 · P10 · P11 · P13 · P14 · P15 · P17 · P18
**所要時間:** 35時間

## 問題

coding agent は2026年の代表的な AI application category になりました。Claude Code、Composer 2 と Agent Tabs を備えた Cursor 3、Amp、OpenCode、Factory Droids、Google Jules は、terminal harness、permissioned tool surface、sandbox、frontier model を中心にした plan-act-observe loop という同じ architecture の変種を提供しています。frontier は狭く、Live-SWE-agent は Opus 4.5 で SWE-bench Verified 79.2% に到達していますが、engineering craft は広いです。多くの failure mode は model mistake ではありません。tool-loop instability、context poisoning、runaway token cost、destructive filesystem operation です。

これらの agent は外から眺めても理解できません。自分で作り、turn 47 で ripgrep が 8MB の match を返して loop が壊れるのを見て、truncation layer を作り直す必要があります。それがこの capstone の狙いです。

## コンセプト

harness には4つの surface があります。**Plan** は TodoWrite-style の state object を保ち、model が毎 turn 書き換えます。**Act** は tool call (read, edit, run, search, git) を dispatch します。**Observe** は stdout / stderr / exit code を取得し、truncate し、summary を返します。**Recover** は context window を壊したり永久 loop したりせずに tool error を処理します。2026年の形ではさらに **hooks** が加わります。`PreToolUse`, `PostToolUse`, `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `Notification`, `Stop`, `PreCompact` は、operator が policy、telemetry、guardrail を注入する extension point です。

sandbox は E2B または Daytona です。各 task は git worktree を read-write で mount した新しい devcontainer で動きます。harness は host filesystem に触れません。worktree は成功時も失敗時も破棄されます。cost control は3層で強制します: turn ごとの token ceiling、session ごとの dollar budget、hard turn limit (通常50)。observability layer は GenAI semantic conventions に従う OpenTelemetry span で、self-hosted Langfuse に送ります。

## Architecture

```
  user CLI  ->  harness (Bun + Ink TUI)
                  |
                  v
           plan / act / observe loop  <--->  Claude Sonnet 4.7 / GPT-5.4-Codex / Gemini 3 Pro
                  |                          (via OpenRouter, model-agnostic)
                  v
           tool dispatcher (MCP StreamableHTTP client)
                  |
     +------------+------------+----------+
     v            v            v          v
  read/edit    ripgrep     tree-sitter   git/run
     |            |            |          |
     +------------+------------+----------+
                  |
                  v
           E2B / Daytona sandbox  (worktree isolated)
                  |
                  v
           hooks: Pre/Post, Session, Prompt, Compact
                  |
                  v
           OpenTelemetry -> Langfuse (spans, tokens, $)
                  |
                  v
           PR via GitHub app
```

## Stack

- Harness runtime: Bun 1.2 + Ink 5 (React-in-terminal)
- Model access: OpenRouter unified API with Claude Sonnet 4.7, GPT-5.4-Codex, Gemini 3 Pro, Opus 4.5 (hardest tasks 用)
- Tool transport: Model Context Protocol StreamableHTTP (MCP 2026 revision)
- Sandbox: E2B sandboxes (JS SDK) または Daytona devcontainers
- Code search: ripgrep subprocess、17言語向け tree-sitter parsers (pre-compiled)
- Isolation: task ごとの `git worktree add`、成功 / 失敗時の cleanup
- Eval harness: SWE-bench Pro (verified subset) + Terminal-Bench 2.0 + 自作30-task holdout
- Observability: `gen_ai.*` semconv 付き OpenTelemetry SDK → self-hosted Langfuse
- PR posting: fine-grained token を持つ GitHub App、scope は target repo に限定

## 実装

1. **TUI and command loop.** Ink で Bun project を scaffold します。`agent run <repo> "<task>"` を受け取り、plan pane、tool-call stream、token budget の3分割 view を表示します。Ctrl-C で cancel し、exit 前に `SessionEnd` hook を発火させます。

2. **Plan state.** typed TodoWrite schema (pending / in_progress / done items with notes) を定義します。model は毎 turn tool call として state 全体を書き換えます。incremental mutation は許可しません。crash から resume できるよう plan を `.agent/state.json` に保存します。

3. **Tool surface.** 6つの tool を定義します: `read_file`, `edit_file` (diff preview 付き), `ripgrep`, `tree_sitter_symbols`, `run_shell` (timeout 付き), `git` (status / diff / commit / push)。MCP StreamableHTTP で公開し、harness を transport-agnostic にします。各 tool は truncated output (call あたり 4k tokens cap) を返します。

4. **Sandbox wrapping.** task ごとに E2B sandbox を spawn します。`git worktree add -b agent/$TASK_ID` で fresh branch を作ります。すべての tool call は sandbox 内で実行し、host filesystem は到達不能にします。

5. **Hooks.** 2026年版の8 hook type をすべて実装します。少なくとも4つの user-authored hook を配線します: (a) worktree 外の `rm -rf` を block する `PreToolUse` destructive-command guard、(b) `PostToolUse` token accounting、(c) `SessionStart` budget initialization、(d) final trace bundle を書く `Stop`。

6. **Eval loop.** SWE-bench Pro Python の30 issue subset を clone します。各 issue に対して harness を実行します。pass@1、turns-per-task、$-per-task で mini-swe-agent (minimal baseline) と比較し、`eval/results.jsonl` に書きます。

7. **Cost control.** hard cutoff は 50 turns、200k context、task あたり $5。150k mark で `PreCompact` hook が古い turn を prior-state block に要約し、plan を失わず新しい observation の余地を作ります。

8. **PR posting.** 成功時の final step は `git push` と GitHub API call で、plan と diff summary を body に含む PR を開くことです。

## Use It

```
$ agent run ./my-repo "Fix the race condition in worker.rs"
[plan]  1 locate worker.rs and enumerate mutex uses
        2 identify shared state under contention
        3 propose fix, verify tests
[tool]  ripgrep mutex.*lock -t rust           (44 matches, truncated)
[tool]  read_file src/worker.rs 120..180
[tool]  edit_file src/worker.rs (+8 -3)
[tool]  run_shell cargo test worker::          (passed)
[plan]  1 done · 2 done · 3 done
[done]  PR opened: #482   turns=9   tokens=38k   cost=$0.41
```

## Ship It

deliverable skill は `outputs/skill-terminal-coding-agent.md` にあります。repo path と task description を受け取り、sandbox 内で full plan-act-observe loop を実行し、PR URL と trace bundle を返します。この capstone の rubric:

| Weight | Criterion | How it is measured |
|:-:|---|---|
| 25 | SWE-bench Pro pass@1 vs baseline | 同じ30個の Python task で harness と mini-swe-agent を比較 |
| 20 | Architecture clarity | Plan/act/observe の分離、hook surface、tool schema を Live-SWE-agent layout と照合 |
| 20 | Safety | sandbox escape tests、permission prompts、destructive-command guard の red-team 通過 |
| 20 | Observability | trace completeness (tool call の100%が spanned)、turn ごとの token accounting |
| 15 | Developer UX | cold-start < 2s、crash recovery が plan を resume、Ctrl-C が mid-tool を clean cancel |
| **100** | | |

## Exercises

1. backing model を Claude Sonnet 4.7 から vLLM 上の Qwen3-Coder-30B に差し替えます。pass@1 と $-per-task を比較し、open model が弱い箇所を報告します。

2. PR posting 前に diff を読む `reviewer` sub-agent を追加し、revision loop を要求できるようにします。false-positive review が SWE-bench pass rate を single-agent baseline 未満に下げるか測定します (ヒント: 多くの場合下がります)。

3. sandbox を stress-test します。外部 URL に `curl` しようとする task と、worktree 外へ書き込もうとする task を作ります。どちらも PreToolUse hook で block されることを確認し、attempt を log します。

4. 小さめの model (Haiku 4.5) で `PreCompact` summarization を実装します。3x compaction で plan fidelity がどれだけ失われるか測定します。

5. MCP StreamableHTTP transport を stdio に差し替えます。cold-start と per-call latency を benchmark し、local-only use に向く方を選びます。

## Key Terms

| Term | What people say | What it actually means |
|------|-----------------|------------------------|
| Harness | 「agent loop」 | tool を dispatch し、plan state を保ち、budget を強制する model 周辺の code |
| Hook | 「agent event listener」 | 8つの lifecycle event のいずれかで harness から実行される user-authored script |
| Worktree | 「Git sandbox」 | 別 path にある linked git checkout。main clone に触れず破棄できる |
| TodoWrite | 「Plan state」 | model が毎 turn 書き換える pending / in-progress / done item の typed list |
| StreamableHTTP | 「MCP transport」 | 2026 MCP revision。bidirectional streaming 付き long-lived HTTP connection。SSE を置き換える |
| Token ceiling | 「Context budget」 | input+output tokens の per-turn / per-session cap。compaction または termination を trigger する |
| pass@1 | 「Single-attempt pass rate」 | retry や test-set peeking なしで初回実行で解けた SWE-bench task の割合 |

## 参考文献

- [Claude Code documentation](https://docs.anthropic.com/en/docs/claude-code) — Anthropic の reference harness
- [Cursor 3 changelog](https://cursor.com/changelog) — Agent Tabs と Composer 2 の product notes
- [mini-swe-agent](https://github.com/SWE-agent/mini-swe-agent) — SWE-bench harness 比較用の minimal baseline
- [Live-SWE-agent](https://github.com/OpenAutoCoder/live-swe-agent) — Opus 4.5 で SWE-bench Verified 79.2%
- [OpenCode](https://opencode.ai) — open harness、112k stars
- [SWE-bench Pro leaderboard](https://www.swebench.com) — この capstone が対象にする evaluation
- [Model Context Protocol 2026 roadmap](https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/) — StreamableHTTP、capability metadata
- [OpenTelemetry GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — tool calls と token usage の span schema
