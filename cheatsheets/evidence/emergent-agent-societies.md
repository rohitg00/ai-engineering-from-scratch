# Evidence: cheatsheets/emergent-agent-societies.md

Abbreviations: N = phases/16-multi-agent-and-swarms/16-negotiation-bargaining, G = phases/16-multi-agent-and-swarms/17-generative-agents-simulation, T = phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination, E = phases/16-multi-agent-and-swarms/21-agent-economies. d = docs/en.md, c = code/main.py.

## Contract Net task market (flow, 6 steps)
1. Manager decomposes the task: N/d:85
2. Broadcast cfp with task description: N/d:22, 86, N/c:120-122
3. Propose with (price, eta, confidence), or refuse: N/d:22, 87, N/c:124-126
4. Feasible: price <= budget and eta <= deadline: N/c:130
5. Winner = max conf/price, accept-proposal: N/c:134-135, N/d:22
6. reject-proposal to losers, losers bid on other tasks: N/c:136-138, N/d:89

## Negotiation mechanisms (concepts, 6)
- OG-Narrator deterministic offer, LLM narrates: N/d:14, 157
- Rubinstein, Zeuthen, tit-for-tat: N/d:43
- Let the LLM narrate rule: N/d:101
- Structured proposal, validate against a schema: N/d:103
- CoT concealment: N/d:62-65, 160
- Persona ~20% payoff: N/d:54, 161

## Bargaining in code (annotated-code, 8 lines)
- BargainState(buyer_max=..., seller_min=...): N/c:69
- og_narrator_bargain concession 0.35: N/c:39-40
- seller_response concession 0.3: N/c:53-54
- move = max(1, int(concession * (state.seller_offer - prior))): N/c:47
- candidate = min(candidate, state.buyer_max): N/c:49
- naive_llm_bargain high variance, outside ZOPA: N/c:23-26
- bench_deal_rate trials=1000, percent: N/c:88, 96
- winner = max(feasible, key=...): N/c:134

## Generative agent loop (architecture, 6 nodes, 6 edges)
- Observation of an invitation: G/c:93, G/d:49
- Memory stream append-only log: G/d:20, 136
- Retrieval top-k by combined score: G/d:28, 71
- Reflection back into the stream: G/d:30, G/c:51
- Plan day, hour, action: G/d:32, 141
- Act, move to HobbsCafe: G/c:58-62

## Memory retrieval (annotated-code, 8 lines)
- retrieve_top_k(stream, query="party cafe", tick=4, k=3): G/c:130
- recency = math.exp(-0.3 * (tick - m.ts)): G/c:68
- importance = m.importance / 10.0: G/c:69
- relevance 0.6 else 0.1: G/c:70
- sum of the three scores, sorted, [:k]: G/c:71-72
- reflect: importance >= 6 and tick - m.ts <= 5: G/c:45
- update_plan adds Plan(tick=5, where="HobbsCafe"): G/c:53-56
- act moves when p.tick == tick: G/c:58-62, 105

## Theory of Mind and coordination (concepts, 7)
- Zeroth-order: T/d:26
- First-order: T/d:27
- Second-order: T/d:28
- other_models attribute, {agent_id: belief_list}: T/d:78, 86
- Riedl metrics: T/d:42-44
- Complementarity, anticipation, correction by T+2: T/d:100-102
- run_trial(n_agents, n_boxes, tom, seed, max_turns=10), duplications: T/c:51, 98

## Economy mechanisms in code (task-table, 7)
- shapley_exact(value_fn, agents): E/c:18
- shapley_sampled(value_fn, agents, samples, rng): E/c:33-34
- second_price(bids): E/c:57
- payment = sorted_bids[1].value: E/c:62
- Reputation(alpha=0.95, floor=0.1): E/c:69
- rep.update(agent, quality): E/c:78, 179
- weighted_choice(agents, rep.weights(agents), rng): E/c:177

## Run the demos (command-table, 4)
- 16-16 naive ~65-75%, OG-Narrator ~85-95%: N/d:122, 125
- 16-17 3 of 5 converge: G/d:105, 108
- 16-18 ~5% vs ~35% duplication: T/d:122, 125
- 16-21 10-20% quality gain: E/d:112, 115

## Defaults in the lesson code (defaults, 8)
- max_rounds 5: N/c:20
- concession 0.35 buyer, 0.3 seller: N/c:40, 54
- trials 1000, ToM 200: N/c:88, T/c:120
- k = 3: G/c:66
- Reflection threshold 150: G/d:72
- max_turns 10: T/c:51
- alpha 0.95: E/c:69
- floor 0.1: E/c:69

## Numbers to remember (concepts, 6)
- 26.67% to 88.88%: N/d:3
- ~180k negotiations, concealment wins: N/d:62
- ~40% inequitable: N/d:56
- 25 agents, 24 without knowledge: G/d:3, 46
- N=3 6 permutations, N=10 3.6M: E/d:52
- Sample 100-1000 orderings: E/d:127

## Failure modes (troubleshooting, 8)
- Offers outside ZOPA, deterministic generation: N/d:28, 136
- Reservation price leaked, separate scratchpad: N/d:64, 69, 135
- Spatial norm errors, detect explicitly: G/d:61, 122
- Memory overflow, summarize-and-prune: G/d:62
- Reflection hallucination, source memory ids: G/d:63
- Coordination illusion, control and p < 0.05: T/d:50-54, 135-136
- Long-horizon belief mixups, explicit or external ToM store: T/d:82, 86, 88
- Sybil attack, DIDs and cost-to-forge: E/d:81

## Questions (qa, 5)
- Larger models, similar strategic error: N/d:30
- Contract Net scales past 100 workers: N/d:91
- Each ablation hurts believability: G/d:36-42
- Second-price truthful under monotone aggregation: E/d:56
- Open networks, verifiable outputs, long-horizon: E/d:87-89

## Ship checklist (tips, 6)
- 3-5 rounds, mediator on deadlock: N/d:138
- Reject out-of-ZOPA offers: N/d:137
- Memory append-only, corrections new entries: G/d:69
- Log the top-k memories: G/d:119
- Reputation, not tokens: E/d:125
- Verify before you reward: E/d:126
