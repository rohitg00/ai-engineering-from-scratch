# An assistant with memory and approvals that survives a restart

> An assistant that must survive a restart needs a durable checkpointer, a store, per-call review, a summary trigger, and an idempotency key, and a crash still asks the reviewer twice.

Your assistant asks for approval before it sends an email. The reviewer clicks approve, and the server restarts a moment later. Did the email go out? Will the assistant ask again, or send it again? The user also expects the assistant to remember their manager next week, in a new conversation.

When you finish this section, you can build an assistant that keeps its threads, its memories, and its pending approvals across processes. You can also predict what a crash after an approved side effect does, and keep that effect to one run.

## What the demo builds

The demo is one `create_agent` assistant with three tools: `remember` and `recall` for facts about the user, and `send_email`. Each step of the run is a new Python process, so each resume is a restart. The model is Qwen3 4B on Ollama.

The demo applies these sections:

- [Checkpointers and threads](#s-checkpointers-and-threads): `SqliteSaver` keeps each thread in a file.
- [Durability modes, and a crash between two steps](#s-durability-modes-and-a-crash-between-two-steps): the crash, and the idempotency key.
- [Stores and long-term memory](#s-stores-and-long-term-memory): `SqliteStore`, with the user id from `context`.
- [Context engineering and summarization](#s-context-engineering-and-summarization): `SummarizationMiddleware` with a trigger.
- [Human in the loop, batched and per call](#s-human-in-the-loop-batched-and-per-call): `per_call` review on `send_email`.

## The code

The agent takes both persistence objects and two middlewares. The summary trigger is 10 messages, and the summary keeps the last 4:

```listing
title: the assistant
source: capture/demos/assistant/assistant.py
lang: python
---
def build(saver, store):
    return create_agent(
        model(),
        tools=[remember, recall, send_email],
        system_prompt=SYSTEM_PROMPT,
        middleware=[
            SummarizationMiddleware(model(), trigger=("messages", 10), keep=("messages", 4)),
            HumanInTheLoopMiddleware(interrupt_on={"send_email": {"allowed_decisions": ["approve", "reject"]}}, interrupt_mode="per_call"),
        ],
        checkpointer=saver,
        store=store,
        context_schema=Context,
    )
```

The tools read the user id from `runtime.context`, which your code sets. The model cannot name another user, and `context_schema` types the context as a dataclass.

`send_email` uses its `tool_call_id` as the idempotency key. The key is the primary key of the `sent` table, so a second insert with the same key changes nothing. Every run of the tool also writes a row to `attempts`, so the run can count how often the tool ran:

```listing
title: the side effect with its key
source: capture/demos/assistant/assistant.py
lang: python
note: The print lines and the crash switch of the demo are cut.
---
@tool
def send_email(to: str, subject: str, body: str, runtime: ToolRuntime[Context]) -> str:
    """Send an email. A person approves each email before it is sent."""
    key = runtime.tool_call_id
    conn = outbox()
    cur = conn.execute("INSERT OR IGNORE INTO sent VALUES (?, ?, ?, ?)", (key, to, subject, body))
    outcome = "sent" if cur.rowcount == 1 else "skipped, key already sent"
    conn.execute("INSERT INTO attempts (idempotency_key, pid, outcome) VALUES (?, ?, ?)", (key, os.getpid(), outcome))
    conn.commit()
    conn.close()
…
    return f"email {outcome}: to {to}, subject {subject!r}"
```

A real email service needs the same check on its side. Send the key with the request, and let the service refuse a second request with a key it has seen.

## The recorded run

`run.sh` runs seven steps. In step 1 the user gives two facts, and the assistant saves them. In step 2 the user asks for the email. The assistant calls `recall`, then `send_email`, and the run stops at the approval:

```listing
title: step 2, the approval waits in the checkpoint
source: capture/lab/assistant/run.log
lang: text
---
== 2-ask-to-send: process 88002, thread t1, durability default, say: Email my manager that the quarterly report is ready.
  call       recall({})
  result     - my manager's email address is lead@example.org - I prefer short replies
  call       send_email({"to": "lead@example.org", "subject": "Quarterly Report Ready", "body": "The quarterly report is ready for review."})
  interrupt  send_email({"to": "lead@example.org", "subject": "Quarterly Report Ready", "body": "The quarterly report is ready for review."}), tool_call_id 3c72b9ba-6b66-47cc-af7a-d11e3338822c
  state      next ['tools'], 9 messages, 18 checkpoints, 1 pending interrupts
  store      2 memories for reader-1
  outbox     0 sent, 0 attempts of send_email
  exit       0
```

Step 3 is a new process. It reads the pending interrupt from the file, approves it, and sends the email. Then it kills itself before LangGraph saves the step. Step 4 resumes the thread in another new process:

```listing
title: steps 3 and 4, a crash after the send and a resume
source: capture/lab/assistant/run.log
lang: text
---
== 3-approve-then-crash: process 88024, thread t1, durability default, approve
  reviewer   approve send_email({"to": "lead@example.org", "subject": "Quarterly Report Ready", "body": "The quarterly report is ready for review."})
  tool       send_email ran in this process: sent (key 3c72b9ba-6b66-47cc-af7a-d11e3338822c)
  crash      SIGKILL after the email and before the checkpoint of the tools step
  exit       137

== 4-resume-after-crash: process 88029, thread t1, durability default, resume
  resume     invoke(None) on the thread, next was ['tools']
  interrupt  send_email({"to": "lead@example.org", "subject": "Quarterly Report Ready", "body": "The quarterly report is ready for review."}), tool_call_id 3c72b9ba-6b66-47cc-af7a-d11e3338822c
  state      next ['tools'], 9 messages, 18 checkpoints, 1 pending interrupts
  store      2 memories for reader-1
  outbox     1 sent, 1 attempts of send_email
  exit       0
```

The approval was gone. The thread had 18 checkpoints before step 3 and 18 after it, and the same interrupt waited again with the same `tool_call_id`. The reviewer sees a request for an email that is already in the outbox. Step 5 approves again. The tool runs a second time, finds its key, and skips the send:

```listing
title: step 5, the second approval
source: capture/lab/assistant/run.log
lang: text
note: The summary line is cut at the mark.
---
== 5-approve-again: process 88037, thread t1, durability default, approve
  reviewer   approve send_email({"to": "lead@example.org", "subject": "Quarterly Report Ready", "body": "The quarterly report is ready for review."})
  tool       send_email ran in this process: skipped, key already sent (key 3c72b9ba-6b66-47cc-af7a-d11e3338822c)
  result     email skipped, key already sent: to lead@example.org, subject 'Quarterly Report Ready'
  answer     The email was already sent. Let me know if you'd like to take any further action.
  state      next [], 6 messages, 22 checkpoints, 0 pending interrupts
  summary    Here is a summary of the conversation to date: ## SESSION INTENT Send an email to the manager to notify them that the quarterly report is ready. ## SUMMARY - The user’s primary request is to email their manager about the readiness of the quarterly report. - The user has specified a preference for  …
  store      2 memories for reader-1
  outbox     1 sent, 2 attempts of send_email
  exit       0
```

The same step shows the summary. The thread had passed 10 messages, so `SummarizationMiddleware` replaced the old ones with one summary message before the model call. The state held 6 messages after the step. In step 6, the assistant answered the address of the manager from the summary, with no tool call. In step 7, a new thread `t2` called `recall` and found both facts in the store. [Figure](#fig-8-3) shows each process.

```figure
id: fig-8-3
kind: timeline
title: seven processes of the assistant, and what each one left behind
claim: The crash lost the approved step, so the reviewer approved twice and send_email ran twice, and the key kept the outbox at one email.
caption: Read one row per process, top to bottom. The counts were read when the process ended. The rose row is the process that was killed and left no state. From capture/lab/summary/demos-mac.json.
```

The run ended with these rows in the three files:

```listing
title: the outbox, the checkpoints, and the store after the run
source: capture/lab/assistant/run.log
lang: text
---
== files after the run
sent|3c72b9ba-6b66-47cc-af7a-d11e3338822c|lead@example.org|Quarterly Report Ready
attempt|1|3c72b9ba-6b66-47cc-af7a-d11e3338822c|sent
attempt|2|3c72b9ba-6b66-47cc-af7a-d11e3338822c|skipped, key already sent
checkpoints|t1|27
checkpoints|t2|9
```

## What the run shows

**We measured** two runs of the seven steps on the Mac, Apple M1 Max, 10 cores, 64 GiB. One used the default durability, and one used `durability="sync"`. Each run is one trial, so read the counts as one example, not a rate.

The two runs gave the same counts in every step. In both, the approval did not survive the crash. The checkpoint count did not change in step 3, and the resume raised the same interrupt again. In both, `send_email` ran twice and the outbox held one email. [Section 4.3](#s-durability-modes-and-a-crash-between-two-steps) ran its agent matrix without a key, and these two runs are a first trial of an agent with one.

The summary step took 10.2 s in the default run, against 1.4 s for step 2. `SummarizationMiddleware` writes the summary with a model call of its own, and the run did not time that call apart. The pending approval, the store, and the summary all lived in the two SQLite files, so each new process found them.

Two results come from the model. Qwen3 4B followed the rule to call `recall` before it wrote, and it answered step 6 from the summary. A model that skips `recall` has to guess the address, and the review is the place to stop that.

## What to change for production

- Show the reviewer what the outbox holds for the key of the call, so a second request after a crash is clear.
- Put the key check in the service that sends, not only in your tool.
- Keep the store and the checkpointer in a database that your other processes can reach, such as Postgres.
- Expect the summary model call to add time to the turn that fires the trigger.

```takeaways
- Use the tool_call_id as the idempotency key of each side effect, and check it before the effect.
- Expect a crash after an approved effect to ask the reviewer again.
- Read the user id from context in every tool that touches the store.
- Set a trigger on SummarizationMiddleware, and expect one slow turn when it fires.
- Run each step of your tests in a new process, so every resume is a restart.
```

Sources: capture/demos/assistant/assistant.py, capture/demos/assistant/run.sh, capture/demos/assistant/README.md; capture/lab/assistant/run.log, capture/lab/assistant/run-sync.log, capture/lab/assistant/run.jsonl, capture/lab/assistant/run-sync.jsonl, capture/lab/summary/demos-mac.json; libs/langchain_v1/langchain/agents/middleware/human_in_the_loop.py and summarization.py at langchain==1.5.0; libs/checkpoint-sqlite/langgraph/checkpoint/sqlite/__init__.py and libs/checkpoint-sqlite/langgraph/store/sqlite/base.py at langgraph 1.2.22.
