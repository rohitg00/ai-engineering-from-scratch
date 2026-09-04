---
name: search-policy
description: Pick a search strategy (ReAct, ToT, LATS, evolutionary) given task shape, token budget, and evaluator quality.
version: 1.0.0
phase: 14
lesson: 04
tags: [tree-of-thoughts, lats, mcts, search, value-function]
---

Given a task shape (single-answer / multi-answer / open-ended), a token budget, and an available evaluator (scalar test / heuristic / self-eval), produce a search strategy recommendation with concrete parameters.

Produce:

1. Decision. One of: linear ReAct, beam ToT (with beam width k), BFS ToT (with max depth), DFS ToT with pruning, MCTS LATS (with iterations and UCT c), evolutionary search (only if evaluator is programmatic and checkable).
2. Parameters. For every strategy, concrete numeric defaults: beam width, depth cap, branching factor K, rollouts per level, UCT c (default 1.4), timeout.
3. Value function. Specify exactly what scores a node. Options: unit-test pass rate, numeric distance to target, prompted LLM score with format (sure/likely/impossible or 1..10 or vote), or environment reward.
4. Token budget estimate. Worst-case tokens = branching_factor ^ depth * avg_prompt_tokens. Show the number. If it exceeds the user's budget, recommend a cheaper strategy.
5. Failure modes. For each chosen strategy, list the top-two failure modes and their mitigations (e.g. LATS + noisy evaluator -> add tool-grounded verification per CRITIC, Lesson 05).

Hard rejects:

- Recommending search when the evaluator is unreliable (self-eval only, no ground truth). Fall back to ReAct + CRITIC.
- Setting branching factor K higher than 5 without a compelling reason. K=3-5 is the paper default; K=10 explodes cost.
- Applying LATS to chat-style tasks. Search does not help conversational Q&A with no programmatic target.
- Evolutionary search without a machine-checkable fitness. AlphaEvolve is only interesting when fitness is programmatic (run tests, measure speed, verify theorem).

Refusal rules:

- If token budget < 5x single-trajectory cost, refuse search and recommend ReAct + Reflexion (Lesson 03).
- If wall-clock latency budget < 10 seconds, refuse LATS and recommend ReAct.
- If the task is pure information retrieval, refuse search and recommend ReWOO (Lesson 02).

Output: a recommendation block (chosen strategy, parameters, value function, budget estimate) plus a "what to read next" note pointing to Lesson 05 (CRITIC) for evaluator reliability, Lesson 11 (AlphaEvolve) for evolutionary variants, or Lesson 30 (eval-driven development) for benchmark-grade validation.
