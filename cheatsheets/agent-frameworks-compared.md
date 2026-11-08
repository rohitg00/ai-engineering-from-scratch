---
id: agent-frameworks-compared
title: Agent Frameworks Compared
code: AC
subtitle: Pick LangGraph, CrewAI, AutoGen, Agno, Mastra, an agent SDK or plain Python by problem shape, state and routing cost.
hue: 280
sources: phases/11-llm-engineering/17-agent-framework-tradeoffs, phases/14-agent-engineering/14-autogen-actor-model, phases/14-agent-engineering/15-crewai-role-based-crews, phases/14-agent-engineering/16-openai-agents-sdk, phases/14-agent-engineering/17-claude-agent-sdk, phases/14-agent-engineering/18-agno-and-mastra-runtimes, projects/typed-workflow-agent-with-mastra, projects/support-agent-with-google-adk
source_hash: e7088d4e33659396
---

## Orchestration frameworks side by side
type: comparison
span: 2
from: phases/11-llm-engineering/17-agent-framework-tradeoffs/docs/en.md

| Factor | LangGraph | CrewAI | AutoGen | Agno |
|---|---|---|---|---|
| Core abstraction | `StateGraph` | `Crew` | `ConversableAgent` pair | `Agent` |
| Mental model | State machine | Team of specialists | Chat | Agent with batteries included |
| State | Typed state, checkpointer | Strings through `context` | Chat history | Session store through `storage=` |
| Who branches | You, with conditional edges | Manager, or you at build time | Agents, through chat | The next tool call |
| Routing tokens | Only where you write `llm.invoke` | Hierarchical manager spends tokens | `GroupChatManager` spends tokens | Thin single-agent path |
| Best fit | Typed state, human interrupts | Short role-driven plans | Proposer-critic dialogue | Single agent, sessions, memory |
| Worst fit | Unknown topology | Complex branching | Known DAG, durable state | Deep branched graphs |

## Agent SDKs and runtimes side by side
type: comparison
span: 2
from: phases/14-agent-engineering/14-autogen-actor-model/docs/en.md, phases/14-agent-engineering/16-openai-agents-sdk/docs/en.md, phases/14-agent-engineering/17-claude-agent-sdk/docs/en.md, phases/14-agent-engineering/18-agno-and-mastra-runtimes/docs/en.md

| Factor | OpenAI Agents SDK | Claude Agent SDK | AutoGen v0.4 | Mastra |
|---|---|---|---|---|
| Primitives | Agent, Handoff, Guardrail, Session, Tracing | Tools, MCP, hooks, subagents, session store | Core, AgentChat, Extensions | Agents, Tools, Workflows |
| Delegation | Tool named `transfer_to_<agent_name>` | Subagents with their own context | Messages to an actor inbox | Workflow steps |
| State | `Session` in SQLite, Redis, custom | `append`, `load`, `delete` with cascade | Private actor state | Composite storage |
| Tracing | On by default | W3C trace context into the CLI | A span for each message | Mastra Studio |
| Use for | OpenAI-first products | Claude-first products | Actor concurrency, fault isolation | TypeScript, Next.js or Vercel |

## Use X when
type: concepts
from: phases/11-llm-engineering/17-agent-framework-tradeoffs/docs/en.md, phases/14-agent-engineering/15-crewai-role-based-crews/docs/en.md, phases/14-agent-engineering/18-agno-and-mastra-runtimes/docs/en.md

- **LangGraph**: typed state, approvals, resume, `Send` fanout.
- **CrewAI**: a Flow that calls `Crew.kickoff()` in a step.
- **AutoGen**: proposer-critic dialogue.
- **Agno**: many short-lived Python agents, FastAPI.
- **Mastra**: TypeScript, Next.js or Vercel, Zod-typed tools.
- **Plain Python**: two LLM calls and a tool.

