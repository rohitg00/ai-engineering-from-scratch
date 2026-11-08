# Evidence: cheatsheets/agent-frameworks-compared.md

Abbreviations: L17 = phases/11-llm-engineering/17-agent-framework-tradeoffs, A14 = phases/14-agent-engineering/14-autogen-actor-model, A15 = phases/14-agent-engineering/15-crewai-role-based-crews, A16 = phases/14-agent-engineering/16-openai-agents-sdk, A17 = phases/14-agent-engineering/17-claude-agent-sdk, A18 = phases/14-agent-engineering/18-agno-and-mastra-runtimes, PM = projects/typed-workflow-agent-with-mastra, PA = projects/support-agent-with-google-adk, d = docs/en.md, c = code/main.py.

## Orchestration frameworks side by side (comparison)
- Core abstraction StateGraph, Crew, ConversableAgent pair, Agent: L17/d:26-29
- Mental model state machine, team of specialists, chat, agent with batteries included: L17/d:35-38
- State: typed state + checkpointer, strings via `context`, chat history, `storage=` session store: L17/d:44-47
- Who branches: conditional edges, manager or build time, agents via chat, next tool call: L17/d:53-56
- Routing tokens: `llm.invoke`, hierarchical manager, `GroupChatManager`, thin single-agent path: L17/d:67
- Best fit: L17/d:26-29 (third column)
- Worst fit: L17/d:26-29 (fourth column)

## Agent SDKs and runtimes side by side (comparison)
- Primitives: A16/d:25-29, A17/d:26, A14/d:39-41, A18/d:36
- Delegation: `transfer_to_<agent_name>` A16/d:26, subagents own context A17/d:37, inbox A14/d:45, workflows A18/d:36
- State: Session SQLite, Redis, custom A16/d:62, append/load/delete cascade A17/d:45-48, private state A14/d:29, composite storage A18/d:38
- Tracing: on by default A16/d:58, W3C trace context A17/d:68, span per message A14/d:59, Mastra Studio A18/d:41
- Use for: OpenAI-first A16/d:93, Claude-first A17/d:104, fault isolation and concurrency A14/d:47-48, TypeScript Next.js Vercel A18/d:55

## Use X when (concepts)
- LangGraph typed state, approvals, resume, `Send` fanout: L17/d:96, 100
- CrewAI Flow that calls `Crew.kickoff()`: A15/d:58, 168
- AutoGen proposer-critic dialogue: L17/d:98
- Agno many short-lived agents, FastAPI: A18/d:54
- Mastra TypeScript, Next.js or Vercel, Zod-typed tools: A18/d:55
- Plain Python for two LLM calls and a tool: L17/d:88

## Decision tree: recommend(p) (flow)
1. plain python, `total_llm_calls` <= 2 and no other flag: L17/c:43-50
2. langgraph on `needs_resume`, `needs_human_interrupt`, `has_parallel_fanout`: L17/c:53-58
3. autogen on `has_dialogue` and not `has_typed_state`: L17/c:61-66
4. crewai on `has_roles` and not `has_typed_state`: L17/c:69-74
5. agno on `needs_session_memory`, no roles, no dialogue: L17/c:77-82
6. langgraph on `has_typed_state`, and the fallback: L17/c:85-97

## Actor runtime (AutoGen v0.4 shape) (architecture, 5 nodes, 6 edges)
- `__user__` sends start: A14/c:134-143
- Runtime queue, deque of Message: A14/c:35, 44-48
- ChecklistAgent sends three reviews: A14/c:108-114, 138-142
- ReviewerAgent sends review_result: A14/c:81-96
- dead_letters holds failed messages: A14/c:36, 67-72
- crash_me raises: A14/c:97-98, 145-150

## SDK tasks in code (task-table)
- `python main.py --ask`: L17/c:9
- `transfer_to_<agent_name>`: A16/d:26
- `OPENAI_AGENTS_DISABLE_TRACING=1`: A16/d:58
- `add_trace_processor(processor)`: A16/d:58
- `Runner.run(agent, input, session=session)`: A16/d:62
- `output_pydantic=MyModel`: A15/d:96
- `list_subkeys(session_id)`: A17/d:49

## Suspend and resume in Mastra (annotated-code)
- createWorkflow ticket-triage with then classifyStep, planStep, executeStep, commit: PM/solution/optional-mastra/adapter.ts:116-124
- classify gives read or write intent: PM/solution/main.ts:45-50
- plan gives lookup or update: PM/solution/main.ts:58-70
- suspend when not approved, with ticketId and planHash: PM/solution/optional-mastra/adapter.ts:89-95
- digest = planHash(plan): PM/solution/optional-mastra/adapter.ts:80-81
- persistentWorkflow with file: URL: PM/solution/optional-mastra/cli.ts:28-31
- createRun with runId on resume: PM/solution/optional-mastra/cli.ts:33-35
- run.resume step execute with resumeData: PM/solution/optional-mastra/cli.ts:40-43
- resumeData fields approved, ticketId, planHash: PM/solution/optional-mastra/adapter.ts:74-78

## Run the projects (command-table)
- `--stage 1 --path ... --strict`: PM/README.md:9, PA/README.md:9
- `--all --solution --optional --strict`, SKIP fails strict: PM/README.md:29, 32, PA/README.md:31, 35
- scratch cli.ts --ticket ... --out workflow-output, checkpoint when approval required: PM/README.md:12, 15
- optional-mastra/cli.ts ... --db ./runs.db --out pending-output, reports runId: PM/README.md:37, 40
- python3 main.py --ticket fixtures/ticket.json --out support-output, index.html: PA/README.md:12, 15
- main.py --ticket YOUR_TICKET.json --adk --out support-adk-output: PA/README.md:40

## What the projects build and check (concepts)
- Mastra builds typed approval workflow, suspend and resume, SQLite: PM/README.md:3
- Mastra output workflow.json plus approval.json with approved=false: PM/README.md:40
- Mastra check, one tool call on match, zero calls on wrong hash: PM/project.json:120
- ADK builds redacted reply or human escalation, real ADK agents: PA/README.md:3
- ADK output HTML review page and support.json: PA/project.json:18
- ADK check invoice login ties billing and access, escalates: PA/project.json:64

## Defaults and limits (defaults)
- Runner max_hops 3: A16/c:69, 84
- Runtime max_messages 100, run_until_idle: A14/c:39, 53-55
- HierarchicalCrew max_steps 5: A15/c:96, 103
- Guardrail mode Parallel default, lower latency, token waste on trip: A16/d:51
- executePlan maxCalls 3, range 1 to 100: PM/solution/main.ts:96, 98-106
- executePlan maxAttempts 2, range 1 to 10: PM/solution/main.ts:97, 98-106

## Troubleshooting (troubleshooting)
- Handoff drift, add a hop counter: A16/d:66
- Guardrail bypass, tool guardrails only on function tools: A16/d:67
- Brittle handoffs, `output_pydantic` on Task N: A15/d:133
- Manager-LLM token tax, switch to Sequential: A15/d:132
- Prompt-bloat from backstories, under 200 words: A15/d:131
- Subagent over-spawn, batch instead: A17/d:76
- Session bloat, `list_sessions` + expiry policy: A17/d:78
- Wrong ticket or digest fails before the tool, preserve ticketId and planHash: PM/README.md:40, 46

## Questions (qa)
- Handoff is a tool, model sees `transfer_to_billing_agent`: A16/d:33-37
- `send(agent_b, msg)` queues and returns, runtime catches failure: A14/d:45, 47
- Model route cannot override, raises ValueError: PA/solution/adk_adapter.py:53-54
