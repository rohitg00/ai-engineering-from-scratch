---
id: agent-planning
title: Agent Planning: Workflows, HTN, Plan-Execute
code: AW
subtitle: Pick a workflow, an HTN or evolutionary planner, or a replanning executor. Stdlib Python from the lessons.
hue: 32
sources: phases/14-agent-engineering/11-planning-htn-and-evolutionary, phases/14-agent-engineering/12-anthropic-workflow-patterns, phases/19-capstone-projects/24-plan-execute-control-flow, phases/14-agent-engineering/44-plan-from-evidence
source_hash: 28f779dbd6acbd70
---

## Pick a planner
type: comparison
from: phases/14-agent-engineering/11-planning-htn-and-evolutionary/docs/en.md, phases/14-agent-engineering/12-anthropic-workflow-patterns/docs/en.md

| Factor | Workflow | HTN + ChatHTN | AlphaEvolve | ReAct / ReWOO |
|---|---|---|---|---|
| Who decides | Engineers | Symbolic layer | Evaluator selects | The model |
| Guarantee | Bounded step count | Provable soundness | Best plan by fitness | No formal guarantees |
| Needs | Steps you can enumerate | Operator schema | Machine-checkable fitness | LLM in the loop |
| Fits | Predictable, compliance-bound | Scheduling, policy-bound | Compiler optimization | Open-ended research |
| LLM role | Calls on fixed code paths | Fallback decomposition | Proposes mutations | Picks each step |

## Five workflow patterns in code
type: task-table
from: phases/14-agent-engineering/12-anthropic-workflow-patterns/code/main.py, phases/14-agent-engineering/12-anthropic-workflow-patterns/docs/en.md
span: 2

| Task | Code |
|---|---|
| Prompt chaining: output N is input N+1 | `prompt_chain(input_text, llm, steps)` |
| Routing: classify, then dispatch | `route(input_text, classifier, handlers)` |
| Parallelization: N runs, majority vote | `parallel_vote(prompt, llm, n=5)` |
| Orchestrator-workers: pick specialists | `orchestrator_workers(task, workers, synth)` |
| Evaluator-optimizer: loop until PASS | `evaluator_optimizer(task, proposer, evaluator, max_iter=5)` |
| Unknown route label | `handlers.get("default")` gives "escalate to human" |
| Run all five demos | `python3 code/main.py` |

## Plan-execute executor
type: flow
from: phases/19-capstone-projects/24-plan-execute-control-flow/docs/en.md, phases/19-capstone-projects/24-plan-execute-control-flow/code/main.py

1. **Planner**: `planner(goal, history, None)` returns the first plan. Event `plan.commit`.
2. **Executor**: runs `plan[cursor]` through the dispatcher. Events `step.start` and `step.end`.
3. **Executor**: on success, append to history and move the cursor to the next step.
4. **Executor**: on an exception, store `step.error` and set `last_error`.
5. **Budget check**: `replans_used >= self.max_replans` returns failed with `replan_budget`.
6. **Planner**: `planner(goal, history, last_error)` gives a new plan. Event `plan.draft`.
7. **Executor**: emits `plan.diff`, commits the new plan and sets `cursor = 0`.
8. **Executor**: the last step succeeds. Event `session.complete` with `goal_met`.

## Evidence plan waves
type: architecture
from: phases/14-agent-engineering/44-plan-from-evidence/docs/en.md, phases/14-agent-engineering/44-plan-from-evidence/code/main.py

```arch
node | contract | 1,1 | contract | wave 1, review contract | process
node | impl | 2,1 | implementation | wave 2, unittest | process
node | docs | 2,2 | docs | wave 2, check_links.py | process
node | integ | 3,1 | integration | wave 3, acceptance gate | process
edge | contract | impl | depends_on
edge | contract | docs | depends_on
edge | impl | integ |
edge | docs | integ |
```

## Run a replanning agent
type: annotated-code
lang: python
from: phases/19-capstone-projects/24-plan-execute-control-flow/code/main.py

```python
agent = PlanExecuteAgent(
    planner=make_deterministic_planner(fail_step_id=2, recovery="route_around"),
    executor=executor,              # (tool_name, args) -> result, raises ToolFailure
    max_steps=12, max_replans=5,    # both budgets are hard
)
res = agent.run("ship the report")
res.status, res.reason              # "completed" and "goal_met"
res.revisions                       # list of PlanDiff
r.to_dict()                         # revision, removed, added, revised
Step(2, "transform", {"mode": "v2"}, "computed via fallback")
```

## HTN planner with LLM fallback
type: annotated-code
lang: python
from: phases/14-agent-engineering/11-planning-htn-and-evolutionary/code/main.py