## Decision tree: recommend(p)
type: flow
from: phases/11-llm-engineering/17-agent-framework-tradeoffs/code/main.py

1. **plain python**: `total_llm_calls` 2 or fewer. No roles, dialogue, resume, fan-out or human interrupt.
2. **langgraph**: `needs_resume`, `needs_human_interrupt` or `has_parallel_fanout`.
3. **autogen**: `has_dialogue` without `has_typed_state`.
4. **crewai**: `has_roles` without `has_typed_state`.
5. **agno**: `needs_session_memory`, no roles, no dialogue.
6. **langgraph**: `has_typed_state`, and the fallback.

## Actor runtime (AutoGen v0.4 shape)
type: architecture
from: phases/14-agent-engineering/14-autogen-actor-model/code/main.py, phases/14-agent-engineering/14-autogen-actor-model/docs/en.md

```arch
node | user | 1,1 | __user__ | sends start | client
node | queue | 2,1 | Runtime queue | Message deque | queue
node | check | 3,1 | ChecklistAgent | sends three reviews | process
node | dlq | 1,2 | dead_letters | failed messages | store
node | rev | 3,2 | ReviewerAgent | sends review_result | process
edge | user | queue | send
edge | queue | check | start
edge | check | queue | review
edge | queue | rev | review
edge | rev | queue | review_result
edge | rev | dlq | crash_me raises
```

## SDK tasks in code
type: task-table
from: phases/11-llm-engineering/17-agent-framework-tradeoffs/code/main.py, phases/14-agent-engineering/15-crewai-role-based-crews/docs/en.md, phases/14-agent-engineering/16-openai-agents-sdk/docs/en.md, phases/14-agent-engineering/17-claude-agent-sdk/docs/en.md

| Task | Code |
|---|---|
| Ask the recommender | `python main.py --ask` |
| Hand off to an agent | `transfer_to_<agent_name>` |
| Turn off tracing | `OPENAI_AGENTS_DISABLE_TRACING=1` |
| Fan spans to your backend | `add_trace_processor(processor)` |
| Run with stored history | `Runner.run(agent, input, session=session)` |
| Force a typed task output | `output_pydantic=MyModel` |
| List subagent sessions | `list_subkeys(session_id)` |

## Suspend and resume in Mastra
type: annotated-code
lang: typescript
from: projects/typed-workflow-agent-with-mastra/solution/optional-mastra/adapter.ts, projects/typed-workflow-agent-with-mastra/solution/optional-mastra/cli.ts

```typescript
const workflow = createWorkflow({ id: "ticket-triage", inputSchema: ticketSchema, outputSchema: resultSchema })
  .then(classifyStep)                    // intent read or write
  .then(planStep)                        // lookup or update action
  .then(executeStep)                     // suspends before an update
  .commit();
if (!resumeData?.approved)
  return suspend({ ticketId: plan.ticket.id, planHash: digest });  // digest = planHash(plan)
const { workflow, storage } = await persistentWorkflow(tool, "file:" + resolve(args["--db"]));
const run = await workflow.createRun({ runId: args["--resume"] });  // fresh process, same file
result = await run.resume({ step: "execute", resumeData });  // approved, ticketId, planHash
```

