# --grammar-backend and structured outputs

> SGLang turns a JSON schema or regex into a token mask for every decode step, and compiles each grammar outside the batch loop.

Your agent asks the model for a tool call and parses the reply with `json.loads`. Most replies parse. A few have a missing brace, a trailing comment, or a field the schema does not allow, and the agent retries. Each retry costs a full generation and a full round trip, and the slow tail of your latency is now made of retries.

When you finish this section, you can constrain output with a JSON schema, a regex, or an EBNF grammar. You can also explain what the mask costs, read the grammar queue, and decide what to check after generation.

## The obvious fix, and why it fails

The obvious fix is to validate after generation and retry on failure. That works and stays slow. It also fails in the cases you care about most. At temperature 0, a retry of the same prompt gives the same broken reply.

**Constrained decoding:** removing every token that would break the grammar before the sampler picks one. The output then satisfies every rule that the backend enforces, so those rules become a property of the server.

## What SGLang does

A request carries one constraint in its sampling parameters: `json_schema`, `regex`, `ebnf`, or `structural_tag`. The OpenAI chat API maps `response_format` to the same fields. `--grammar-backend` picks the engine that compiles it. The default at v0.5.22 is `xgrammar`, and `outlines`, `llguidance`, and `none` are the other choices.

```figure
id: fig-4-8
kind: flow
title: one constrained request from arrival to sampling
claim: A schema compiles once in a thread pool while the request waits in the grammar queue, then masks the logits at every decode step.
caption: Read left to right. The cache key is the constraint type and its text. A cache hit skips the thread pool. From GrammarManager and ModelRunner._preprocess_logits at v0.5.22.
```

1. **Look up.** The grammar manager builds a key from the constraint type and its text, such as `("json", schema)`. A compiled grammar for that key comes back from the cache at once.
2. **Compile.** On a miss, compilation starts in a thread pool and returns a future. The request moves to the grammar queue instead of the waiting queue.
3. **Admit.** Each scheduler loop polls the futures. With tensor or data parallelism, a request is admitted only when its grammar is ready on every rank. It fails if compilation failed on any rank. An invalid grammar is cached as invalid, so the next request with the same schema fails at once.
4. **Mask.** At every step the grammar fills a vocabulary bitmask, and the model runner applies it to the logits before sampling. With the overlap scheduler, the mask for the next step is built while the GPU runs the current one.
5. **Advance.** After sampling, the grammar accepts the chosen token. With speculative decoding, it rolls back the rejected draft tokens.

On Apple silicon, the MLX runtime applies grammar masks only with `--mlx-enable-sampling`. Without that flag every decode step takes the highest logit, as [section 4.6](#s-deterministic-inference-and-logprobs) shows from the help text.

**Grammar queue:** the list of requests whose grammar is still compiling. `/metrics` exports its length as `sglang:num_grammar_queue_reqs`.

## Jump-forward is not active at v0.5.22

The SGLang paper describes jump-forward decoding. When the grammar allows only one continuation, such as the fixed text `{"name": "`, the server writes it without running the model. The grammar classes at v0.5.22 still have the jump-forward methods. A search of the runtime finds no caller outside the grammar classes. The scheduler does not use them, so expect one forward per token even inside fixed text. We read this in the code and did not run a timing test.

## What to measure

Measure three things on your own schemas. First, the time to first token for the first request with a new schema against the second request with the same schema. The difference is compile time. Second, inter-token latency with and without the constraint at your real concurrency. The mask costs CPU time on every step. Third, the grammar queue length under load.

A field report by Varad More {{field Varad More 2026-04}} measured structured generation on one A10G across 16 models from 2B to 9B. On 14 of the 16, vLLM was faster. The report does not separate compile time from per-token cost, so read it as a reason to measure, not as a verdict.

## What we measured on a GB10

We ran a small probe against `Qwen/Qwen3-30B-A3B-Instruct-2507` on one NVIDIA GB10, with the default `xgrammar` backend. The probe asks "Describe one GPU for a model server as a JSON object." five times, one request at a time. The schema has four required fields, an integer `memory_gb` from 1 to 1024, an `enum` for the vendor, and no extra properties.

| Request | Constraint | Latency | Completion tokens | Valid |
|---|---|---|---|---|
| 1 | none | 3,943.9 ms | 128 | no schema |
| 2 | a new schema | 1,636.6 ms | 41 | yes |
| 3 | the same schema | 1,309.2 ms | 41 | yes |
| 4 | the same schema | 1,310.9 ms | 41 | yes |
| 5 | a second new schema | 1,291.1 ms | 41 | yes |

**We measured** one run, so read the table as a direction. Every constrained reply was valid JSON with exactly the four fields. The unconstrained reply ran to the 128-token limit and invented its own keys, such as `gpu_id` and `power_consumption`.

The first constrained request cost about 330 ms more than the repeats. The second new schema showed no such cost. Our reading is that the first cost belongs to the first grammar after startup. The compile of one small schema was too short to see next to a decode of 41 tokens.

The schema fixed the shape and not the facts. The constrained replies named an "NVIDIA A100" with 40 GB, and the unconstrained one gave it "80 GB GDDR6". A grammar checks syntax, and your validator still checks meaning.

## Our position

Constrain every response that a program parses. A mask adds work to each step, and a retry repeats the whole request. We did not measure the cost of the mask per step.

Do not trust the grammar backend to enforce every JSON Schema keyword. Test each keyword your consumer depends on, such as `minLength`, `pattern`, `minimum`, and `enum`, with a request that tries to break it. Keep a cheap validator behind the server for the fields that matter.

Send one constrained request after every deploy, so the first user request does not pay the startup cost of the grammar backend. On the GB10 that first request paid about 330 ms. Our probe showed no extra cost for a second, new small schema.

## Incidents

**A schema rule was dropped without an error.** Issue #37707 (2026-09-03): with xgrammar, a string field accepted values shorter than its `minLength` when the same field also had a `pattern`. The same report says outlines dropped `pattern` and numeric bounds. The issue was open when this manual was verified.

**Grammar work grew with output length under speculation.** Issue #38863 (2026-09-10): with speculative decoding, the host CPU time to build bitmasks grew with the length of the output. The cause was a rollback method that copied a debug list on every call. The issue was open as a performance report.

```takeaways
- Use json_schema or response_format for every response that a program parses.
- Test each JSON Schema keyword you rely on with a request designed to break it.
- Send one constrained request after deploy so users do not pay the first grammar cost.
- Watch sglang:num_grammar_queue_reqs when you add new schemas under load.
```

Sources: capture/out/serve-help.txt, capture/gpu/out-gb10/structured.txt, capture/gpu/structured_probe.py, python/sglang/srt/constrained/grammar_manager.py (process_req_with_grammar, get_ready_grammar_requests), constrained/base_grammar_backend.py, constrained/xgrammar_backend.py, model_executor/model_runner.py (_preprocess_logits), sampling/sampling_params.py, arg_groups/serving_hook.py (handle_grammar_backend), arg_groups/choices.py (GRAMMAR_BACKEND_CHOICES), and observability/metrics_collector.py at v0.5.22; SGLang paper (arXiv 2312.07104); issues #37707 and #38863; field report by Varad More (2026-04-22).
