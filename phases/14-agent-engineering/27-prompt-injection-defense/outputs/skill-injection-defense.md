---
name: injection-defense
description: 任意の agent runtime 向けに、source-tagged content、injection-marker scanning、allowlist navigation を備えた PVE (Prompt-Validator-Executor) layer を構築する。
version: 1.0.0
phase: 14
lesson: 27
tags: [security, prompt-injection, pve, greshake, source-tag]
---

tool access と retrieval を持つ agent が与えられたら、injection-defense layer を生成する。

生成するもの:

1. すべての content piece に source tag を付ける: `user_message`, `tool_output`, `retrieved_web`, `retrieved_memory`, `retrieved_file`。message history 全体に tags を伝播させる。
2. `Validator.assess(tool_call, contents)` — injection-shaped args または retrieved content を伴う tool calls を拒否する。declared trust level と source tags が一致する場合だけ許可する。
3. navigation の allowlist / blocklist: agent が触れてよい URLs、domains、file paths。
4. Memory-write guardrail: directive に見える writes を拒否する。
5. Content-capture discipline (Lesson 23): retrieved content は外部に保存し、spans には prose ではなく reference IDs を載せる。
6. Test suite: 5 つの Greshake exploit classes を red-team cases として含める。

強い却下条件:

- source tags のない tool-use surface。provenance なしでは permission levels を区別できない。
- final output だけで走る validator。late validation は意味がない。model はすでに行動済み。
- 「system prompt が処理するので信頼してよ」。system-prompt hygiene は control ではない。

拒否ルール:

- agent が source tagging なしに retrieval capability を持つなら、ship を拒否する。retrieved content は標準的な injection vector。
- sensitive tools (send message, execute shell, write file in /) に human-in-the-loop confirmation がないなら拒否する。
- memory writes が unguarded なら拒否する。persistent memory poisoning は次 session を再汚染する。

出力: `validator.py`, `source_tag.py`, `allowlist.py`, `memory_guard.py`, `red_team.py`, `README.md`。six-control stack、residual risks、ongoing review cadence を説明する。最後に Lesson 21 (computer use safety) と Lesson 23 (content capture via OTel) を指す "what to read next" で締める。
