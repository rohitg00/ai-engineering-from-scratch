# Middleware: hooks and their order

> A middleware has six hooks, the four node hooks become graph nodes, and `before_*` hooks run in list order while `after_*` hooks run in reverse.

You add a logging middleware and a redaction middleware to an agent. The log shows the redacted text on the way in and the raw text on the way out. The order of the `middleware` list did that, and it works in two directions.

When you finish this section, you can write a middleware and say where each of its hooks runs. You can also predict the order of hooks from several middlewares. You can also say what a change of order breaks.

## The six hooks

**Middleware:** an object of a subclass of `AgentMiddleware` that `create_agent` runs at fixed points of the agent loop.

**Node hook:** a hook that `create_agent` turns into a graph node. It takes the state and the runtime, and returns a state update or `None`.

**Wrap hook:** a hook that takes a request and a `handler`, and calls the handler to run the model or the tool. It can change the request, call the handler again, or return without a call.

| Hook | Kind | When it runs | It returns |
|---|---|---|---|
| `before_agent` | node | once, at the start of each run | a state update or `None` |
| `before_model` | node | before each model call | a state update or `None` |
| `wrap_model_call` | wrap | around each model call, inside the `model` node | a `ModelResponse`, an `AIMessage`, or an `ExtendedModelResponse` |
| `after_model` | node | after each model call | a state update or `None` |
| `wrap_tool_call` | wrap | around each tool call, inside the `tools` node | a `ToolMessage` or a `Command` |
| `after_agent` | node | once, at the end of each run | a state update or `None` |

Each hook has an async twin with an `a` in front, such as `abefore_model`. A middleware with only a sync `wrap_model_call` raises `NotImplementedError` when the agent runs under `ainvoke` {{code libs/langchain_v1/langchain/agents/middleware/types.py}}. A middleware can also declare `tools` and a `state_schema`, and `create_agent` adds both to the agent.

The kit middleware `Traced` writes one line for each hook it runs. Its model wrapper shows the shape of every wrap hook:

```listing
title: a wrap_model_call hook
source: capture/s_agents.py
lang: python
note: One method of the Traced middleware. The other hooks append one line each.
---
    def wrap_model_call(self, request, handler):
        self.log.append(f"{self.label}.wrap_model_call enter")
        response = handler(request)
        self.log.append(f"{self.label}.wrap_model_call exit")
        return response
```

For a hook or two, the decorators `before_model`, `after_model`, `before_agent`, `after_agent`, `wrap_model_call`, `wrap_tool_call`, and `dynamic_prompt` turn one function into a middleware.

## Hooks become nodes

The kit builds an agent with `middleware=[A, B, C]`, three `Traced` instances. Each node hook is a node named `<middleware name>.<hook>`. The edges chain them in the list order on the way in:

```listing
title: the edges into the model node
source: capture/out/09-middleware-order.txt
lang: json
note: Cut to the edges from __start__ to model.
---
  "A.before_agent -> B.before_agent",
  "A.before_model -> B.before_model",
…
  "B.before_agent -> C.before_agent",
  "B.before_model -> C.before_model",
…
  "C.before_agent -> A.before_model",
  "C.before_model -> model",
…
  "__start__ -> A.before_agent",
```

On the way out, the edge from `model` goes to the last middleware first:

```listing
title: the edges out of the model node
source: capture/out/09-middleware-order.txt
lang: json
note: Cut to the after_model edges.
---
  "A.after_model -> A.before_model",
  "A.after_model -> C.after_agent",
  "A.after_model -> tools",
…
  "B.after_model -> A.after_model",
…
  "C.after_model -> B.after_model",
…
  "model -> C.after_model",
```

`A.after_model` is the last node hook after the model. Its three edges go to `tools`, to the end through `C.after_agent`, or back to `A.before_model` for a jump. After `tools`, the loop goes back to `A.before_model`, so `before_agent` hooks run once for each run.

## The order of one tool round trip

The kit ran one question with one tool call and recorded every hook:

