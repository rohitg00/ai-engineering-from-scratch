# Agent Economies、Token Incentives、Reputation

> long-horizon autonomous agents（METR の 1-hour to 8-hour work-curve）には economic agency が必要である。 emerging **5-layer stack** は、**DePIN**（physical compute）→ **Identity**（W3C DIDs + reputation capital）→ **Cognition**（RAG + MCP）→ **Settlement**（account abstraction）→ **Governance**（Agentic DAOs）である。production agent-incentive networks には、**Bittensor**（TAO subnets が task-specific models に報酬を与える）、**Fetch.ai / ASI Alliance**（ASI-1 Mini LLM + FET token）、**Gonka**（productive AI tasks に compute を再配分する transformer-based PoW）が含まれる。academic work: AAMAS 2025 の decentralized LaMAS は **Shapley-value credit attribution** により contributing agents に公平に報酬を与える。Google Research の「Mechanism design for large language models」は monotone aggregation の下で second-price payment を行う **token auctions** を提案している。この lesson では最小の agent marketplace を構築し、multi-agent pipeline に Shapley-value credit attribution を適用し、second-price token auction を走らせて game-theory machinery を具体化する。

**種別:** 学習
**言語:** Python (stdlib)
**前提条件:** Phase 16 · 16 (Negotiation and Bargaining), Phase 16 · 09 (Parallel Swarm Networks)
**所要時間:** 約75分

## 問題

multi-agent systems は、agents が共同で価値を生むが個別に報酬を受ける必要があるとき複雑になる。classical mechanisms、つまり equal split や last-contributor-takes-all は不公平または gameable である。Shapley values による coalition-based rewarding は構成上 fair だが、計算が高い。2025-2026 literature は有用な approximations を押し出している: Shapley sampling、monotone aggregation auctions、confirmed contributions から蓄積される on-chain reputation。

credit attribution を超えて、field は実際の economic agents に向かった。Bittensor TAO は subnet-specific models を fine-tune する mining compute に報酬を与え、Fetch.ai/ASI は ASI-1 Mini LLM usage に FET tokens で報酬を与え、Gonka は transformer proof-of-work を productive AI tasks へ再配分する。自律的に取引する agents はすでに存在する。問題は incentives をどう align するかである。

この lesson は agent economies を特定の problem family、つまり credit attribution、mechanism design、reputation として扱い、ideas が定着するよう最小限の math でそれぞれを構築する。

## コンセプト

### 5-layer agent-economy stack

1. **DePIN（physical compute）。** GPU、storage、bandwidth を貸し出す decentralized infrastructure。Bittensor subnets、Render Network、Akash。agent-specific ではないが、agents が使う。
2. **Identity。** W3C Decentralized Identifiers（DIDs）は各 agent に platform から独立した durable ID を与える。reputation は DID に蓄積される。Agent Network Protocol（ANP）は discovery layer として DID を使う。
3. **Cognition。** agent の reasoning loop: LLM + RAG + MCP。これは他 phases が構築するもの。
4. **Settlement。** Account abstraction（ERC-4337）により、agents は ETH を保持せずに自分の balances から gas を払える。agents は services、互い、または compute に支払える。
5. **Governance。** Agentic DAOs: humans *and* agents が protocol changes に投票する governance structures。voting power は reputation に紐づく。

すべての production system が 5 層すべてを使うわけではない。Bittensor は 1、2、部分的に 3、部分的に 4 を使い、5 は使わない。OpenAI agents は 3 以外を使わない。stack は requirement ではなく reference map である。

### Bittensor, Fetch.ai, Gonka — 実際に動いているもの

**Bittensor（TAO）。** Subnets は specialized tasks（language modeling、image generation、forecasting）。miners が model outputs を提出する。validators が rank し、stake-weighted scoring が TAO rewards を分配する。各 subnet は独自 evaluation を持つ。economic lesson: used compute ではなく task-specific output quality に支払う。

**Fetch.ai / ASI Alliance。** ASI-1 Mini LLM は Fetch.ai の network 上で動き、users は inference に FET tokens を支払う。agents-as-peers narrative はここで強い。Fetch 上の agent は別の agent を task のために呼び、FET で支払える。

