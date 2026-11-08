---
id: emergent-agent-societies
title: Negotiation, Simulation and Agent Economies
code: NS
subtitle: Contract Net, OG-Narrator bargaining, Smallville memory, Theory of Mind tests, Shapley credit and second-price auctions.
hue: 30
sources: phases/16-multi-agent-and-swarms/16-negotiation-bargaining, phases/16-multi-agent-and-swarms/17-generative-agents-simulation, phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination, phases/16-multi-agent-and-swarms/21-agent-economies
source_hash: 9c7a6188a8e515ae
---

## Contract Net task market
type: flow
from: phases/16-multi-agent-and-swarms/16-negotiation-bargaining/docs/en.md, phases/16-multi-agent-and-swarms/16-negotiation-bargaining/code/main.py

1. **Manager**: decomposes the task into units.
2. **Manager**: broadcasts `cfp` with the task description to workers.
3. **Bidder**: returns a **propose** with `(price, eta, confidence)`, or a **refuse**.
4. **Manager**: keeps bids with price within budget and eta within the deadline.
5. **Manager**: picks the max of conf/price and sends **accept-proposal**.
6. **Manager**: sends **reject-proposal** to the losers. They bid on other tasks.

## Negotiation mechanisms
type: concepts
from: phases/16-multi-agent-and-swarms/16-negotiation-bargaining/docs/en.md

- **OG-Narrator**: a deterministic offer generator computes the price. The LLM only narrates.
- **Offer generator**: Rubinstein bargaining, Zeuthen strategy or tit-for-tat over price.
- **Rule**: let the LLM narrate. Do not let the LLM compute the offer.
- **Structured proposal**: the LLM drafts it. Validate it against a schema before you send.
- **CoT concealment**: winners compute strategy privately. The public channel shows the offer only.
- **Persona manipulation**: a desperation persona gives about 20% more payoff.

## Bargaining in code
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/16-negotiation-bargaining/code/main.py

```python
state = BargainState(buyer_max=buyer_max, seller_min=seller_min)
og_narrator_bargain(state, rng, concession=0.35)  # buyer offer
seller_response(state, rng, concession=0.3)       # seller counter
move = max(1, int(concession * (state.seller_offer - prior)))
candidate = min(candidate, state.buyer_max)       # never past own max
naive_llm_bargain(state, rng)          # high variance, often outside ZOPA
bench_deal_rate(buyer_fn, label, trials=1000)     # deal rate in percent
winner = max(feasible, key=lambda b: b.confidence / max(b.price, 1))
```

## Generative agent loop
type: architecture
from: phases/16-multi-agent-and-swarms/17-generative-agents-simulation/docs/en.md, phases/16-multi-agent-and-swarms/17-generative-agents-simulation/code/main.py

```arch
node | obs | 1,1 | Observation | invitation from a neighbor | client
node | stream | 2,1 | Memory stream | append-only log | store
node | retr | 3,1 | Retrieval | top-k by combined score | process
node | refl | 2,2 | Reflection | new belief back into the stream | model
node | plan | 3,2 | Plan | day, hour, action | model
node | act | 4,2 | Act | move to HobbsCafe | process
edge | obs | stream | observe
edge | stream | retr | score
edge | stream | refl | important memories
edge | refl | stream | reflection entry
edge | retr | plan | top-k
edge | plan | act | tick
```

## Memory retrieval
type: annotated-code
lang: python
from: phases/16-multi-agent-and-swarms/17-generative-agents-simulation/code/main.py

```python
top = retrieve_top_k(stream, query="party cafe", tick=4, k=3)
recency = math.exp(-0.3 * (tick - m.ts))     # exponential decay by age
importance = m.importance / 10.0              # self-rated 1 to 10
relevance = 0.6 if any(w in m.content.lower() for w in query.lower().split()) else 0.1
score = recency + importance + relevance  # sorted, keep [:k]
a.reflect(tick)          # importance >= 6 in the last 5 ticks
a.update_plan(tick)      # belief adds Plan(tick=5, where="HobbsCafe")
action = a.act(tick)     # move when the plan tick arrives
```

## Theory of Mind and coordination
type: concepts
from: phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination/docs/en.md, phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination/code/main.py

- **Zeroth-order**: no model of others. The agent acts on its own observations only.
- **First-order**: a model of each other agent's beliefs. "Alice believes X."
- **Second-order**: recursive beliefs. "Alice believes that Bob believes X."
- **ToM state**: the `other_models` attribute. Keep it as `{agent_id: belief_list}`.
- **Riedl metrics**: identity-linked differentiation, goal-directed complementarity, higher-order synergy.
- **Real signals**: complementarity over time, anticipation and correction by turn T+2.
- **Demo**: `run_trial(n_agents, n_boxes, tom, seed, max_turns=10)` counts duplications.

## Economy mechanisms in code
type: task-table
from: phases/16-multi-agent-and-swarms/21-agent-economies/code/main.py, phases/16-multi-agent-and-swarms/21-agent-economies/docs/en.md

