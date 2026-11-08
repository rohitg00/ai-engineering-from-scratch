---
id: agent-reasoning-patterns
title: ReAct, ReWOO, Reflexion and Tree of Thoughts
code: RR
subtitle: Pick, build and stop an agent reasoning loop. ReAct, ReWOO, Reflexion, ToT, LATS, Self-Refine, CRITIC and CoT.
hue: 280
sources: phases/14-agent-engineering/01-the-agent-loop, phases/14-agent-engineering/02-rewoo-plan-and-execute, phases/14-agent-engineering/03-reflexion-verbal-rl, phases/14-agent-engineering/04-tree-of-thoughts-lats, phases/14-agent-engineering/05-self-refine-and-critic, phases/11-llm-engineering/02-few-shot-cot
source_hash: f39d998186f057e3
---

## Four patterns side by side
type: comparison
span: 2
from: phases/14-agent-engineering/01-the-agent-loop/docs/en.md, phases/14-agent-engineering/02-rewoo-plan-and-execute/docs/en.md, phases/14-agent-engineering/03-reflexion-verbal-rl/docs/en.md, phases/14-agent-engineering/04-tree-of-thoughts-lats/docs/en.md, phases/11-llm-engineering/02-few-shot-cot/docs/en.md

| Factor | ReAct | ReWOO | Reflexion | ToT / LATS |
|---|---|---|---|---|
| Roles | Thought, Action, Observation | Planner, Workers, Solver | Actor, Evaluator, Self-Reflector | Policy, value function, search |
| LLM calls | One for each step | One plan, one solve | One run for each trial | One for each node |
| Observations | In every step | Not in the planner | As reflections in the next trial | Mixed into the value function |
| Token cost | Grows with depth | About 5x fewer on HotpotQA | Grows with the buffer | 100-1000x CoT |
| Paper result | ALFWorld +34 points | HotpotQA +4 accuracy | Beats ReAct on ALFWorld | Game of 24: 4% to 74% |
| Main failure | Loop length explosion | Static plan | Memory rot | Noisy evaluator |

## Use each pattern when
type: concepts
from: phases/14-agent-engineering/02-rewoo-plan-and-execute/docs/en.md, phases/14-agent-engineering/03-reflexion-verbal-rl/docs/en.md, phases/14-agent-engineering/04-tree-of-thoughts-lats/docs/en.md, phases/14-agent-engineering/05-self-refine-and-critic/docs/en.md

- **ReAct**: short tasks, unknown environment, reactive exception handling.
- **ReWOO**: structured tasks with known tools and parallel evidence.
- **Plan-and-Execute**: like ReWOO, with replanning after partial execution.
- **Plan-and-Act**: long horizon (>30 steps), web, mobile or computer use.
- **Reflexion**: a clear failure signal and a task class that repeats.
- **ToT / LATS**: a cheap, reliable value function. Correctness beats wall-clock.
- **Self-Refine**: no external verifier. One model generates and critiques.
- **CRITIC**: an external verifier exists: search, code, calculator, tests.

## ReAct loop: AgentLoop.run
type: flow
from: phases/14-agent-engineering/01-the-agent-loop/code/main.py, phases/14-agent-engineering/01-the-agent-loop/docs/en.md

1. **User**: the message goes into the history as a `user` turn.
2. **LLM**: `respond(history)` returns a thought and an action, or `finish`.
3. **ToolRegistry**: `dispatch(call)` runs the tool by name.
4. **Formatter**: a bad tool or bad args returns an `error:` string, not a crash.
5. **Loop**: the action turn and its observation go into the history. Go to step 2.
6. **Stop**: `finish`, no tool calls, max turns, max tokens or a guardrail trip.
7. **Budget**: after `max_turns` the loop returns "budget exhausted".

## ReWOO: plan, fetch, solve
type: architecture
from: phases/14-agent-engineering/02-rewoo-plan-and-execute/code/main.py, phases/14-agent-engineering/02-rewoo-plan-and-execute/docs/en.md