```listing
title: the hook order for one tool round trip
source: capture/out/09-middleware-order.txt
lang: json
note: Cut to the first model call and the tool call. The second model call repeats the model part, and the three after_agent hooks end the run.
---
  "A.before_agent",
  "B.before_agent",
  "C.before_agent",
  "A.before_model",
  "B.before_model",
  "C.before_model",
  "A.wrap_model_call enter",
  "B.wrap_model_call enter",
  "C.wrap_model_call enter",
  "  model called",
  "C.wrap_model_call exit",
  "B.wrap_model_call exit",
  "A.wrap_model_call exit",
  "C.after_model",
  "B.after_model",
  "A.after_model",
  "A.wrap_tool_call enter add",
  "B.wrap_tool_call enter add",
  "C.wrap_tool_call enter add",
  "C.wrap_tool_call exit",
  "B.wrap_tool_call exit",
  "A.wrap_tool_call exit",
…
  "C.after_agent",
  "B.after_agent",
  "A.after_agent"
```

Three rules give this order, and [figure](#fig-3-3) draws them:

1. `before_agent` and `before_model` hooks run in list order, A then B then C.
2. `after_model` and `after_agent` hooks run in reverse list order, C then B then A.
3. Wrap hooks nest. The first middleware in the list is the outermost layer, so A enters first and exits last.

```figure
id: fig-3-3
kind: flow
title: the order of hooks from three middlewares
claim: Node hooks run A, B, C before the model and C, B, A after it, and wrap hooks nest with A as the outer layer.
caption: Read the trace from left to right. Each dot is one node hook in lane A, B, or C, and each bar is one wrap hook from enter to exit. The numbered phases are keyed under the trace, and the bottom row is the edges around the model node. From capture/out/09-middleware-order.txt.
```

The custom middleware page states the same three rules {{docs oss/python/langchain/middleware/custom}}. Our capture agrees with it at the pin.

## What the order changes

Put a middleware first when it must see the raw request and the final response. A wrap hook in front sees everything the later ones do. A node hook in front runs first before the model and last after it.

The reverse order of `after_model` has a cost. A middleware that sets `jump_to` from `after_model` runs before the `after_model` hooks of every middleware in front of it. If one of those is `HumanInTheLoopMiddleware`, the jump can skip the review. The other order failed too in batched mode: a rejected call still ran. [Section 5.5](#s-human-in-the-loop-batched-and-per-call) shows both cases, as issue langchain#40492 reports, and per-call mode was safe in both orders {{issue langchain#40492}}. The human in the loop page says to list `HumanInTheLoopMiddleware` before retry and error middleware {{docs oss/python/langchain/human-in-the-loop}}.

**jump_to:** a key that a node hook returns to move the run to `model`, `tools`, or `end`. A hook can use it only when it declares the targets with `hook_config(can_jump_to=...)` or the `can_jump_to` option of a decorator.

## Names must be unique

`create_agent` names a middleware by its `name` property, which is the class name by default. Two instances of one class have the same name, and the agent refuses them:

```listing
title: two middleware with the same name
source: capture/out/09-middleware-order.txt
lang: text
---
create_agent(middleware=[A, A]):

raised builtins.AssertionError: Please remove duplicate middleware instances.
```

To use two instances of one class, give each its own `name`. The kit `Traced` middleware returns its label as the name:

```listing
title: a name property
source: capture/s_agents.py
lang: python
---
    @property
    def name(self):
        return self.label
```

[Section 7.2](#s-cost-the-framework-against-a-plain-sdk-loop) gives the measured cost of each hook.

```takeaways
- Put a middleware first when it must see the raw request and the final response.
- Expect after_model hooks to run in reverse list order.
- Use per-call review when another middleware sets jump_to from after_model.
- Give each middleware instance a unique name.
- Write the async twin of every wrap hook when the agent runs under ainvoke.
```

Sources: capture/s_agents.py, capture/out/09-middleware-order.txt; docs.langchain.com at docs commit 04d4d4a (oss/python/langchain/middleware/custom, oss/python/langchain/human-in-the-loop); issue langchain#40492; libs/langchain_v1/langchain/agents/middleware/types.py and libs/langchain_v1/langchain/agents/factory.py at langchain==1.5.0.
