# Serve reasoning models

> A reasoning model writes its thinking before the answer, and the reasoning parser keeps the thinking out of the answer text.

Your Qwen3 server returns a long block of thinking where you expected a short answer. When you finish this section, you can separate the thinking from the answer, turn the thinking off, and limit its length.

We did not measure the speed of reasoning models for this manual. We checked the fields and switches on this page on an L4 with Qwen3-8B-FP8. That covers the `reasoning` field, `enable_thinking` per request and per server, the thinking budget, and the stream order. The rest comes from the vLLM documentation and the source at 0.31.0.

## Know what the model writes

**Reasoning model:** a model that writes its reasoning steps first, between markers such as `<think>` and `</think>`, and then the final answer. Qwen3, DeepSeek-R1, and QwQ are examples. Qwen3 thinks by default.

Without a reasoning parser, vLLM returns the whole output in `content`. The answer then starts with the thinking. The thinking also counts against `max_tokens`, so a short limit can end the request before the answer starts.

## Turn on the parser

Start the server with the parser for your model family. For Qwen3, the parser is `qwen3`:

```bash
vllm serve Qwen/Qwen3-8B --reasoning-parser qwen3 2>&1 | tee server.log
```

The default is no parser. vLLM does not pick one from the model name. The vLLM documentation lists the parser name for each supported family, such as `deepseek_r1` for DeepSeek-R1 and QwQ.

With the parser, a chat response has two text fields:

| Field | What it holds |
|---|---|
| `choices[0].message.reasoning` | the thinking, without the markers |
| `choices[0].message.content` | the final answer |

In a stream, each chunk carries the new text in `delta.reasoning` or in `delta.content`. Older releases called the field `reasoning_content`. At 0.31.0 the response field is `reasoning`, so update a client that reads the old name.

## Turn the thinking off or limit it

You have three controls:

- **For one request.** Send `"chat_template_kwargs": {"enable_thinking": false}` in the request body. With the OpenAI client, put it in `extra_body`.
- **For the whole server.** Start the server with `--default-chat-template-kwargs '{"enable_thinking": false}'`. A request can still turn the thinking on again with its own `chat_template_kwargs`.
- **A budget for the thinking.** Send `thinking_token_budget` in the request. When the thinking reaches that many tokens, vLLM makes the model close the thinking and start the answer. The parser must be on.

The name `enable_thinking` comes from the Qwen3 chat template. Other families use other names, so read the chat template of your model.

## Know what changes for JSON and tools

With a reasoning parser on, structured output applies to the answer only, after the thinking ends. The thinking itself is free text. The Qwen3 parser also works with tool calls, so a request can return `reasoning` and `tool_calls` together. For tool calls, also start the server with `--enable-auto-tool-choice` and a tool call parser, such as `--tool-call-parser hermes` for Qwen3. [The JSON page](#s-return-valid-json-and-tool-calls) shows how to ask for a schema.

Give a thinking request a large `max_tokens`. If the limit ends the request inside the thinking, `content` is empty and `finish_reason` is `length`. A response that a limit cut is not valid JSON.

## Check the setup

Send one request with the thinking on and one with it off:

```bash
curl -s http://localhost:8000/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model": "Qwen/Qwen3-8B", "messages": [{"role": "user", "content": "Is 91 a prime number?"}], "max_tokens": 2048}'
```

The first reply has text in both `reasoning` and `content`. Add `"chat_template_kwargs": {"enable_thinking": false}` to the body and send it again. The second reply has an empty or missing `reasoning` field and a short `content`.

```takeaways
- Start a reasoning model with --reasoning-parser, so the thinking leaves the answer text.
- Read the answer from content and the thinking from reasoning.
- Turn the thinking off with enable_thinking, or limit it with thinking_token_budget.
```

Sources: vLLM documentation at v0.31.0 (docs/features/reasoning_outputs.md, docs/features/structured_outputs.md), the vLLM source at v0.31.0 (vllm/reasoning/, vllm/config/structured_outputs.py, vllm/config/reasoning.py, vllm/entrypoints/launchers/cli_args.py, vllm/entrypoints/openai/chat_completion/protocol.py, vllm/sampling_params.py), capture/gpu/out-l4/livecheck-2026-10-22.txt.
