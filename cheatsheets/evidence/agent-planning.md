# Evidence: cheatsheets/agent-planning.md

Abbreviations: L11 = phases/14-agent-engineering/11-planning-htn-and-evolutionary, L12 = phases/14-agent-engineering/12-anthropic-workflow-patterns, C24 = phases/19-capstone-projects/24-plan-execute-control-flow, L44 = phases/14-agent-engineering/44-plan-from-evidence. d = docs/en.md, c = code/main.py.

## Pick a planner (comparison, 5 rows)
- Who decides: engineers own the graph L12/d:25, symbolic layer owns correctness L11/d:51, evaluator selects L11/d:136, model owns the graph L12/d:26
- Guarantee: bounded step counts L12/d:49, provable soundness L11/d:78, the best plan L11/d:22, no formal guarantees L11/d:80
- Needs: enumerate the steps L12/d:48, operator schema L11/d:86, machine-checkable fitness L11/d:79, LLM in the loop L11/d:80
- Fits: predictable and compliance-bound L12/d:48-50, scheduling and policy-bound L11/d:78, 82, compiler optimization L11/d:79, open-ended research L12/d:54
- LLM role: predefined code paths L12/d:25, LLM fallback decomposition L11/d:45-49, ensemble proposes mutations L11/d:62, model directs its own tools L12/d:26

## Five workflow patterns in code (task-table, 7)
- prompt_chain(input_text, llm, steps): L12/c:33, output N to N+1 L12/d:109
- route(input_text, classifier, handlers): L12/c:45
- parallel_vote(prompt, llm, n=5), majority via most_common: L12/c:54-58
- orchestrator_workers(task, workers, synth): L12/c:68
- evaluator_optimizer(..., max_iter=5), loop until PASS: L12/c:77-89
- handlers.get("default") and "escalate to human": L12/c:48, 120
- python3 code/main.py: L12/d:79

## Plan-execute executor (flow, 8 steps)
1. planner(goal, history, None), plan.commit: C24/c:126-127
2. step.start and step.end: C24/c:148, 151
3. history.append, cursor += 1: C24/c:152-153
4. step.error and last_error: C24/c:157-161
5. replans_used >= self.max_replans returns replan_budget: C24/c:163-168
6. planner(goal, history, last_error), plan.draft: C24/c:172-173
7. plan.diff, cursor = 0, plan.commit: C24/c:182-185
8. session.complete goal_met: C24/c:187-189

## Evidence plan waves (architecture, 4 nodes, 4 edges)
- contract, review contract: L44/c:79
- implementation, unittest proof, depends on contract: L44/c:80
- docs, check_links.py proof, depends on contract: L44/c:81
- integration, acceptance gate, depends on both: L44/c:82
- three waves and order: L44/d:98, L44/d:41-49

## Run a replanning agent (annotated-code, 10 lines)
- PlanExecuteAgent, make_deterministic_planner(fail_step_id=2, recovery="route_around"), max_steps=12, max_replans=5: C24/c:258-262
- executor signature and ToolFailure: C24/c:78, 81, 248
- agent.run("ship the report"): C24/c:263
- status completed, reason goal_met: C24/c:189
- revisions list of PlanDiff: C24/c:60
- to_dict revision, removed, added, revised: C24/c:39-45
- Step(2, "transform", {"mode": "v2"}, "computed via fallback"): C24/c:222

## HTN planner with LLM fallback (annotated-code, 7 lines)
- Operator("open_editor", ...): L11/c:109
- Method("ship_change_m1", ...): L11/c:116-117
- HTNPlanner(operators=operators, methods=methods, llm=llm): L11/c:125
- planner.plan returns list or None: L11/c:64-86, 129
- cached_methods: L11/c:62, 74-83
- 0 new LLM calls on a cache hit: L11/c:140-144

## Planning terms (concepts, 7)
- Operator: L11/d:34
- Method: L11/d:33
- ChatHTN: L11/d:135
- Fitness function: L11/d:137
- Augmented LLM: L12/d:108
- expected_outcome not enforced: C24/d:47
- Replan turns a script into an agent: C24/d:33

## Defaults (defaults, 6)
- max_steps 12: C24/c:106, C24/d:91
- max_replans 5: C24/c:107, C24/d:93
- max_depth 12: L11/c:65-67
- max_iter 5: L12/c:79
- n 5: L12/c:54
- generations 12, top 3 of 6: L11/c:169, 174, 180, 186

## Failures and fixes (troubleshooting, 8)
- replan_budget, same broken plan, last_error route around: C24/c:163-168, C24/d:93, 101
- step_budget, replans add steps: C24/c:140-145, C24/d:91, reuse history C24/d:129
- no_plan, planner returned []: C24/c:174-179, C24/d:103
- dependency cycle among:: L44/c:59, hidden disagreement L44/d:113
- has no repository evidence: L44/c:30-31, repository receipt L44/d:104
- has no proof command: L44/c:32-33, one clear completion proof L44/d:105
- HTN soundness collapses without schemas: L11/d:86
- prose fitness does not converge, LLM asked if code is better, deterministic and fast: L11/d:72, 87

## Commands (command-table, 3)
- python3 code/main.py: L44/d:94, C24/c:8, L11/d:104
- python3 -m unittest discover code/tests -v: L44/d:95
- outputs/evidence-plan.json, status ready or blocked: L44/d:89, L44/c:70

## Questions (qa, 4)
- Workflow or agent: L12/d:48, 54
- Cap replans: C24/d:93
- ChatHTN sound: L11/d:51, 86
- Waves run together, integration waits: L44/d:49, 98

## Tips (tips, 5)
- Direct API calls first: L12/d:3. ReAct or ReWOO first: L11/d:88
- Contract first: L44/d:39
- Five commitments: L44/d:29-35
- Plan diff visible, not silent rewrite: C24/d:87
- Store the plan next to the work: L44/d:72
