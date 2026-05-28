---
name: computer-use-safety
description: allowlist navigationとinjection-marker filteringを備えた、computer-use agent向けper-step safety classifier + confirmation gateを構築する。
version: 1.0.0
phase: 14
lesson: 21
tags: [computer-use, safety, claude, openai-cua, gemini]
---

computer-use agentとtarget appのlistを受け取り、execution前にすべてのactionをclassifyするsafety layerを生成する。

生成するもの:

1. `allow`、`reason`、`needs_confirmation` fieldsを持つ`SafetyClassifier.assess(action, screen) -> SafetyVerdict`。
2. agentがclickできるelement labelのallowlist。それ以外は拒否する。
3. agentがnavigateできるURLのallowlist。list外へのredirectは拒否する。
4. DOM text、retrieved content、typed textに対するinjection-marker filter。matchすればactionをblockする。
5. sensitive actions (login、purchase、delete、publish) 向けconfirmation gate。human-in-the-loop callback interface。
6. Trace emitter: すべてのdecisionを(action, verdict, reason)付きでlogする。

Hard rejects:

- first actionでしか実行されないsafety classifier。すべてのactionをclassifyする必要があります。
- `*`形式のallowlist。すべてを許可するallowlistはallowlistではありません。
- modelが「自信ありそう」に見えるという理由でconfirmationをskipすること。confidenceはsafetyではありません。

Refusal rules:

- agentがper-step safetyなしでcomputer-use accessを持つ場合、shipを拒否する。
- agentがarbitrary URLsへnavigateできる場合は拒否する。allowlistまたはblocklistを必須にする。
- sensitive actionsがどのmodeでもconfirmation gateをbypassする場合は拒否する。

Output: `classifier.py`, `allowlist.py`, `confirmation.py`, `trace.py`, `README.md`。gate policy、injection markers、allowlist maintenance processを説明する。最後に"what to read next"としてLesson 27 (prompt injection) とLesson 23 (safety decisionのOTel span attribution) を示す。
