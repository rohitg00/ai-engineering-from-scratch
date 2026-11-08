# Return valid JSON and tool calls

> Structured output makes the model produce valid JSON, at a cost you can measure on your own schema.

Your application needs JSON that always parses. When you finish this section, you can request structured output and check its cost.

## Ask for a schema

With structured output, vLLM limits each next token to the tokens that keep the output valid for your schema. The model cannot produce text that breaks the schema. You ask for it in the request, not with a server flag.

With the OpenAI client, use `response_format`:

```python
from openai import OpenAI

client = OpenAI(base_url="http://localhost:8000/v1", api_key="EMPTY")
schema = {
    "type": "object",
    "properties": {"city": {"type": "string"}, "days": {"type": "integer"}},
    "required": ["city", "days"],
}
reply = client.chat.completions.create(
    model="Qwen/Qwen3-8B",
    messages=[{"role": "user", "content": "Plan a trip to Lisbon. Answer in JSON."}],
    response_format={"type": "json_schema", "json_schema": {"name": "trip", "schema": schema}},
)
print(reply.choices[0].message.content)
```

For other limits, send `structured_outputs` in `extra_body`. It takes one of `json`, `json_object`, `regex`, `choice`, `grammar`, or `structural_tag`. Release 0.12.0 removed the older `guided_json` and `guided_*` fields. A recipe that uses them is out of date.

## Know what runs on the server

The default backend setting is `auto`, which picks a backend for the request. You can also name one: `xgrammar`, `guidance`, `outlines`, or `lm-format-enforcer`. The server compiles your schema into a grammar the first time it sees the schema, and it caches the result. On each step it builds a mask of the allowed tokens and applies it before sampling.

Two costs follow:

- The first request with a new schema waits for the compile.
- Each step builds a mask, which adds CPU time for each token.

Not measured on our hardware. We have not timed the compile or the mask cost on the L4 or the GB10.

## Return tool calls

For tool calls, start the server with a parser for your model's tool format:

```bash
vllm serve Qwen/Qwen3-8B --enable-auto-tool-choice --tool-call-parser hermes
```

The parser turns the model's text into the `tool_calls` field of the response. Pick the parser that matches your model family. The vLLM documentation lists them.

## Avoid two known problems

- **Speculative decoding.** A schema and a speculation method can disagree on the next tokens. An issue on 0.31 showed invalid JSON with MTP speculation for one model, and the issue is now closed. Test your schema with and without `--speculative-config` before you rely on both.
- **Reasoning models.** A model that thinks before it answers needs the schema to apply to the answer only. Set the reasoning parser for your model, so the limit starts after the thinking ends. [The reasoning models page](#s-serve-reasoning-models) shows the flag.

## Check the result

Parse every response in your client, even with structured output on. Count the parse failures and the requests that hit `max_tokens` before the JSON closed. A response cut by the token limit is not valid JSON.

```takeaways
- Ask for a schema in the request, with response_format or structured_outputs.
- Do not use the guided_* fields, which were removed in 0.12.0.
- Test a schema with speculative decoding and with reasoning models before you rely on it.
```

Sources: the vLLM source at v0.31.0 (vllm/config/structured_outputs.py, vllm/v1/structured_output/), vLLM documentation at v0.31.0 (docs/features/structured_outputs.md, docs/features/tool_calling.md), vLLM issue 60830.
