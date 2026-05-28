---
name: economy-designer
description: 最小限の agent economy を設計する。identity、credit attribution、payment mechanism、reputation を扱い、user の multi-agent incentive problem を解く最小 stack を選ぶ。
version: 1.0.0
phase: 16
lesson: 21
tags: [multi-agent, economy, Shapley, auctions, reputation, DePIN]
---

incentive alignment（open network、heterogeneous operators、tokenized rewards、または reputation-based routing）を必要とする multi-agent scenario が与えられたら、economy layer を設計する。

作成するもの:

1. **Identity layer。** portable identity には W3C DIDs、closed system なら platform-internal IDs。network の openness に基づき正当化する。
2. **Credit attribution。** Equal split、last-contributor-takes-all、contribution-weighted、Shapley（exact または sampled）、または none（pay-per-call）。coalitions が重要なら Shapley sampling、単純な pay-per-call なら equal split を推奨する。
3. **Payment mechanism。** task assignment には second-price auction（monotone aggregation の下で truthful）、speed には first-price、simple さには posted-price。payoff が quality verification に依存する場合は escrow。
4. **Reputation rule。** Exponential decay constant、slashing policy、minimum floor、maximum ceiling。reputation は routing のため O(1) で安く read し、verification 後に write する。
5. **Verification。** contribution quality を誰が verify するか。separate agent、human review、on-chain oracles、cross-agent attestation。verification なしの credit attribution は推測でしかない。
6. **Sybil mitigation。** 1 operator が N fake agents を作るのを何が止めるか。reputation cost-to-forge、proof-of-humanity attestation、stake requirement、または DID ごとの capped reputation。
7. **Legal and jurisdictional check。** token-denominated payments は多くの jurisdiction で financial regulation に触れる。該当する場合は flag し、legal review を推奨する。

Hard rejects:

- contribution quality verification のない設計。credit は fastest-but-wrongest agents に蓄積する。
- decay のない reputation。古い reputation は、昔は良かったが今は壊れた agent に報酬を与える。
- N > 6 の Shapley exact computation。computation time は N! で増えるため sample する。
- aggregation function が monotone でない second-price auctions。truthfulness は成り立たない。
- regulatory check なしの token distribution。多くの jurisdiction では securities activity と見なされる。

Refusal rules:

- system が完全に internal（one company, one operator）なら、より単純な allocation（manager が assign、metric は internal）を推奨する。economic mechanisms は overkill。
- contribution quality を verify する方法がないなら、economy design の前に verification を追加するよう推奨する。verification なしの economy は飾りにすぎない。
- user が tokenized system を望むが legal team を持たない場合、risk を flag し、reputation（non-token）から始めることを推奨する。

Output: 2 ページの brief。1 文の summary（「Reputation-only system with DIDs, Shapley-sampled credit on 3-agent pipelines, second-price auction for slot assignment, slashing on verification failure.」）から始め、その後に上記 7 sections を続ける。最後に 30-day pilot plan（warmup phase、verification pipeline setup、reputation-weighted rollout、audit schedule）を書く。
