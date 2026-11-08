# Evidence: cheatsheets/agent-reasoning-patterns.md

Abbreviations: L01 = phases/14-agent-engineering/01-the-agent-loop, L02 = phases/14-agent-engineering/02-rewoo-plan-and-execute, L03 = phases/14-agent-engineering/03-reflexion-verbal-rl, L04 = phases/14-agent-engineering/04-tree-of-thoughts-lats, L05 = phases/14-agent-engineering/05-self-refine-and-critic, COT = phases/11-llm-engineering/02-few-shot-cot. d = docs/en.md, c = code/main.py, ap = code/advanced_prompting.py.

## Four patterns side by side (comparison)
- Roles: ReAct Thought/Action/Observation L01/d:12, 27-34. ReWOO Planner/Workers/Solver L02/d:27-31. Reflexion Actor/Evaluator/Self-Reflector L03/d:29-33. ToT/LATS policy, value function, search L04/d:27, 43-45
- LLM calls: ReAct each step carries the prior context L02/d:19, L01/d:55. ReWOO one plan call, one solve call L02/d:21. Reflexion one Actor run per trial L03/d:41. ToT one LLM call per node COT/d:194
- Observations: ReAct each step L01/d:49. Planner does not see observations L02/d:47. Reflection seen by next trial L03/d:41. Environment feedback mixes into the value function L04/d:47
- Token cost: grows quadratically with depth L02/d:19. ~5x fewer on HotpotQA L02/d:39. Re-runs slower as the buffer grows L03/d:76. 100-1000x CoT L04/d:62
- Paper result: ALFWorld +34 L01/d:39. +4 absolute accuracy L02/d:39. Beats ReAct on ALFWorld L03/d:23. 4% -> 74% L04/d:37
- Main failure: loop length explosion L01/d:69. Static plan L02/d:21. Memory rot L03/d:76. Noisy evaluator L04/d:68

## Use each pattern when (concepts)
- ReAct: L02/d:61
- ReWOO: L02/d:62
- Plan-and-Execute: L02/d:63
- Plan-and-Act (>30 steps): L02/d:64
- Reflexion: clear failure signal, reproducible task class L03/d:66-67
- ToT / LATS: cheap reliable value function, wall-clock less important L04/d:65-66
- Self-Refine: one LLM, three roles L05/d:29. No external verifier L05/d:56
- CRITIC: search, code interpreter, calculator, unit tests L05/d:49-52

## ReAct loop: AgentLoop.run (flow)
1. user turn appended: L01/c:105
2. respond(history), finish kind: L01/c:89, 107-110
3. dispatch(call): L01/c:44, 113-114
4. error strings for unknown tool and bad args: L01/c:47, 51. Not a crash: L01/d:59
5. action turn with observation appended: L01/c:115-118
6. stop conditions: L01/d:57
7. max_turns then "budget exhausted": L01/c:101, 106, 119-121

## ReWOO: plan, fetch, solve (architecture)
- Question, user_question: L02/d:28
- Planner, plan DAG, no observations: L02/d:28, 33, 47
- Worker E1 search capital: L02/c:169
- Worker E2 population of #E1: L02/c:170
- Worker E3 round_million #E2: L02/c:171
- Solver question, plan, evidence: L02/d:30
- edges topological order and #E references: L02/c:57, 78-82, L02/d:33

## Reflexion trial (flow)
1. actor.act(memory): L03/c:42, 82
2. binary_evaluator(attempt, TARGET): L03/c:53-55, 83
3. "pick larger values": L03/c:61
4. memory.add, pop oldest past max_len: L03/c:24-29, 88
5. fresh trial sees reflections: L03/d:41. Break on success: L03/c:86-87

## LATS: one MCTS iteration (flow)
1. Select with UCT formula: L04/d:53, 58
2. Expand K children: L04/d:54
3. Simulate and score: L04/d:55
4. Backpropagate visits and value_sum: L04/d:56, L04/c:116-119

## Tasks in code (task-table)
- tools.register("calculator", calculator): L01/c:141
- topological(plan): L02/c:57
- resolve_references(value, evidence): L02/c:50
- run_reflexion(max_trials=4, use_memory=True): L03/c:113
- tot_bfs(root_tot): L04/c:158
- mcts(root_lats, iterations=80, rng=rng): L04/c:171
- run_loop("world facts", use_critic=True): L05/c:109

## CoT escalation pipeline (annotated-code)
- few_shot_cot_solve line: COT/ap:338. temperature 0.0: COT/ap:187
- self_consistency_solve with n_samples=5: COT/ap:340-342. temperature 0.7: COT/ap:197. Majority vote: COT/d:562
- confidence >= 0.8 check: COT/ap:343. 4 of 5 samples: COT/d:454
- tree_of_thought_solve breadth=3, depth=2: COT/ap:352-354. Escalate: COT/d:454

## Prompt reasoning ladder (comparison)
- Zero-Shot CoT row: COT/d:315
- Few-Shot CoT row: COT/d:316
- Self-Consistency (N=5) row: COT/d:317
- Tree-of-Thought row: COT/d:319

## Defaults in the lesson code (defaults)
- max_turns 12, demo 10: L01/c:101, 159
- max_len 6: L03/c:24
- max_iters 4: L05/c:78
- c 1.4 in uct: L04/c:94
- max_expansions_per_level 8: L04/c:76
- max_depth 3: L04/c:77
- n_samples 5: COT/ap:191
- temperature 0.7, identical at 0.0: COT/ap:197, COT/d:408

## Troubleshooting (troubleshooting)
- hallucinate success on 400 errors: L01/d:68. Observation string: L01/d:59
- trust boundary collapse, only direct instructions: L01/d:67
- "cyclic plan or unresolved reference": L02/c:65-73
- memory rot, compaction, TTL: L03/d:76
- external failure, one-off flaky run: L03/d:73-74
- rubber-stamp loop, structurally different prompts: L05/d:82
- good-scoring wrong answer, noisy evaluator: L04/d:68. Reliable value function: L04/d:66

## Questions (qa)
- ReWOO tokens: L02/d:37-39
- 7B planner from 175B teacher: L02/d:47
- LATS roles under MCTS: L04/d:41-45
- refine history: L05/d:41
- hallucination looks convincing: L05/d:47
- reasoning models run CoT internally: COT/d:100

## Tips (tips)
- start with the simplest: L02/d:67
- verifier passes, max_iterations: L05/d:62, 65
- K=3-5, K=10 explodes cost: L04/outputs/skill-search-policy.md:23