```python
op = Operator("open_editor", ("logged_in",), ("editor_open",))
m = Method("ship_change_m1", "ship_change", ("logged_in",),
           ("open_editor", "write_tests", "run_tests", "open_pr"))
planner = HTNPlanner(operators=operators, methods=methods, llm=llm)
plan = planner.plan("ship_change", {"logged_in"})  # list of operators or None
planner.cached_methods      # LLM decompositions kept for the next call
planner.llm.calls           # 0 new calls on a cache hit
```

## Planning terms
type: concepts
from: phases/14-agent-engineering/11-planning-htn-and-evolutionary/docs/en.md, phases/14-agent-engineering/12-anthropic-workflow-patterns/docs/en.md, phases/19-capstone-projects/24-plan-execute-control-flow/docs/en.md

- **Operator**: primitive action with preconditions and effects.
- **Method**: a way to break a compound task into subtasks, with preconditions.
- **ChatHTN**: the symbolic planner asks the LLM when no method matches.
- **Fitness function**: deterministic, machine-checkable score over outputs.
- **Augmented LLM**: LLM plus search, tools and memory. The atomic unit.
- **expected_outcome**: planner's success condition. The executor does not enforce it.
- **Replan**: hand the error to the planner. This turns a script into an agent.

## Defaults
type: defaults
from: phases/19-capstone-projects/24-plan-execute-control-flow/code/main.py, phases/19-capstone-projects/24-plan-execute-control-flow/docs/en.md, phases/14-agent-engineering/11-planning-htn-and-evolutionary/code/main.py, phases/14-agent-engineering/12-anthropic-workflow-patterns/code/main.py

| Setting | Default | Note |
|---|---|---|
| `max_steps` | `12` | All step executions, replans included |
| `max_replans` | `5` | Planner calls after the first plan |
| `max_depth` | `12` | HTN recursion limit, then None |
| `max_iter` | `5` | Evaluator-optimizer rounds |
| `n` | `5` | Voters in `parallel_vote` |
| `generations` | `12` | Evolutionary demo, keep top 3 of 6 |

## Failures and fixes
type: troubleshooting
from: phases/19-capstone-projects/24-plan-execute-control-flow/code/main.py, phases/19-capstone-projects/24-plan-execute-control-flow/docs/en.md, phases/14-agent-engineering/44-plan-from-evidence/code/main.py, phases/14-agent-engineering/11-planning-htn-and-evolutionary/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| `failed`, reason `replan_budget` | Planner returns the same broken plan | Feed `last_error` and route around it |
| `failed`, reason `step_budget` | Replans add steps past `max_steps` | Shorter plans or reuse history |
| `failed`, reason `no_plan` | Planner returned `[]` | Add a recovery plan for that error |
| `dependency cycle among:` | Items wait on each other | Resolve the disagreement behind it |
| `has no repository evidence` | Item has empty `evidence` | Cite a repository fact |
| `has no proof command` | Empty `proof` | Give one exact check |
| HTN soundness collapses | No precondition/effect schemas | Validate LLM output against operators |
| Evolution does not converge | LLM asked if the code is better | Use a deterministic, fast evaluator |

## Commands
type: command-table
from: phases/14-agent-engineering/44-plan-from-evidence/docs/en.md, phases/19-capstone-projects/24-plan-execute-control-flow/code/main.py, phases/14-agent-engineering/11-planning-htn-and-evolutionary/docs/en.md

| Command | What it does |
|---|---|
| `python3 code/main.py` | Runs the lesson demo and prints the trace |
| `python3 -m unittest discover code/tests -v` | Runs the evidence plan tests |
| `outputs/evidence-plan.json` | Written by lesson 44, status ready or blocked |

## Questions
type: qa
from: phases/14-agent-engineering/12-anthropic-workflow-patterns/docs/en.md, phases/14-agent-engineering/11-planning-htn-and-evolutionary/docs/en.md, phases/19-capstone-projects/24-plan-execute-control-flow/docs/en.md, phases/14-agent-engineering/44-plan-from-evidence/docs/en.md

- **Workflow or agent?** Workflow when you can enumerate the steps. Agent when the next step depends on the last result.
- **Why cap replans and steps?** A capped replan fails faster with a clearer reason.
- **Why is ChatHTN sound?** LLM output enters only as candidate decompositions. The schema rejects invalid ones.
- **Which steps run together?** Steps in the same wave. Integration waits for both branches.

## Tips
type: tips
from: phases/14-agent-engineering/11-planning-htn-and-evolutionary/docs/en.md, phases/14-agent-engineering/12-anthropic-workflow-patterns/docs/en.md, phases/19-capstone-projects/24-plan-execute-control-flow/docs/en.md, phases/14-agent-engineering/44-plan-from-evidence/docs/en.md

- Start with direct API calls. Reach for ReAct or ReWOO before HTN.
- Define the contract before its implementations.
- Give each work item an id, change, evidence, dependencies and proof.
- Emit a plan diff on each revision. Do not rewrite the plan silently.
- Store the plan next to the work, not in chat checkboxes.
