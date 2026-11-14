# The system prompt

> `create_agent` puts the system prompt first in every model request and never stores it in the state, so a new prompt applies to the next call of every thread.

You save a conversation with a checkpointer, change the system prompt in your code, and resume the thread. The model follows the new prompt. You look for the old prompt in the saved state, and it is not there.

When you finish this section, you can say where the system prompt lives during a run and set it from runtime context. You can also find the prompt hub at the pin.

## A string or a SystemMessage

**System prompt:** the instructions that go first in every model request of an agent.

The agents page says that the parameter takes a string or a `SystemMessage`, and that a prompt built at run time needs middleware {{docs oss/python/langchain/agents}}. `create_agent` turns a string into a `SystemMessage` once, when it builds the graph {{code libs/langchain_v1/langchain/agents/factory.py}}.

## Not in the state

The model node adds the system message to the request on each call. It does not write it to `messages`. [Section 1.2](#s-one-create-agent-run) showed both halves of this. The model got `system: You add numbers.` first on both calls, and the final state held four messages with no `SystemMessage`:

```listing
title: what the model received on the second call
source: capture/out/06-agent-run.txt
lang: json
note: Cut to the message list of call 2.
---
    "call": 2,
    "messages": [
      "system: You add numbers.",
      "human: What is 2 + 3?",
      "ai",
      "tool: 5"
    ],
```

[Figure 2.5](#fig-2-5) draws the request that the model node builds. Three things follow from it.

```figure
id: fig-2-5
kind: flow
title: how the model node builds each request
claim: Each model request is the system prompt from the agent plus the messages from the state, and only the model reply goes back into the state.
caption: Read from left to right. The violet box is set when you build the agent, and the teal box is the saved state. The plum arrow is the model call, and only its reply returns to the state. From capture/out/06-agent-run.txt and capture/out/18-mw-selection-emulation.txt.
```

- A checkpoint holds no prompt. A thread resumed by new code uses the new prompt from its next model call.
- Two agents can share one thread with two prompts. Each one sends its own prompt with the shared messages.
- The prompt costs input tokens on every call, because it is sent every time. Long prompts multiply with the number of steps.

A `SystemMessage` that you put in the input messages is different. It is a message, so `add_messages` stores it in the state, and every later call sends it again.

## A prompt from runtime context

The `dynamic_prompt` decorator turns a function of the model request into middleware that sets the system prompt for each call. The kit reads the user name from the runtime context:

```listing
title: a dynamic prompt
source: capture/s_middleware.py
lang: python
note: Cut from the scenario. The fake model returns one message.
---
    @dynamic_prompt
    def by_user(request):
        return f"You are helping {request.runtime.context['user']}."
…
    create_agent(fake, middleware=[by_user]).invoke(ask("hi"), context={"user": "Ada"})
```

The model got the prompt with the name filled in:

```listing
title: the request with a dynamic prompt
source: capture/out/18-mw-selection-emulation.txt
lang: json
note: The last section of the file, cut to the messages.
---
    "messages": [
      "system: You are helping Ada.",
      "human: hi"
    ]
```

For more control, a `wrap_model_call` middleware can read and replace the prompt of each request. The custom middleware page says to read and change the prompt through the `system_message` field of `ModelRequest` {{docs oss/python/langchain/middleware/custom}}. Part 3 explains the middleware hooks and their order.

## The prompt hub

The LangChain docs at commit `04d4d4a` have no page on prompt templates for Python agents. The prompt hub moved to LangSmith. Its page says that the hub used to be the `langchainhub` package, which is now deprecated {{docs langsmith/manage-prompts-programmatically}}. The same page still shows `from langchain_classic import hub`, which is the legacy path that [section 2.1](#s-install-and-the-package-map) lists. Use the `langsmith` client to push and pull prompts, and pass the text to `create_agent` as a string.

```takeaways
- Pass the system prompt to create_agent, not as a message in the input.
- Expect a resumed thread to use the prompt of the code that resumes it.
- Count the prompt tokens once for each model call of a run.
- Use dynamic_prompt to build the prompt from runtime context.
- Pull shared prompts with the langsmith client, not with the legacy hub module.
```

Sources: capture/out/06-agent-run.txt, capture/out/18-mw-selection-emulation.txt, capture/s_middleware.py; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/agents, oss/python/langchain/middleware/custom, langsmith/manage-prompts-programmatically); libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0.