```arch
node | q | 1,2 | Question | user_question | client
node | plan | 2,2 | Planner | plan DAG, no observations | model
node | e1 | 3,1 | Worker E1 | search capital | process
node | e2 | 3,2 | Worker E2 | population of #E1 | process
node | e3 | 3,3 | Worker E3 | round_million #E2 | process
node | solve | 4,2 | Solver | question, plan, evidence | model
edge | q | plan |
edge | plan | e1 | topological
edge | e1 | e2 | #E1
edge | e2 | e3 | #E2
edge | e3 | solve | evidence
```

## Reflexion trial
type: flow
from: phases/14-agent-engineering/03-reflexion-verbal-rl/code/main.py, phases/14-agent-engineering/03-reflexion-verbal-rl/docs/en.md

1. **Actor**: `actor.act(memory)` returns a candidate trajectory.
2. **Evaluator**: `binary_evaluator(attempt, TARGET)` returns success and delta.
3. **Self-Reflector**: writes one line, for example "pick larger values".
4. **EpisodicMemory**: `memory.add` stores it. The oldest drops past `max_len`.
5. **Next trial**: starts fresh but sees the reflections. A success ends the run.

## LATS: one MCTS iteration
type: flow
from: phases/14-agent-engineering/04-tree-of-thoughts-lats/docs/en.md, phases/14-agent-engineering/04-tree-of-thoughts-lats/code/main.py

1. **Select**: walk from root to a leaf by `Q(s, a) + c * sqrt(ln N(s) / N(s, a))`.
2. **Expand**: generate K children with the policy.
3. **Simulate**: roll out from a child. Score the leaf with the value function.
4. **Backpropagate**: add 1 to `visits` and the reward to `value_sum` on the path.

## Tasks in code
type: task-table
from: phases/14-agent-engineering/01-the-agent-loop/code/main.py, phases/14-agent-engineering/02-rewoo-plan-and-execute/code/main.py, phases/14-agent-engineering/03-reflexion-verbal-rl/code/main.py, phases/14-agent-engineering/04-tree-of-thoughts-lats/code/main.py, phases/14-agent-engineering/05-self-refine-and-critic/code/main.py

| Task | Code |
|---|---|
| Register a tool | `tools.register("calculator", calculator)` |
| Order a plan DAG | `topological(plan)` |
| Fill #E references | `resolve_references(value, evidence)` |
| Reflexion with memory | `run_reflexion(max_trials=4, use_memory=True)` |
| ToT breadth first | `tot_bfs(root_tot)` |
| LATS search | `mcts(root_lats, iterations=80, rng=rng)` |
| CRITIC loop | `run_loop("world facts", use_critic=True)` |

## CoT escalation pipeline
type: annotated-code
lang: python
from: phases/11-llm-engineering/02-few-shot-cot/code/advanced_prompting.py, phases/11-llm-engineering/02-few-shot-cot/docs/en.md

```python
single_answer, _ = few_shot_cot_solve(question, examples, client, model)  # temperature 0.0
sc_answer, confidence, reasonings, votes = self_consistency_solve(
    question, examples, client, model, n_samples=5
)                                                   # temperature 0.7, majority vote
if confidence >= 0.8 and single_answer == sc_answer:
    return sc_answer                                # 4 of 5 samples agree
tot_answer, tot_reasoning = tree_of_thought_solve(
    question, client, model, breadth=3, depth=2
)                                                   # escalate hard problems
```

## Prompt reasoning ladder (GPT-5, GSM8K)
type: comparison
from: phases/11-llm-engineering/02-few-shot-cot/docs/en.md

