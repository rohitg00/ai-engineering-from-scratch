# Negotiation and Bargaining

> Agents negotiate resources, prices, task allocations, and terms. The 2026 benchmark set is clear: NegotiationArena (arXiv:2402.05863) shows LLMs can improve payoffs ~20% via persona manipulation ("desperation"); "Measuring Bargaining Abilities" (arXiv:2402.15813) shows buyer is harder than seller and scale does not help — their **OG-Narrator** (deterministic offer generator + LLM narrator) pushed deal rate from 26.67% to 88.88%; the Large-Scale Autonomous Negotiation Competition (arXiv:2503.06416) ran ~180k negotiations and found that **chain-of-thought-concealing** agents win by hiding reasoning from counterparts; Bhattacharya et al. 2025 on Harvard Negotiation Project metrics ranked Llama-3 most-effective, Claude-3 aggressive, GPT-4 fairest. This lesson implements Contract Net Protocol (the FIPA ancestor, Lesson 02), wires an LLM-style buyer/seller, runs an OG-Narrator-style decomposition, and measures how deal rate changes with each structural choice.

**Type:** Learn + Build
**Languages:** Python (stdlib)
**Prerequisites:** Phase 16 · 02 (FIPA-ACL Heritage), Phase 16 · 09 (Parallel Swarm Networks)
**Time:** ~75 minutes

## Problem

Two agents need to agree on a price. Left to themselves with pure language prompts, 2024-2026 LLMs close deals at surprisingly low rates (~27% on tightly-parameterized bargains in arXiv:2402.15813). Scale does not fix it: GPT-4 is not structurally better at bargaining than GPT-3.5; it is better at the *language* of bargaining.

The root issue is that LLMs conflate two jobs — deciding the offer and narrating the offer. OG-Narrator separated these: a deterministic offer generator computes numeric moves; the LLM only narrates. Deal rate jumps to ~89%.

This mirrors a classical multi-agent finding: decoupling the mechanism from the communication layer wins. Contract Net Protocol (FIPA, 1996; Smith, 1980) is the reference task-market mechanism. Plug an LLM into the narration slot and you get a modern LLM-powered task market.

## Concept

### Contract Net, in one paragraph

Smith's 1980 Contract Net Protocol: a **manager** broadcasts a **call for proposals (cfp)**; **bidders** respond with **propose** messages containing their offers; the manager picks a winner and sends **accept-proposal** to the winner and **reject-proposal** to the losers. The winner performs the work. Optional message: **refuse** (bidder declines to propose). FIPA codified this as `fipa-contract-net` interaction protocol.

### Why OG-Narrator wins

"Measuring Bargaining Abilities of Language Models" (arXiv:2402.15813) observed that:

