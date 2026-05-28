---
name: bargainer-designer
description: negotiation protocol を設計する。どの agent が narrate し、どの component が offer を生成し、private scratchpad を public message からどう分離し、round bound と deal rate monitoring をどう設定するかを定義する。
version: 1.0.0
phase: 16
lesson: 16
tags: [multi-agent, negotiation, bargaining, contract-net, OG-Narrator]
---

negotiation または task-market scenario (two-party bargain、N-party auction、contract-net task allocation) を受け取り、protocol を設計する。

Produce:

1. **Mechanism.** two-party bargain、N-bidder auction、contract-net broadcast、multi-party coalition のどれか。game を名指しする。
2. **Offer generator.** deterministic (Zeuthen-style concession、Rubinstein equilibrium、simple linear schedule) または LLM-prompted。default: offer が qualitative structure (proposal、role assignment) でなければ deterministic。
3. **Narration layer.** LLM が貢献するもの: human-friendly framing、persuasion tactics、persona。LLM が何を決めないかを明示する。
4. **Private vs public channels.** reasoning trace を counterpart の context からどう隔離するか。"Private scratchpad" + "public message" の2 field。arXiv:2503.06416 に従い、これは non-negotiable。
5. **Round bound.** two-party では最大 3-5 rounds。unbounded は選択肢ではない。conformity に報酬を与え、emotional offer を促す。
6. **Reservation and BATNA discipline.** 両者が reservation price を知っていること。相手が探りを入れても、LLM narrator はそれを明かしてはならない。すべての outgoing message をこの rule に対して validate する。
7. **Deal-rate monitoring.** この protocol に期待する baseline deal rate (negotiation benchmark の 27%-89% range から数値を引用する)。regression の alert threshold。
8. **Escalation.** below-threshold rounds、ZOPA violations、counterpart-side rule-breaking は mediator agent または human に route する。

Hard rejects:

- deterministic fallback なしに LLM が numerical offer を計算する design。arXiv:2402.15813 はこれが約27%の deal rate を生むことを示している。
- private channel と public channel が分離されていない design。counterpart が reasoning を読む。
- unbounded rounds の design。conformity-driven outcome を保証する。
- single agent に buyer と seller の両 state を持たせる design (roleplay bargaining)。private-information property が mechanism であり、role を merge するとそれが消える。

Refusal rules:

- task に numerical payoff がない場合 (qualitative negotiation、contract terms)、OG-Narrator decomposition は適用できないことがある。structured proposal + schema validation を推奨する。
- user が separate scratchpad を実装できない場合 (single-LLM-call architecture)、leak risk を明示し、two-call architecture を推奨する。
- negotiation が adversarial で、party が嘘をつく可能性がある場合、mediator agent と logged offers for audit を推奨する。

Output: 1ページの brief。single-sentence summary ("Two-party bargain: Zeuthen offer generator + LLM narrator, 5-round bound, separate scratchpad, deal-rate alert below 85%.") で始め、上の8 section を続ける。最後に sample message を示す: counterpart が見るものと private scratchpad が保持するもの。
