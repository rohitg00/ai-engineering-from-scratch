---
id: context-engineering
title: Context Engineering and Agent Memory
code: CE
subtitle: Budget the window, order the context, page memory in and out, fuse memory stores and persist agent state.
hue: 280
sources: phases/11-llm-engineering/05-context-engineering, phases/14-agent-engineering/07-memory-virtual-context-memgpt, phases/14-agent-engineering/08-memory-blocks-sleep-time-compute, phases/14-agent-engineering/09-hybrid-memory-mem0, phases/14-agent-engineering/34-repo-memory-and-state, projects/memory-server
source_hash: de3d6fbb8902e981
---

## The context window budget
type: architecture
from: phases/11-llm-engineering/05-context-engineering/docs/en.md

```arch
node | sys | 1,1 | System prompt | ~500 tokens, goes first
node | tools | 2,1 | Tool definitions | ~2K-8K tokens
node | ret | 3,1 | Retrieved context | ~2K-10K tokens
node | hist | 4,1 | Conversation history | ~2K-20K tokens
node | shots | 1,2 | Few-shot examples | ~1K-3K tokens
node | query | 2,2 | User query | ~100-500 tokens, goes last
node | gen | 3,2 | Generation budget | ~2K-8K tokens
node | win | 4,2 | Context window | 128K tokens | model
edge | sys | tools |
edge | tools | ret |
edge | ret | hist |
edge | shots | query |
edge | query | gen |
edge | gen | win | fits or truncates
```

## Numbers that matter
type: concepts
from: phases/11-llm-engineering/05-context-engineering/docs/en.md

- **Lost in the middle**: 85-90% accuracy with the document first or last. 60-70% at position 10 of 20.
- **Low zone**: positions 40-70% of the context lose 10-20% accuracy.
- **Curated beats dumped**: a 10K token context often beats a dumped 100K token context.
- **Tool cost**: 50-200 tokens per tool. 50 tools at 150 tokens is 7,500 tokens.
- **Tool pruning**: cuts tool tokens by 60-80%.
- **History**: 50 turns at 200 tokens is 10,000 tokens.
- **Summary**: 100 tokens replace 10 turns that took 2,000 tokens.
- **Token estimate**: word count times 1.3 in `count_tokens`.

## Assemble context per query
type: flow
from: phases/11-llm-engineering/05-context-engineering/docs/en.md, phases/11-llm-engineering/05-context-engineering/code/main.py

1. **Classifier**: `classify_intent(query)` counts keyword hits per intent. No hit gives `["code"]`.
2. **Tool selector**: `select_tools(query, token_budget=2000)` keeps tools whose category matches.
3. **Retriever**: `score_relevance(query, documents)` scores word overlap. Docs below `threshold` drop out.
4. **Reorder**: `reorder_lost_in_middle(items, scores)` puts the best items first and last.
5. **History**: `ConversationManager` summarizes the oldest 2 turns while history is over the cap.
6. **Budget**: `ContextBudget` truncates each component to its cap and to the space left.

## ContextEngine.assemble
type: annotated-code
lang: python
from: phases/11-llm-engineering/05-context-engineering/code/main.py, phases/11-llm-engineering/05-context-engineering/docs/en.md

```python
budget = ContextBudget(max_tokens=128000, generation_reserve=4000)
budget.allocate("system_prompt", self.system_prompt, max_tokens=1000)
tools, tool_tokens = select_tools(query, token_budget=2000)
budget.allocate("tools", tool_text, max_tokens=2000)
budget.allocate("retrieved_context", doc_text, max_tokens=3000)
budget.allocate("conversation_history", history_text, max_tokens=5000)
budget.allocate("user_query", query, max_tokens=500)  # query goes last
print(budget.report())  # tokens and percent per component
```

## Memory tool surface
type: command-table
from: phases/14-agent-engineering/07-memory-virtual-context-memgpt/docs/en.md, phases/14-agent-engineering/07-memory-virtual-context-memgpt/code/main.py, phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/docs/en.md

| Command | What it does |
|---|---|
| `core_memory_append(section, text)` | Writes to a pinned section of the prompt |
| `core_memory_replace(section, old, new)` | Edits a pinned section |
| `archival_memory_insert(text)` | Writes to the searchable external store |
| `archival_memory_search(query, top_k)` | Pages facts back into the next turn |
| `conversation_search(query)` | Scans past turns, evicted turns too |
| `block_append(label, text)` | Adds text to a memory block |
| `block_replace(label, old, new)` | Edits a memory block |
| `block_summarize(label)` | Condenses a block near its limit |

## Memory designs side by side
type: comparison
span: 2
from: phases/14-agent-engineering/07-memory-virtual-context-memgpt/docs/en.md, phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/docs/en.md, phases/14-agent-engineering/09-hybrid-memory-mem0/docs/en.md, phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md

