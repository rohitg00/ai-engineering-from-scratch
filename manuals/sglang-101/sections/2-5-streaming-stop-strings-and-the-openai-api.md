# Streaming, stop strings, and the OpenAI API

> SGLang checks stop conditions in the scheduler and builds text in the detokenizer, and its native /generate endpoint reports the timing and cache data that the OpenAI format leaves out.

You stream a reply to a chat window, and the last word before your stop string arrives late. Or the stop string itself leaks into the text when speculative decoding is on. Or the client shows no `cached_tokens` at all, so you cannot tell whether your prompt hit the cache. All three are decisions about where text is made and who reports what.

When you finish this section, you can choose between the native `/generate` endpoint and the OpenAI endpoints. You can read every timing field in a native response and explain why streamed text sometimes waits.

## Two APIs on one server

**Native API:** SGLang's own endpoints, mainly `POST /generate`. It takes text or token ids and `sampling_params`, and it returns a `meta_info` object with SGLang's own data.

**OpenAI API:** the `/v1/chat/completions`, `/v1/completions`, and `/v1/models` endpoints, in the format that OpenAI clients expect. The server applies the chat template before it tokenizes.

Both endpoints build the same internal request and cross the same three processes from [section 2.1](#s-sglang-serve-and-the-three-processes). The difference is what comes back.

## What the native response tells you

Our capture kit sends one native request with 12 output tokens at temperature 0.

```listing
title: one native /generate response
source: capture/out/generate.txt
lang: json
note: The output_ids list and the weight_versions list are cut.
---
{
  "text": " Paris, and the capital of Germany is Berlin. The capital",
  …
  "meta_info": {
    "id": "e272e3ffc4064bfeaa0223b86408e107",
    "finish_reason": {
      "type": "length",
      "length": 12
    },
    "prompt_tokens": 5,
    …
    "num_retractions": 0,
    …
    "queue_time": 0.0002437499351799488,
    "reasoning_tokens": 0,
    "completion_tokens": 12,
    "cached_tokens": 2,
    …
    "cached_tokens_details": {
      "device": 2,
      "host": 0
    },
    "dp_rank": null,
    "e2e_latency": 0.9496850408613682,
    …
    "first_token_latency": 0.8885334208607674,
    …
    "decode_throughput": 179.8807619469758,
    …
  }
}
```

Every field answers a question you will ask in production:

- `finish_reason` says why it stopped: `length` here, because the request asked for 12 tokens and got 12.
- `queue_time` is 0.24 ms, so the request did not wait. Under load, this number grows while requests wait in the queue.
- `first_token_latency` is 889 ms and `e2e_latency` is 950 ms. The first token cost most of the time on a cold server.
- `num_retractions` is 0. [Section 2.3](#s-admission-and-retraction) explains what a nonzero value costs.
- `cached_tokens` is 2 of 5 prompt tokens, all on the device and none from host memory.

Two cached tokens on the first request of our kit is a small mystery with a clean answer. Before it accepts traffic, the server warms up with the prompt `The capital city of France is` {{code}}. Our prompt was `The capital of France is`. The first two tokens matched the warm-up in the radix tree. The cache does not care which user sent a prefix.

## What the OpenAI response tells you

```listing
title: the OpenAI chat response
source: capture/out/generate.txt
lang: json
note: The id, the created time, and the metadata block are cut.
---
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Ardens",
        "reasoning_content": null
      },
      "logprobs": null,
      "finish_reason": "stop",
      "matched_stop": 151645
    }
  ],
  "usage": {
    "prompt_tokens": 21,
    "total_tokens": 25,
    "completion_tokens": 4,
    "prompt_tokens_details": {
      "cached_tokens": 0
    },
    "reasoning_tokens": 0
  },
```

We asked for one planet in one word. The 4-bit 0.6B model answered "Ardens", which is not a planet. Keep that in mind when you judge a serving engine with a tiny model. The engine did its job: it stopped at token 151645, the end-of-turn token, and reported `matched_stop`.

The `cached_tokens` field is there only because our server runs with `--enable-cache-report`. Without the flag, SGLang omits the cache details from OpenAI usage, even though it computes them for every request {{code}}. The native `meta_info` reports `cached_tokens` either way.

A note for Mac readers. On MLX at v0.5.22, decode is greedy unless you pass `--mlx-enable-sampling`, so `temperature`, grammar masks, and output logprobs have no effect there. The help text of `sglang serve` says so. Our kit uses temperature 0, so its outputs are the same either way. [Section 4.6](#s-deterministic-inference-and-logprobs) covers sampling and logprobs on GPUs.

## Where stop strings are checked

**Stop condition:** a rule that ends a request. It can be a stop token, a stop string, a regex, the `max_new_tokens` limit, an abort, or the end of a grammar.

SGLang checks stop conditions in the scheduler, after each step, in a fixed order {{code}}. A stop string is checked before the end-of-sequence token. The code comment gives the reason. Speculative decoding can accept more than one token in a step. A check by token would trim only the last token, and the rest of the stop string would leak into the output. The detokenizer only trims the matched stop text from the output.

```figure
id: fig-2-5
kind: sequence
title: one streamed request with a stop string
claim: The scheduler decides when a request stops, the detokenizer turns ids into text, and the output streamer holds back text that could start a stop string.
caption: Read top to bottom. Blue lifelines are SGLang processes, the olive lifeline is the client, dotted indigo arrows are streamed chunks. Behaviour from schedule_batch.py, output_streamer.py, and detokenizer_manager.py at v0.5.22.
```

## Why streamed text waits

Two rules can delay a chunk {{code}}:

- **Incomplete characters.** The detokenizer decodes incrementally with two offsets per request. If the new text ends in an incomplete UTF-8 character, it waits for the next token before it sends anything.
- **A possible stop string.** If the tail of the text could be the start of a stop string, the output streamer holds it back. If the next tokens complete the stop string, the text never appears. If they do not, the held text goes out with the next chunk.

With the default `--stream-interval 1`, SGLang streams after every step. A non-streaming request still sends progress inside the server every 50 tokens, `SGLANG_FORCE_STREAM_INTERVAL`, so the TokenizerManager can track it {{code}}.

## An incident: the detokenizer that never moved

The incomplete-character rule has a cost when the tokens never complete a character {{issue #34740}}. The detokenizer waits while the text ends in the replacement character U+FFFD. Byte tokens that never complete a character never advance the offsets. Every step then decodes the whole tail again, and the work grows with the square of the length. The report found it with a test setting that fills id 100, which decodes to U+FFFD on DeepSeek-V4-Pro. The issue was open when we checked.

## Our position

Use the native `/generate` endpoint when you debug, measure, or build your own client. Its `meta_info` tells you queue time, first token latency, cache hits, and retractions per request. The OpenAI format has no place for most of that.

Use the OpenAI endpoints for applications that already speak that format. Start every server with `--enable-cache-report`, so those clients can see cache hits too. We did not measure a cost, and [part 3](#s-prefix-friendly-prompts) shows how much the number is worth.

```takeaways
- Debug and measure with /generate and read its meta_info fields.
- Start servers with --enable-cache-report so OpenAI clients see cached_tokens.
- Expect streamed text to wait when its tail could start a stop string.
- Judge the engine and the model separately when a small model answers wrong.
```

Sources: python/sglang/srt/entrypoints/http_server.py (warm-up prompt, /generate), python/sglang/srt/entrypoints/openai/serving_chat.py (enable_cache_report), python/sglang/srt/managers/schedule_batch.py (update_finish_state, check_match_stop_str_prefix), python/sglang/srt/managers/scheduler_components/output_streamer.py, python/sglang/srt/managers/detokenizer_manager.py, python/sglang/srt/environ.py (SGLANG_FORCE_STREAM_INTERVAL), python/sglang/srt/arg_groups/fields/serving.py at v0.5.22; capture/out/generate.txt and capture/one_request.py; capture/out/serve-help.txt for --mlx-enable-sampling; issue https://github.com/sgl-project/sglang/issues/34740.
