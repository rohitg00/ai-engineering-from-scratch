# Glossary

> This page defines each term the manual uses, with the matching SGLang term.

Use this page when a section uses a term you do not know.

| Term | Meaning | SGLang term |
|---|---|---|
| API server | the process that serves HTTP, tokenizes, and streams the answer | the tokenizer manager in the main process |
| async scheduling | planning the next step while the GPU runs the current one | the overlap scheduler |
| attention backend | the kernel family that computes attention | the attention backend |
| block | a fixed group of 16 tokens in the KV cache | a page, with a page size of 1 by default |
| block pool | all KV blocks, allocated at startup | the KV pool |
| chunked prefill | splitting a long prompt across steps | chunked prefill |
| clock floor | the lowest median SM clock that our sweep tool accepts for a run, below which it repeats the run | not an SGLang term |
| CUDA graph | a recorded sequence of kernel launches that replays with one call | a CUDA graph |
| engine core | the process that runs the scheduler and the KV cache manager | the scheduler process |
| fixed pool | a KV pool that we set by hand with `--num-gpu-blocks-override`, so that two engines get the same room | not an SGLang term |
| ITL | inter-token latency, the time between two tokens of one stream | ITL |
| knee | the concurrency where latency starts to rise fast while the output stops rising | not an SGLang term |
| KV cache | the keys and values of past tokens, kept for the next steps | the KV cache |
| KV connector | the interface that loads and saves KV blocks outside the GPU | the disaggregation transfer backend and HiCache storage |
| Model Runner V2 | the newer code that builds batches and runs the forward pass in a worker | the model runner |
| preemption | stopping a running request to free its blocks, then computing it again | retraction |
| prefix caching | reusing the KV blocks of a matching prompt prefix | the radix cache |
| reasoning parser | the server option that moves the thinking of a reasoning model out of the answer text | the reasoning parser |
| throttled | running below the full clock because the GPU is too hot or shares power with other work | not an SGLang term |
| token budget | the most tokens the scheduler gives out in one step | the chunked prefill size and the running request limit together |
| TPOT | time per output token, the mean time for each output token of a request | TPOT |
| TTFT | time to first token | TTFT |
| waves | our workload of 64 prompts at 16 users, with a length ratio that sets how much the lengths vary | not an SGLang term |
| worker | the process that holds the weights for one GPU | the TP worker |

Sources: vLLM documentation at v0.31.0 (docs/design/arch_overview.md, docs/design/prefix_caching.md), the SGLang 101 manual of this course.