| Factor | MemGPT two tiers | Letta blocks | Mem0 hybrid | Repo memory |
|---|---|---|---|---|
| Stores | Main context plus archival | Core, recall, archival | Vector, KV, graph | JSON files under a schema |
| Write | Memory tool call | Block tools and sleep-time rewrites | `add(text, user_id, metadata)` to all three | Validate, then atomic write |
| Read | `archival_memory_search` | Core blocks stay in the prompt | `search(query, user_id)` fuses scores | Load and validate |
| Stale facts | Consolidation, invalidation | Sleep-time agent invalidates | Old edge marked invalid, not deleted | `schema_version` refuses unknown files |
| Main risk | Memory rot, poisoning | Block bloat, silent drift | Embedding drift, graph explosion | Partial writes |
| Use it when | Data is larger than the window | Some facts must stay in the prompt | Queries mix similarity, lookup, relations | State must outlive the chat |

## Tasks in code
type: task-table
from: phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/code/main.py, phases/14-agent-engineering/09-hybrid-memory-mem0/code/main.py, phases/14-agent-engineering/34-repo-memory-and-state/code/main.py, phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md

| Task | Code |
|---|---|
| Create a block | `create(label, description, limit=300)` |
| Test a block for summary | `block.near_limit()` |
| Consolidate off the critical path | `sleep.run(contradictions=[...])` |
| Soft delete a stale fact | `self.archival.invalidate(record.rid)` |
| Write to all three stores | `mem.add(text, user_id=..., kv_triples=...)` |
| Fused, scoped search | `mem.search(query, user_id=..., top_k=3)` |
| Persist state safely | `atomic_write(path, content)` |
| Refuse a bad write | `mgr.commit(state)` raises `SchemaError` |

## Memory server project
type: command-table
span: 2
from: projects/memory-server/README.md, projects/memory-server/solution/cli.ts

| Command | What it does |
|---|---|
| `python3 scripts/project_test.py memory-server --init <dir>` | Creates your workspace. A fresh starter fails |
| `python3 scripts/project_test.py memory-server --all --path <dir> --strict` | Grades all four stages |
| `node cli.ts --data-dir memory-data --put samples/memory.json` | Appends revision 1 of `cache-policy` |
| `node cli.ts --data-dir memory-data --query "cache policy"` | Searches the `docs` namespace |
| `node cli.ts --data-dir memory-data --put samples/memory-updated.json --revision 1` | Appends revision 2. Revision 0 again is a conflict |
| `node cli.ts --data-dir memory-data --history cache-policy --html history.html` | Prints all revisions and writes a comparison table |
| `node cli.ts --data-dir memory-data --serve --port 8788` | Serves REST and MCP. Set MEMORY_TOKEN first |

## Defaults
type: defaults
from: phases/11-llm-engineering/05-context-engineering/code/main.py, phases/11-llm-engineering/05-context-engineering/docs/en.md, phases/14-agent-engineering/07-memory-virtual-context-memgpt/code/main.py, phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/code/main.py, phases/14-agent-engineering/09-hybrid-memory-mem0/code/main.py

| Setting | Default | Note |
|---|---|---|
| `max_tokens` | 128000 | Minus `generation_reserve` 4000 |
| `max_history_tokens` | 5000 | Summarize old turns above it |
| `token_budget` | 2000 | Cap for tool definitions |
| Relevance `threshold` | 0.05 | The docs version uses 0.1 |
| `max_messages` | 4 | MemGPT main context. Older messages go to `evicted` |
| Block `limit` | 300 | Characters. `near_limit` fires at 0.8 |
| `w_relevance` | 0.6 | `w_importance` 0.2, `w_recency` 0.2 |
| `recency_halflife_s` | 86400.0 | Recency is 0.5 per half-life |

## Troubleshooting
type: troubleshooting
from: phases/11-llm-engineering/05-context-engineering/docs/en.md, phases/14-agent-engineering/07-memory-virtual-context-memgpt/docs/en.md, phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/docs/en.md, phases/14-agent-engineering/09-hybrid-memory-mem0/docs/en.md, phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md

| Symptom | Cause | Fix |
|---|---|---|
| Model ignores a fact in the middle | Lost in the middle | Key facts first, query last. Repeat the key point at the end |
| Tools fill the window | Every tool sent on every call | Classify intent and prune tools |
| Retrieval drowns in stale facts | Memory rot | Consolidate and invalidate in a sleep pass |
| Agent obeys an old injected note | Memory poisoning | Treat retrieved memory as untrusted text |
| Agent recalls but cannot cite | Citation loss | Store session ID and turn ID with each write |
| Block hits its cap | Block bloat | Summarize before the write that crosses the cap |
| One user sees another user's facts | Scopes mixed | Pick one scope for each write |
| Session resumes on corrupt state | Non-atomic write | Temp file, `fsync`, `os.replace` |

## Questions
type: qa
from: phases/11-llm-engineering/05-context-engineering/docs/en.md, phases/14-agent-engineering/07-memory-virtual-context-memgpt/docs/en.md, phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/docs/en.md, phases/14-agent-engineering/09-hybrid-memory-mem0/docs/en.md, phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md

- **Bigger window, no memory?** 128k-window baselines still miss long-horizon facts that a 4k-window agent with external memory catches.
- **Why sleep-time compute?** Primary turns do not wait. The sleep agent can use a stronger, slower model.
- **Why three stores?** A single store is wrong for two of three query classes.
- **How does fusion rank?** A weighted sum of relevance, importance and recency. Weights change per product.
- **What goes in repo memory?** Task id, touched files, assumptions, blockers, next action. Not raw chat transcripts.
