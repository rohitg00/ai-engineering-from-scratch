# Agent Economies, Token Incentives, Reputation

> Long-horizon autonomous agents (METR's 1-hour to 8-hour work-curve) need economic agency. The emerging **5-layer stack** is: **DePIN** (physical compute) → **Identity** (W3C DIDs + reputation capital) → **Cognition** (RAG + MCP) → **Settlement** (account abstraction) → **Governance** (Agentic DAOs). Production agent-incentive networks include **Bittensor** (TAO subnets reward task-specific models), **Fetch.ai / ASI Alliance** (ASI-1 Mini LLM + FET token), and **Gonka** (transformer-based PoW that reallocates compute to productive AI tasks). Academic work: AAMAS 2025's decentralized LaMAS uses **Shapley-value credit attribution** to fairly reward contributing agents; Google Research "Mechanism design for large language models" proposes **token auctions** with second-price payment under monotone aggregation. This lesson builds a minimal agent marketplace, applies Shapley-value credit attribution to a multi-agent pipeline, and runs a second-price token auction so the game-theory machinery lands concretely.

**Type:** Learn
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 16 (Negotiation and Bargaining), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Problem

Multi-agent systems get complicated when agents produce value jointly but need to be rewarded individually. Classical mechanisms — equal split, last-contributor-takes-all — are unfair or gameable. Coalition-based rewarding via Shapley values is fair by construction but expensive to compute. The 2025-2026 literature pushes useful approximations: Shapley sampling, monotone aggregation auctions, and on-chain reputation that accrues from confirmed contributions.

Beyond credit attribution, the field has turned to actual economic agents: Bittensor TAO rewards mining compute to fine-tune subnet-specific models, Fetch.ai/ASI rewards ASI-1 Mini LLM usage with FET tokens, Gonka reallocates transformer proof-of-work toward productive AI tasks. Agents that transact autonomously exist today; the question is how to align incentives.

This lesson treats agent economies as a specific problem family — credit attribution, mechanism design, and reputation — and builds each with the minimal math so the ideas stick.

## Concept

### The 5-layer agent-economy stack

1. **DePIN (physical compute).** Decentralized infrastructure that rents GPU, storage, bandwidth. Bittensor subnets, Render Network, Akash. Not agent-specific; agents use it.
2. **Identity.** W3C Decentralized Identifiers (DIDs) give each agent a durable ID independent of any platform. Reputation accrues to the DID. The Agent Network Protocol (ANP) uses DID as the discovery layer.
3. **Cognition.** The agent's reasoning loop: LLM + RAG + MCP. This is what the other phases build.
4. **Settlement.** Account abstraction (ERC-4337) lets agents pay gas from their own balances without holding ETH. Agents can pay for services, each other, or compute.
5. **Governance.** Agentic DAOs: governance structures where humans *and* agents vote on protocol changes, with voting power tied to reputation.

Not every production system uses all five. Bittensor uses 1, 2, partially 3, partially 4, none of 5. OpenAI agents use none except 3. The stack is a reference map, not a requirement.

### Bittensor, Fetch.ai, Gonka — what runs

**Bittensor (TAO).** Subnets are specialized tasks (language modeling, image generation, forecasting). Miners submit model outputs. Validators rank them; stake-weighted scoring distributes the TAO rewards. Each subnet has its own evaluation. The economic lesson: pay for task-specific output quality, not compute used.

**Fetch.ai / ASI Alliance.** ASI-1 Mini LLM runs on Fetch.ai's network; users pay FET tokens for inference. The agents-as-peers narrative is stronger here: an agent on Fetch can call another for a task and pay in FET.

**Gonka.** Transformer proof-of-work: the "work" is forward passes of a transformer. Miners earn by running inference tasks that have known correct outputs (from training data). Resource-productive PoW instead of hash-based PoW.

All three are production-grade as of April 2026. Payoff distribution differs. Bittensor rewards quality relative to subnet validators; Fetch rewards utility measured by paying users; Gonka rewards verifiable inference work.

### Shapley-value credit attribution

Three agents collaborate on a task. The output scores 0.8. Who contributed what?

Shapley value: the unique credit allocation satisfying four axioms (efficiency, symmetry, linearity, null). For agent `i`:

```
shapley(i) = (1/N!) * sum over all orderings O of (v(S_i_O ∪ {i}) - v(S_i_O))
```

where `S_i_O` is the set of agents before `i` in ordering `O`. In practice: enumerate all permutations, record marginal contribution of each agent in each permutation, average.

For N=3 agents, there are 6 permutations. For N=10, 3.6M — so in practice you sample orderings rather than enumerate.

### Second-price auction for aggregation

Google Research ("Mechanism design for large language models") proposes second-price token auctions for aggregating LLM outputs. Setup: N agents each propose a completion; each has a private value for being selected. The auctioneer picks the highest-value proposal and pays the *second-highest* value. Under monotone aggregation (value depends on which proposal is chosen, not how many were bid), this is truthful — agents bid their true value.

Why this matters for LLM systems: you can outsource completion tasks to multiple agents with different pricing; the auction picks the best + pays fairly, and agents have no incentive to misreport.

### Reputation capital

A DID-bound reputation score accumulates from confirmed contributions. A simple update rule:

```
rep(i, t+1) = alpha * rep(i, t) + (1 - alpha) * contribution_quality(i, t)
```

With decay factor `alpha` close to 1. Reputation:

- Is cheap to read for routing decisions ("send hard tasks to high-rep agents").
- Is expensive to forge (accumulates over time, bound to DID).
- Can be slashed: contributions that fail verification subtract.

### AAMAS 2025 decentralized LaMAS

The LaMAS proposal (AAMAS 2025) combines: DID identity, Shapley-value credit attribution, and a simple auction mechanism. The key claim: decentralizing the credit attribution step makes the system auditable and immune to single-point manipulation.

### Where the economics falls apart

- **Price oracle manipulation.** If the credit function can be gamed, agents will game it. Every mechanism needs an adversarial test.
- **Sybil attacks.** One operator spins up N fake agents to inflate their own contribution. DIDs slow but do not stop this; reputation cost-to-forge is the mitigation.
- **Verification cost.** Credit attribution is only as fair as the verifier. If verification is cheap (small LLM), it can be gamed; if expensive (human panel), the system does not scale.
- **Regulatory overhang.** Agent economies intersect with financial regulation. Bittensor, Fetch, and Gonka all operate in legal gray areas in some jurisdictions as of 2026.

### When agent economies make sense

- **Open networks with heterogeneous operators.** No single team controls all agents.
- **Verifiable outputs.** Without verification, credit attribution is a guess.
- **Long-horizon workflows.** One-shot tasks do not benefit from reputation accumulation.
- **Tokenized payments are legally viable** in your jurisdiction.

In closed corporate systems, economics gives way to simpler allocation (managers assign work, metrics are internal). The economics literature applies mostly to open networks.

## Build It

`code/main.py` implements:

- `shapley(value_fn, agents)` — exact Shapley computation by enumeration for small N.
- `second_price_auction(bids)` — truthful mechanism; winner pays second-highest.
- `Reputation` — DID-bound reputation with exponential decay and slashing.
- Demo 1: three agents collaborate, exact Shapley attributes credit.
- Demo 2: five agents bid for a task slot; second-price auction picks winner + payment.
- Demo 3: 100 rounds of task assignment to agents with heterogeneous rep; rep-weighted routing beats random.

Run:

```
python3 code/main.py
```

Expected output: Shapley values for each agent; auction result showing truthful-bid equilibrium; rep-weighted routing showing 10-20% quality gain over random after warmup.

## Use It

`outputs/skill-economy-designer.md` designs a minimal agent economy: choice of identity layer, credit attribution mechanism, payment mechanism, reputation rule.

## Ship It

Running an agent economy in 2026:

- **Start with reputation, not tokens.** Reputation is cheap to implement and valuable alone; tokens add legal and economic complexity.
- **Verify before you reward.** Never distribute credit without an independent verification step. Self-reported quality accrues sybil games.
- **Shapley-sample, not Shapley-exact.** Sample 100-1000 orderings; exact enumeration does not scale.
- **Cap decay factor and floor reputation.** Unbounded decay wipes legitimate contributors; too-slow decay rewards stale high-rep agents.
- **Audit mechanisms adversarially.** Run red-team scenarios before opening the network. Every mechanism has a game theory; you want to find the holes, not the attackers.

## Exercises

1. Run `code/main.py`. Confirm Shapley values sum to total value (efficiency axiom). Change the value function; do Shapley allocations change in the expected direction?
2. Implement Shapley *sampling* (Monte Carlo over K orderings). How does K affect approximation accuracy? Compare to exact for N=4.
3. Implement a coalition-forming step before the auction: agents can merge into teams and bid as a unit. Which coalitions form? Is the outcome Pareto-better than individual bidding?
4. Read the Google Research mechanism-design post. Identify one assumption that, if violated, breaks truthfulness. What does that failure mode look like in an LLM setting?
5. Read the AAMAS 2025 decentralized LaMAS paper. Implement their Shapley step over 10 agents on a synthetic task. How long does exact computation take? How close does sampling get with 100 draws?

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| DePIN | "Decentralized physical infrastructure" | Token-incentivized compute/storage/bandwidth. Bittensor, Akash, Render. |
| DID | "Decentralized identifier" | W3C spec for portable IDs. Agent reputation binds to DID, not to a platform. |
| ERC-4337 | "Account abstraction" | Contract accounts that can sponsor gas, enabling agent payments. |
| Shapley value | "Fair credit attribution" | Unique allocation satisfying efficiency, symmetry, linearity, null. |
| Second-price auction | "Vickrey auction" | Truthful mechanism: winner pays second-highest bid. Monotone aggregation compatible. |
| Reputation capital | "Accumulated quality score" | DID-bound score from confirmed contributions; decays over time. |
| Agentic DAO | "Agents + humans govern" | DAO with agent voters as first-class, voting power tied to reputation. |
| TAO / FET / GPU credits | "Token denominations" | Bittensor TAO, Fetch.ai FET, various DePIN tokens. |

## Further Reading

- [The Agent Economy](https://arxiv.org/abs/2602.14219) — 2026 survey of the 5-layer agent-economy stack
- [Google Research — Mechanism design for large language models](https://research.google/blog/mechanism-design-for-large-language-models/) — token auctions with monotone aggregation
- [AAMAS 2025 — decentralized LaMAS](https://www.ifaamas.org/Proceedings/aamas2025/pdfs/p2896.pdf) — Shapley-value credit attribution
- [Bittensor TAO documentation](https://docs.bittensor.com/) — subnet structure and reward distribution
- [Fetch.ai / ASI Alliance](https://fetch.ai/) — ASI-1 Mini LLM and FET token
- [W3C Decentralized Identifiers (DIDs) spec](https://www.w3.org/TR/did-core/) — identity foundation