| Task | Code |
|---|---|
| Exact Shapley, small N | `shapley_exact(value_fn, agents)` |
| Sampled Shapley | `shapley_sampled(value_fn, agents, samples, rng)` |
| Truthful auction | `second_price(bids)` |
| Winner pays | `payment = sorted_bids[1].value` |
| Reputation store | `Reputation(alpha=0.95, floor=0.1)` |
| Update after a task | `rep.update(agent, quality)` |
| Route by reputation | `weighted_choice(agents, rep.weights(agents), rng)` |

## Run the demos
type: command-table
from: phases/16-multi-agent-and-swarms/16-negotiation-bargaining/docs/en.md, phases/16-multi-agent-and-swarms/17-generative-agents-simulation/docs/en.md, phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination/docs/en.md, phases/16-multi-agent-and-swarms/21-agent-economies/docs/en.md

| Command | What it does |
|---|---|
| `python3 code/main.py` in 16-16 | Naive LLM ~65-75% deals, OG-Narrator ~85-95% |
| `python3 code/main.py` in 16-17 | 3 of 5 agents converge at the party |
| `python3 code/main.py` in 16-18 | ToM duplicates ~5%, zeroth-order ~35% |
| `python3 code/main.py` in 16-21 | Rep routing gives 10-20% quality gain |

## Defaults in the lesson code
type: defaults
from: phases/16-multi-agent-and-swarms/16-negotiation-bargaining/code/main.py, phases/16-multi-agent-and-swarms/17-generative-agents-simulation/code/main.py, phases/16-multi-agent-and-swarms/17-generative-agents-simulation/docs/en.md, phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination/code/main.py, phases/16-multi-agent-and-swarms/21-agent-economies/code/main.py

| Setting | Default | Note |
|---|---|---|
| `max_rounds` | 5 | Bargaining rounds per trial |
| Buyer `concession` | 0.35 | Seller uses 0.3 |
| Bargain `trials` | 1000 | ToM bench uses 200 |
| Retrieval `k` | 3 | Top-k memories in the prompt |
| Reflection trigger | 150 | Sum of importance of unprocessed memories |
| `max_turns` | 10 | ToM token-collection budget |
| `alpha` | 0.95 | Reputation decay |
| `floor` | 0.1 | Lowest reputation score |

## Numbers to remember
type: concepts
from: phases/16-multi-agent-and-swarms/16-negotiation-bargaining/docs/en.md, phases/16-multi-agent-and-swarms/17-generative-agents-simulation/docs/en.md, phases/16-multi-agent-and-swarms/21-agent-economies/docs/en.md

- **OG-Narrator**: deal rate from 26.67% to 88.88%.
- **Competition**: ~180k negotiations. Concealing agents won.
- **Symmetric pairs**: inequitable outcomes on about 40% of scenarios.
- **Smallville**: 25 agents. 24 had no knowledge of the party.
- **Shapley cost**: N=3 has 6 permutations. N=10 has 3.6M.
- **Shapley sampling**: 100-1000 orderings.

## Failure modes
type: troubleshooting
from: phases/16-multi-agent-and-swarms/16-negotiation-bargaining/docs/en.md, phases/16-multi-agent-and-swarms/17-generative-agents-simulation/docs/en.md, phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination/docs/en.md, phases/16-multi-agent-and-swarms/21-agent-economies/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Offers outside the ZOPA | LLM computes the price | Deterministic offer generator |
| Counterpart knows your limit | Reservation price in a visible trace | Separate private scratchpad |
| Agents enter closed stores | Spatial norm errors | Detect norm violations explicitly |
| Retrieval cost grows | Memory overflow | Summarize-and-prune, decay low importance |
| Invented relationships | Reflection hallucination | Put source memory ids in the prompt |
| Coordination only in demos | Prompt dressing, no control | Control condition and `p < 0.05` |
| Belief bound to wrong agent | Long horizon, context limits | Explicit or external ToM store |
| One operator inflates credit | Sybil attack | DIDs and reputation cost-to-forge |

## Questions
type: qa
from: phases/16-multi-agent-and-swarms/16-negotiation-bargaining/docs/en.md, phases/16-multi-agent-and-swarms/17-generative-agents-simulation/docs/en.md, phases/16-multi-agent-and-swarms/21-agent-economies/docs/en.md

- **Does a larger model bargain better?** No. It writes better language with similar strategic error.
- **Why does Contract Net scale past 100 workers?** It is broadcast-and-respond, not synchronous chat.
- **Which Smallville part can you drop?** None. Each ablation hurts believability.
- **Why second-price?** Under monotone aggregation, agents bid their true value.
- **When do agent economies make sense?** Open networks, verifiable outputs, long-horizon work.

## Ship checklist
type: tips
from: phases/16-multi-agent-and-swarms/16-negotiation-bargaining/docs/en.md, phases/16-multi-agent-and-swarms/17-generative-agents-simulation/docs/en.md, phases/16-multi-agent-and-swarms/21-agent-economies/docs/en.md

- Bound bargaining to 3-5 rounds. Escalate to a mediator on deadlock.
- Reject out-of-ZOPA offers at the protocol boundary.
- Memory is append-only. Corrections are new entries.
- Log the top-k memories that drove each action.
- Start with reputation, not tokens.
- Verify before you reward.
