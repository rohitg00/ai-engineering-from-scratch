---
id: request-400-max-tokens
title: A 400 for long answers
card: scenarios
kind: incident
level: 1
roles: [applied-ai-engineer, forward-deployed-ai-engineer, inference-engineer]
rounds: [screen, debugging]
tags: [http-400, max-tokens, max-model-len, kv-pool, support]
minutes: 15
lessons: []
manuals: [vllm-101#s-troubleshoot-by-symptom, vllm-101#s-count-the-memory-before-you-pick-a-gpu, vllm-101#s-fix-out-of-memory-at-startup]
practice: []
cheatsheet: []
related: [scenarios/startup-oom-shared-gpu]
updated: 2026-11-03
system:
  version: vLLM 0.31.0
  model: Qwen/Qwen3-0.6B
  hardware: the shared second L4 of a two-GPU node, with another user's processes on it
source:
  - manuals/vllm-101/capture/gpu/out-l4/livecheck-2026-10-22.txt
  - manuals/vllm-101/sections/7-1-troubleshoot-by-symptom.md
  - manuals/vllm-101/sections/2-1-count-the-memory-before-you-pick-a-gpu.md
  - manuals/vllm-101/sections/2-2-fix-out-of-memory-at-startup.md
---

## Situation

A product team runs `Qwen/Qwen3-0.6B` on one vLLM server for an internal writing tool. A support ticket arrives: "the API rejects long answers". The client sets `max_tokens` to 50000 so that the model never cuts an answer short, and every such request comes back as HTTP 400 at once, before any token streams. Shorter requests work.

The ticket asks the platform team to "turn off the limit". You pick it up with the error body, the startup log of the server and the manual.

## Evidence

- [the answer the client got](evidence/the-error.txt)
- [the pool and the maximum length of that server at startup](evidence/the-pool-at-startup.txt)
- [a request that the server cut at its own cap](evidence/a-cut-answer.txt)
- [the troubleshooting entry for this status code](evidence/the-troubleshooting-entry.txt)
- [the four choices when the pool holds too few users](evidence/four-ways-to-fit-more.txt)

## Questions

1. Read the error body. Which two numbers does it compare, and which parameter does it name?
2. Where does the server get the second number, and what does it have to do with the KV pool?
3. The ticket asks to turn off the limit. What are the two honest fixes, and who makes each change?
4. A second ticket reports the same status code, but the message names the prompt length. What is different, and what is the fix?

## Walkthrough

1. **Read the body.** The message says that `max_tokens=50000` cannot be greater than `max_model_len=40960`, and the `param` field names `max_tokens`. The server checks the numbers of a request before it schedules anything, so the 400 arrives at once and no token is generated. The client asked for more output than one request may hold.
2. **Read the startup lines.** The server derived a longest request of 40,960 tokens from the model config, and it sized its pool at 84,480 tokens from 9.02 GiB of KV cache memory. The second line says that 2.06 requests at the full length fit at once. The maximum length is a budget for one request, and the pool is the budget for everyone. A request for 50,000 output tokens would exceed the first budget on an empty server.
3. **Read what a cut answer looks like.** In the same check session a request with `max_tokens` of 64 ran, and the server stopped it with the finish reason `length`. That is how a client learns that an answer was cut: the stream ends with `length` instead of `stop`. A huge `max_tokens` is not the way to avoid a cut; the finish reason is the way to see one.
4. **Read the two shapes of the error.** The troubleshooting entry gives both. When the prompt tokens plus `max_tokens` exceed the limit, the message names the model's maximum context length and gives the counts. When `max_tokens` alone is above the limit, the message is the one in this ticket. The fix is the same pair in both cases: a shorter prompt or a smaller `max_tokens` on the client, or a larger maximum length on the server if the pool allows it.
5. **Read the order of server-side choices.** The manual lists four moves when the pool holds too few users, in order of cost, and the first is to lower the maximum length to the longest context that users send. The direction of this ticket is the opposite: raising the limit lets one request take a larger share of the pool. The startup line already said that about two full-length requests fit. A larger limit means fewer users at full length, so it is a measured decision, not a ticket closure.

## Resolution

The limit is a budget, not a bug. The client asked for 50,000 output tokens on a server whose longest request is 40,960 tokens, and the server refused before any work. The client fix is a `max_tokens` that the product needs, far below the limit, and a check of the finish reason so that a cut answer is visible to the user. That is what the 64-token check shows: the server reports `length` when it cuts.

The server fix exists, and it is conditional. Raise `--max-model-len` only after you measured the longest prompt plus answer that users send, and only if one request at that length still fits the pool next to the other users. On a pool of 84,480 tokens, each step up in the limit lowers the count of full-length requests that fit, from the 2.06 of the startup line. The startup check enforces the same rule from the other side: a server whose one full-length request does not fit refuses to start, as the shared-GPU start in the manual did at 2,928 tokens when only 2,912 fit.

## Wrong turns

- "Turn off the limit on the server." The maximum length is the KV cache that one request may take, and the pool sizes it. Without it one request can claim most of the pool and starve every other user.
- "Set max_tokens to exactly the limit." Then the prompt plus the answer exceeds the context, and the server returns the other shape of the same 400, the one that names the prompt tokens.
- "Raise the maximum length until the ticket stops." A longer limit means fewer requests fit at once. Measure the longest real request first, and check that it fits the pool.
- "Retry the request." A 400 is a check on the numbers in the request, and the same request gets the same answer.

## Generalize

A 400 from a model server is usually a budget that the operator set on purpose. Read the two numbers in the message, find which side owns each one, and change the side that is wrong: the client's request, or the server's measured limit. Never remove a limit to close a ticket, and teach clients to read the finish reason instead of asking for an unbounded answer.

## Taught in

The vLLM manual lists this status code in [the troubleshooting page](../../../manuals/vllm-101/sections/7-1-troubleshoot-by-symptom.md#a-request-returns-http-400-about-the-maximum-context-length), orders the server-side choices in [the memory counting page](../../../manuals/vllm-101/sections/2-1-count-the-memory-before-you-pick-a-gpu.md#decide-what-to-change) and shows the same budget at startup in [the out-of-memory page](../../../manuals/vllm-101/sections/2-2-fix-out-of-memory-at-startup.md#fix-a-shared-gpu).
