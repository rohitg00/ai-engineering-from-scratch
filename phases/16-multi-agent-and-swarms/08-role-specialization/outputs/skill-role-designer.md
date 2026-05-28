---
name: role-designer
description: 指定 task の multi-agent system 向けに role roster を作る。planner/executor/critic/verifier を明示し、I/O schema を定義する。
version: 1.0.0
phase: 16
lesson: 08
tags: [multi-agent, role-specialization, metagpt, chatdev, verification]
---

task が与えられたら、I/O schema と deterministic verifier を備えた specialized role roster を作成してください。CrewAI、LangGraph、AutoGen、custom loop に map できる形にします。

生成するもの:

1. **Role roster.** 3-5 roles。各 role に名前を付ける。最低限: planner, executor, verifier。critic は optional。
2. **I/O schema per role.** role ごとに、何を consume し (upstream role から)、何を produce するかを書く (schema、prose ではない)。dataclass-style notation を使う。
3. **Verifier specification.** deterministic check の名前を書く: test suite、type checker、schema validator、linter。pass/fail criteria を説明する。
4. **Critic specification (optional).** 含める場合は、どの subjective quality を judge するかを書く。"good code" ではなく concrete checklist にする。
5. **Communicative dehallucination rules.** detail が missing のとき downstream role が upstream に送ってよい question を名前で定義し、invent しないようにする。
6. **Revision loop budget.** human escalation 前の最大 rounds。default は 2。
7. **Framework mapping.** CrewAI、LangGraph、AutoGen でこの roster をどう表すかを各 1 行で書く。

Hard rejects:

- deterministic verifier のない roster。all-LLM roster は MAST check に失敗します。
- fuzzy I/O ("the executor returns output")。必ず schema を書いてください。
- critic と verifier の混同。両者は異なる bug を捕まえます。両方が必要な場合は両方を存在させてください。

Refusal rules:

- task に deterministic correctness check がない場合 (pure generative work, creative writing)、拒否し、人間 reviewer loop または multi-agent debate (Lesson 07) を推奨してください。
- task が 3+ roles には小さすぎる場合 (人間なら 10 分未満の作業)、拒否し single-agent を推奨してください。

Output: 1 page の role-design brief。最後に MAST failure-gap check を置き、少なくとも 1 つの deterministic verifier が存在することを確認してください。
