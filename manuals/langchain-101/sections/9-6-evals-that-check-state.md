# Evals in CI: tool calls, rows, and state

> Assert on tool calls, database rows, and thread state, and run the suite on each model you deploy, because three real models failed different cases of one suite.

Your 20 conversation tests pass against a scripted model. You point the service at a real model, and seven of them fail. Some failures are the model. Some are the test, which had learned the habits of the scripted model.

When you finish this section, you can write an eval that checks state and not wording. You can tell a model failure from a test failure, and choose which cases block a deploy.

## What one eval checks

**Eval:** one scripted conversation against the running service, followed by assertions on what the service did. The service under test is the real FastAPI app with Postgres. Only the model changes from run to run.

```listing
title: one eval: the refund is proposed, held, and written once
source: capture/lab/prodapp-mac/code/tests/test_evals.py
lang: python
---
@case
async def refund_approved_once(c, t, x):
    order = f"ORD-{c.user}-1"
    events = await c.say(t, f"Please refund {order}")
    [pending] = interrupts(events)
    assert (pending["name"], pending["args"]["order_id"], pending["args"]["amount_cents"]) == ("refund_order", order, 12900)
    assert await refunds(x.sql, order) == []
    await c.approve(t)
    assert await refunds(x.sql, order) == [{"amount_cents": 12900}]
    assert finished(await c.state(t))
```

Every assertion reads something the model cannot word differently. The first reads the interrupt that the stream sent, with the tool name and its arguments. The second and third read the `refunds` table before and after the approval. The last reads the thread state: no next node, no pending interrupt, and a final AI message with no tool calls.

