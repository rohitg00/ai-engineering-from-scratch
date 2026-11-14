# A deep agent with a subagent and files

> A deep agent on a local model plans, writes, and delegates a review in seven model calls, and its first call sends 3,651 prompt tokens for a short task.

You want an agent that drafts a document, asks a second agent to review it, and applies the fixes. Deep Agents gives you the file tools, the `task` tool, and the subagents in one call. You still need to know what each call costs, and which part of a bad result came from the model.

When you finish this section, you can build a deep agent with one subagent on a local model. You can also record the tokens of each model call and read a run call by call.

## What the demo builds

The code is our own. The Deep Agents course of LangChain Academy has no license, so the demo copies nothing from it. It uses `deepagents` 0.7.38 with `ChatOllama` and Qwen3 8B, at temperature 0, seed 42, and with reasoning off.

The demo applies these sections:

- [Deep Agents 0.7](#s-deep-agents-0-7): the tools, the virtual filesystem, and `TodoListMiddleware`, which 0.7 leaves out.
- [Subgraphs and multi-agent patterns](#s-subgraphs-and-multi-agent-patterns): the `task` tool runs the subagent as a separate agent.
- [Cost: the framework against a plain SDK loop](#s-cost-the-framework-against-a-plain-sdk-loop): tokens per call, read from `usage_metadata`.

The agent has one subagent, `editor`. A subagent is a dict with a name, a description that the main agent reads, and a system prompt of its own:

```listing
title: the deep agent and its editor
source: capture/demos/deep-agent/deep_agent.py
lang: python
---
    agent = create_deep_agent(
        model=model,
        system_prompt="You write clear technical documents. Keep the files you write in /notes/.",
        subagents=[{**EDITOR, "model": model}],
        middleware=[TodoListMiddleware()],
        checkpointer=InMemorySaver(),
    )
```

The task asks for release notes of three changes, a review by the editor, the fixes, and the final text. The system prompt of the editor asks for sentences over 25 words and sentences in the passive voice. The editor returns fixes and edits nothing.

A callback records each model call. It reads `usage_metadata` from the reply and `lc_agent_name` from the metadata of the call. Deep Agents sets that name to `editor` for the subagent, so the callback can tell the two agents apart.

## The recorded run

The run made seven model calls in 62.0 s. The first call took 22.6 s, which includes the load of the model into Ollama:

```listing
title: the seven model calls
source: capture/lab/deep-agent/run.log
lang: text
---
  call  1  main    in  3651  out  120   22.6 s  -> write_todos
  call  2  main    in  3872  out  124    6.7 s  -> write_file
  call  3  main    in  4016  out   58    3.2 s  -> task
  call  4  editor  in  1977  out   27    8.4 s  -> read_file
  call  5  editor  in  2113  out  143    7.4 s  -> answer
  call  6  main    in  4225  out  104    6.3 s  -> write_todos
  call  7  main    in  4446  out  111    7.4 s  -> answer
```

The main agent wrote a todo list, wrote `/notes/release-2.0.md`, and called `task`. The editor read the file and answered. The main agent then marked its todos and replied with the text of the file. It never called `edit_file`, because the editor returned no fixes:

```listing
title: what the editor returned
source: capture/lab/deep-agent/run.log
lang: text
note: The copy of the file inside the reply is cut at the mark.
---
  result    task: The file `/notes/release-2.0.md` has been read successfully. Here is the content: ``` ## Version 2.0 Release Notes The sync command now resumes an interrupted upload from the last finished part, ensuring seamless continuity for large file transfers. … ``` No sentences in this file exceed 25 words, and there are no sentences in passive voice. Therefore, no fixes or improvements are needed.
```

The file that the run wrote holds two sentences in the passive voice:

```listing
title: two sentences of the final file
source: capture/lab/deep-agent/run.log
lang: text
---
The config file has been moved from ~/.tool.toml to the XDG config folder. The old path still works for one release, ensuring backward compatibility during the transition.

The --verbose flag has been removed. Use --log-level debug in its place for detailed logging and debugging information.
```

## What the run shows

**We measured** one run on the Mac, Apple M1 Max, 10 cores, 64 GiB, with Ollama 0.31.1. The main agent made 5 model calls with 20,210 prompt tokens. The editor made 2 calls with 4,090 prompt tokens. Together they sent 24,300 prompt tokens and got 687 output tokens, for a file of 458 characters. [Figure](#fig-8-4) shows each call.

```figure
id: fig-8-4
kind: chart
title: prompt tokens of each model call of the deep agent
claim: Every call of the main agent sent more than 3,600 prompt tokens, and the editor calls sent about half that, with two tools fewer.
caption: Each dot is one model call of one run on the Mac with Qwen3 8B. Blue dots are the main agent and indigo dots the editor. The label on the axis is the tool the call asked for. From capture/lab/summary/demos-mac.json.
```

The first call of the main agent sent 3,651 tokens for a task of about 100 words. Most of that is the harness: the system prompt of Deep Agents and the schemas of 9 tools. [Section 6.3](#s-deep-agents-0-7) measured the extra cost of the harness at 2,075 to 2,251 tokens per call on Qwen3 8B. Each later call adds the messages of the run on top.

The editor had 7 tools: the file tools without `task` and `write_todos`. Its messages held its own system prompt and the task description from the main agent. So its calls were about half the size. A subagent is a way to keep a long side task out of the context of the main agent.

The review failure is a model result. The editor missed two sentences in the passive voice, and the main agent trusted the review. LangChain ran each step that the model asked for: the file write, the `task` call, the read, and the todo updates. A stronger model, or a check in code for the passive voice, could change the outcome. The first is a choice of model, and the second is a tool you write.

```takeaways
- Record usage_metadata and lc_agent_name on every model call of a deep agent.
- Expect more than 3,600 prompt tokens on each call of the main agent, at this pin.
- Give a subagent a narrow system prompt, because it sees only the description of its task.
- Check the work of a reviewer subagent in code when the rule is mechanical.
- Pass TodoListMiddleware when you want write_todos at 0.7.
```

Sources: capture/demos/deep-agent/deep_agent.py, capture/demos/deep-agent/run.sh, capture/demos/deep-agent/README.md; capture/lab/deep-agent/run.log, capture/lab/deep-agent/run.jsonl, capture/lab/summary/demos-mac.json; libs/deepagents/deepagents/graph.py and libs/deepagents/deepagents/middleware/subagents.py at deepagents 0.7.38; libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0.
