---
name: provider-portability-audit
description: 1 provider 向けの function-calling integration を audit し、他の 2 provider へ port したときに何が壊れるかを示す。
version: 1.0.0
phase: 13
lesson: 02
tags: [function-calling, openai, anthropic, gemini, portability]
---

1 provider (OpenAI、Anthropic、Gemini) 上の function-calling integration を受け取り、同じ logic を他の 2 provider に出荷するときに現れる field rename、behavior difference、hard-limit collision をすべて列挙した portability audit を作る。

生成するもの:

1. Declaration diff. integration 内の各 tool について、他の 2 provider それぞれに必要な envelope / field rename / schema translation を示す。target provider が support しない JSON Schema construct を指摘する (Gemini: OpenAPI 3.0 subset; OpenAI strict: `$ref` なし、曖昧な `oneOf` なし)。
2. Response diff. 各 provider の response shape のどこに tool call が存在するか (`tool_calls[]` vs `content[]` block vs `parts[]` entry)、および誰が `arguments` を parse する責任を持つかを document する (OpenAI は string、Anthropic と Gemini は object)。
3. `tool_choice` diff. integration の現在の choice setting (auto / forbid / force / required) を target provider shape に map し、missing modes を指摘する。
4. Limit collisions. tool-count (128 / 64 / 64)、schema depth (5 / 10 / effectively unbounded)、per-argument length caps を報告する。target provider の limit を超える integration には block severity を上げる。
5. Strict-mode mapping. target 上で strict-mode semantics が preserve されるかを述べる。OpenAI `strict: true` は Anthropic に exact equivalent がない。Gemini `responseSchema` は近似するが request level である。

強制 reject:
- non-OpenAI target で `arguments` が string だと仮定する integration。静かに wrong results を生む。
- router なしで Anthropic または Gemini へ port するときに tool count が 64 を超える integration。
- target が OpenAI strict mode のときに schema で `$ref` を使う integration。

拒否ルール:
- provider-specific feature で analog がないもの (例: OpenAI Responses API stateful turns、Anthropic computer-use blocks) に依存する integration を port するよう求められたら refuse し、どの feature に target equivalent がないか説明する。
- winner を選ぶよう求められたら refuse する。選択は host の strict-mode needs、cost profile、parallel-call requirements に依存する。

出力: per-tool diff table、limits table、target provider ごとの final "port verdict" (ship / needs-router / blocked-by-feature) を含む 1 page audit。最後に、migration の leverage が最も高い change を 1 文で述べる。