The other cases follow the same rule. A FAQ case checks that `search_faq` ran and that its result holds the right entry id. A fault case reads the OpenTelemetry spans of the run, as [section 9.4](#s-opentelemetry-spans-with-langsmith-off) shows. Two checks read text, and both are literal strings that must not appear: another customer's item name, and another user's door code.

## One suite, three models

**We measured** the 27 tests of the service on the Mac, three times with Qwen3 4B and three times with Qwen3 14B through Ollama. Both ran with temperature 0 and seed 42. Claude Haiku 5.5 ran the 20 evals once. The other seven tests start servers and send many requests, and our budget for Anthropic calls covered the evals only. The backup model was Qwen3 8B for the 4B runs and Qwen3 4B for the others.

| Model | Runs | Tests in a run | Passed in each run |
|---|---|---|---|
| Qwen3 4B | 3 | 27 | 16, 16, 16 |
| Qwen3 14B | 3 | 27 | 22, 21, 21 |
| Claude Haiku 5.5 | 1 | 20 | 20 |

[Figure 9.6](#fig-9-6) puts every test of every run in one grid.

```figure
id: fig-9-6
kind: chart
title: the same 27 tests on three real models
claim: Qwen3 4B and Qwen3 14B failed different cases of the same suite, and Claude Haiku 5.5 passed all 20 evals.
caption: Each row is one test, and each column is one run of the suite. A plum cell passed. A rose cell failed, and its letter is the cause in the key. A dotted cell did not run. From capture/lab/prodapp-mac/summary/evals-mac.json.
```

## Why each case failed

We read the stream events, the thread state, and the database rows of every failed case. Each failure has one cause, and the causes fall in two groups.

| Cause | Kind | Qwen3 4B | Qwen3 14B | Claude Haiku 5.5 |
|---|---|---|---|---|
| asked for the amount and the reason, and proposed no refund | model | 3 cases | none | none |
| invented `amount_cents` 10000 without reading the order | model | none | 3 cases | none |
| proposed `amount_cents` 0, and the approver approved it | model | 1 case | 1 case | none |
| opened a ticket in place of a refund | model | 1 case | none | none |
| did not call `save_note` | model | 2 cases | none | none |
| answered without `search_faq` | model | 1 case | none | none |
| an approve sent after no refund was proposed | test | 2 cases | none | not run |
| a time limit that assumed the scripted model | test | 1 case | 1 case | none |
| uvicorn closed the stream at 10 s, and the run finished in the drain | test | none | 1 case in 2 of 3 runs | not run |

Within a model, the causes did not change from run to run. Qwen3 4B failed the same 11 tests in each of 3 runs. Qwen3 14B failed the same four evals and the crash test in each of its 3 runs.

The model failures are the results that the suite exists to find. Qwen3 4B would not call `refund_order` until the customer gave an amount and a reason. Qwen3 14B called it at once, with an amount that it made up. `refund_order` refused 10000 cents on an order of 8900, so no money moved. On an order of 12900 cents the same guess would have refunded the wrong amount.

Claude Haiku 5.5 read the order before it proposed a refund, in 5 of 5 refund cases. It read it in the same turn three times and in an earlier turn of the thread twice. It proposed the order total each time.

The zero refund is the case to remember. Both Qwen models proposed `amount_cents` 0 for `Refund ORD-e19-3`. The test approved it, as a careless human would, and the tool wrote a refund row of 0 cents. [Section 9.3](#s-approvals-and-the-idempotency-key) has the record and the two fixes. With them, the 0-cent row was gone in 6 of 6 reruns, and the refund evals passed no more often than before.

State checks have a blind spot, and Claude Haiku 5.5 found it. After an approved refund was written, it told the customer `It's pending human approval, so it isn't final yet.` The row existed, the test passed, and the reply was wrong. Read a sample of replies by hand, or add a check for the claims that matter to you.

## Tests that knew the scripted model

Three failures were in the tests. The crash test and the LangSmith test asked for a refund and then posted an approve without a check. When the model proposed no refund, `/approve` answered 409 with a JSON body, and the helper parsed that body as SSE. The test failed with a `ValueError` that said nothing about the service.

The third test sent SIGTERM 3.5 s into a run and expected the run to still be going. The scripted model slept for 3 s on each call. Qwen3 4B finished the whole run in 1.45 s. The `hung_tool_times_out` case had the same flaw on Qwen3 14B. It bounded the whole conversation to 5 s, and the run took 11.04 s, while the tool timeout itself worked.

Those tests also leaked. Each one started uvicorn workers and stopped them only on its success path. After the six Qwen runs, 12 workers from failed tests were still running. With the load test's worker, `lc_prod` had 77 connections, and stopping the 12 left 17. Stop test servers in a `finally` block, or in a fixture.

So split the suite in two:

- **Service tests** check what the service promises: the lock, the owner check, crash recovery, shutdown, and LangSmith staying off. Drive them with a request that leaves the model no choice, such as an explicit amount and reason. Require every run to pass. [Section 9.3](#s-approvals-and-the-idempotency-key) and [section 9.5](#s-timeouts-retries-backup-model-and-shutdown) ran them that way.
- **Model evals** check what the model does with an ordinary request. Run each one on each model that you deploy, and track a pass rate per case.

## Repeats on a local model

Greedy decoding with a fixed seed repeats itself. The three runs of Qwen3 4B passed the same 16 tests. Between the first and second run, 18 of 20 eval transcripts matched word for word. The two that differed were the longest conversations, the runaway loop and the six-turn thread, and their tool calls matched. So three repeats of a greedy local model measure the service and not the model. Vary the seed or the temperature when you want a spread.

## The CI job

The file `deploy/ci.yml` in the app code is a workflow that runs the suite on each push with a Postgres service container. It is not installed under `.github/workflows` in this repository. As written it uses the scripted model, and we did not run it on GitHub Actions. To run it on a real model, set `MODEL` and give the job a key or an Ollama service. Keep the two halves apart: the service tests on every push, and the model evals on a schedule with a pass-rate threshold for each case.

```takeaways
- Assert on tool calls, tool arguments, database rows, and thread state, not on exact reply text.
- Check the reply claims that matter, such as a refund status.
- Check that the model proposed the action before the test approves it.
- Drive service tests with requests that pin the tool call, and require every run to pass.
- Run model evals on each deployed model, and track a pass rate per case.
- Vary the seed when you repeat a greedy local model, or the repeats measure nothing.
```

Sources: capture/lab/prodapp-mac/summary/evals-mac.json, capture/lab/prodapp-mac/runs/summary/suite-mac.json, capture/lab/prodapp-mac/runs/suite/qwen3-4b/rep-1/pytest.txt, capture/lab/prodapp-mac/runs/suite/qwen3-14b/rep-1/pytest.txt, capture/lab/prodapp-mac/runs/suite/haiku/rep-1/pytest.txt, capture/lab/prodapp-mac/runs/suite/qwen3-14b/rep-1/cases/19-new_message_while_waiting_for_approval.json, capture/lab/prodapp-mac/code/tests/test_evals.py, capture/lab/prodapp-mac/code/tests/conftest.py, capture/lab/prodapp-mac/code/tests/procs.py, capture/lab/prodapp-mac/code/tests/test_durability.py, capture/lab/prodapp-mac/code/deploy/ci.yml, capture/lab/prodapp-mac/code/scripts/causes.json, capture/lab/prodapp-mac/summary/fix-mac.json.
