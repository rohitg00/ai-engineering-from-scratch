---
name: ipi-audit
description: agentic deployment について、indirect prompt injection exposure と information-flow-control coverage を監査する。
version: 1.0.0
phase: 18
lesson: 15
tags: [ipi, indirect-prompt-injection, ifc, agent-security, owasp-llm01]
---

agentic deployment description が与えられたら、その deployment の indirect prompt injection exposure を監査する。

生成する内容:

1. Untrusted-content inventory。agent が読み得る content source をすべて列挙する: RAG documents、inbox、calendar、tool outputs、tickets、product reviews、third-party APIs。各 source は潜在的な IPI vector である。
2. Trust labelling。deployment は trusted (user prompt) と untrusted (retrieved content) を分離しているか。label なしで同じ prompt に concatenation されているなら、IFC は有効ではない。
3. Action gating。どの tools を invoke できるか。それぞれについて、invocation が trusted prompt のみに gate されているか、untrusted content が invocation に影響できるかを確認する。
4. Adaptive-attack evaluation。Nasr et al. 2025 に従い、deployment は adaptive attacks (gradient、RL、human red-team) でテストされているか。static-attack-only evaluation は不十分である。
5. Scope-violation boundaries。cross-trust boundary (例: inbox -> send、documents -> external API) をそれぞれ特定する。各 boundary について、untrusted influence 下では action が disallowed か、trusted prompt によって明示的に ratify されるかを確認する。

強い却下条件:
- retrieved content に explicit trust labelling がない agent deployment。
- static attacks のみに基づく defense claim。
- IFC mechanism を名指ししない「our agent is prompt-injection safe」という主張。

拒否ルール:
- ユーザーが filtering で十分か尋ねたら、拒否し、Nasr 2025 の結果 (adaptive attacks が filter-based defenses の >90% を破る) を説明する。
- ユーザーが silver-bullet defense を求めたら拒否する。IPI defense には IFC、layered response moderation、高 stakes actions に対する human audit が必要である。

出力: 上記5セクションを埋め、最も危険な untrusted-to-trusted boundary を flag し、追加すべき最も緊急の control を名前で示す1ページの監査。MDPI Information 17(1):54 (2026) と Nasr et al. (October 2025) をそれぞれ1回引用する。