## Run the projects
type: command-table
span: 2
from: projects/typed-workflow-agent-with-mastra/README.md, projects/support-agent-with-google-adk/README.md

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py <project> --stage 1 --path <dir> --strict` | Grade one stage |
| `python3 scripts/project_test.py <project> --all --solution --optional --strict` | Run the real SDK tests. A SKIP fails |
| `node --experimental-strip-types cli.ts --ticket fixtures/ticket.json --out workflow-output` | Scratch workflow. Writes a checkpoint when approval is required |
| `node --experimental-strip-types optional-mastra/cli.ts --ticket fixtures/ticket.json --db ./runs.db --out pending-output` | Durable Mastra run. Reports a runId |
| `python3 main.py --ticket fixtures/ticket.json --out support-output` | Offline support review in index.html |
| `main.py --ticket YOUR_TICKET.json --adk --out support-adk-output` | Same ticket through real ADK agents |

## What the projects build and check
type: concepts
from: projects/typed-workflow-agent-with-mastra/README.md, projects/typed-workflow-agent-with-mastra/project.json, projects/typed-workflow-agent-with-mastra/solution/main.ts, projects/support-agent-with-google-adk/README.md, projects/support-agent-with-google-adk/project.json, projects/support-agent-with-google-adk/solution/intake.py

- **Mastra builds**: a typed approval workflow. It suspends before an update and resumes from SQLite.
- **Mastra output**: `workflow.json`, plus `approval.json` with approved=false.
- **Mastra check**: matching approval gives one tool call. A wrong hash gives zero calls.
- **ADK builds**: a redacted support reply or a human escalation, then the same rules in real ADK agents.
- **ADK output**: an HTML review page and `support.json`.
- **ADK check**: invoice login ties billing and access, so it escalates.

## Defaults and limits
type: defaults
from: phases/14-agent-engineering/14-autogen-actor-model/code/main.py, phases/14-agent-engineering/15-crewai-role-based-crews/code/main.py, phases/14-agent-engineering/16-openai-agents-sdk/code/main.py, phases/14-agent-engineering/16-openai-agents-sdk/docs/en.md, projects/typed-workflow-agent-with-mastra/solution/main.ts

| Setting | Default | Note |
|---|---|---|
| Runner `max_hops` | 3 | Hop counter against handoff drift |
| Runtime `max_messages` | 100 | Messages for each `run_until_idle` |
| HierarchicalCrew `max_steps` | 5 | Manager rounds before stop |
| Guardrail mode | Parallel | Lower tail latency, wastes tokens on a trip |
| `executePlan` `maxCalls` | 3 | Allowed range 1 to 100 |
| `executePlan` `maxAttempts` | 2 | Allowed range 1 to 10 |

## Troubleshooting
type: troubleshooting
from: phases/14-agent-engineering/15-crewai-role-based-crews/docs/en.md, phases/14-agent-engineering/16-openai-agents-sdk/docs/en.md, phases/14-agent-engineering/17-claude-agent-sdk/docs/en.md, phases/14-agent-engineering/18-agno-and-mastra-runtimes/docs/en.md, projects/typed-workflow-agent-with-mastra/README.md

| Symptom | Cause | Fix |
|---|---|---|
| A hands off to B, B hands back to A | Handoff drift | Add a hop counter |
| Built-in tool skips the check | Tool guardrails fire on function tools only | Add a separate policy |
| Task N+1 ad-libs on free text | Brittle handoffs | Set `output_pydantic` on Task N |
| Crew costs too many tokens | Manager-LLM token tax | Switch to Sequential |
| Context gone before the first tool call | Long backstories | Keep backstories under 200 words |
| Overhead dominates tiny tasks | Subagent over-spawn | Batch the tasks |
| Sessions grow without limit | Session bloat | Use `list_sessions` and an expiry policy |
| Resume fails before the tool | Wrong ticket or digest in approval | Keep ticketId and planHash unchanged |

## Questions
type: qa
from: phases/14-agent-engineering/14-autogen-actor-model/docs/en.md, phases/14-agent-engineering/16-openai-agents-sdk/docs/en.md, phases/14-agent-engineering/18-agno-and-mastra-runtimes/docs/en.md, phases/11-llm-engineering/17-agent-framework-tradeoffs/docs/en.md, projects/support-agent-with-google-adk/solution/adk_adapter.py

- **Why is a handoff a tool?** The model calls `transfer_to_billing_agent`. The runtime switches agents.
- **Why do actors isolate faults?** `send(agent_b, msg)` only queues. The runtime catches handler crashes.
- **Can the model change the ADK route?** No. It raises `ValueError`.
