---
name: fipa-mapper
description: 2026 年の任意の agent-protocol spec (MCP, A2A, ACP, ANP, CA-MCP, NLIP, または新規 spec) を FIPA-ACL performatives と interaction protocols に map し、どこが本当に新しく、どこが再発明かを判断する。
version: 1.0.0
phase: 16
lesson: 02
tags: [multi-agent, protocols, FIPA, speech-acts, interoperability]
---

新しい agent-protocol spec が与えられたら、reader が reinvention と genuine new structure を見分けられるように FIPA-ACL mapping を作成する。

生成するもの:

1. **Envelope mapping.** spec が定義する各 message type について、最も近い FIPA performative (`inform`, `request`, `query-if`, `query-ref`, `propose`, `accept-proposal`, `reject-proposal`, `cfp`, `subscribe`, `cancel`, `failure`, `not-understood`, または約 20 個のうちの他のもの) を挙げる。合う performative がなければ、gap を正確に説明する。
2. **Correlation model.** spec は requests と replies、cancellation と original request、streamed events と subscribe をどう correlate するか。FIPA の `:conversation-id` と `:reply-with` fields と比較する。
3. **Content-language stance.** spec は content schema (typed artifacts, JSON-Schema) を必須にするか、natural language を受け入れるか、open にするか。FIPA の SL0/SL1 と ontology fields と比較する。
4. **Interaction-protocol library.** spec 上で実装できる FIPA interaction protocols はどれか: contract-net、subscribe-notify、request-when、propose-accept。それぞれを実装する messages を挙げる。
5. **Discovery model.** agent は counterparties と capabilities をどう見つけるか (MCP `listTools`、A2A Agent Card、ANP DID + meta-protocol)。FIPA の directory facilitator と yellow-pages service と比較する。
6. **Reinvention vs novelty.** 3 columns の short table を作る: [FIPA concept, modern spec equivalent, what changed]。各 row を [reinvention] または [novel-structure] と mark する。spec が FIPA にはない primitive を導入している場合のみ "novel-structure" とする。common candidates は decentralized identity、typed multimodal artifacts、LLM-interpretable content。

強制 reject:

- FIPA にはない primitive を示さずに spec を "revolutionary" と主張する mapping。failure mode は speech-act theory + ontology overhead であって、primitives ではない。
- discovery layer を無視した framework comparisons。discovery のない spec は incomplete であり novel ではない。
- content meaning について 2 agents が disagree した場合 (semantic drift) を扱わずに "Protocol X replaces FIPA" と述べること。

拒否ルール:

- spec が pre-standardization (draft < 6 months old、public implementations なし) の場合、mapping は provisional と明記し、最も変わりそうな 3 点を flag する。
- spec が closed-source または enterprise-only (一部 ACP flavors) の場合、documented な範囲を map し、gaps を挙げる。
- user が blog post だけを提供し spec document がない場合、mapping 前に spec を求める。

出力: 1 ページの brief。single-sentence summary ("Protocol X is FIPA `request`/`subscribe` with JSON syntax and a DID-based discovery layer.") で始め、上記 6 sections を続け、最後に "Which old FIPA failure mode will this spec rediscover?" に答える closing paragraph を置く。