**Gonka。** Transformer proof-of-work: 「work」は transformer の forward passes である。miners は known correct outputs（training data 由来）を持つ inference tasks を実行して稼ぐ。hash-based PoW ではなく resource-productive PoW である。

3 つとも 2026 年 4 月時点で production-grade である。payoff distribution は異なる。Bittensor は subnet validators に対する quality relative で報酬を与え、Fetch は paying users が測る utility に報酬を与え、Gonka は verifiable inference work に報酬を与える。

### Shapley-value credit attribution

3 agents が task で協力する。output score は 0.8。誰が何を contribution したのか。

Shapley value は 4 axioms（efficiency、symmetry、linearity、null）を満たす unique credit allocation である。agent `i` について:

```
shapley(i) = (1/N!) * sum over all orderings O of (v(S_i_O ∪ {i}) - v(S_i_O))
```

ここで `S_i_O` は ordering `O` において `i` より前にいる agents の set である。実務的には、すべての permutations を enumerate し、各 ordering における each agent の marginal contribution を記録して平均する。

N=3 agents では 6 permutations。N=10 では 3.6M。したがって実務では enumerate ではなく orderings を sample する。

### aggregation のための second-price auction

Google Research（「Mechanism design for large language models」）は、LLM outputs を aggregate するための second-price token auctions を提案している。setup: N agents が completion を提案し、それぞれ selected されることへの private value を持つ。auctioneer は highest-value proposal を選び、*second-highest* value を支払う。monotone aggregation（value がどの proposal が選ばれたかに依存し、いくつ bid されたかには依存しない）の下で、これは truthful であり、agents は true value を bid する。

LLM systems にとって重要な理由: completion tasks を pricing の異なる複数 agents に outsource できる。auction は best を選んで fair に pay し、agents は misreport する incentive を持たない。

### Reputation capital

DID-bound reputation score は confirmed contributions から蓄積される。単純な update rule:

```
rep(i, t+1) = alpha * rep(i, t) + (1 - alpha) * contribution_quality(i, t)
```

`alpha` は 1 に近い decay factor。Reputation は:

- routing decisions で安く読める（「hard tasks は high-rep agents に送る」）。
- forge が高コスト（time とともに蓄積され、DID に bound）。
- slashing できる。verification に失敗した contributions は減点する。

### AAMAS 2025 decentralized LaMAS

LaMAS proposal（AAMAS 2025）は DID identity、Shapley-value credit attribution、simple auction mechanism を組み合わせる。key claim は、credit attribution step を decentralize すると system が auditable になり、single-point manipulation に強くなるというもの。

### economics が崩れる場所

- **Price oracle manipulation。** credit function が gameable なら agents はそれを game する。すべての mechanism には adversarial test が必要。
- **Sybil attacks。** 1 operator が N fake agents を立てて自分の contribution を inflate する。DIDs はこれを遅らせるが止めない。reputation cost-to-forge が mitigation。
- **Verification cost。** credit attribution の fairness は verifier 次第である。verification が安い（small LLM）と game される。高い（human panel）と scale しない。
- **Regulatory overhang。** Agent economies は financial regulation と交差する。Bittensor、Fetch、Gonka は 2026 年時点で一部 jurisdictions では legal gray areas で運用されている。

### agent economies が意味を持つとき

- **heterogeneous operators を持つ open networks。** 単一 team が全 agents を control していない。
- **Verifiable outputs。** verification なしでは credit attribution は推測。
- **Long-horizon workflows。** one-shot tasks は reputation accumulation の恩恵が少ない。
- **Tokenized payments が jurisdiction で legally viable** である。

closed corporate systems では、economics は simpler allocation（managers assign work、metrics are internal）に譲る。economics literature は主に open networks に当てはまる。

## 実装

`code/main.py` は次を実装する:

- `shapley(value_fn, agents)` — small N 向けの enumeration による exact Shapley computation。
- `second_price_auction(bids)` — truthful mechanism。winner は second-highest を支払う。
- `Reputation` — exponential decay と slashing を持つ DID-bound reputation。
- Demo 1: 3 agents が collaborate し、exact Shapley が credit を attribute する。
- Demo 2: 5 agents が task slot に bid し、second-price auction が winner + payment を選ぶ。
- Demo 3: heterogeneous rep を持つ agents への 100 rounds の task assignment。rep-weighted routing は random に勝つ。

Run:

```
python3 code/main.py
```

期待される出力: 各 agent の Shapley values、truthful-bid equilibrium を示す auction result、warmup 後に random より 10-20% quality gain を示す rep-weighted routing。

## Use It

`outputs/skill-economy-designer.md` は最小の agent economy を設計する。identity layer、credit attribution mechanism、payment mechanism、reputation rule を選ぶ。

## Ship It

2026 年に agent economy を運用するには:

- **tokens ではなく reputation から始める。** Reputation は実装が安く、それ単体で価値がある。tokens は legal and economic complexity を増やす。
- **reward の前に verify する。** independent verification step なしに credit を分配してはいけない。self-reported quality は sybil games を蓄積する。
- **Shapley-exact ではなく Shapley-sample。** 100-1000 orderings を sample する。exact enumeration は scale しない。
- **decay factor を cap し、reputation に floor を置く。** unbounded decay は legitimate contributors を消し、too-slow decay は stale high-rep agents に報酬を与える。
- **mechanisms を adversarial に audit する。** network を開く前に red-team scenarios を走らせる。すべての mechanism は game theory を持つ。穴は attackers ではなく自分たちが見つけるべきである。

## Exercises

1. `code/main.py` を実行する。Shapley values が total value に sum すること（efficiency axiom）を確認する。value function を変えると、Shapley allocations は期待通りに変わるか。
2. Shapley *sampling*（K orderings の Monte Carlo）を実装する。K は approximation accuracy にどう影響するか。N=4 の exact と比較する。
3. auction の前に coalition-forming step を実装する: agents は teams に merge し、unit として bid できる。どの coalitions が形成されるか。outcome は individual bidding より Pareto-better か。
4. Google Research mechanism-design post を読む。violated されると truthfulness が壊れる assumption を 1 つ特定する。LLM setting ではその failure mode はどう見えるか。
5. AAMAS 2025 decentralized LaMAS paper を読む。synthetic task 上の 10 agents に対して Shapley step を実装する。exact computation はどれだけ時間がかかるか。100 draws の sampling はどれだけ近いか。

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| DePIN | 「Decentralized physical infrastructure」 | token-incentivized compute/storage/bandwidth。Bittensor、Akash、Render。 |
| DID | 「Decentralized identifier」 | portable IDs の W3C spec。agent reputation は platform ではなく DID に bind される。 |
| ERC-4337 | 「Account abstraction」 | gas sponsorship を可能にする contract accounts。agent payments を可能にする。 |
| Shapley value | 「fair credit attribution」 | efficiency、symmetry、linearity、null を満たす unique allocation。 |
| Second-price auction | 「Vickrey auction」 | truthful mechanism。winner は second-highest bid を払う。monotone aggregation と compatible。 |
| Reputation capital | 「accumulated quality score」 | confirmed contributions から得る DID-bound score。time とともに decay。 |
| Agentic DAO | 「agents + humans govern」 | agent voters を first-class に含み、voting power が reputation に紐づく DAO。 |
| TAO / FET / GPU credits | 「token denominations」 | Bittensor TAO、Fetch.ai FET、various DePIN tokens。 |

## 参考文献

- [The Agent Economy](https://arxiv.org/abs/2602.14219) — 5-layer agent-economy stack の 2026 survey
- [Google Research — Mechanism design for large language models](https://research.google/blog/mechanism-design-for-large-language-models/) — monotone aggregation による token auctions
- [AAMAS 2025 — decentralized LaMAS](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) — Shapley-value credit attribution
- [Bittensor TAO documentation](https://docs.bittensor.com/) — subnet structure and reward distribution
- [Fetch.ai / ASI Alliance](https://fetch.ai/) — ASI-1 Mini LLM and FET token
- [W3C Decentralized Identifiers (DIDs) spec](https://www.w3.org/TR/did-core/) — identity foundation