| Factor | Zero-Shot CoT | Few-Shot CoT | Self-Consistency (N=5) | Tree-of-Thought |
|---|---|---|---|---|
| API calls | 1 | 1 | 5 | 10-40+ |
| Token overhead | 50-200 tokens | 300-600 tokens | 5x token cost | 10-40x token cost |
| Accuracy | 97% | 98% | 98.5% | 74% on Game of 24 |
| Best for | Quick reasoning boost | Maximum single-call accuracy | High-stakes reasoning | Search/planning problems |

## Defaults in the lesson code
type: defaults
from: phases/14-agent-engineering/01-the-agent-loop/code/main.py, phases/14-agent-engineering/03-reflexion-verbal-rl/code/main.py, phases/14-agent-engineering/04-tree-of-thoughts-lats/code/main.py, phases/14-agent-engineering/05-self-refine-and-critic/code/main.py, phases/11-llm-engineering/02-few-shot-cot/code/advanced_prompting.py, phases/11-llm-engineering/02-few-shot-cot/docs/en.md

| Setting | Default | Note |
|---|---|---|
| `max_turns` | 12 | AgentLoop turn budget. The demo sets 10 |
| `max_len` | 6 | EpisodicMemory size |
| `max_iters` | 4 | Refine loop cap in `run_loop` |
| `c` in `uct` | 1.4 | Exploration weight |
| `max_expansions_per_level` | 8 | ToT BFS frontier width |
| `max_depth` | 3 | ToT BFS depth |
| `n_samples` | 5 | Self-consistency votes |
| `temperature` | 0.7 | Sampled paths. At 0.0 all samples match |

## Troubleshooting
type: troubleshooting
from: phases/14-agent-engineering/01-the-agent-loop/docs/en.md, phases/14-agent-engineering/02-rewoo-plan-and-execute/code/main.py, phases/14-agent-engineering/03-reflexion-verbal-rl/docs/en.md, phases/14-agent-engineering/04-tree-of-thoughts-lats/docs/en.md, phases/14-agent-engineering/05-self-refine-and-critic/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Agent hallucinates success on 400 errors | Error not fed back | Turn each error into an observation string |
| A web page gives the agent orders | Trust boundary collapse | Only direct user instructions count as permission |
| "cyclic plan or unresolved reference" | A step refers to a missing node | Fix the #E references in the plan |
| Reruns get slower, stale advice | Memory rot | Compaction or TTL on reflections |
| Reflection does not help | External failure, network down | Do not store one-off flaky runs |
| Critique always says looks good | Rubber-stamp loop | Use structurally different prompts |
| Search finds a good-scoring wrong answer | Noisy evaluator | Use search only with a reliable value function |

## Questions
type: qa
from: phases/14-agent-engineering/02-rewoo-plan-and-execute/docs/en.md, phases/14-agent-engineering/04-tree-of-thoughts-lats/docs/en.md, phases/14-agent-engineering/05-self-refine-and-critic/docs/en.md, phases/11-llm-engineering/02-few-shot-cot/docs/en.md

- **Why does ReWOO use fewer tokens?** ReAct prompts carry every prior step. ReWOO workers get only the tool call.
- **Why can a 7B model plan?** The planner does not see observations. It learns from 175B teacher plans.
- **What does LATS add to ToT?** MCTS. The LLM is policy, value function and self-reflector.
- **Why does Self-Refine keep history?** Refine sees prior outputs and critiques. Without history, quality drops sharply.
- **Why CRITIC over Self-Refine?** A hallucination often looks convincing to the model that produced it.
- **Add CoT to a reasoning model?** No. The o-series and DeepSeek-R1 run CoT internally.

## Tips
type: tips
from: phases/14-agent-engineering/02-rewoo-plan-and-execute/docs/en.md, phases/14-agent-engineering/04-tree-of-thoughts-lats/outputs/skill-search-policy.md, phases/14-agent-engineering/05-self-refine-and-critic/docs/en.md

- Start with the simplest pattern. One tool call plus a summary needs no ReWOO.
- Stop a refine loop when the verifier passes. Also cap it with `max_iterations`.
- Keep branching factor K at 3-5. K=10 explodes cost.
