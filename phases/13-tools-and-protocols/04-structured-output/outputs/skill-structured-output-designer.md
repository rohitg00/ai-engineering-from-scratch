---
name: structured-output-designer
description: free-text extraction target 向けに、strict-mode-compatible な JSON Schema と Pydantic model を設計し、typed refusal と retry handling の stub を含める。
version: 1.0.0
phase: 13
lesson: 04
tags: [structured-output, json-schema, pydantic, strict-mode, extraction]
---

free-text extraction target (invoices、resumes、support tickets、research summaries) が与えられたら、production-ready な extraction contract を作る。含めるものは JSON Schema 2020-12、Pydantic model、refusal handler、retry policy。

生成するもの:

1. JSON Schema 2020-12。すべての property を型付けする。`required` はすべての property を列挙する。すべての object に `additionalProperties: false` を置く。closed value sets には enum を使う。`$ref` は使わない。曖昧な `oneOf` / `anyOf` は使わない。OpenAI strict-mode requirements に対して validate 済みにする。
2. Pydantic v2 BaseModel。Python types で schema を mirror する。`model_json_schema()` は (1) と等価な schema を生成しなければならない。
3. Refusal handler。typed `Refusal(reason: str, category: str)` outcome。categories として `safety`、`input_mismatch`、`insufficient_info` を列挙する。
4. Retry policy。3 つの retry shape: (a) validation errors を注入して 1 回 retry する (strict mode の外側)、(b) refusal を final として受け入れる (strict mode)、(c) repeated refusal では stronger model に escalate する。
5. Test vectors。happy path、adversarial fields、partial input、refusal-triggering case を含む 10 個の input。それぞれに expected outcome を付ける。

強制 reject:
- untyped fields を含む schema。strict mode と validator の両方で失敗する。
- `additionalProperties: false` が欠けている schema。hallucinations が漏れる。
- discriminator field なしで `oneOf` を使う schema。decoding が曖昧になる。
- JSON Schema round-trip が check されていない Pydantic model。

拒否ルール:
- target domain が documented purpose なしに personally identifying data を含む場合は refuse し、lawful-basis argument のために Phase 18 (ethics) に route する。
- user が JSON Schema 2020-12 で表現できない schema (例: recursive arbitrary graphs) を求める場合は refuse し、表現可能な最も近い relaxation を提案する。
- extraction target が「extract structured data from anything」の場合は refuse し、specific domain を尋ねる。

出力: schema JSON、Pydantic class、refusal と retry policy、10 個の test vectors を含む one-page contract。最後に、最初に target する provider とその理由についての note を付ける。
