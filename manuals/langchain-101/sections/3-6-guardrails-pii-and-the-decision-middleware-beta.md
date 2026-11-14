# Guardrails, PII, and the decision middleware (beta)

> `PIIMiddleware` rewrites or blocks one kind of personal data by a fixed rule, and two beta middlewares ask a decision model to pick a model or block a call.

A user pastes an email address and a card number into your support agent. The model provider now has both. A day later the model asks to delete the `main` branch, and the tool runs. Both needed a check between the user, the model, and the tools.

When you finish this section, you can choose a PII strategy, say where `PIIMiddleware` acts, and read what it changed. You can also set up `ModelRouterMiddleware` and `AutoModeMiddleware`, and say what their decision models receive.

## Two kinds of guardrail

**Guardrail:** a check that runs inside the agent and changes, blocks, or stops a request, a reply, or a tool call.

The guardrails page names two kinds {{docs oss/python/langchain/guardrails}}. A deterministic guardrail uses rules, such as a regular expression. It is fast and repeatable, and it misses what the rule does not describe. A model-based guardrail asks a model or a classifier, and costs a call.

`PIIMiddleware` is the deterministic guardrail in `langchain`. `HumanInTheLoopMiddleware` asks a person, and [section 5.5](#s-human-in-the-loop-batched-and-per-call) covers it. The two decision middlewares below are model-based.

## PIIMiddleware

**PIIMiddleware:** a middleware that finds one type of personal data in messages and applies one strategy to each match.

Each instance handles one type: `email`, `credit_card`, `ip`, `mac_address`, `url`, or a name of your own with a `detector` {{code libs/langchain_v1/langchain/agents/middleware/pii.py}}. Use one instance for each type. Each instance is named `PIIMiddleware[<type>]`, so two instances of one type conflict. Its defaults set where it acts:

| Option | Default | Where it acts |
|---|---|---|
| `apply_to_input` | `True` | the newest human message, in `before_model` |
| `apply_to_output` | `False` | the newest AI message, in `after_model` |
| `apply_to_tool_results` | `False` | the tool messages after the newest AI message, in `before_model` |
| `strategy` | `redact` | what it does with a match |

The middleware changes the message in the state, so the checkpoint and the trace hold the changed text too. The kit sends one input with four kinds of data, through one middleware at a time. [Figure 3.6](#fig-3-6) sets the results side by side.

```figure
id: fig-3-6
kind: comparison
title: four PII strategies on one input
claim: Redact and hash replace the match, mask keeps the last four digits of a card, and block raises before the model gets any call.
caption: Each row is one run of the kit with one PIIMiddleware. The left column is the setting, and the right column is the text the model received, or the error. From capture/out/14-mw-pii.txt.
```

```listing
title: the human message after PIIMiddleware('credit_card', strategy='mask')
source: capture/out/14-mw-pii.txt
lang: json
---
    "content": "Mail ada@example.com, card **** **** **** 1111, from 192.168.1.20, see https://example.com/x",
```

`hash` writes the type and a short hash, here `<ip_hash:55235459>`. The same address gives the same hash, so the model can tell two values apart without seeing them. `block` raises before the model call:

```listing
title: PIIMiddleware('email', strategy='block')
source: capture/out/14-mw-pii.txt
lang: text
note: The model log after the error is empty.
---
raised langchain.agents.middleware._redaction.PIIDetectionError: Detected 1 instance(s) of email in text content

model calls seen by the fake:
[]
```

A custom detector is a regular expression or a function. The kit redacts keys that match `sk-[a-z0-9]{8}`:

```listing
title: a custom detector
source: capture/s_middleware.py
lang: python
---
        middleware=[PIIMiddleware("api_key", detector=r"sk-[a-z0-9]{8}", strategy="redact")], inp=ask("my key is sk-abcd1234"), first=0)
```

The model received `my key is [REDACTED_API_KEY]`. With `apply_to_output=True`, the AI reply `Write to grace@example.org.` became `Write to [REDACTED_EMAIL].` in the state.

The guardrails page describes a stream transformer for `apply_to_output=True`. It holds back the last 128 characters of each text block, so a match split across chunks is not sent {{docs oss/python/langchain/guardrails}}. The kit did not stream through `PIIMiddleware`. That test is coming in the next edition, and section 7.6 lists it.

## Decision models

**Decision model:** a `BaseDecisionModel` from `langchain_core.decisions`, new in `langchain-core` 1.8.0. It answers typed questions, such as a choice among named options or the probability that a statement is true.

Both decision middlewares are new in `langchain` 1.5.0, and both are in beta. The prebuilt middleware page marks both as beta {{docs oss/python/langchain/middleware/built-in}}. In the code, `ModelRouterMiddleware` has the `beta` decorator and warns when you build it. `AutoModeMiddleware` says beta in its docstring only, so it gives no warning {{code libs/langchain_v1/langchain/agents/middleware/auto_mode.py}}. The kit uses a scripted decision model, so the answers below are ours and the questions are what the middleware sent.

## ModelRouterMiddleware

`ModelRouterMiddleware` asks one choice question in `before_agent` and uses the chosen model for every model call of the run. The kit gives it two choices, `fast` and `deep`. This is the question it sent:

```listing
title: the question ModelRouterMiddleware sent
source: capture/out/20-mw-decisions.txt
lang: json
---
    "questions": {
      "model_route": {
        "type": "choice",
        "criteria": {
          "fast": "arithmetic and short answers",
          "deep": "long reasoning"
        },
        "instructions": "Pick the cheapest model that can answer."
      }
    }
```

The scripted answer was `fast`. The `fast` model got the only model call, the model passed to `create_agent` got none, and the answer went into `state["model_route"]`. The run warned `LangChainBetaWarning: The middleware `ModelRouterMiddleware` is in beta.`.

## AutoModeMiddleware

**AutoModeMiddleware:** a middleware that asks a decision model, before each call to a listed tool, for the probability that the call is risky. At 0.5 or more it blocks the call.

The middleware sends the tool call, the tool description, and up to 30 recent messages {{code libs/langchain_v1/langchain/agents/middleware/auto_mode.py}}. A blocked call gets an error `ToolMessage`, and the tool does not run. A tool you do not list runs with no question. When the decision model raises, the error goes up and the tool does not run. The middleware blocks. It never asks a person.

The kit lists `delete_branch` and `add`. Its scripted model answers 0.93 for `delete_branch` and 0.05 for `add`:

```listing
title: one blocked call and one allowed call
source: capture/out/20-mw-decisions.txt
lang: json
note: The two ToolMessages. The ids are cut.
---
    "type": "ToolMessage",
    "content": "The tool call `delete_branch` was blocked because it was classified as risky (probability: 0.93). The tool was not executed.",
    "name": "delete_branch",
…
    "tool_call_id": "call_d",
    "status": "error"
  },
  {
    "type": "ToolMessage",
    "content": "5",
    "name": "add",
```

[Figure 3.6b](#fig-3-6b) draws the two paths. The question that the decision model received has `criteria` set to `null`:

```listing
title: the question AutoModeMiddleware sent
source: capture/out/20-mw-decisions.txt
lang: json
note: The instructions are cut after their first sentence.
---
    "is_risky": {
      "type": "noul",
…
      "criteria": null
    }
```

```figure
id: fig-3-6b
kind: decision
title: what AutoModeMiddleware does with one tool call
claim: A listed tool call at or above 0.5 gets an error ToolMessage and never runs, and the question carries criteria null unless you pass criteria.
caption: Read from the tool call at the top. The amber box is the question to the decision model, with the fields it sent. The rose box is the blocked delete_branch call, and the green box is add, which ran. From capture/out/20-mw-decisions.txt.
```

The config class of the middleware has default criteria: risky means harm, more than the user allowed, exposed data, or an outside effect. The constructor takes `criteria=None` as its default and passes it on, and that `None` replaces the default {{code libs/langchain_v1/langchain/agents/middleware/auto_mode.py}}. So with no `criteria` argument, the decision model gets the instructions and no criteria. Pass a `NoulCriteria` with `true` and `false` texts when your decision model needs them.

```takeaways
- Add one PIIMiddleware for each type of personal data you must remove.
- Set apply_to_output=True when the model can repeat personal data in its reply.
- Use the block strategy when a match must stop the run before the model sees it.
- Expect no warning from AutoModeMiddleware, though it is beta.
- Pass criteria to AutoModeMiddleware, because the default sends criteria null.
- Use HumanInTheLoopMiddleware when a person must approve a call, because auto mode only blocks.
```

Sources: capture/out/14-mw-pii.txt, capture/out/20-mw-decisions.txt, capture/s_middleware.py, capture/README.md; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/guardrails, oss/python/langchain/middleware/built-in); libs/langchain_v1/langchain/agents/middleware/pii.py, auto_mode.py, and model_router.py at langchain==1.5.0; libs/core/langchain_core/decisions at langchain-core 1.8.0.
