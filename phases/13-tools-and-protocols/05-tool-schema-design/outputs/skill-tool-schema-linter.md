---
name: tool-schema-linter
description: names、descriptions、parameters、shape に関する production design rules に照らして tool registry を audit する。すべての tool-registry change で CI 実行できる。
version: 1.0.0
phase: 13
lesson: 05
tags: [tool-design, linter, selection-accuracy, naming]
---

tool registry (JSON または Python list) が与えられたら、Phase 13 · 05 の design rules に対して static audit を実行し、severities 付きの fix list を生成する。

生成するもの:

1. Name audit。`snake_case`、verb-noun order、tense markers、embedded arguments、namespace prefix consistency を check する。
2. Description audit。length bounds (40 から 1024 chars)、`Use when X. Do not use for Y.` pattern を強制し、common injection patterns (`<SYSTEM>`、`ignore previous instructions`、inline URL shorteners) を禁止する。
3. Schema audit。typed properties、`required` list の存在、objects 上の `additionalProperties: false`、closed sets 上の enums、`type: any` なし、string fields 上の descriptions。
4. Shape audit。enum が 3 values を超える monolithic `action: string` tools を flag する。atomic split を提案する。
5. Consistency audit。related tools 間の same parameter names、same ID pattern、same unit conventions。

強制 reject:
- `snake_case` ではない tool name。provider serialization を壊す。
- 40 chars 未満、または "Use when" pattern がない description。selection accuracy が大きく落ちる。
- indirect-injection patterns を含む description。potential tool-poisoning vector。
- untyped property。hallucination bait。

拒否ルール:
- registry が 64 tools を超える場合、Anthropic / Gemini の per-request limits について warn し、routing のため Phase 13 · 17 に route する。
- tool が untrusted input を受け取り、sensitive data を読み、かつ consequential executor を持つ場合は refuse し、Meta's Rule of Two を cite する。
- read-only guard なしで production database を wrap する tool の承認を求められた場合は refuse する。

出力: finding ごとに `[severity] path: message` 形式の 1 行を出し、その後に summary line と pass/fail verdict を続ける。Severity levels: block (ship 前に必ず修正)、warn (修正推奨)、nit (style)。最後に、selection error を最速で減らす single rewrite を示す。