- LLMs often break the bargaining rules (offer at nonsensical prices, ignore the other side's ZOPA).
- They anchor poorly (accept bad first offers; counter-offer at symbolic rather than strategic amounts).
- Scale alone does not fix these. Larger models make more-plausible language with similar strategic error.

The OG-Narrator decomposition:

```
           ┌──────────────────┐        ┌──────────────────┐
  state  → │ offer generator  │ price → │  LLM narrator    │ → message
           │  (deterministic) │        │  (writes the     │
           │                  │        │   human-style    │
           └──────────────────┘        │   accompaniment) │
                                       └──────────────────┘
```

The offer generator is a classical negotiation strategy: a Rubinstein bargaining model, a Zeuthen strategy, or a simple tit-for-tat over price. The LLM narrates. The message contains the deterministic price and the natural-language framing.

Deal rate jumps because:
- Prices stay in the bargaining zone.
- Anchors are strategic, not emotional.
- The LLM does what it is good at: writing.

### NegotiationArena findings

arXiv:2402.05863 provides the canonical benchmark. Headline findings:

- LLMs can improve payoffs ~20% by adopting personas ("I am desperate to sell this by Friday") — persona manipulation is a real tactic.
- Fair/cooperative agents are exploited by adversarial ones; defense requires explicit counter-posturing.
- Symmetric pair-ups converge to inequitable outcomes on about 40% of the benchmark scenarios.

This is not "LLMs are bad negotiators." It is "LLMs negotiate too much like humans, including the exploitable parts."

### Chain-of-thought concealment

The Large-Scale Autonomous Negotiation Competition (arXiv:2503.06416) ran ~180k negotiations across many LLM strategies. Winners concealed their reasoning from counterparts:

- If an agent prints "I will only go to $75; my reservation price is $70" into a publicly visible scratchpad, the opponent reads it.
- Winners compute strategy privately; the output channel contains only the offer and minimum required narration.

This is a 2026 echo of classical game theory (Aumann 1976 on rationality and information): revealing your private valuation costs payoff. LLMs do not intuit this and happily type their reservations in reasoning traces that become visible to the counterpart.

Engineering takeaway: separate private-scratchpad context from public-message context. Not optional.

### Bhattacharya et al. 2025 — model rankings

On Harvard Negotiation Project metrics (principled negotiation, BATNA respect, interest reciprocity):

- **Llama-3** was most-effective at striking bargains (deal rate + payoff).
- **Claude-3** was the most-aggressive negotiator (high anchors, late concessions).
- **GPT-4** was the fairest (smallest variance in payoff across pairings).

This is a 2025 snapshot. The point is not which model wins in April 2026 — it is that different base models have persistent negotiation styles. Heterogeneous ensembles (Lesson 15) include this as a diversity source.

### Task allocation via Contract Net + LLM

The modern re-use of Contract Net for LLM multi-agent:

1. Manager agent decomposes a task into units.
2. Broadcasts `cfp` with task description to worker agents.
3. Each worker returns an offer: `(price, eta, confidence)` where price could be tokens, compute units, or dollars.
4. Manager picks winners (single or multiple, depending on task) and awards.
5. Rejected workers are free to bid on other tasks.

This scales well past 100 workers because coordination is broadcast-and-respond, not synchronous chat. Used in production: Microsoft Agent Framework's orchestration patterns, some LangGraph implementations.

### LLM-Stakeholders Interactive Negotiation

NeurIPS 2024 (https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) introduces multi-party scorable games with **secret scores** and **minimum-acceptance thresholds**. Each stakeholder has private utilities; the LLM must infer them from messages. This is the generalization of two-party bargaining to N-party coalition formation. Relevant for production task markets with heterogeneous worker capabilities.

### The narration-vs-mechanism rule

Across all 2024-2026 negotiation benchmarks, the consistent engineering rule is:

> Let the LLM narrate. Do not let the LLM compute the offer.

If the offer needs to be a number (price, ETA, quantity), generate it deterministically from the negotiation state and have the LLM produce the framing. If the offer needs to be a proposal structure (task decomposition, role assignment), let the LLM draft it, but validate it against a schema and constraint-check before sending.

## Build It

`code/main.py` implements:

- `ContractNetManager`, `ContractNetTask`, `Bid` — manager + bidders, broadcast cfp, collect proposals, award.
- `og_narrator_bargain(state, rng)` — OG-Narrator buyer: deterministic Zeuthen-style concession toward the midpoint.
- `seller_response(state, rng)` — deterministic seller counter-offer policy (the structural ground truth for both styles).
- `naive_llm_bargain(state, rng)` — simulates an all-LLM bargainer: picks prices with high variance, often outside the ZOPA.
- Measurement: deal rate over 1000 trials with fresh reservation prices sampled per trial.

Run:

```
python3 code/main.py
```

Expected output: naive-LLM deal rate ~65-75%; OG-Narrator deal rate ~85-95%; the 15-25 point gap is the structural advantage of decomposing offer-generation from narration. Plus a Contract Net task-market allocation example with three bidders and one task.

## Use It

`outputs/skill-bargainer-designer.md` designs a bargaining protocol: who generates offers (deterministic or LLM), who narrates, how private scratchpads separate from public messages, and how deal rate is monitored.

## Ship It

Production bargaining checklist:

- **Separate scratchpad.** Private state never reaches the counterpart's context. This is non-negotiable.
- **Deterministic offer generation.** Prices, quantities, ETAs: compute, do not prompt.
- **Validate all incoming offers** against a schema. Reject out-of-ZOPA offers at the protocol boundary.
- **Bound rounds.** 3-5 rounds maximum; escalate to mediator on deadlock.
- **Measure deal rate and payoff variance** continuously. A falling deal rate is a symptom — often a prompt drift or a counterpart-side attack.
- **Log all rejected proposals** with the deterministic rationale. For Contract Net managers, losing bidders need to understand why.

## Exercises

1. Run `code/main.py`. Confirm OG-Narrator beats naive-LLM on deal rate. By how much?
2. Implement **persona-based payoff improvement** (arXiv:2402.05863) — the buyer adopts a "desperate to buy this week" persona in the narration only, offer generator unchanged. Does the deal rate or payoff change?
3. Implement chain-of-thought **concealment**: maintain a private scratchpad string that is not passed to the counterpart. What happens if you accidentally leak it (simulate by swapping the channels)?
4. Extend Contract Net to N-bidder auction with reserve price. When bids all exceed reserve, how does the manager decide between lowest-price and highest-quality? Which award rule do you pick and why?
5. Read Bhattacharya et al. 2025 on Harvard Negotiation Project metrics. Implement two bargainers with different styles (aggressive vs fair). Measure payoff variance under symmetric and asymmetric pairings.

## Key Terms

| Term | What people say | What it actually means |
|------|----------------|------------------------|
| Contract Net | "Task market" | Smith 1980, FIPA 1996. cfp + propose + accept/reject. The canonical task-market. |
| ZOPA | "Zone of possible agreement" | Overlap between buyer's max and seller's min. Offers outside it cannot close. |
| BATNA | "Best alternative to a negotiated agreement" | Your fallback if this deal fails. Sets your reservation price. |
| OG-Narrator | "Offer generator + narrator" | Decomposition: deterministic offer, LLM narration. |
| Zeuthen strategy | "Risk-minimizing concession" | Classical offer-generator that concedes based on risk limits. |
| Rubinstein bargaining | "Alternating-offer equilibrium" | Game-theoretic model for infinite-horizon bargaining with discounting. |
| CoT concealment | "Hide your reasoning" | Winners in arXiv:2503.06416 kept private scratchpads; public channel shows offer only. |
| Persona manipulation | "Emotional posturing" | arXiv:2402.05863: ~20% payoff gain from desperation/urgency personas. |

## Further Reading

- [NegotiationArena](https://arxiv.org/abs/2402.05863) — the benchmark; persona manipulation and exploitation findings
- [Measuring Bargaining Abilities of Language Models](https://arxiv.org/abs/2402.15813) — OG-Narrator and the buyer-harder-than-seller result
- [Large-Scale Autonomous Negotiation Competition](https://arxiv.org/abs/2503.06416) — ~180k negotiations; chain-of-thought concealment wins
- [LLM-Stakeholders Interactive Negotiation (NeurIPS 2024)](https://proceedings.neurips.cc/paper_files/paper/2024/file/984dd3db213db2d1454a163b65b84d08-Paper-Datasets_and_Benchmarks_Track.pdf) — multi-party scorable games with secret utilities
- [Smith 1980 — The Contract Net Protocol](https://ieeexplore.ieee.org/document/1675516) — the classical mechanism, IEEE Transactions on Computers
